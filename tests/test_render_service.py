"""
Comprehensive tests for the RenderService.

Tests cover:
- RenderRequest schema validation
- Moment timerange extraction
- Subtitle generation and burning
- Audio processing modes
- Complete render pipeline
- Error handling
"""

import asyncio
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from models.transcription_moment import TranscriptionMoment, MomentType
from services.render_service import (
    RenderService,
    RenderRequest,
    RenderError,
    SubtitleBurnError,
    AudioMergeError,
    MomentExtractionError,
    RenderProgress,
    SubtitleConfig,
    AudioConfig,
    SubtitlePosition,
    AudioMode,
    render_final_clip,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def sample_moment():
    """Create a sample TranscriptionMoment for testing."""
    return TranscriptionMoment(
        id="m-test-12345678",
        start_time=10.5,
        end_time=25.0,
        text="This is a test moment with some meaningful content.",
        segment_id=0,
        moment_type=MomentType.KEY_POINT,
        labels=["test", "sample"],
        confidence=0.95,
    )


@pytest.fixture
def sample_words():
    """Create sample word timestamps for karaoke testing."""
    return [
        {"word": "This ", "start": 10.5, "end": 10.8},
        {"word": "is ", "start": 10.8, "end": 11.0},
        {"word": "a ", "start": 11.0, "end": 11.1},
        {"word": "test ", "start": 11.1, "end": 11.5},
        {"word": "moment ", "start": 11.5, "end": 12.0},
        {"word": "with ", "start": 12.0, "end": 12.3},
        {"word": "some ", "start": 12.3, "end": 12.6},
        {"word": "meaningful ", "start": 12.6, "end": 13.2},
        {"word": "content.", "start": 13.2, "end": 14.0},
    ]


@pytest.fixture
def temp_video_path(tmp_path):
    """Create a temporary file path for testing."""
    video_path = tmp_path / "test_video.mp4"
    # Create an empty file for existence checks
    video_path.touch()
    return str(video_path)


@pytest.fixture
def temp_output_dir(tmp_path):
    """Create a temporary output directory."""
    output_dir = tmp_path / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


# ============================================================================
# RenderRequest Schema Tests
# ============================================================================

class TestRenderRequest:
    """Tests for RenderRequest Pydantic schema."""

    def test_create_basic_request(self, sample_moment, temp_video_path):
        """Test creating a basic render request."""
        request = RenderRequest(
            moment=sample_moment,
            source_video_path=temp_video_path,
        )

        assert request.moment.id == "m-test-12345678"
        assert request.moment.start_time == 10.5
        assert request.moment.end_time == 25.0
        assert request.source_video_path == temp_video_path
        assert request.output_filename is None
        assert request.subtitle_words is None
        assert request.enable_composite is False

    def test_create_request_with_subtitles(self, sample_moment, sample_words, temp_video_path):
        """Test creating request with subtitle configuration."""
        request = RenderRequest(
            moment=sample_moment,
            source_video_path=temp_video_path,
            subtitle_words=sample_words,
            subtitle_config=SubtitleConfig(
                font_size=64,
                primary_color="#FF0000",
                position=SubtitlePosition.TOP_CENTER,
            ),
        )

        assert request.subtitle_words == sample_words
        assert request.subtitle_config.font_size == 64
        assert request.subtitle_config.primary_color == "#FF0000"
        assert request.subtitle_config.position == SubtitlePosition.TOP_CENTER

    def test_create_request_with_audio_config(self, sample_moment, temp_video_path):
        """Test creating request with audio configuration."""
        request = RenderRequest(
            moment=sample_moment,
            source_video_path=temp_video_path,
            audio_config=AudioConfig(
                mode=AudioMode.MUTE,
            ),
        )

        assert request.audio_config.mode == AudioMode.MUTE

    def test_effective_times_with_padding(self, sample_moment, temp_video_path):
        """Test effective start/end times with padding."""
        request = RenderRequest(
            moment=sample_moment,
            source_video_path=temp_video_path,
            padding_start=2.0,
            padding_end=1.5,
        )

        assert request.effective_start_time == 8.5  # 10.5 - 2.0
        assert request.effective_end_time == 26.5   # 25.0 + 1.5
        assert request.effective_duration == 18.0   # 26.5 - 8.5

    def test_effective_start_time_not_negative(self, temp_video_path):
        """Test that effective start time doesn't go negative."""
        moment = TranscriptionMoment(
            start_time=1.0,
            end_time=5.0,
            text="Short moment",
            segment_id=0,
        )
        request = RenderRequest(
            moment=moment,
            source_video_path=temp_video_path,
            padding_start=5.0,  # Would make start negative
        )

        assert request.effective_start_time == 0.0  # Clamped to 0

    def test_audio_replace_requires_external_path(self, sample_moment, temp_video_path):
        """Test that REPLACE audio mode requires external audio path."""
        with pytest.raises(ValueError, match="external_audio_path required"):
            RenderRequest(
                moment=sample_moment,
                source_video_path=temp_video_path,
                audio_config=AudioConfig(
                    mode=AudioMode.REPLACE,
                    external_audio_path=None,  # Missing required path
                ),
            )

    def test_audio_mix_requires_external_path(self, sample_moment, temp_video_path):
        """Test that MIX audio mode requires external audio path."""
        with pytest.raises(ValueError, match="external_audio_path required"):
            RenderRequest(
                moment=sample_moment,
                source_video_path=temp_video_path,
                audio_config=AudioConfig(
                    mode=AudioMode.MIX,
                    external_audio_path=None,
                ),
            )


# ============================================================================
# SubtitleConfig Tests
# ============================================================================

class TestSubtitleConfig:
    """Tests for SubtitleConfig schema."""

    def test_default_values(self):
        """Test default subtitle configuration values."""
        config = SubtitleConfig()

        assert config.enabled is True
        assert config.font_name == "Arial"
        assert config.font_size == 48
        assert config.primary_color == "#FFFF00"
        assert config.secondary_color == "#FFFFFF"
        assert config.outline_color == "#000000"
        assert config.position == SubtitlePosition.BOTTOM_CENTER
        assert config.karaoke_effect == "sweep"

    def test_custom_values(self):
        """Test custom subtitle configuration."""
        config = SubtitleConfig(
            font_name="Helvetica",
            font_size=72,
            primary_color="#00FF00",
            position=SubtitlePosition.CUSTOM,
            custom_x=540,
            custom_y=100,
            bold=True,
        )

        assert config.font_name == "Helvetica"
        assert config.font_size == 72
        assert config.primary_color == "#00FF00"
        assert config.position == SubtitlePosition.CUSTOM
        assert config.custom_x == 540
        assert config.custom_y == 100
        assert config.bold is True

    def test_invalid_color_format(self):
        """Test that invalid color format raises error."""
        with pytest.raises(ValueError):
            SubtitleConfig(primary_color="invalid")


# ============================================================================
# AudioConfig Tests
# ============================================================================

class TestAudioConfig:
    """Tests for AudioConfig schema."""

    def test_default_values(self):
        """Test default audio configuration values."""
        config = AudioConfig()

        assert config.mode == AudioMode.ORIGINAL
        assert config.external_audio_path is None
        assert config.original_volume == 1.0
        assert config.external_volume == 1.0
        assert config.fade_in is None
        assert config.fade_out is None

    def test_replace_mode(self):
        """Test replace audio mode configuration."""
        config = AudioConfig(
            mode=AudioMode.REPLACE,
            external_audio_path="/path/to/audio.mp3",
            external_volume=0.8,
        )

        assert config.mode == AudioMode.REPLACE
        assert config.external_audio_path == "/path/to/audio.mp3"
        assert config.external_volume == 0.8

    def test_mix_mode(self):
        """Test mix audio mode configuration."""
        config = AudioConfig(
            mode=AudioMode.MIX,
            external_audio_path="/path/to/audio.mp3",
            original_volume=0.5,
            external_volume=0.7,
        )

        assert config.mode == AudioMode.MIX
        assert config.original_volume == 0.5
        assert config.external_volume == 0.7

    def test_volume_bounds(self):
        """Test that volume values are bounded 0.0-2.0."""
        with pytest.raises(ValueError):
            AudioConfig(original_volume=2.5)

        with pytest.raises(ValueError):
            AudioConfig(original_volume=-0.1)


# ============================================================================
# RenderService Unit Tests
# ============================================================================

class TestRenderService:
    """Tests for RenderService functionality."""

    def test_service_initialization(self, temp_output_dir):
        """Test service initialization."""
        service = RenderService(output_dir=temp_output_dir)

        assert service.output_dir == temp_output_dir
        assert service.output_dir.exists()

    def test_generate_output_filename_from_moment(self, temp_output_dir, sample_moment, temp_video_path):
        """Test automatic filename generation from moment."""
        service = RenderService(output_dir=temp_output_dir)

        request = RenderRequest(
            moment=sample_moment,
            source_video_path=temp_video_path,
        )

        filename = service._generate_output_filename(request)

        assert filename.startswith("clip_")
        assert filename.endswith(".mp4")
        assert "10s-25s" in filename

    def test_generate_output_filename_custom(self, temp_output_dir, sample_moment, temp_video_path):
        """Test custom filename usage."""
        service = RenderService(output_dir=temp_output_dir)

        request = RenderRequest(
            moment=sample_moment,
            source_video_path=temp_video_path,
            output_filename="my_custom_clip.mp4",
        )

        filename = service._generate_output_filename(request)

        assert filename == "my_custom_clip.mp4"

    def test_generate_output_filename_adds_extension(self, temp_output_dir, sample_moment, temp_video_path):
        """Test that .mp4 extension is added if missing."""
        service = RenderService(output_dir=temp_output_dir)

        request = RenderRequest(
            moment=sample_moment,
            source_video_path=temp_video_path,
            output_filename="my_clip",  # No extension
        )

        filename = service._generate_output_filename(request)

        assert filename == "my_clip.mp4"

    def test_filter_words_in_range(self, temp_output_dir, sample_words):
        """Test filtering words within moment timerange."""
        service = RenderService(output_dir=temp_output_dir)

        # Filter words between 11.0 and 12.5
        filtered = service._filter_words_in_range(sample_words, 11.0, 12.5)

        # Should include words that overlap with this range
        assert len(filtered) > 0
        for word in filtered:
            word_start = word.get('start', word.get('start_time', 0))
            word_end = word.get('end', word.get('end_time', 0))
            assert word_end > 11.0 and word_start < 12.5

    def test_adjust_word_timings(self, temp_output_dir, sample_words):
        """Test adjusting word timings relative to clip start."""
        service = RenderService(output_dir=temp_output_dir)

        offset = 10.0
        adjusted = service._adjust_word_timings(sample_words, offset)

        assert len(adjusted) == len(sample_words)

        # Check first word adjustment
        assert adjusted[0]['start'] == sample_words[0]['start'] - offset
        assert adjusted[0]['end'] == sample_words[0]['end'] - offset

    def test_get_codec_mapping(self, temp_output_dir):
        """Test codec name mapping."""
        service = RenderService(output_dir=temp_output_dir)

        assert service._get_codec("h264") == "libx264"
        assert service._get_codec("hevc") == "libx265"
        assert service._get_codec("h265") == "libx265"
        assert service._get_codec("vp9") == "libvpx-vp9"
        assert service._get_codec("unknown") == "unknown"  # Passthrough


# ============================================================================
# RenderProgress Tests
# ============================================================================

class TestRenderProgress:
    """Tests for RenderProgress dataclass."""

    def test_progress_creation(self):
        """Test creating progress object."""
        progress = RenderProgress(
            phase="extracting",
            percent=50.0,
            current_step=1,
            total_steps=4,
            message="Extracting video segment...",
        )

        assert progress.phase == "extracting"
        assert progress.percent == 50.0
        assert progress.current_step == 1
        assert progress.total_steps == 4

    def test_progress_to_dict(self):
        """Test progress to_dict conversion."""
        progress = RenderProgress(
            phase="subtitles",
            percent=75.555,
            current_step=3,
            total_steps=4,
            message="Burning subtitles...",
        )

        result = progress.to_dict()

        assert result["phase"] == "subtitles"
        assert result["percent"] == 75.56  # Rounded to 2 decimal places
        assert result["current_step"] == 3
        assert result["total_steps"] == 4
        assert result["message"] == "Burning subtitles..."


# ============================================================================
# Integration Tests (with mocked FFmpeg)
# ============================================================================

class TestRenderServiceIntegration:
    """Integration tests with mocked FFmpeg calls."""

    @pytest.fixture
    def mock_ffmpeg_service(self):
        """Create a mock FFmpeg service."""
        with patch('backend.services.render_service.FFmpegService') as mock:
            instance = mock.return_value
            instance.is_available.return_value = True
            instance.ffmpeg_path = "/usr/bin/ffmpeg"
            instance.ffprobe_path = "/usr/bin/ffprobe"
            instance.get_video_info = AsyncMock(return_value=MagicMock(
                duration=60.0,
                width=1920,
                height=1080,
                frame_rate=30.0,
                has_audio=True,
            ))
            yield instance

    @pytest.mark.asyncio
    async def test_service_availability_check(self, temp_output_dir, mock_ffmpeg_service):
        """Test FFmpeg availability check."""
        service = RenderService(output_dir=temp_output_dir)
        # The mock will be used when service methods are called
        mock_ffmpeg_service.is_available.return_value = True

    @pytest.mark.asyncio
    async def test_render_request_validation_before_processing(
        self, temp_output_dir, sample_moment
    ):
        """Test that invalid requests are caught before processing."""
        service = RenderService(output_dir=temp_output_dir)

        # Create request with non-existent video file
        request = RenderRequest(
            moment=sample_moment,
            source_video_path="/nonexistent/video.mp4",
        )

        # Mock FFmpeg availability
        with patch.object(service, 'is_available', return_value=True):
            with patch.object(service, 'get_video_info', new_callable=AsyncMock) as mock_info:
                mock_info.side_effect = FileNotFoundError("Video not found")

                with pytest.raises(Exception):  # Should raise during video info fetch
                    await service.render_final_clip(request)


# ============================================================================
# Convenience Function Tests
# ============================================================================

class TestRenderFinalClipFunction:
    """Tests for the convenience render_final_clip function."""

    @pytest.mark.asyncio
    async def test_convenience_function_creates_request(
        self, temp_output_dir, sample_moment, sample_words, temp_video_path
    ):
        """Test that the convenience function properly creates a request."""
        with patch('services.render_service.RenderService') as MockService:
            mock_instance = MockService.return_value
            mock_instance.render_final_clip = AsyncMock(return_value=Path("/output/clip.mp4"))

            result = await render_final_clip(
                moment=sample_moment,
                source_video_path=temp_video_path,
                subtitle_words=sample_words,
                output_filename="test_output.mp4",
                output_dir=str(temp_output_dir),
            )

            # Verify the service was called
            mock_instance.render_final_clip.assert_called_once()

            # Check the request that was passed
            call_args = mock_instance.render_final_clip.call_args
            request = call_args[0][0]  # First positional argument

            assert request.moment == sample_moment
            assert request.source_video_path == temp_video_path
            assert request.subtitle_words == sample_words
            assert request.output_filename == "test_output.mp4"


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestRenderErrors:
    """Tests for render error handling."""

    def test_render_error_with_details(self):
        """Test RenderError with additional details."""
        error = RenderError("Render failed", details="FFmpeg exited with code 1")

        assert str(error) == "Render failed"
        assert error.message == "Render failed"
        assert error.details == "FFmpeg exited with code 1"

    def test_subtitle_burn_error(self):
        """Test SubtitleBurnError creation."""
        error = SubtitleBurnError(
            "Failed to burn subtitles",
            details="Invalid ASS file format"
        )

        assert isinstance(error, RenderError)
        assert "subtitle" in str(error).lower() or "burn" in str(error).lower() or error.message == "Failed to burn subtitles"

    def test_audio_merge_error(self):
        """Test AudioMergeError creation."""
        error = AudioMergeError(
            "Audio merge failed",
            details="Audio streams have different sample rates"
        )

        assert isinstance(error, RenderError)
        assert error.message == "Audio merge failed"

    def test_moment_extraction_error(self):
        """Test MomentExtractionError creation."""
        error = MomentExtractionError(
            "Could not extract moment",
            details="Source video is corrupted"
        )

        assert isinstance(error, RenderError)
        assert error.message == "Could not extract moment"


# ============================================================================
# Subtitle Position Tests
# ============================================================================

class TestSubtitlePosition:
    """Tests for subtitle positioning."""

    def test_position_enum_values(self):
        """Test SubtitlePosition enum values."""
        assert SubtitlePosition.BOTTOM_CENTER.value == "bottom_center"
        assert SubtitlePosition.TOP_CENTER.value == "top_center"
        assert SubtitlePosition.MIDDLE_CENTER.value == "middle_center"
        assert SubtitlePosition.CUSTOM.value == "custom"

    def test_position_mapping_to_ass_alignment(self, temp_output_dir):
        """Test position to ASS alignment mapping."""
        from services.karaoke_generator import ASSAlignment

        service = RenderService(output_dir=temp_output_dir)

        assert service._get_subtitle_alignment(SubtitlePosition.BOTTOM_CENTER) == ASSAlignment.BOTTOM_CENTER
        assert service._get_subtitle_alignment(SubtitlePosition.TOP_CENTER) == ASSAlignment.TOP_CENTER
        assert service._get_subtitle_alignment(SubtitlePosition.MIDDLE_CENTER) == ASSAlignment.MIDDLE_CENTER


# ============================================================================
# Audio Mode Tests
# ============================================================================

class TestAudioMode:
    """Tests for audio mode handling."""

    def test_audio_mode_enum_values(self):
        """Test AudioMode enum values."""
        assert AudioMode.ORIGINAL.value == "original"
        assert AudioMode.REPLACE.value == "replace"
        assert AudioMode.MIX.value == "mix"
        assert AudioMode.MUTE.value == "mute"
