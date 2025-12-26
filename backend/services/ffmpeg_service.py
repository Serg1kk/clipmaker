"""
FFmpeg Service for Audio Extraction and Video Processing

This module provides a comprehensive interface for FFmpeg operations including:
- Audio extraction from video files with format conversion
- Video metadata retrieval (duration, codec, resolution)
- File validation and error handling
- Progress callbacks for real-time updates

Optimized for speech recognition workflows with Whisper-compatible output.
"""

import asyncio
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Callable, Optional, Union
import logging

# Configure logging
logger = logging.getLogger(__name__)


class AudioFormat(str, Enum):
    """Supported audio output formats."""
    WAV = "wav"
    MP3 = "mp3"
    AAC = "aac"
    FLAC = "flac"
    OGG = "ogg"


class FFmpegError(Exception):
    """Base exception for FFmpeg-related errors."""

    def __init__(self, message: str, stderr: Optional[str] = None, return_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.stderr = stderr
        self.return_code = return_code


class FFmpegNotFoundError(FFmpegError):
    """Raised when FFmpeg binary is not found on the system."""
    pass


class InvalidVideoError(FFmpegError):
    """Raised when the input file is not a valid video."""
    pass


class DiskSpaceError(FFmpegError):
    """Raised when there is insufficient disk space."""
    pass


class ExtractionTimeoutError(FFmpegError):
    """Raised when extraction exceeds the timeout limit."""
    pass


@dataclass
class VideoInfo:
    """Container for video file metadata."""
    duration: float  # Duration in seconds
    duration_formatted: str  # Human-readable duration (HH:MM:SS)
    width: int
    height: int
    video_codec: str
    audio_codec: Optional[str]
    frame_rate: float
    bitrate: Optional[int]  # In kbps
    file_size: int  # In bytes
    has_audio: bool
    audio_sample_rate: Optional[int]
    audio_channels: Optional[int]
    format_name: str

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "duration": self.duration,
            "duration_formatted": self.duration_formatted,
            "width": self.width,
            "height": self.height,
            "video_codec": self.video_codec,
            "audio_codec": self.audio_codec,
            "frame_rate": self.frame_rate,
            "bitrate": self.bitrate,
            "file_size": self.file_size,
            "has_audio": self.has_audio,
            "audio_sample_rate": self.audio_sample_rate,
            "audio_channels": self.audio_channels,
            "format_name": self.format_name,
        }


@dataclass
class ExtractionProgress:
    """Container for extraction progress information."""
    percent: float  # 0.0 to 100.0
    time_processed: float  # Seconds processed
    speed: float  # Processing speed multiplier
    eta_seconds: Optional[float]  # Estimated time remaining
    current_size: Optional[int]  # Output file size so far

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "percent": round(self.percent, 2),
            "time_processed": round(self.time_processed, 2),
            "speed": round(self.speed, 2),
            "eta_seconds": round(self.eta_seconds, 1) if self.eta_seconds else None,
            "current_size": self.current_size,
        }


# Type alias for progress callback
ProgressCallback = Callable[[ExtractionProgress], None]


class FFmpegService:
    """
    Service class for FFmpeg operations.

    Provides async-compatible methods for extracting audio from video,
    retrieving video metadata, and validating video files.

    Usage:
        service = FFmpegService()

        # Check if FFmpeg is available
        if not service.is_available():
            raise RuntimeError("FFmpeg not installed")

        # Get video info
        info = await service.get_video_info("/path/to/video.mp4")
        print(f"Duration: {info.duration_formatted}")

        # Extract audio with progress callback
        def on_progress(progress):
            print(f"Progress: {progress.percent}%")

        output_path = await service.extract_audio(
            "/path/to/video.mp4",
            "/path/to/output.wav",
            format=AudioFormat.WAV,
            progress_callback=on_progress
        )
    """

    # Default settings optimized for Whisper speech recognition
    DEFAULT_SAMPLE_RATE = 16000  # 16kHz - optimal for Whisper
    DEFAULT_CHANNELS = 1  # Mono for speech recognition
    DEFAULT_FORMAT = AudioFormat.WAV
    DEFAULT_TIMEOUT = 7200  # 2 hours for long videos
    MIN_DISK_SPACE_MB = 500  # Minimum free disk space required

    # FFmpeg output codec mappings
    CODEC_MAP = {
        AudioFormat.WAV: "pcm_s16le",
        AudioFormat.MP3: "libmp3lame",
        AudioFormat.AAC: "aac",
        AudioFormat.FLAC: "flac",
        AudioFormat.OGG: "libvorbis",
    }

    # Quality settings for lossy formats
    QUALITY_MAP = {
        AudioFormat.MP3: ["-q:a", "2"],  # High quality VBR
        AudioFormat.AAC: ["-b:a", "128k"],
        AudioFormat.OGG: ["-q:a", "6"],
    }

    def __init__(
        self,
        ffmpeg_path: Optional[str] = None,
        ffprobe_path: Optional[str] = None,
        output_dir: Optional[Union[str, Path]] = None,
    ):
        """
        Initialize FFmpeg service.

        Args:
            ffmpeg_path: Custom path to FFmpeg binary (uses system PATH if None)
            ffprobe_path: Custom path to FFprobe binary (uses system PATH if None)
            output_dir: Default directory for output files
        """
        self.ffmpeg_path = ffmpeg_path or self._find_binary("ffmpeg")
        self.ffprobe_path = ffprobe_path or self._find_binary("ffprobe")
        self.output_dir = Path(output_dir) if output_dir else Path("output")

        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _find_binary(name: str) -> str:
        """Find binary in system PATH."""
        path = shutil.which(name)
        if path:
            return path
        # Common installation paths
        common_paths = [
            f"/usr/bin/{name}",
            f"/usr/local/bin/{name}",
            f"/opt/homebrew/bin/{name}",  # macOS Homebrew ARM
            f"/opt/local/bin/{name}",  # macOS MacPorts
            f"C:\\ffmpeg\\bin\\{name}.exe",  # Windows
        ]
        for p in common_paths:
            if os.path.isfile(p):
                return p
        return name  # Return name, will fail later with clear error

    def is_available(self) -> bool:
        """Check if FFmpeg is available on the system."""
        try:
            result = subprocess.run(
                [self.ffmpeg_path, "-version"],
                capture_output=True,
                timeout=10,
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            return False

    def get_version(self) -> Optional[str]:
        """Get FFmpeg version string."""
        try:
            result = subprocess.run(
                [self.ffmpeg_path, "-version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                # Extract version from first line
                match = re.search(r"ffmpeg version (\S+)", result.stdout)
                return match.group(1) if match else result.stdout.split("\n")[0]
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            pass
        return None

    def _check_ffmpeg_available(self) -> None:
        """Raise error if FFmpeg is not available."""
        if not self.is_available():
            raise FFmpegNotFoundError(
                "FFmpeg is not installed or not found in PATH. "
                "Please install FFmpeg: https://ffmpeg.org/download.html"
            )

    def _check_disk_space(self, path: Union[str, Path], required_mb: int = None) -> None:
        """Check if there is sufficient disk space."""
        required_mb = required_mb or self.MIN_DISK_SPACE_MB
        path = Path(path)

        # Get the mount point for the path
        check_path = path if path.exists() else path.parent
        while not check_path.exists() and check_path != check_path.parent:
            check_path = check_path.parent

        try:
            stat = os.statvfs(check_path)
            free_mb = (stat.f_bavail * stat.f_frsize) // (1024 * 1024)

            if free_mb < required_mb:
                raise DiskSpaceError(
                    f"Insufficient disk space. Required: {required_mb}MB, "
                    f"Available: {free_mb}MB at {check_path}"
                )
        except AttributeError:
            # Windows doesn't have statvfs
            import ctypes
            free_bytes = ctypes.c_ulonglong(0)
            ctypes.windll.kernel32.GetDiskFreeSpaceExW(
                ctypes.c_wchar_p(str(check_path)),
                None,
                None,
                ctypes.pointer(free_bytes),
            )
            free_mb = free_bytes.value // (1024 * 1024)
            if free_mb < required_mb:
                raise DiskSpaceError(
                    f"Insufficient disk space. Required: {required_mb}MB, "
                    f"Available: {free_mb}MB"
                )

    def validate_video_file(self, video_path: Union[str, Path]) -> bool:
        """
        Validate that a file is a valid video file.

        Args:
            video_path: Path to the video file

        Returns:
            True if valid video file

        Raises:
            InvalidVideoError: If file is not valid
            FileNotFoundError: If file does not exist
        """
        self._check_ffmpeg_available()

        path = Path(video_path)
        if not path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        if not path.is_file():
            raise InvalidVideoError(f"Path is not a file: {video_path}")

        if path.stat().st_size == 0:
            raise InvalidVideoError(f"File is empty: {video_path}")

        # Use ffprobe to check if it's a valid video
        try:
            result = subprocess.run(
                [
                    self.ffprobe_path,
                    "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=codec_type",
                    "-of", "csv=p=0",
                    str(path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0 or "video" not in result.stdout.lower():
                # Check if it might be audio-only
                audio_result = subprocess.run(
                    [
                        self.ffprobe_path,
                        "-v", "error",
                        "-select_streams", "a:0",
                        "-show_entries", "stream=codec_type",
                        "-of", "csv=p=0",
                        str(path),
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )

                if "audio" not in audio_result.stdout.lower():
                    raise InvalidVideoError(
                        f"File is not a valid video or audio file: {video_path}",
                        stderr=result.stderr,
                    )

            return True

        except subprocess.TimeoutExpired:
            raise InvalidVideoError(
                f"Timeout while validating video file: {video_path}"
            )
        except FileNotFoundError:
            raise FFmpegNotFoundError("FFprobe not found")

    async def get_video_info(self, video_path: Union[str, Path]) -> VideoInfo:
        """
        Get detailed information about a video file.

        Args:
            video_path: Path to the video file

        Returns:
            VideoInfo object with video metadata

        Raises:
            InvalidVideoError: If file is not valid
            FFmpegError: If FFprobe fails
        """
        self._check_ffmpeg_available()

        path = Path(video_path)
        if not path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # Run ffprobe asynchronously
        cmd = [
            self.ffprobe_path,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(path),
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=60,
            )

            if process.returncode != 0:
                raise FFmpegError(
                    f"FFprobe failed for {video_path}",
                    stderr=stderr.decode() if stderr else None,
                    return_code=process.returncode,
                )

            data = json.loads(stdout.decode())

        except asyncio.TimeoutError:
            raise FFmpegError(f"Timeout while probing video: {video_path}")
        except json.JSONDecodeError as e:
            raise FFmpegError(f"Failed to parse FFprobe output: {e}")

        # Extract video stream info
        video_stream = None
        audio_stream = None

        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video" and video_stream is None:
                video_stream = stream
            elif stream.get("codec_type") == "audio" and audio_stream is None:
                audio_stream = stream

        format_info = data.get("format", {})

        # Parse duration
        duration = float(format_info.get("duration", 0))
        hours, remainder = divmod(int(duration), 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_formatted = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

        # Parse frame rate
        frame_rate = 0.0
        if video_stream:
            fps_str = video_stream.get("r_frame_rate", "0/1")
            if "/" in fps_str:
                num, den = map(int, fps_str.split("/"))
                frame_rate = num / den if den != 0 else 0.0
            else:
                frame_rate = float(fps_str)

        # Parse bitrate
        bitrate = None
        if format_info.get("bit_rate"):
            bitrate = int(format_info["bit_rate"]) // 1000  # Convert to kbps

        return VideoInfo(
            duration=duration,
            duration_formatted=duration_formatted,
            width=int(video_stream.get("width", 0)) if video_stream else 0,
            height=int(video_stream.get("height", 0)) if video_stream else 0,
            video_codec=video_stream.get("codec_name", "unknown") if video_stream else "none",
            audio_codec=audio_stream.get("codec_name") if audio_stream else None,
            frame_rate=frame_rate,
            bitrate=bitrate,
            file_size=int(format_info.get("size", path.stat().st_size)),
            has_audio=audio_stream is not None,
            audio_sample_rate=int(audio_stream.get("sample_rate", 0)) if audio_stream else None,
            audio_channels=int(audio_stream.get("channels", 0)) if audio_stream else None,
            format_name=format_info.get("format_name", "unknown"),
        )

    def _parse_progress(self, line: str, total_duration: float) -> Optional[ExtractionProgress]:
        """Parse FFmpeg progress output from stderr."""
        # FFmpeg progress format: frame=X fps=X size=X time=HH:MM:SS.ms speed=Xx

        time_match = re.search(r"time=(\d{2}):(\d{2}):(\d{2})\.(\d+)", line)
        speed_match = re.search(r"speed=\s*([\d.]+)x", line)
        size_match = re.search(r"size=\s*(\d+)", line)

        if not time_match:
            return None

        hours, minutes, seconds, ms = map(int, time_match.groups())
        time_processed = hours * 3600 + minutes * 60 + seconds + ms / 100

        speed = float(speed_match.group(1)) if speed_match else 1.0
        current_size = int(size_match.group(1)) * 1024 if size_match else None  # Convert from KB

        percent = (time_processed / total_duration * 100) if total_duration > 0 else 0
        percent = min(percent, 100.0)  # Cap at 100%

        eta_seconds = None
        if speed > 0 and total_duration > 0:
            remaining = total_duration - time_processed
            eta_seconds = remaining / speed

        return ExtractionProgress(
            percent=percent,
            time_processed=time_processed,
            speed=speed,
            eta_seconds=eta_seconds,
            current_size=current_size,
        )

    async def extract_audio(
        self,
        video_path: Union[str, Path],
        output_path: Optional[Union[str, Path]] = None,
        format: AudioFormat = DEFAULT_FORMAT,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        channels: int = DEFAULT_CHANNELS,
        progress_callback: Optional[ProgressCallback] = None,
        timeout: Optional[int] = None,
    ) -> Path:
        """
        Extract audio from a video file.

        Args:
            video_path: Path to the input video file
            output_path: Path for the output audio file (auto-generated if None)
            format: Output audio format (WAV recommended for Whisper)
            sample_rate: Output sample rate in Hz (16000 for Whisper)
            channels: Number of audio channels (1 for mono/speech)
            progress_callback: Optional callback for progress updates
            timeout: Maximum extraction time in seconds

        Returns:
            Path to the extracted audio file

        Raises:
            FFmpegNotFoundError: If FFmpeg is not installed
            InvalidVideoError: If input is not a valid video
            DiskSpaceError: If insufficient disk space
            ExtractionTimeoutError: If extraction exceeds timeout
            FFmpegError: If extraction fails
        """
        self._check_ffmpeg_available()

        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # Validate input file
        self.validate_video_file(video_path)

        # Generate output path if not provided
        if output_path is None:
            output_path = self.output_dir / f"{video_path.stem}.{format.value}"
        else:
            output_path = Path(output_path)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Check disk space (estimate: input file size * 2)
        estimated_size_mb = (video_path.stat().st_size // (1024 * 1024)) * 2
        self._check_disk_space(output_path.parent, max(estimated_size_mb, self.MIN_DISK_SPACE_MB))

        # Get video duration for progress calculation
        video_info = await self.get_video_info(video_path)

        if not video_info.has_audio:
            raise InvalidVideoError(f"Video file has no audio stream: {video_path}")

        # Build FFmpeg command
        cmd = [
            self.ffmpeg_path,
            "-i", str(video_path),
            "-vn",  # No video
            "-acodec", self.CODEC_MAP[format],
            "-ar", str(sample_rate),
            "-ac", str(channels),
        ]

        # Add quality settings for lossy formats
        if format in self.QUALITY_MAP:
            cmd.extend(self.QUALITY_MAP[format])

        # Progress output
        cmd.extend(["-progress", "pipe:1", "-stats_period", "0.5"])

        # Overwrite output without asking
        cmd.extend(["-y", str(output_path)])

        logger.info(f"Starting audio extraction: {video_path} -> {output_path}")
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
                        progress = self._parse_progress(line_str, video_info.duration)
                        if progress and (last_progress is None or
                                        progress.percent - last_progress.percent >= 0.5):
                            last_progress = progress
                            try:
                                progress_callback(progress)
                            except Exception as e:
                                logger.warning(f"Progress callback error: {e}")

            async def read_stdout():
                """Read stdout (progress pipe) for additional progress info."""
                nonlocal last_progress
                while True:
                    line = await process.stdout.readline()
                    if not line:
                        break
                    line_str = line.decode("utf-8", errors="replace").strip()

                    # Parse progress from -progress pipe
                    if progress_callback and "out_time_ms=" in line_str:
                        try:
                            time_ms = int(line_str.split("=")[1])
                            time_processed = time_ms / 1_000_000
                            percent = (time_processed / video_info.duration * 100) if video_info.duration > 0 else 0

                            progress = ExtractionProgress(
                                percent=min(percent, 100.0),
                                time_processed=time_processed,
                                speed=last_progress.speed if last_progress else 1.0,
                                eta_seconds=last_progress.eta_seconds if last_progress else None,
                                current_size=last_progress.current_size if last_progress else None,
                            )

                            if last_progress is None or progress.percent - last_progress.percent >= 0.5:
                                last_progress = progress
                                progress_callback(progress)
                        except (ValueError, IndexError):
                            pass

            # Run both readers concurrently with timeout
            try:
                await asyncio.wait_for(
                    asyncio.gather(read_stderr(), read_stdout(), process.wait()),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                raise ExtractionTimeoutError(
                    f"Audio extraction timed out after {timeout} seconds",
                    stderr="\n".join(stderr_lines[-20:]),  # Last 20 lines
                )

            if process.returncode != 0:
                raise FFmpegError(
                    f"Audio extraction failed with return code {process.returncode}",
                    stderr="\n".join(stderr_lines[-20:]),
                    return_code=process.returncode,
                )

            # Send final progress update
            if progress_callback:
                progress_callback(ExtractionProgress(
                    percent=100.0,
                    time_processed=video_info.duration,
                    speed=last_progress.speed if last_progress else 1.0,
                    eta_seconds=0,
                    current_size=output_path.stat().st_size if output_path.exists() else None,
                ))

            logger.info(f"Audio extraction completed: {output_path}")
            return output_path

        except (OSError, FileNotFoundError) as e:
            raise FFmpegError(f"Failed to run FFmpeg: {e}")

    async def extract_audio_segment(
        self,
        video_path: Union[str, Path],
        output_path: Optional[Union[str, Path]] = None,
        start_time: float = 0,
        duration: Optional[float] = None,
        end_time: Optional[float] = None,
        format: AudioFormat = DEFAULT_FORMAT,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        channels: int = DEFAULT_CHANNELS,
    ) -> Path:
        """
        Extract a segment of audio from a video file.

        Args:
            video_path: Path to the input video file
            output_path: Path for the output audio file
            start_time: Start time in seconds
            duration: Duration to extract in seconds (mutually exclusive with end_time)
            end_time: End time in seconds (mutually exclusive with duration)
            format: Output audio format
            sample_rate: Output sample rate
            channels: Number of channels

        Returns:
            Path to the extracted audio segment
        """
        self._check_ffmpeg_available()

        video_path = Path(video_path)

        if output_path is None:
            suffix = f"_{start_time}s"
            if duration:
                suffix += f"_{duration}s"
            elif end_time:
                suffix += f"_to_{end_time}s"
            output_path = self.output_dir / f"{video_path.stem}{suffix}.{format.value}"
        else:
            output_path = Path(output_path)

        output_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            self.ffmpeg_path,
            "-ss", str(start_time),
            "-i", str(video_path),
        ]

        if duration:
            cmd.extend(["-t", str(duration)])
        elif end_time:
            cmd.extend(["-to", str(end_time - start_time)])

        cmd.extend([
            "-vn",
            "-acodec", self.CODEC_MAP[format],
            "-ar", str(sample_rate),
            "-ac", str(channels),
            "-y", str(output_path),
        ])

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        _, stderr = await process.communicate()

        if process.returncode != 0:
            raise FFmpegError(
                "Segment extraction failed",
                stderr=stderr.decode() if stderr else None,
                return_code=process.returncode,
            )

        return output_path

    def cleanup_output(self, path: Union[str, Path]) -> bool:
        """
        Clean up an output file.

        Args:
            path: Path to the file to remove

        Returns:
            True if file was removed, False if it didn't exist
        """
        path = Path(path)
        if path.exists() and path.is_file():
            path.unlink()
            return True
        return False


# Convenience functions for direct usage
async def extract_audio(
    video_path: Union[str, Path],
    output_path: Optional[Union[str, Path]] = None,
    format: str = "wav",
    progress_callback: Optional[ProgressCallback] = None,
) -> Path:
    """
    Convenience function to extract audio from video.

    Args:
        video_path: Path to input video
        output_path: Path for output audio (auto-generated if None)
        format: Output format (wav, mp3, aac, flac, ogg)
        progress_callback: Optional callback for progress updates

    Returns:
        Path to extracted audio file
    """
    service = FFmpegService()
    audio_format = AudioFormat(format.lower())
    return await service.extract_audio(
        video_path,
        output_path,
        format=audio_format,
        progress_callback=progress_callback,
    )


async def get_video_info(video_path: Union[str, Path]) -> VideoInfo:
    """
    Convenience function to get video information.

    Args:
        video_path: Path to video file

    Returns:
        VideoInfo object with video metadata
    """
    service = FFmpegService()
    return await service.get_video_info(video_path)


def validate_video_file(video_path: Union[str, Path]) -> bool:
    """
    Convenience function to validate a video file.

    Args:
        video_path: Path to video file

    Returns:
        True if valid video file
    """
    service = FFmpegService()
    return service.validate_video_file(video_path)
