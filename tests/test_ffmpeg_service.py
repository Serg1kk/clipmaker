"""
Tests for FFmpeg Service Module

This module tests the FFmpeg audio extraction and video processing functionality.
"""

import asyncio
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
import pytest

# Add backend to path for imports - import directly to avoid dependency issues
sys.path.insert(0, str(Path(__file__).parent.parent / "backend" / "services"))

from ffmpeg_service import (
    FFmpegService,
    FFmpegError,
    FFmpegNotFoundError,
    InvalidVideoError,
    DiskSpaceError,
    ExtractionTimeoutError,
    VideoInfo,
    ExtractionProgress,
    AudioFormat,
    extract_audio,
    get_video_info,
    validate_video_file,
)


class TestFFmpegServiceInit:
    """Tests for FFmpegService initialization."""

    def test_default_initialization(self):
        """Test service initializes with default settings."""
        service = FFmpegService()
        assert service.ffmpeg_path is not None
        assert service.ffprobe_path is not None
        assert service.output_dir.exists()

    def test_custom_output_dir(self, tmp_path):
        """Test service with custom output directory."""
        custom_dir = tmp_path / "custom_output"
        service = FFmpegService(output_dir=custom_dir)
        assert service.output_dir == custom_dir
        assert custom_dir.exists()

    def test_is_available(self):
        """Test FFmpeg availability check."""
        service = FFmpegService()
        # Should return True or False without raising
        result = service.is_available()
        assert isinstance(result, bool)

    def test_get_version(self):
        """Test FFmpeg version retrieval."""
        service = FFmpegService()
        if service.is_available():
            version = service.get_version()
            assert version is not None
            assert isinstance(version, str)


class TestVideoInfo:
    """Tests for VideoInfo dataclass."""

    def test_to_dict(self):
        """Test VideoInfo conversion to dictionary."""
        info = VideoInfo(
            duration=120.5,
            duration_formatted="00:02:00",
            width=1920,
            height=1080,
            video_codec="h264",
            audio_codec="aac",
            frame_rate=30.0,
            bitrate=5000,
            file_size=1024000,
            has_audio=True,
            audio_sample_rate=44100,
            audio_channels=2,
            format_name="mp4",
        )

        result = info.to_dict()

        assert result["duration"] == 120.5
        assert result["width"] == 1920
        assert result["height"] == 1080
        assert result["has_audio"] is True
        assert result["audio_codec"] == "aac"


class TestExtractionProgress:
    """Tests for ExtractionProgress dataclass."""

    def test_to_dict(self):
        """Test ExtractionProgress conversion to dictionary."""
        progress = ExtractionProgress(
            percent=50.123,
            time_processed=60.5,
            speed=1.5,
            eta_seconds=40.0,
            current_size=512000,
        )

        result = progress.to_dict()

        assert result["percent"] == 50.12  # Rounded
        assert result["time_processed"] == 60.5
        assert result["speed"] == 1.5
        assert result["eta_seconds"] == 40.0
        assert result["current_size"] == 512000


class TestAudioFormat:
    """Tests for AudioFormat enum."""

    def test_format_values(self):
        """Test all audio format values."""
        assert AudioFormat.WAV.value == "wav"
        assert AudioFormat.MP3.value == "mp3"
        assert AudioFormat.AAC.value == "aac"
        assert AudioFormat.FLAC.value == "flac"
        assert AudioFormat.OGG.value == "ogg"

    def test_format_from_string(self):
        """Test creating format from string value."""
        assert AudioFormat("wav") == AudioFormat.WAV
        assert AudioFormat("mp3") == AudioFormat.MP3


class TestValidation:
    """Tests for file validation."""

    def test_validate_nonexistent_file(self):
        """Test validation raises for non-existent file."""
        service = FFmpegService()
        with pytest.raises(FileNotFoundError):
            service.validate_video_file("/nonexistent/path/video.mp4")

    def test_validate_empty_file(self, tmp_path):
        """Test validation raises for empty file."""
        empty_file = tmp_path / "empty.mp4"
        empty_file.touch()

        service = FFmpegService()
        with pytest.raises(InvalidVideoError):
            service.validate_video_file(empty_file)


class TestProgressParsing:
    """Tests for FFmpeg progress output parsing."""

    def test_parse_progress_valid(self):
        """Test parsing valid FFmpeg progress output."""
        service = FFmpegService()
        line = "frame=  100 fps=30 size=    1024kB time=00:01:30.50 bitrate=  93.0kbits/s speed=1.5x"
        total_duration = 180.0  # 3 minutes

        progress = service._parse_progress(line, total_duration)

        assert progress is not None
        assert 50 < progress.percent < 51  # ~50% through
        assert progress.speed == 1.5
        assert progress.time_processed == 90.5  # 1:30.50

    def test_parse_progress_no_time(self):
        """Test parsing returns None when no time present."""
        service = FFmpegService()
        line = "frame=  100 fps=30 size=    1024kB"

        progress = service._parse_progress(line, 180.0)

        assert progress is None


class TestFFmpegErrors:
    """Tests for FFmpeg error classes."""

    def test_ffmpeg_error_with_details(self):
        """Test FFmpegError stores all details."""
        error = FFmpegError("Test error", stderr="Error output", return_code=1)

        assert str(error) == "Test error"
        assert error.message == "Test error"
        assert error.stderr == "Error output"
        assert error.return_code == 1

    def test_error_inheritance(self):
        """Test error class hierarchy."""
        assert issubclass(FFmpegNotFoundError, FFmpegError)
        assert issubclass(InvalidVideoError, FFmpegError)
        assert issubclass(DiskSpaceError, FFmpegError)
        assert issubclass(ExtractionTimeoutError, FFmpegError)


class TestConvenienceFunctions:
    """Tests for module-level convenience functions."""

    @pytest.mark.asyncio
    async def test_get_video_info_nonexistent(self):
        """Test get_video_info with non-existent file."""
        with pytest.raises(FileNotFoundError):
            await get_video_info("/nonexistent/video.mp4")

    def test_validate_video_file_nonexistent(self):
        """Test validate_video_file with non-existent file."""
        with pytest.raises(FileNotFoundError):
            validate_video_file("/nonexistent/video.mp4")


class TestCodecMapping:
    """Tests for codec and quality mappings."""

    def test_all_formats_have_codec(self):
        """Test all audio formats have codec mapping."""
        service = FFmpegService()
        for format in AudioFormat:
            assert format in service.CODEC_MAP
            assert isinstance(service.CODEC_MAP[format], str)

    def test_lossy_formats_have_quality(self):
        """Test lossy formats have quality settings."""
        service = FFmpegService()
        lossy_formats = [AudioFormat.MP3, AudioFormat.AAC, AudioFormat.OGG]
        for format in lossy_formats:
            assert format in service.QUALITY_MAP
            assert isinstance(service.QUALITY_MAP[format], list)


# Integration tests (require actual FFmpeg and test video)
class TestIntegration:
    """Integration tests requiring FFmpeg installation."""

    @pytest.fixture
    def ffmpeg_service(self):
        """Create FFmpeg service for testing."""
        service = FFmpegService()
        if not service.is_available():
            pytest.skip("FFmpeg not available")
        return service

    def test_ffmpeg_available(self, ffmpeg_service):
        """Verify FFmpeg is available for integration tests."""
        assert ffmpeg_service.is_available()
        assert ffmpeg_service.get_version() is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
