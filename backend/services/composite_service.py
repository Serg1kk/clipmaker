"""
Video Compositing Service for AI Clips

This module provides video compositing functionality using FFmpeg filter_complex
to combine multiple cropped and scaled video sources into a 9:16 vertical layout.

Features:
- Multi-video compositing with template-based layouts
- Crop and scale transformations with precise coordinate control
- Overlay-based layering with z-order support
- Audio handling (single source, mix, or mute)
- Progress callbacks for real-time updates
- Comprehensive error handling

Usage:
    from services.composite_service import CompositeService
    from models import CompositeRequest, create_vertical_split_template

    service = CompositeService()
    template = create_vertical_split_template()

    request = CompositeRequest(
        template=template,
        sources=[...],
        output_path="/output/composite.mp4"
    )

    output_path = await service.composite_video(request)
"""

import asyncio
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional, Tuple, Union

from models.composite_schemas import (
    AudioMixMode,
    BlendMode,
    CompositeRequest,
    CompositeTemplate,
    ScaleMode,
    SourceRegion,
    TemplateSlot,
    VideoSource,
)
from services.ffmpeg_service import (
    FFmpegError,
    FFmpegNotFoundError,
    FFmpegService,
    DiskSpaceError,
    ExtractionTimeoutError,
    VideoInfo,
)

# Configure logging
logger = logging.getLogger(__name__)


class CompositeError(FFmpegError):
    """Base exception for video compositing errors."""
    pass


class InvalidTemplateError(CompositeError):
    """Raised when template definition is invalid."""
    pass


class SlotMismatchError(CompositeError):
    """Raised when video inputs don't match template slots."""
    pass


class FilterBuildError(CompositeError):
    """Raised when filter_complex string cannot be built."""
    pass


@dataclass
class CompositeProgress:
    """Progress information for composite operation."""
    percent: float
    current_frame: int
    total_frames: int
    speed: float
    eta_seconds: Optional[float]
    phase: str  # "preparing", "compositing", "encoding", "finalizing"

    def to_dict(self) -> dict:
        return {
            "percent": round(self.percent, 2),
            "current_frame": self.current_frame,
            "total_frames": self.total_frames,
            "speed": round(self.speed, 2),
            "eta_seconds": round(self.eta_seconds, 1) if self.eta_seconds else None,
            "phase": self.phase,
        }


# Type alias for progress callback
CompositeProgressCallback = Callable[[CompositeProgress], None]


class FilterComplexBuilder:
    """
    Builder for FFmpeg filter_complex strings.

    Handles the complexity of multi-input video compositing with proper
    stream labeling, filter chaining, and layered overlay composition.

    The builder creates filter graphs that:
    1. Generate a base canvas with background color
    2. Process each input video (crop, scale, format)
    3. Overlay processed videos onto the canvas by z-order
    4. Handle audio mixing/selection
    """

    def __init__(
        self,
        canvas_width: int,
        canvas_height: int,
        background_color: str = "#000000",
        output_fps: float = 30.0,
    ):
        """
        Initialize the filter builder.

        Args:
            canvas_width: Output canvas width in pixels
            canvas_height: Output canvas height in pixels
            background_color: Background color in hex format (#RRGGBB)
            output_fps: Output frame rate
        """
        self.canvas_width = canvas_width
        self.canvas_height = canvas_height
        self.background_color = background_color
        self.output_fps = output_fps
        self.filters: List[str] = []
        self._label_counter = 0

    def _next_label(self, prefix: str = "tmp") -> str:
        """Generate a unique stream label."""
        label = f"{prefix}{self._label_counter}"
        self._label_counter += 1
        return label

    def add_background(self, duration: float = 999.0) -> str:
        """
        Generate background color source filter.

        Args:
            duration: Duration of the color source in seconds

        Returns:
            Output stream label for the background
        """
        # Convert hex color to FFmpeg format (0xRRGGBB)
        color = self.background_color.lstrip('#')
        self.filters.append(
            f"color=c=0x{color}:s={self.canvas_width}x{self.canvas_height}"
            f":d={duration}:r={self.output_fps}[bg]"
        )
        return "[bg]"

    def add_video_input(
        self,
        input_index: int,
        source_region: SourceRegion,
        slot: TemplateSlot,
        source_info: Optional[VideoInfo] = None,
    ) -> str:
        """
        Add video input processing filters (crop, scale, format).

        Args:
            input_index: FFmpeg input index
            source_region: Crop region definition
            slot: Target slot for scaling
            source_info: Video metadata for smart scaling

        Returns:
            Output stream label for the processed video
        """
        output_label = f"v{input_index}"
        filter_chain: List[str] = []

        # Crop filter (if crop region is defined)
        crop_filter = source_region.get_crop_filter()
        if crop_filter:
            filter_chain.append(crop_filter)

        # Scale filter based on slot settings
        source_width = source_region.source_width or (source_region.crop_width or 1920)
        source_height = source_region.source_height or (source_region.crop_height or 1080)

        if source_region.crop_width and source_region.crop_height:
            source_width = source_region.crop_width
            source_height = source_region.crop_height

        scale_filter = slot.get_scale_filter(source_width, source_height)
        if scale_filter:
            filter_chain.append(scale_filter)

        # Ensure even dimensions for encoding compatibility
        filter_chain.append("setsar=1")

        # Frame rate normalization
        filter_chain.append(f"fps={self.output_fps}")

        # Format for overlay compatibility
        filter_chain.append("format=yuva420p")

        # Opacity handling
        if slot.opacity < 1.0:
            alpha_value = slot.opacity
            filter_chain.append(f"colorchannelmixer=aa={alpha_value}")

        # Build the complete filter chain
        full_filter = f"[{input_index}:v]{','.join(filter_chain)}[{output_label}]"
        self.filters.append(full_filter)

        return f"[{output_label}]"

    def add_overlay_chain(
        self,
        base_label: str,
        video_labels: List[str],
        slots: List[TemplateSlot],
        output_label: str = "out",
    ) -> str:
        """
        Build overlay chain to composite videos onto the base.

        Videos are overlaid in order, with later videos appearing on top.
        This respects z-order as the caller should provide sorted inputs.

        Args:
            base_label: Input label for base canvas (e.g., "[bg]")
            video_labels: List of video stream labels to overlay
            slots: Corresponding slots with position info
            output_label: Final output stream label

        Returns:
            Output stream label
        """
        if not video_labels:
            # No overlays, just output the base
            self.filters.append(f"{base_label}null[{output_label}]")
            return f"[{output_label}]"

        current_base = base_label

        for i, (video_label, slot) in enumerate(zip(video_labels, slots)):
            is_last = i == len(video_labels) - 1
            next_label = output_label if is_last else self._next_label("ov")

            overlay_params = [
                f"x={slot.x}",
                f"y={slot.y}",
            ]

            # Blend mode support (requires format conversion)
            # Note: Complex blend modes require additional filter setup

            overlay_filter = f"{current_base}{video_label}overlay={':'.join(overlay_params)}[{next_label}]"
            self.filters.append(overlay_filter)
            current_base = f"[{next_label}]"

        return f"[{output_label}]"

    def add_audio_select(self, input_index: int, volume: float = 1.0) -> str:
        """
        Select audio from a single input.

        Args:
            input_index: FFmpeg input index
            volume: Volume multiplier

        Returns:
            Output stream label for the audio
        """
        label = f"a{input_index}"

        if volume != 1.0:
            self.filters.append(
                f"[{input_index}:a]volume={volume}[{label}]"
            )
        else:
            self.filters.append(f"[{input_index}:a]anull[{label}]")

        return f"[{label}]"

    def add_audio_mix(
        self,
        input_indices: List[int],
        volumes: Optional[List[float]] = None,
        output_label: str = "aout",
    ) -> str:
        """
        Mix audio from multiple inputs.

        Args:
            input_indices: List of FFmpeg input indices with audio
            volumes: Volume levels for each input (defaults to 1.0)
            output_label: Output stream label

        Returns:
            Output stream label for mixed audio
        """
        if not input_indices:
            return ""

        if len(input_indices) == 1:
            return self.add_audio_select(input_indices[0], volumes[0] if volumes else 1.0)

        volumes = volumes or [1.0] * len(input_indices)

        # Apply volume to each input
        processed_labels = []
        for i, (idx, vol) in enumerate(zip(input_indices, volumes)):
            label = f"a{i}"
            if vol != 1.0:
                self.filters.append(f"[{idx}:a]volume={vol}[{label}]")
            else:
                self.filters.append(f"[{idx}:a]anull[{label}]")
            processed_labels.append(f"[{label}]")

        # Mix all audio streams
        inputs_str = "".join(processed_labels)
        self.filters.append(
            f"{inputs_str}amix=inputs={len(input_indices)}:duration=longest"
            f":dropout_transition=0[{output_label}]"
        )

        return f"[{output_label}]"

    def build(self) -> str:
        """
        Build the complete filter_complex string.

        Returns:
            The FFmpeg filter_complex string
        """
        return ";".join(self.filters)


class CompositeService:
    """
    Service class for video compositing operations.

    Provides async methods for compositing multiple video sources
    according to template layouts, with support for cropping, scaling,
    layering, and audio handling.
    """

    # Default settings
    DEFAULT_TIMEOUT = 7200  # 2 hours for long videos
    DEFAULT_VIDEO_CODEC = "libx264"
    DEFAULT_AUDIO_CODEC = "aac"
    DEFAULT_VIDEO_BITRATE = "8M"
    DEFAULT_AUDIO_BITRATE = "192k"
    DEFAULT_PRESET = "medium"
    DEFAULT_CRF = 23
    MAX_SOURCES = 10

    # Codec mappings
    CODEC_MAP = {
        "h264": "libx264",
        "hevc": "libx265",
        "h265": "libx265",
        "vp9": "libvpx-vp9",
        "av1": "libaom-av1",
    }

    def __init__(
        self,
        ffmpeg_path: Optional[str] = None,
        ffprobe_path: Optional[str] = None,
        output_dir: Optional[Union[str, Path]] = None,
    ):
        """
        Initialize the composite service.

        Args:
            ffmpeg_path: Custom path to FFmpeg binary
            ffprobe_path: Custom path to FFprobe binary
            output_dir: Default directory for output files
        """
        # Delegate to FFmpegService for binary management
        self._ffmpeg_service = FFmpegService(
            ffmpeg_path=ffmpeg_path,
            ffprobe_path=ffprobe_path,
            output_dir=output_dir,
        )
        self.ffmpeg_path = self._ffmpeg_service.ffmpeg_path
        self.ffprobe_path = self._ffmpeg_service.ffprobe_path
        self.output_dir = self._ffmpeg_service.output_dir

    def is_available(self) -> bool:
        """Check if FFmpeg is available."""
        return self._ffmpeg_service.is_available()

    def _check_ffmpeg_available(self) -> None:
        """Raise error if FFmpeg is not available."""
        if not self.is_available():
            raise FFmpegNotFoundError(
                "FFmpeg is not installed or not found in PATH. "
                "Please install FFmpeg: https://ffmpeg.org/download.html"
            )

    def _validate_request(self, request: CompositeRequest) -> None:
        """
        Validate a composite request.

        Args:
            request: The composite request to validate

        Raises:
            InvalidTemplateError: If template is invalid
            SlotMismatchError: If sources don't match slots
            ValueError: For other validation errors
        """
        # Check source count
        if len(request.sources) == 0:
            raise ValueError("At least one video source is required")

        if len(request.sources) > self.MAX_SOURCES:
            raise ValueError(f"Maximum {self.MAX_SOURCES} sources allowed")

        # Validate template slots
        issues = request.template.validate_slots_within_canvas()
        if issues:
            raise InvalidTemplateError(
                f"Template validation failed: {'; '.join(issues)}"
            )

        # Validate source-slot mapping (already done by Pydantic model_validator)
        # Additional validation: check source files exist
        for source in request.sources:
            source_path = Path(source.source_region.source_path)
            if not source_path.exists():
                raise FileNotFoundError(
                    f"Source video not found: {source_path}"
                )

    async def _get_source_infos(
        self,
        sources: List[VideoSource],
    ) -> List[VideoInfo]:
        """
        Get video info for all sources in parallel.

        Args:
            sources: List of video sources

        Returns:
            List of VideoInfo objects
        """
        tasks = [
            self._ffmpeg_service.get_video_info(
                source.source_region.source_path
            )
            for source in sources
        ]
        return await asyncio.gather(*tasks)

    def _build_filter_complex(
        self,
        request: CompositeRequest,
        source_infos: List[VideoInfo],
        duration: float,
    ) -> Tuple[str, str, Optional[str]]:
        """
        Build the filter_complex string for compositing.

        Args:
            request: The composite request
            source_infos: Video info for each source
            duration: Target duration in seconds

        Returns:
            Tuple of (filter_complex string, video output label, audio output label)
        """
        template = request.template

        builder = FilterComplexBuilder(
            canvas_width=template.output_width,
            canvas_height=template.output_height,
            background_color=template.background_color,
            output_fps=template.output_fps,
        )

        # 1. Add background canvas
        bg_label = builder.add_background(duration=duration)

        # 2. Process each video source
        # Sort sources by z-order for proper layering
        sorted_sources = request.get_sources_by_z_order()

        video_labels = []
        slots = []
        input_index_map = {}  # Map source_id to input index

        for i, (source, slot) in enumerate(sorted_sources):
            input_index_map[source.source_id] = i

            video_label = builder.add_video_input(
                input_index=i,
                source_region=source.source_region,
                slot=slot,
                source_info=source_infos[i] if i < len(source_infos) else None,
            )
            video_labels.append(video_label)
            slots.append(slot)

        # 3. Build overlay chain
        video_output = builder.add_overlay_chain(
            base_label=bg_label,
            video_labels=video_labels,
            slots=slots,
            output_label="vout",
        )

        # 4. Handle audio
        audio_output = None

        if request.audio_mix_mode == AudioMixMode.MUTE:
            audio_output = None
        elif request.audio_mix_mode == AudioMixMode.SINGLE:
            audio_source = request.get_audio_source()
            if audio_source and audio_source.source_id in input_index_map:
                input_idx = input_index_map[audio_source.source_id]
                audio_output = builder.add_audio_select(
                    input_idx,
                    volume=audio_source.audio_volume,
                )
        elif request.audio_mix_mode == AudioMixMode.MIX:
            audio_indices = []
            volumes = []
            for source, _ in sorted_sources:
                if source.audio_enabled and source.source_id in input_index_map:
                    audio_indices.append(input_index_map[source.source_id])
                    volumes.append(source.audio_volume)

            if audio_indices:
                audio_output = builder.add_audio_mix(
                    audio_indices,
                    volumes=volumes,
                    output_label="aout",
                )

        return builder.build(), video_output, audio_output

    def _build_command(
        self,
        request: CompositeRequest,
        filter_complex: str,
        video_output: str,
        audio_output: Optional[str],
        duration: float,
    ) -> List[str]:
        """
        Build the complete FFmpeg command.

        Args:
            request: The composite request
            filter_complex: The filter_complex string
            video_output: Video output stream label
            audio_output: Audio output stream label (or None)
            duration: Target duration

        Returns:
            FFmpeg command as list of strings
        """
        cmd = [self.ffmpeg_path, "-y"]

        # Add input files in z-order
        sorted_sources = request.get_sources_by_z_order()
        for source, _ in sorted_sources:
            region = source.source_region

            # Add trim args before input
            trim_args = region.get_trim_args()
            cmd.extend(trim_args)

            cmd.extend(["-i", str(region.source_path)])

        # Add filter complex
        cmd.extend(["-filter_complex", filter_complex])

        # Map outputs
        # Remove brackets from labels for -map
        video_label = video_output.strip("[]")
        cmd.extend(["-map", f"[{video_label}]"])

        if audio_output:
            audio_label = audio_output.strip("[]")
            cmd.extend(["-map", f"[{audio_label}]"])

        # Video codec settings
        codec = self.CODEC_MAP.get(
            request.output_codec,
            request.output_codec
        )
        cmd.extend(["-c:v", codec])

        # Bitrate and quality
        cmd.extend(["-b:v", f"{request.output_bitrate}k"])
        cmd.extend(["-preset", request.output_preset])

        # Pixel format for compatibility
        cmd.extend(["-pix_fmt", "yuv420p"])

        # Duration limit
        if request.duration_limit:
            cmd.extend(["-t", str(request.duration_limit)])
        else:
            cmd.extend(["-t", str(duration)])

        # Audio settings
        if audio_output:
            cmd.extend(["-c:a", request.audio_codec])
            cmd.extend(["-b:a", f"{request.audio_bitrate}k"])
        else:
            cmd.extend(["-an"])  # No audio

        # Fast start for web playback
        cmd.extend(["-movflags", "+faststart"])

        # Output path
        cmd.append(str(request.output_path))

        return cmd

    def _parse_progress(
        self,
        line: str,
        total_duration: float,
        total_frames: int,
    ) -> Optional[CompositeProgress]:
        """
        Parse FFmpeg progress output.

        Args:
            line: Stderr line from FFmpeg
            total_duration: Total expected duration
            total_frames: Total expected frames

        Returns:
            CompositeProgress object or None
        """
        # Parse frame number
        frame_match = re.search(r"frame=\s*(\d+)", line)
        if not frame_match:
            return None

        current_frame = int(frame_match.group(1))

        # Parse speed
        speed_match = re.search(r"speed=\s*([\d.]+)x", line)
        speed = float(speed_match.group(1)) if speed_match else 1.0

        # Calculate progress
        percent = (current_frame / total_frames * 100) if total_frames > 0 else 0
        percent = min(percent, 100.0)

        # Calculate ETA
        eta_seconds = None
        if speed > 0 and total_frames > 0:
            remaining_frames = total_frames - current_frame
            frames_per_second = speed * 30  # Approximate
            if frames_per_second > 0:
                eta_seconds = remaining_frames / frames_per_second

        # Determine phase
        if percent < 10:
            phase = "preparing"
        elif percent < 90:
            phase = "compositing"
        elif percent < 99:
            phase = "encoding"
        else:
            phase = "finalizing"

        return CompositeProgress(
            percent=percent,
            current_frame=current_frame,
            total_frames=total_frames,
            speed=speed,
            eta_seconds=eta_seconds,
            phase=phase,
        )

    async def composite_video(
        self,
        request: CompositeRequest,
        progress_callback: Optional[CompositeProgressCallback] = None,
        timeout: Optional[int] = None,
    ) -> Path:
        """
        Composite multiple videos according to a template layout.

        This is the main entry point for video compositing. It:
        1. Validates the request
        2. Gathers video metadata
        3. Builds the filter_complex string
        4. Executes FFmpeg
        5. Returns the output path

        Args:
            request: The composite request with template, sources, output path
            progress_callback: Optional callback for progress updates
            timeout: Maximum processing time in seconds

        Returns:
            Path to the output video file

        Raises:
            FFmpegNotFoundError: If FFmpeg is not installed
            InvalidTemplateError: If template is invalid
            SlotMismatchError: If sources don't match template slots
            FileNotFoundError: If source videos not found
            CompositeError: If compositing fails
        """
        self._check_ffmpeg_available()
        self._validate_request(request)

        output_path = Path(request.output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Check disk space
        total_input_size = sum(
            Path(s.source_region.source_path).stat().st_size
            for s in request.sources
        )
        estimated_output_mb = (total_input_size // (1024 * 1024)) * 2
        self._ffmpeg_service._check_disk_space(
            output_path.parent,
            max(estimated_output_mb, 500),
        )

        # Get video info for all sources
        source_infos = await self._get_source_infos(request.sources)

        # Determine output duration
        sorted_sources = request.get_sources_by_z_order()
        durations = []
        for i, (source, _) in enumerate(sorted_sources):
            region = source.source_region
            if region.duration is not None:
                durations.append(region.duration)
            elif i < len(source_infos):
                durations.append(source_infos[i].duration)

        # Use shortest duration or duration_limit
        duration = min(durations) if durations else 60.0
        if request.duration_limit:
            duration = min(duration, request.duration_limit)

        # Calculate total frames for progress
        total_frames = int(duration * request.template.output_fps)

        # Build filter complex
        filter_complex, video_output, audio_output = self._build_filter_complex(
            request,
            source_infos,
            duration,
        )

        # Build command
        cmd = self._build_command(
            request,
            filter_complex,
            video_output,
            audio_output,
            duration,
        )

        logger.info(f"Starting video composite: {len(request.sources)} sources -> {output_path}")
        logger.debug(f"Filter complex: {filter_complex}")
        logger.debug(f"FFmpeg command: {' '.join(cmd)}")

        timeout = timeout or self.DEFAULT_TIMEOUT

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stderr_lines = []
            last_progress = None

            async def read_stderr():
                """Read stderr for progress and error messages."""
                nonlocal last_progress
                while True:
                    line = await process.stderr.readline()
                    if not line:
                        break
                    line_str = line.decode("utf-8", errors="replace").strip()
                    stderr_lines.append(line_str)

                    # Parse progress
                    if progress_callback:
                        progress = self._parse_progress(
                            line_str,
                            duration,
                            total_frames,
                        )
                        if progress and (
                            last_progress is None or
                            progress.percent - last_progress.percent >= 0.5
                        ):
                            last_progress = progress
                            try:
                                progress_callback(progress)
                            except Exception as e:
                                logger.warning(f"Progress callback error: {e}")

            async def read_stdout():
                """Read stdout (if any progress output)."""
                while True:
                    line = await process.stdout.readline()
                    if not line:
                        break

            # Run readers concurrently with timeout
            try:
                await asyncio.wait_for(
                    asyncio.gather(read_stderr(), read_stdout(), process.wait()),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                raise ExtractionTimeoutError(
                    f"Video compositing timed out after {timeout} seconds",
                    stderr="\n".join(stderr_lines[-20:]),
                )

            if process.returncode != 0:
                raise CompositeError(
                    f"Video compositing failed with return code {process.returncode}",
                    stderr="\n".join(stderr_lines[-30:]),
                    return_code=process.returncode,
                )

            # Send final progress
            if progress_callback:
                progress_callback(CompositeProgress(
                    percent=100.0,
                    current_frame=total_frames,
                    total_frames=total_frames,
                    speed=last_progress.speed if last_progress else 1.0,
                    eta_seconds=0,
                    phase="complete",
                ))

            logger.info(f"Video compositing completed: {output_path}")
            return output_path

        except (OSError, FileNotFoundError) as e:
            raise CompositeError(f"Failed to run FFmpeg: {e}")


# Convenience function for direct usage
async def composite_video(
    request: CompositeRequest,
    progress_callback: Optional[CompositeProgressCallback] = None,
) -> Path:
    """
    Convenience function to composite videos.

    Args:
        request: The composite request
        progress_callback: Optional progress callback

    Returns:
        Path to the output video file
    """
    service = CompositeService()
    return await service.composite_video(request, progress_callback)
