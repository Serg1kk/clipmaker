"""
Final Clip Render Service for AI Clips

This module provides a unified rendering pipeline that combines:
- Moment timerange extraction from TranscriptionMoment
- Video compositing via CompositeService
- ASS subtitle burning with word-by-word karaoke timing
- Audio track merging
- MP4 output to /output folder

Usage:
    from services.render_service import RenderService, RenderRequest

    service = RenderService()

    request = RenderRequest(
        moment=moment,  # TranscriptionMoment with start/end times
        source_video_path="/path/to/video.mp4",
        subtitle_words=words,  # Word-level timestamps for karaoke
        output_filename="my_clip.mp4",
    )

    output_path = await service.render_final_clip(request)
"""

import asyncio
import logging
import os
import tempfile
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Union
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator

from models.transcription_moment import TranscriptionMoment
from models.composite_schemas import (
    AudioMixMode,
    CompositeRequest,
    CompositeTemplate,
    ScaleMode,
    SourceRegion,
    TemplateSlot,
    VideoSource,
    create_vertical_split_template,
    create_pip_template,
    get_preset_template,
)
from services.composite_service import (
    CompositeService,
    CompositeError,
    CompositeProgress,
)
from services.ffmpeg_service import (
    FFmpegService,
    FFmpegError,
    FFmpegNotFoundError,
    VideoInfo,
    ExtractionTimeoutError,
)
from services.karaoke_generator import (
    generate_karaoke_ass,
    generate_karaoke_ass_multiline,
    generate_word_by_word_ass,
    KaraokeStyle,
    KaraokeConfig,
    ASSAlignment,
    KaraokeEffect,
)

# Configure logging
logger = logging.getLogger(__name__)


class RenderError(Exception):
    """Base exception for render service errors."""
    def __init__(self, message: str, details: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.details = details


class SubtitleBurnError(RenderError):
    """Raised when subtitle burning fails."""
    pass


class AudioMergeError(RenderError):
    """Raised when audio merging fails."""
    pass


class MomentExtractionError(RenderError):
    """Raised when moment extraction fails."""
    pass


class SubtitlePosition(str, Enum):
    """Preset positions for subtitles."""
    BOTTOM_CENTER = "bottom_center"
    TOP_CENTER = "top_center"
    MIDDLE_CENTER = "middle_center"
    CUSTOM = "custom"


class AudioMode(str, Enum):
    """Audio handling modes for the final render."""
    ORIGINAL = "original"      # Use original video audio only
    REPLACE = "replace"        # Replace with external audio track
    MIX = "mix"                # Mix original with external audio
    MUTE = "mute"              # No audio output


@dataclass
class RenderProgress:
    """Progress information for render operation."""
    phase: str  # "extracting", "compositing", "subtitles", "audio", "finalizing"
    percent: float
    current_step: int
    total_steps: int
    message: str

    def to_dict(self) -> dict:
        return {
            "phase": self.phase,
            "percent": round(self.percent, 2),
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "message": self.message,
        }


# Type alias for progress callback
RenderProgressCallback = Callable[[RenderProgress], None]


class SubtitleConfig(BaseModel):
    """Configuration for subtitle burning."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "enabled": True,
                "font_name": "Arial",
                "font_size": 48,
                "primary_color": "#FFFF00",
                "secondary_color": "#FFFFFF",
                "outline_color": "#000000",
                "position": "bottom_center",
                "margin_vertical": 50,
            }
        }
    )

    enabled: bool = Field(default=True, description="Whether to burn subtitles")
    font_name: str = Field(default="Arial", description="Font family name")
    font_size: int = Field(default=48, gt=0, description="Font size in pixels")
    primary_color: str = Field(
        default="#FFFF00",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Highlight color (after karaoke)"
    )
    secondary_color: str = Field(
        default="#FFFFFF",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Pre-highlight color (before karaoke)"
    )
    outline_color: str = Field(
        default="#000000",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Outline/border color"
    )
    outline_width: float = Field(default=2.0, ge=0, description="Outline thickness")
    shadow_depth: float = Field(default=1.0, ge=0, description="Shadow distance")
    position: SubtitlePosition = Field(
        default=SubtitlePosition.BOTTOM_CENTER,
        description="Subtitle position preset"
    )
    custom_x: Optional[int] = Field(default=None, description="Custom X position")
    custom_y: Optional[int] = Field(default=None, description="Custom Y position")
    margin_vertical: int = Field(default=50, ge=0, description="Vertical margin")
    karaoke_effect: str = Field(
        default="sweep",
        description="Karaoke effect type (sweep, instant, outline)"
    )
    bold: bool = Field(default=False, description="Bold text")


class AudioConfig(BaseModel):
    """Configuration for audio handling."""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "mode": "original",
                "external_audio_path": None,
                "original_volume": 1.0,
                "external_volume": 0.5,
            }
        }
    )

    mode: AudioMode = Field(
        default=AudioMode.ORIGINAL,
        description="Audio handling mode"
    )
    external_audio_path: Optional[str] = Field(
        default=None,
        description="Path to external audio track"
    )
    original_volume: float = Field(
        default=1.0,
        ge=0.0,
        le=2.0,
        description="Volume for original audio (0.0-2.0)"
    )
    external_volume: float = Field(
        default=1.0,
        ge=0.0,
        le=2.0,
        description="Volume for external audio (0.0-2.0)"
    )
    fade_in: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Audio fade-in duration in seconds"
    )
    fade_out: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Audio fade-out duration in seconds"
    )


class RenderRequest(BaseModel):
    """
    Complete request for rendering a final clip.

    Combines moment extraction, optional compositing, subtitle burning,
    and audio merging into a single unified request.
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "moment": {
                    "id": "m-12345",
                    "start_time": 10.5,
                    "end_time": 25.0,
                    "text": "This is the moment text",
                    "segment_id": 0,
                },
                "source_video_path": "/path/to/video.mp4",
                "output_filename": "my_clip.mp4",
                "subtitle_words": [
                    {"word": "This ", "start": 10.5, "end": 10.8},
                    {"word": "is ", "start": 10.8, "end": 11.0},
                ],
            }
        }
    )

    # Core inputs
    moment: TranscriptionMoment = Field(
        ...,
        description="TranscriptionMoment defining the clip timerange"
    )
    source_video_path: str = Field(
        ...,
        description="Path to the source video file"
    )
    output_filename: Optional[str] = Field(
        default=None,
        description="Output filename (auto-generated if not provided)"
    )

    # Subtitle configuration
    subtitle_words: Optional[List[Dict]] = Field(
        default=None,
        description="Word-level timestamps for karaoke subtitles"
    )
    subtitle_config: SubtitleConfig = Field(
        default_factory=SubtitleConfig,
        description="Subtitle styling configuration"
    )

    # Composite configuration (optional)
    enable_composite: bool = Field(
        default=False,
        description="Whether to apply video compositing"
    )
    composite_template: Optional[str] = Field(
        default=None,
        description="Preset template name (e.g., 'vertical-split', 'pip-bottom-right')"
    )
    composite_request: Optional[CompositeRequest] = Field(
        default=None,
        description="Full composite request (overrides template)"
    )

    # Audio configuration
    audio_config: AudioConfig = Field(
        default_factory=AudioConfig,
        description="Audio handling configuration"
    )

    # Output settings
    output_codec: str = Field(
        default="h264",
        description="Video codec (h264, hevc, vp9)"
    )
    output_bitrate: int = Field(
        default=8000,
        gt=0,
        description="Video bitrate in kbps"
    )
    output_preset: str = Field(
        default="medium",
        description="Encoding preset (ultrafast, fast, medium, slow)"
    )
    output_width: Optional[int] = Field(
        default=None,
        description="Output width (None = source width)"
    )
    output_height: Optional[int] = Field(
        default=None,
        description="Output height (None = source height)"
    )

    # Padding options
    padding_start: float = Field(
        default=0.0,
        ge=0.0,
        description="Extra seconds to add before moment start"
    )
    padding_end: float = Field(
        default=0.0,
        ge=0.0,
        description="Extra seconds to add after moment end"
    )

    @model_validator(mode='after')
    def validate_audio_paths(self) -> 'RenderRequest':
        """Validate audio configuration."""
        if self.audio_config.mode in [AudioMode.REPLACE, AudioMode.MIX]:
            if not self.audio_config.external_audio_path:
                raise ValueError(
                    f"external_audio_path required for audio mode '{self.audio_config.mode.value}'"
                )
        return self

    @property
    def effective_start_time(self) -> float:
        """Get effective start time with padding."""
        return max(0, self.moment.start_time - self.padding_start)

    @property
    def effective_end_time(self) -> float:
        """Get effective end time with padding."""
        return self.moment.end_time + self.padding_end

    @property
    def effective_duration(self) -> float:
        """Get effective clip duration with padding."""
        return self.effective_end_time - self.effective_start_time


class RenderService:
    """
    Unified service for rendering final clips.

    Orchestrates the complete rendering pipeline:
    1. Moment timerange extraction from source video
    2. Optional video compositing (multi-source layouts)
    3. ASS subtitle generation and burning
    4. Audio track merging/replacement
    5. Final MP4 encoding to /output folder
    """

    DEFAULT_OUTPUT_DIR = Path("output")
    DEFAULT_TIMEOUT = 7200  # 2 hours

    def __init__(
        self,
        output_dir: Optional[Union[str, Path]] = None,
        ffmpeg_path: Optional[str] = None,
        ffprobe_path: Optional[str] = None,
    ):
        """
        Initialize the render service.

        Args:
            output_dir: Directory for output files (default: ./output)
            ffmpeg_path: Custom FFmpeg binary path
            ffprobe_path: Custom FFprobe binary path
        """
        self.output_dir = Path(output_dir) if output_dir else self.DEFAULT_OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self._ffmpeg_service = FFmpegService(
            ffmpeg_path=ffmpeg_path,
            ffprobe_path=ffprobe_path,
            output_dir=self.output_dir,
        )
        self._composite_service = CompositeService(
            ffmpeg_path=ffmpeg_path,
            ffprobe_path=ffprobe_path,
            output_dir=self.output_dir,
        )

        self.ffmpeg_path = self._ffmpeg_service.ffmpeg_path
        self.ffprobe_path = self._ffmpeg_service.ffprobe_path

    def is_available(self) -> bool:
        """Check if FFmpeg is available."""
        return self._ffmpeg_service.is_available()

    async def get_video_info(self, video_path: Union[str, Path]) -> VideoInfo:
        """Get video information."""
        return await self._ffmpeg_service.get_video_info(video_path)

    def _generate_output_filename(self, request: RenderRequest) -> str:
        """Generate output filename if not provided."""
        if request.output_filename:
            filename = request.output_filename
            if not filename.endswith('.mp4'):
                filename += '.mp4'
            return filename

        # Generate from moment info
        moment_id = request.moment.id.replace('m-', '')[:8]
        start_int = int(request.moment.start_time)
        end_int = int(request.moment.end_time)

        return f"clip_{moment_id}_{start_int}s-{end_int}s.mp4"

    def _get_subtitle_alignment(self, position: SubtitlePosition) -> ASSAlignment:
        """Convert position preset to ASS alignment."""
        mapping = {
            SubtitlePosition.BOTTOM_CENTER: ASSAlignment.BOTTOM_CENTER,
            SubtitlePosition.TOP_CENTER: ASSAlignment.TOP_CENTER,
            SubtitlePosition.MIDDLE_CENTER: ASSAlignment.MIDDLE_CENTER,
            SubtitlePosition.CUSTOM: ASSAlignment.BOTTOM_CENTER,
        }
        return mapping.get(position, ASSAlignment.BOTTOM_CENTER)

    def _get_karaoke_effect(self, effect_name: str) -> KaraokeEffect:
        """Convert effect name to KaraokeEffect enum."""
        mapping = {
            "sweep": KaraokeEffect.SWEEP,
            "instant": KaraokeEffect.INSTANT,
            "outline": KaraokeEffect.OUTLINE,
            "fill": KaraokeEffect.FILL,
        }
        return mapping.get(effect_name.lower(), KaraokeEffect.SWEEP)

    def _adjust_word_timings(
        self,
        words: List[Dict],
        offset: float,
    ) -> List[Dict]:
        """
        Adjust word timings relative to clip start.

        Args:
            words: Original word timestamps
            offset: Time offset to subtract (clip start time)

        Returns:
            Adjusted word timestamps
        """
        adjusted = []
        for word in words:
            adj_word = word.copy()

            # Handle different key names
            start_key = 'start' if 'start' in word else 'start_time'
            end_key = 'end' if 'end' in word else 'end_time'

            if start_key in adj_word:
                adj_word[start_key] = max(0, adj_word[start_key] - offset)
            if end_key in adj_word:
                adj_word[end_key] = max(0, adj_word[end_key] - offset)

            adjusted.append(adj_word)

        return adjusted

    def _filter_words_in_range(
        self,
        words: List[Dict],
        start_time: float,
        end_time: float,
    ) -> List[Dict]:
        """Filter words that fall within the moment timerange."""
        filtered = []
        for word in words:
            word_start = word.get('start', word.get('start_time', 0))
            word_end = word.get('end', word.get('end_time', 0))

            # Include word if it overlaps with the range
            if word_end > start_time and word_start < end_time:
                filtered.append(word)

        return filtered

    async def _generate_subtitle_file(
        self,
        request: RenderRequest,
        video_info: VideoInfo,
        temp_dir: Path,
    ) -> Optional[Path]:
        """
        Generate ASS subtitle file for the clip.

        Returns:
            Path to generated ASS file, or None if subtitles disabled
        """
        if not request.subtitle_config.enabled or not request.subtitle_words:
            return None

        # Filter words within moment range
        words_in_range = self._filter_words_in_range(
            request.subtitle_words,
            request.effective_start_time,
            request.effective_end_time,
        )

        if not words_in_range:
            logger.warning("No words found within moment timerange")
            return None

        # Adjust timings relative to clip start
        adjusted_words = self._adjust_word_timings(
            words_in_range,
            request.effective_start_time,
        )

        # Determine output dimensions
        output_width = request.output_width or video_info.width
        output_height = request.output_height or video_info.height

        # Build subtitle style
        subtitle_cfg = request.subtitle_config

        style = KaraokeStyle(
            font_name=subtitle_cfg.font_name,
            font_size=subtitle_cfg.font_size,
            bold=subtitle_cfg.bold,
            primary_color=subtitle_cfg.primary_color,
            secondary_color=subtitle_cfg.secondary_color,
            outline_color=subtitle_cfg.outline_color,
            outline_width=subtitle_cfg.outline_width,
            shadow_depth=subtitle_cfg.shadow_depth,
            alignment=self._get_subtitle_alignment(subtitle_cfg.position),
            margin_vertical=subtitle_cfg.margin_vertical,
            karaoke_effect=self._get_karaoke_effect(subtitle_cfg.karaoke_effect),
        )

        # Set custom position if specified
        if subtitle_cfg.position == SubtitlePosition.CUSTOM:
            if subtitle_cfg.custom_x is not None and subtitle_cfg.custom_y is not None:
                style.position = (subtitle_cfg.custom_x, subtitle_cfg.custom_y)

        config = KaraokeConfig(
            video_width=output_width,
            video_height=output_height,
            title=f"Clip Subtitles - {request.moment.id}",
        )

        # Generate ASS content (word-by-word, not karaoke)
        ass_path = temp_dir / "subtitles.ass"
        generate_word_by_word_ass(
            adjusted_words,
            style=style,
            config=config,
            output_path=ass_path,
        )

        logger.info(f"Generated subtitle file: {ass_path}")
        return ass_path

    async def _extract_moment_clip(
        self,
        request: RenderRequest,
        temp_dir: Path,
        progress_callback: Optional[RenderProgressCallback] = None,
    ) -> Path:
        """
        Extract the moment timerange from source video.

        Returns:
            Path to extracted clip
        """
        source_path = Path(request.source_video_path)
        if not source_path.exists():
            raise MomentExtractionError(
                f"Source video not found: {source_path}"
            )

        output_path = temp_dir / "extracted.mp4"

        # Build FFmpeg command for extraction
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-ss", str(request.effective_start_time),
            "-i", str(source_path),
            "-t", str(request.effective_duration),
            "-c:v", "libx264",
            "-preset", "fast",  # Fast for intermediate file
            "-crf", "18",  # High quality
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
        ]

        # Add scaling if specified
        if request.output_width and request.output_height:
            cmd.extend([
                "-vf", f"scale={request.output_width}:{request.output_height}"
            ])

        cmd.append(str(output_path))

        logger.info(f"Extracting moment: {request.effective_start_time}s - {request.effective_end_time}s")
        logger.debug(f"FFmpeg command: {' '.join(cmd)}")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            _, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.DEFAULT_TIMEOUT,
            )

            if process.returncode != 0:
                raise MomentExtractionError(
                    "Failed to extract moment from video",
                    details=stderr.decode() if stderr else None,
                )

            if progress_callback:
                progress_callback(RenderProgress(
                    phase="extracting",
                    percent=100.0,
                    current_step=1,
                    total_steps=4,
                    message="Moment extracted successfully",
                ))

            return output_path

        except asyncio.TimeoutError:
            raise MomentExtractionError(
                f"Moment extraction timed out after {self.DEFAULT_TIMEOUT}s"
            )

    async def _burn_subtitles(
        self,
        video_path: Path,
        subtitle_path: Path,
        output_path: Path,
        request: RenderRequest,
        progress_callback: Optional[RenderProgressCallback] = None,
    ) -> Path:
        """
        Burn ASS subtitles into video.

        Returns:
            Path to video with burned subtitles
        """
        # Build FFmpeg command with subtitle filter
        # Need to escape special characters in path for filter
        sub_path_escaped = str(subtitle_path).replace("\\", "/").replace(":", "\\:")

        vf_filter = f"ass='{sub_path_escaped}'"

        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", str(video_path),
            "-vf", vf_filter,
            "-c:v", self._get_codec(request.output_codec),
            "-preset", request.output_preset,
            "-b:v", f"{request.output_bitrate}k",
            "-c:a", "copy",  # Copy audio stream
            "-movflags", "+faststart",
            str(output_path),
        ]

        logger.info(f"Burning subtitles into video")
        logger.debug(f"FFmpeg command: {' '.join(cmd)}")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            _, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.DEFAULT_TIMEOUT,
            )

            if process.returncode != 0:
                raise SubtitleBurnError(
                    "Failed to burn subtitles into video",
                    details=stderr.decode() if stderr else None,
                )

            if progress_callback:
                progress_callback(RenderProgress(
                    phase="subtitles",
                    percent=100.0,
                    current_step=3,
                    total_steps=4,
                    message="Subtitles burned successfully",
                ))

            return output_path

        except asyncio.TimeoutError:
            raise SubtitleBurnError(
                f"Subtitle burning timed out after {self.DEFAULT_TIMEOUT}s"
            )

    async def _process_audio(
        self,
        video_path: Path,
        output_path: Path,
        request: RenderRequest,
        progress_callback: Optional[RenderProgressCallback] = None,
    ) -> Path:
        """
        Process audio according to configuration.

        Returns:
            Path to video with processed audio
        """
        audio_cfg = request.audio_config

        if audio_cfg.mode == AudioMode.ORIGINAL:
            # No audio processing needed, just copy
            import shutil
            shutil.copy2(video_path, output_path)
            return output_path

        elif audio_cfg.mode == AudioMode.MUTE:
            # Remove audio
            cmd = [
                self.ffmpeg_path,
                "-y",
                "-i", str(video_path),
                "-c:v", "copy",
                "-an",  # No audio
                str(output_path),
            ]

        elif audio_cfg.mode == AudioMode.REPLACE:
            # Replace with external audio
            if not audio_cfg.external_audio_path:
                raise AudioMergeError("External audio path required for REPLACE mode")

            # Build audio filter for volume and fades
            audio_filter = f"volume={audio_cfg.external_volume}"
            if audio_cfg.fade_in:
                audio_filter += f",afade=t=in:st=0:d={audio_cfg.fade_in}"
            if audio_cfg.fade_out:
                # Calculate fade start (need duration)
                video_info = await self.get_video_info(video_path)
                fade_start = max(0, video_info.duration - audio_cfg.fade_out)
                audio_filter += f",afade=t=out:st={fade_start}:d={audio_cfg.fade_out}"

            cmd = [
                self.ffmpeg_path,
                "-y",
                "-i", str(video_path),
                "-i", audio_cfg.external_audio_path,
                "-c:v", "copy",
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-af", audio_filter,
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output_path),
            ]

        elif audio_cfg.mode == AudioMode.MIX:
            # Mix original with external audio
            if not audio_cfg.external_audio_path:
                raise AudioMergeError("External audio path required for MIX mode")

            # Build audio filter complex for mixing
            filter_complex = (
                f"[0:a]volume={audio_cfg.original_volume}[a0];"
                f"[1:a]volume={audio_cfg.external_volume}[a1];"
                f"[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[aout]"
            )

            cmd = [
                self.ffmpeg_path,
                "-y",
                "-i", str(video_path),
                "-i", audio_cfg.external_audio_path,
                "-c:v", "copy",
                "-filter_complex", filter_complex,
                "-map", "0:v:0",
                "-map", "[aout]",
                "-c:a", "aac",
                "-b:a", "192k",
                str(output_path),
            ]

        else:
            raise AudioMergeError(f"Unknown audio mode: {audio_cfg.mode}")

        logger.info(f"Processing audio: mode={audio_cfg.mode.value}")
        logger.debug(f"FFmpeg command: {' '.join(cmd)}")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            _, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.DEFAULT_TIMEOUT,
            )

            if process.returncode != 0:
                raise AudioMergeError(
                    "Failed to process audio",
                    details=stderr.decode() if stderr else None,
                )

            if progress_callback:
                progress_callback(RenderProgress(
                    phase="audio",
                    percent=100.0,
                    current_step=4,
                    total_steps=4,
                    message="Audio processed successfully",
                ))

            return output_path

        except asyncio.TimeoutError:
            raise AudioMergeError(
                f"Audio processing timed out after {self.DEFAULT_TIMEOUT}s"
            )

    def _get_codec(self, codec_name: str) -> str:
        """Map codec name to FFmpeg codec."""
        mapping = {
            "h264": "libx264",
            "hevc": "libx265",
            "h265": "libx265",
            "vp9": "libvpx-vp9",
            "av1": "libaom-av1",
        }
        return mapping.get(codec_name.lower(), codec_name)

    async def render_final_clip(
        self,
        request: RenderRequest,
        progress_callback: Optional[RenderProgressCallback] = None,
        timeout: Optional[int] = None,
    ) -> Path:
        """
        Render a final clip with all processing applied.

        This is the main entry point that orchestrates the complete pipeline:
        1. Extract moment timerange from source video
        2. Apply video compositing (if enabled)
        3. Generate and burn ASS subtitles (if configured)
        4. Process audio (merge/replace/mute)
        5. Output final MP4 to /output folder

        Args:
            request: Complete render request configuration
            progress_callback: Optional callback for progress updates
            timeout: Maximum processing time in seconds

        Returns:
            Path to the rendered output file

        Raises:
            RenderError: If any step of the pipeline fails
            FFmpegNotFoundError: If FFmpeg is not available
        """
        if not self.is_available():
            raise FFmpegNotFoundError(
                "FFmpeg is not installed or not found in PATH"
            )

        timeout = timeout or self.DEFAULT_TIMEOUT
        output_filename = self._generate_output_filename(request)

        # Support absolute paths in output_filename (for structured output dirs)
        if output_filename and Path(output_filename).is_absolute():
            final_output_path = Path(output_filename)
            # Ensure parent directory exists
            final_output_path.parent.mkdir(parents=True, exist_ok=True)
        elif output_filename and "/" in output_filename:
            # Relative path with directories - treat as relative to output_dir
            final_output_path = self.output_dir / output_filename
            final_output_path.parent.mkdir(parents=True, exist_ok=True)
        else:
            final_output_path = self.output_dir / output_filename

        # Get source video info
        video_info = await self.get_video_info(request.source_video_path)

        logger.info(
            f"Starting render: {request.source_video_path} -> {final_output_path}"
        )
        logger.info(
            f"Moment: {request.moment.start_time}s - {request.moment.end_time}s "
            f"(duration: {request.effective_duration}s)"
        )

        # Create temp directory for intermediate files
        with tempfile.TemporaryDirectory(prefix="aiclips_render_") as temp_dir:
            temp_path = Path(temp_dir)

            # Step 1: Extract moment from source
            if progress_callback:
                progress_callback(RenderProgress(
                    phase="extracting",
                    percent=0.0,
                    current_step=1,
                    total_steps=4,
                    message="Extracting moment from source video...",
                ))

            current_video = await self._extract_moment_clip(
                request, temp_path, progress_callback
            )

            # Step 2: Apply compositing (if enabled)
            composite_video_info = video_info  # Default to source video info
            if request.enable_composite and request.composite_request:
                if progress_callback:
                    progress_callback(RenderProgress(
                        phase="compositing",
                        percent=0.0,
                        current_step=2,
                        total_steps=4,
                        message="Applying video composite...",
                    ))

                # Update composite request output to temp directory
                composite_output = temp_path / "composited.mp4"
                # Create a copy of the request with temp output path
                from models.composite_schemas import CompositeRequest as CompReq
                composite_req_dict = request.composite_request.model_dump()
                composite_req_dict["output_path"] = str(composite_output)
                temp_composite_request = CompReq(**composite_req_dict)

                current_video = await self._composite_service.composite_video(
                    temp_composite_request,
                )

                # Update video info for composite dimensions (9:16 vertical)
                template = request.composite_request.template
                # Create a mock VideoInfo with composite dimensions for subtitle generation
                composite_video_info = VideoInfo(
                    width=template.output_width,
                    height=template.output_height,
                    duration=video_info.duration,
                    duration_formatted=video_info.duration_formatted,
                    video_codec=video_info.video_codec,
                    audio_codec=video_info.audio_codec,
                    frame_rate=template.output_fps,
                    bitrate=video_info.bitrate,
                    file_size=video_info.file_size,
                    has_audio=video_info.has_audio,
                    audio_sample_rate=video_info.audio_sample_rate,
                    audio_channels=video_info.audio_channels,
                    format_name=video_info.format_name,
                )
                logger.info(f"Composite output: {template.output_width}x{template.output_height}")

            # Step 3: Generate and burn subtitles (use composite dimensions if compositing was applied)
            subtitle_path = await self._generate_subtitle_file(
                request, composite_video_info, temp_path
            )

            if subtitle_path:
                if progress_callback:
                    progress_callback(RenderProgress(
                        phase="subtitles",
                        percent=0.0,
                        current_step=3,
                        total_steps=4,
                        message="Burning subtitles into video...",
                    ))

                subtitled_video = temp_path / "subtitled.mp4"
                current_video = await self._burn_subtitles(
                    current_video,
                    subtitle_path,
                    subtitled_video,
                    request,
                    progress_callback,
                )

            # Step 4: Process audio
            if request.audio_config.mode != AudioMode.ORIGINAL:
                if progress_callback:
                    progress_callback(RenderProgress(
                        phase="audio",
                        percent=0.0,
                        current_step=4,
                        total_steps=4,
                        message="Processing audio...",
                    ))

                audio_processed = temp_path / "audio_processed.mp4"
                current_video = await self._process_audio(
                    current_video,
                    audio_processed,
                    request,
                    progress_callback,
                )

            # Final step: Move to output directory
            import shutil
            shutil.move(str(current_video), str(final_output_path))

            if progress_callback:
                progress_callback(RenderProgress(
                    phase="complete",
                    percent=100.0,
                    current_step=4,
                    total_steps=4,
                    message=f"Render complete: {output_filename}",
                ))

            logger.info(f"Render completed: {final_output_path}")
            return final_output_path


# Convenience function for direct usage
async def render_final_clip(
    moment: TranscriptionMoment,
    source_video_path: str,
    subtitle_words: Optional[List[Dict]] = None,
    output_filename: Optional[str] = None,
    output_dir: Optional[str] = None,
    progress_callback: Optional[RenderProgressCallback] = None,
    **kwargs,
) -> Path:
    """
    Convenience function to render a final clip.

    Args:
        moment: TranscriptionMoment defining the clip timerange
        source_video_path: Path to source video
        subtitle_words: Word-level timestamps for karaoke subtitles
        output_filename: Output filename (auto-generated if None)
        output_dir: Output directory (default: ./output)
        progress_callback: Optional progress callback
        **kwargs: Additional RenderRequest parameters

    Returns:
        Path to rendered output file
    """
    service = RenderService(output_dir=output_dir)

    request = RenderRequest(
        moment=moment,
        source_video_path=source_video_path,
        subtitle_words=subtitle_words,
        output_filename=output_filename,
        **kwargs,
    )

    return await service.render_final_clip(request, progress_callback)
