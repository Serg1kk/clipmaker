"""
Video Files Service for AI Clips

Provides endpoints for listing and retrieving video files from the /videos folder
with rich metadata including duration, size, format, and codec information.

Uses FFmpeg for metadata extraction when available.
"""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional
import logging

from pydantic import BaseModel, Field

from services.ffmpeg_service import FFmpegService, FFmpegError


# Configure logging
logger = logging.getLogger(__name__)


# Configuration
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


class VideoFileMetadata(BaseModel):
    """Extended video file metadata including media information."""

    # Basic file info
    name: str = Field(..., description="Video file name")
    path: str = Field(..., description="Relative path from videos folder")
    full_path: str = Field(..., description="Full absolute path")
    size_bytes: int = Field(..., description="File size in bytes")
    size_formatted: str = Field(..., description="Human-readable file size")
    modified: str = Field(..., description="Last modification date (ISO format)")
    extension: str = Field(..., description="File extension")

    # Video metadata (from FFmpeg)
    duration_seconds: Optional[float] = Field(None, description="Video duration in seconds")
    duration_formatted: Optional[str] = Field(None, description="Human-readable duration (HH:MM:SS)")
    width: Optional[int] = Field(None, description="Video width in pixels")
    height: Optional[int] = Field(None, description="Video height in pixels")
    resolution: Optional[str] = Field(None, description="Resolution string (e.g., '1920x1080')")
    video_codec: Optional[str] = Field(None, description="Video codec name")
    audio_codec: Optional[str] = Field(None, description="Audio codec name")
    frame_rate: Optional[float] = Field(None, description="Frames per second")
    bitrate_kbps: Optional[int] = Field(None, description="Bitrate in kbps")
    format_name: Optional[str] = Field(None, description="Container format")
    has_audio: Optional[bool] = Field(None, description="Whether video has audio track")


class VideoFilesListResponse(BaseModel):
    """Response model for listing video files."""

    videos_path: str = Field(..., description="Path to videos folder")
    total_count: int = Field(..., description="Total number of video files")
    total_size_bytes: int = Field(..., description="Total size of all videos")
    total_size_formatted: str = Field(..., description="Human-readable total size")
    files: list[VideoFileMetadata] = Field(default_factory=list, description="List of video files")
    error: Optional[str] = Field(None, description="Error message if any")


class VideoFileDetailResponse(BaseModel):
    """Response model for single video file info."""

    file: Optional[VideoFileMetadata] = Field(None, description="Video file metadata")
    error: Optional[str] = Field(None, description="Error message if any")
    exists: bool = Field(True, description="Whether the file exists")


class VideoFilesService:
    """
    Service for managing video files in the /videos folder.

    Provides methods for:
    - Listing all video files with metadata
    - Getting detailed info for a single file
    - Extracting video metadata using FFmpeg
    """

    def __init__(self, videos_dir: Optional[Path] = None):
        """
        Initialize the video files service.

        Args:
            videos_dir: Path to videos directory. Defaults to ./videos in project root.
        """
        # Default to videos folder relative to backend
        if videos_dir is None:
            self.videos_dir = Path(__file__).parent.parent.parent / "videos"
        else:
            self.videos_dir = Path(videos_dir)

        # Ensure videos directory exists
        self.videos_dir.mkdir(parents=True, exist_ok=True)

        # Initialize FFmpeg service for metadata extraction
        self._ffmpeg_service: Optional[FFmpegService] = None
        self._ffmpeg_available: Optional[bool] = None

    @property
    def ffmpeg_service(self) -> Optional[FFmpegService]:
        """Lazy initialization of FFmpeg service."""
        if self._ffmpeg_service is None:
            try:
                self._ffmpeg_service = FFmpegService()
                self._ffmpeg_available = self._ffmpeg_service.is_available()
                if not self._ffmpeg_available:
                    logger.warning("FFmpeg not available - video metadata will be limited")
                    self._ffmpeg_service = None
            except Exception as e:
                logger.warning(f"Failed to initialize FFmpeg service: {e}")
                self._ffmpeg_available = False
        return self._ffmpeg_service

    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                if unit == "B":
                    return f"{size_bytes} {unit}"
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def _is_video_file(self, path: Path) -> bool:
        """Check if a file is a valid video file based on extension."""
        return path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS

    def _get_relative_path(self, full_path: Path) -> str:
        """Get path relative to videos folder."""
        try:
            return str(full_path.relative_to(self.videos_dir))
        except ValueError:
            return full_path.name

    async def _get_video_metadata(self, file_path: Path) -> dict:
        """
        Extract video metadata using FFmpeg.

        Returns empty dict if FFmpeg is not available or extraction fails.
        """
        if not self.ffmpeg_service:
            return {}

        try:
            video_info = await self.ffmpeg_service.get_video_info(file_path)
            return {
                "duration_seconds": video_info.duration,
                "duration_formatted": video_info.duration_formatted,
                "width": video_info.width,
                "height": video_info.height,
                "resolution": f"{video_info.width}x{video_info.height}" if video_info.width and video_info.height else None,
                "video_codec": video_info.video_codec,
                "audio_codec": video_info.audio_codec,
                "frame_rate": round(video_info.frame_rate, 2) if video_info.frame_rate else None,
                "bitrate_kbps": video_info.bitrate,
                "format_name": video_info.format_name,
                "has_audio": video_info.has_audio,
            }
        except FFmpegError as e:
            logger.warning(f"FFmpeg error extracting metadata from {file_path}: {e}")
            return {}
        except Exception as e:
            logger.warning(f"Error extracting metadata from {file_path}: {e}")
            return {}

    async def _build_file_metadata(self, file_path: Path, include_video_metadata: bool = True) -> VideoFileMetadata:
        """Build complete metadata for a video file."""
        stat = file_path.stat()

        # Basic file info
        metadata = {
            "name": file_path.name,
            "path": self._get_relative_path(file_path),
            "full_path": str(file_path.absolute()),
            "size_bytes": stat.st_size,
            "size_formatted": self._format_size(stat.st_size),
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "extension": file_path.suffix.lower(),
        }

        # Add video metadata if requested
        if include_video_metadata:
            video_metadata = await self._get_video_metadata(file_path)
            metadata.update(video_metadata)

        return VideoFileMetadata(**metadata)

    async def list_video_files(self, include_metadata: bool = True) -> VideoFilesListResponse:
        """
        List all video files in the videos directory.

        Args:
            include_metadata: Whether to include FFmpeg metadata (slower but more info)

        Returns:
            VideoFilesListResponse with all video files and their metadata
        """
        try:
            if not self.videos_dir.exists():
                self.videos_dir.mkdir(parents=True, exist_ok=True)
                return VideoFilesListResponse(
                    videos_path=str(self.videos_dir.absolute()),
                    total_count=0,
                    total_size_bytes=0,
                    total_size_formatted="0 B",
                    files=[],
                )

            # Find all video files (non-recursive for now, but can be extended)
            video_files: list[Path] = []
            for file_path in self.videos_dir.iterdir():
                if self._is_video_file(file_path):
                    video_files.append(file_path)

            # Sort by name
            video_files.sort(key=lambda p: p.name.lower())

            # Build metadata for each file
            files_metadata: list[VideoFileMetadata] = []
            total_size = 0

            # Process files concurrently for better performance
            if include_metadata and video_files:
                tasks = [self._build_file_metadata(f, include_video_metadata=True) for f in video_files]
                files_metadata = await asyncio.gather(*tasks)
            else:
                # Without FFmpeg metadata, we can process synchronously
                for file_path in video_files:
                    metadata = await self._build_file_metadata(file_path, include_video_metadata=False)
                    files_metadata.append(metadata)

            # Calculate totals
            for fm in files_metadata:
                total_size += fm.size_bytes

            return VideoFilesListResponse(
                videos_path=str(self.videos_dir.absolute()),
                total_count=len(files_metadata),
                total_size_bytes=total_size,
                total_size_formatted=self._format_size(total_size),
                files=files_metadata,
            )

        except PermissionError as e:
            logger.error(f"Permission denied accessing videos directory: {e}")
            return VideoFilesListResponse(
                videos_path=str(self.videos_dir.absolute()),
                total_count=0,
                total_size_bytes=0,
                total_size_formatted="0 B",
                files=[],
                error="Permission denied accessing videos directory",
            )
        except Exception as e:
            logger.error(f"Error listing video files: {e}")
            return VideoFilesListResponse(
                videos_path=str(self.videos_dir.absolute()),
                total_count=0,
                total_size_bytes=0,
                total_size_formatted="0 B",
                files=[],
                error=str(e),
            )

    async def get_file_info(self, file_path: str) -> VideoFileDetailResponse:
        """
        Get detailed information about a specific video file.

        Args:
            file_path: Path to the video file (relative to videos folder or absolute)

        Returns:
            VideoFileDetailResponse with file metadata or error
        """
        try:
            # Resolve the path
            path = Path(file_path)

            # If not absolute, treat as relative to videos folder
            if not path.is_absolute():
                path = self.videos_dir / path

            # Security check: ensure path is within videos folder
            resolved_path = path.resolve()
            videos_resolved = self.videos_dir.resolve()

            if not str(resolved_path).startswith(str(videos_resolved)):
                return VideoFileDetailResponse(
                    file=None,
                    error="Access denied: path is outside videos folder",
                    exists=False,
                )

            # Check if file exists
            if not resolved_path.exists():
                return VideoFileDetailResponse(
                    file=None,
                    error=f"File not found: {file_path}",
                    exists=False,
                )

            # Check if it's a video file
            if not self._is_video_file(resolved_path):
                return VideoFileDetailResponse(
                    file=None,
                    error=f"Not a valid video file: {file_path}",
                    exists=True,
                )

            # Build and return metadata
            metadata = await self._build_file_metadata(resolved_path, include_video_metadata=True)

            return VideoFileDetailResponse(
                file=metadata,
                exists=True,
            )

        except PermissionError:
            return VideoFileDetailResponse(
                file=None,
                error="Permission denied",
                exists=False,
            )
        except Exception as e:
            logger.error(f"Error getting file info for {file_path}: {e}")
            return VideoFileDetailResponse(
                file=None,
                error=str(e),
                exists=False,
            )


# Singleton instance
video_files_service = VideoFilesService()
