"""
Tests for Video Files API endpoints.

Tests the VideoFilesService for listing and retrieving video file information.
"""

import pytest
from pathlib import Path
import sys

# Add backend to path
backend_path = str(Path(__file__).parent.parent / "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from services.video_files_service import (
    VideoFilesService,
    VideoFileMetadata,
    VideoFilesListResponse,
    VideoFileDetailResponse,
)


@pytest.fixture
def mock_video_metadata():
    """Sample video file metadata."""
    return VideoFileMetadata(
        name="test_video.mp4",
        path="test_video.mp4",
        full_path="/path/to/videos/test_video.mp4",
        size_bytes=1024 * 1024 * 100,  # 100MB
        size_formatted="100.0 MB",
        modified="2025-12-26T19:00:00",
        extension=".mp4",
        duration_seconds=120.5,
        duration_formatted="00:02:00",
        width=1920,
        height=1080,
        resolution="1920x1080",
        video_codec="h264",
        audio_codec="aac",
        frame_rate=30.0,
        bitrate_kbps=5000,
        format_name="mov,mp4,m4a,3gp,3g2,mj2",
        has_audio=True,
    )


class TestVideoFilesService:
    """Unit tests for VideoFilesService class."""

    @pytest.fixture
    def temp_videos_dir(self, tmp_path):
        """Create a temporary videos directory."""
        videos_dir = tmp_path / "videos"
        videos_dir.mkdir()
        return videos_dir

    @pytest.fixture
    def service(self, temp_videos_dir):
        """Create a VideoFilesService with temp directory."""
        return VideoFilesService(videos_dir=temp_videos_dir)

    def test_format_size_bytes(self, service):
        """Test file size formatting for bytes."""
        assert service._format_size(0) == "0 B"
        assert service._format_size(512) == "512 B"

    def test_format_size_kb(self, service):
        """Test file size formatting for kilobytes."""
        assert service._format_size(1024) == "1.0 KB"
        assert service._format_size(1536) == "1.5 KB"

    def test_format_size_mb(self, service):
        """Test file size formatting for megabytes."""
        assert service._format_size(1024 * 1024) == "1.0 MB"
        assert service._format_size(1024 * 1024 * 50) == "50.0 MB"

    def test_format_size_gb(self, service):
        """Test file size formatting for gigabytes."""
        assert service._format_size(1024 * 1024 * 1024) == "1.0 GB"

    def test_is_video_file_valid(self, service, temp_videos_dir):
        """Test video file detection for valid extensions."""
        extensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"]
        for ext in extensions:
            video_file = temp_videos_dir / f"test{ext}"
            video_file.write_bytes(b"fake video content")
            assert service._is_video_file(video_file) is True, f"Failed for {ext}"

    def test_is_video_file_invalid(self, service, temp_videos_dir):
        """Test video file detection for invalid extensions."""
        text_file = temp_videos_dir / "test.txt"
        text_file.write_text("not a video")
        assert service._is_video_file(text_file) is False

    def test_is_video_file_directory(self, service, temp_videos_dir):
        """Test video file detection for directories."""
        assert service._is_video_file(temp_videos_dir) is False

    def test_get_relative_path(self, service, temp_videos_dir):
        """Test relative path calculation."""
        video_file = temp_videos_dir / "subdir" / "test.mp4"
        video_file.parent.mkdir()
        video_file.write_bytes(b"content")

        rel_path = service._get_relative_path(video_file)
        assert rel_path == "subdir/test.mp4"

    @pytest.mark.asyncio
    async def test_list_empty_directory(self, service):
        """Test listing an empty videos directory."""
        result = await service.list_video_files(include_metadata=False)

        assert result.total_count == 0
        assert result.files == []
        assert result.error is None
        assert result.total_size_bytes == 0

    @pytest.mark.asyncio
    async def test_list_with_videos(self, service, temp_videos_dir):
        """Test listing directory with video files."""
        # Create test video files
        (temp_videos_dir / "video1.mp4").write_bytes(b"x" * 1000)
        (temp_videos_dir / "video2.mov").write_bytes(b"x" * 2000)
        (temp_videos_dir / "video3.mkv").write_bytes(b"x" * 3000)

        result = await service.list_video_files(include_metadata=False)

        assert result.total_count == 3
        assert len(result.files) == 3
        assert result.error is None
        assert result.total_size_bytes == 6000

    @pytest.mark.asyncio
    async def test_list_filters_non_video(self, service, temp_videos_dir):
        """Test that non-video files are filtered out."""
        (temp_videos_dir / "video.mp4").write_bytes(b"x" * 1000)
        (temp_videos_dir / "readme.txt").write_text("text file")
        (temp_videos_dir / "image.jpg").write_bytes(b"image")
        (temp_videos_dir / "script.py").write_text("python")

        result = await service.list_video_files(include_metadata=False)

        assert result.total_count == 1
        names = [f.name for f in result.files]
        assert "video.mp4" in names
        assert "readme.txt" not in names

    @pytest.mark.asyncio
    async def test_list_sorted_by_name(self, service, temp_videos_dir):
        """Test that files are sorted alphabetically."""
        (temp_videos_dir / "zebra.mp4").write_bytes(b"x")
        (temp_videos_dir / "alpha.mp4").write_bytes(b"x")
        (temp_videos_dir / "beta.mp4").write_bytes(b"x")

        result = await service.list_video_files(include_metadata=False)

        names = [f.name for f in result.files]
        assert names == ["alpha.mp4", "beta.mp4", "zebra.mp4"]

    @pytest.mark.asyncio
    async def test_get_file_info_existing(self, service, temp_videos_dir):
        """Test getting info for existing video file."""
        video_file = temp_videos_dir / "test.mp4"
        video_file.write_bytes(b"x" * 5000)

        result = await service.get_file_info("test.mp4")

        assert result.exists is True
        assert result.error is None
        assert result.file is not None
        assert result.file.name == "test.mp4"
        assert result.file.size_bytes == 5000
        assert result.file.extension == ".mp4"

    @pytest.mark.asyncio
    async def test_get_file_info_nonexistent(self, service):
        """Test getting info for non-existent file."""
        result = await service.get_file_info("nonexistent.mp4")

        assert result.exists is False
        assert result.error is not None
        assert "not found" in result.error.lower()
        assert result.file is None

    @pytest.mark.asyncio
    async def test_get_file_info_path_traversal(self, service, temp_videos_dir):
        """Test path traversal protection."""
        # Create a file outside the videos directory
        outside_file = temp_videos_dir.parent / "secret.txt"
        outside_file.write_text("secret data")

        result = await service.get_file_info("../secret.txt")

        assert result.exists is False
        # Should either say "outside" or "not found"
        assert result.file is None

    @pytest.mark.asyncio
    async def test_get_file_info_absolute_path(self, service, temp_videos_dir):
        """Test handling of absolute paths."""
        video_file = temp_videos_dir / "absolute_test.mp4"
        video_file.write_bytes(b"content")

        # Use absolute path
        result = await service.get_file_info(str(video_file))

        assert result.exists is True
        assert result.file is not None
        assert result.file.name == "absolute_test.mp4"

    @pytest.mark.asyncio
    async def test_get_file_info_subdirectory(self, service, temp_videos_dir):
        """Test getting file from subdirectory."""
        subdir = temp_videos_dir / "subdir"
        subdir.mkdir()
        video_file = subdir / "nested.mp4"
        video_file.write_bytes(b"nested content")

        result = await service.get_file_info("subdir/nested.mp4")

        assert result.exists is True
        assert result.file is not None
        assert result.file.name == "nested.mp4"
        assert "subdir" in result.file.path

    @pytest.mark.asyncio
    async def test_get_file_info_non_video(self, service, temp_videos_dir):
        """Test getting info for non-video file."""
        text_file = temp_videos_dir / "readme.txt"
        text_file.write_text("text content")

        result = await service.get_file_info("readme.txt")

        assert result.exists is True  # File exists
        assert "not a valid video" in result.error.lower()
        assert result.file is None

    @pytest.mark.asyncio
    async def test_file_metadata_fields(self, service, temp_videos_dir):
        """Test that all metadata fields are populated."""
        video_file = temp_videos_dir / "complete.mp4"
        video_file.write_bytes(b"x" * 10000)

        result = await service.get_file_info("complete.mp4")

        assert result.file is not None
        assert result.file.name == "complete.mp4"
        assert result.file.path == "complete.mp4"
        assert result.file.full_path.endswith("complete.mp4")
        assert result.file.size_bytes == 10000
        assert result.file.size_formatted == "9.8 KB"
        assert result.file.modified is not None
        assert result.file.extension == ".mp4"


class TestVideoFileMetadataModel:
    """Tests for VideoFileMetadata Pydantic model."""

    def test_required_fields(self):
        """Test that required fields must be provided."""
        with pytest.raises(Exception):  # Pydantic validation error
            VideoFileMetadata()

    def test_optional_video_fields(self, mock_video_metadata):
        """Test that video metadata fields can be None."""
        basic = VideoFileMetadata(
            name="test.mp4",
            path="test.mp4",
            full_path="/videos/test.mp4",
            size_bytes=1000,
            size_formatted="1.0 KB",
            modified="2025-12-26T00:00:00",
            extension=".mp4",
        )

        assert basic.duration_seconds is None
        assert basic.width is None
        assert basic.video_codec is None

    def test_full_metadata(self, mock_video_metadata):
        """Test metadata with all fields populated."""
        assert mock_video_metadata.duration_seconds == 120.5
        assert mock_video_metadata.resolution == "1920x1080"
        assert mock_video_metadata.video_codec == "h264"
        assert mock_video_metadata.has_audio is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
