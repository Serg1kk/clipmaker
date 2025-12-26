"""
Tests for the engaging moments detection service.

Tests cover:
- EngagingMoment model validation
- Transcript parsing and formatting
- Gemini response parsing
- Duration filtering (13-60 seconds)
- Edge cases and error handling
"""

import json
import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from backend.services.engaging_moments import (
    EngagingMoment,
    EngagingMomentsResponse,
    find_engaging_moments,
    find_engaging_moments_async,
    find_engaging_moments_response,
    _format_transcript_for_prompt,
    _extract_text_for_moment,
    _parse_gemini_response,
    _get_transcript_duration,
)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def sample_transcript():
    """Sample transcript with multiple segments."""
    return {
        "segments": [
            {"id": 0, "start": 0.0, "end": 10.0, "text": "Welcome to our show today."},
            {"id": 1, "start": 10.0, "end": 25.0, "text": "We're going to reveal something amazing that will change how you think."},
            {"id": 2, "start": 25.0, "end": 45.0, "text": "This discovery took scientists ten years to make and the results are shocking."},
            {"id": 3, "start": 45.0, "end": 60.0, "text": "Let me tell you exactly how this works and why it matters."},
            {"id": 4, "start": 60.0, "end": 120.0, "text": "Here's the detailed explanation of the methodology and findings..."},
        ]
    }


@pytest.fixture
def short_transcript():
    """Transcript shorter than minimum hook duration."""
    return {
        "segments": [
            {"id": 0, "start": 0.0, "end": 5.0, "text": "Hello world."},
        ]
    }


@pytest.fixture
def empty_transcript():
    """Empty transcript."""
    return {"segments": []}


@pytest.fixture
def mock_gemini_response():
    """Mock successful Gemini response."""
    return json.dumps({
        "moments": [
            {
                "start": 10.0,
                "end": 45.0,
                "reason": "Creates curiosity and reveals surprising information"
            },
            {
                "start": 45.0,
                "end": 60.0,
                "reason": "Provides clear value proposition"
            }
        ]
    })


@pytest.fixture
def mock_gemini_response_with_invalid_duration():
    """Mock response with moments outside valid duration range."""
    return json.dumps({
        "moments": [
            {
                "start": 0.0,
                "end": 5.0,  # Too short (5s < 13s)
                "reason": "Too short"
            },
            {
                "start": 10.0,
                "end": 45.0,  # Valid (35s)
                "reason": "Valid duration"
            },
            {
                "start": 0.0,
                "end": 120.0,  # Too long (120s > 60s)
                "reason": "Too long"
            }
        ]
    })


# =============================================================================
# EngagingMoment Model Tests
# =============================================================================

class TestEngagingMoment:
    """Tests for EngagingMoment model."""

    def test_valid_moment_creation(self):
        """Test creating a valid moment."""
        moment = EngagingMoment(
            start=10.0,
            end=30.0,
            reason="Interesting content",
            text="Sample text",
            confidence=0.9
        )
        assert moment.start == 10.0
        assert moment.end == 30.0
        assert moment.reason == "Interesting content"
        assert moment.text == "Sample text"
        assert moment.confidence == 0.9

    def test_duration_calculation(self):
        """Test duration property."""
        moment = EngagingMoment(start=10.0, end=45.0, reason="Test")
        assert moment.duration == 35.0

    def test_is_valid_hook_within_range(self):
        """Test is_valid_hook returns True for valid duration."""
        moment = EngagingMoment(start=0.0, end=30.0, reason="Test")
        assert moment.is_valid_hook() is True  # 30s is within 13-60

    def test_is_valid_hook_too_short(self):
        """Test is_valid_hook returns False for short duration."""
        moment = EngagingMoment(start=0.0, end=10.0, reason="Test")
        assert moment.is_valid_hook() is False  # 10s < 13s

    def test_is_valid_hook_too_long(self):
        """Test is_valid_hook returns False for long duration."""
        moment = EngagingMoment(start=0.0, end=90.0, reason="Test")
        assert moment.is_valid_hook() is False  # 90s > 60s

    def test_is_valid_hook_custom_range(self):
        """Test is_valid_hook with custom duration range."""
        moment = EngagingMoment(start=0.0, end=10.0, reason="Test")
        assert moment.is_valid_hook(min_duration=5.0, max_duration=15.0) is True

    def test_end_must_be_after_start(self):
        """Test validation that end must be after start."""
        with pytest.raises(ValueError, match="end must be greater than start"):
            EngagingMoment(start=30.0, end=10.0, reason="Invalid")

    def test_reason_cannot_be_empty(self):
        """Test that reason must have content."""
        with pytest.raises(ValueError):
            EngagingMoment(start=0.0, end=30.0, reason="")

    def test_confidence_bounds(self):
        """Test confidence must be between 0 and 1."""
        with pytest.raises(ValueError):
            EngagingMoment(start=0.0, end=30.0, reason="Test", confidence=1.5)
        with pytest.raises(ValueError):
            EngagingMoment(start=0.0, end=30.0, reason="Test", confidence=-0.1)


class TestEngagingMomentsResponse:
    """Tests for EngagingMomentsResponse model."""

    def test_empty_response(self):
        """Test empty response."""
        response = EngagingMomentsResponse()
        assert response.moments == []
        assert response.total_count == 0

    def test_response_with_moments(self):
        """Test response with moments auto-calculates total."""
        moments = [
            EngagingMoment(start=0.0, end=30.0, reason="Test 1"),
            EngagingMoment(start=30.0, end=60.0, reason="Test 2"),
        ]
        response = EngagingMomentsResponse(moments=moments)
        assert response.total_count == 2


# =============================================================================
# Transcript Parsing Tests
# =============================================================================

class TestTranscriptParsing:
    """Tests for transcript parsing functions."""

    def test_format_transcript_standard(self, sample_transcript):
        """Test formatting standard transcript."""
        result = _format_transcript_for_prompt(sample_transcript)
        assert "[0.00s - 10.00s]:" in result
        assert "Welcome to our show today" in result

    def test_format_transcript_list_format(self):
        """Test formatting transcript as list."""
        transcript = [
            {"start": 0.0, "end": 5.0, "text": "Hello"},
            {"start": 5.0, "end": 10.0, "text": "World"},
        ]
        result = _format_transcript_for_prompt(transcript)
        assert "[0.00s - 5.00s]: Hello" in result
        assert "[5.00s - 10.00s]: World" in result

    def test_format_transcript_nested(self):
        """Test formatting transcript with nested transcription key."""
        transcript = {
            "transcription": {
                "segments": [
                    {"start": 0.0, "end": 5.0, "text": "Nested format"}
                ]
            }
        }
        result = _format_transcript_for_prompt(transcript)
        assert "Nested format" in result

    def test_format_empty_transcript(self, empty_transcript):
        """Test formatting empty transcript."""
        result = _format_transcript_for_prompt(empty_transcript)
        assert result == "No transcript segments found."

    def test_extract_text_for_moment(self, sample_transcript):
        """Test extracting text for a time range."""
        text = _extract_text_for_moment(sample_transcript, 10.0, 45.0)
        assert "reveal something amazing" in text
        assert "shocking" in text

    def test_extract_text_partial_overlap(self, sample_transcript):
        """Test extracting text with partial segment overlap."""
        text = _extract_text_for_moment(sample_transcript, 20.0, 30.0)
        assert "reveal something amazing" in text or "discovery" in text

    def test_get_transcript_duration(self, sample_transcript):
        """Test getting total transcript duration."""
        duration = _get_transcript_duration(sample_transcript)
        assert duration == 120.0


# =============================================================================
# Gemini Response Parsing Tests
# =============================================================================

class TestGeminiResponseParsing:
    """Tests for parsing Gemini responses."""

    def test_parse_valid_response(self, sample_transcript, mock_gemini_response):
        """Test parsing valid JSON response."""
        moments = _parse_gemini_response(mock_gemini_response, sample_transcript)
        assert len(moments) == 2
        assert moments[0].start == 10.0
        assert moments[0].end == 45.0

    def test_parse_response_with_code_blocks(self, sample_transcript):
        """Test parsing response wrapped in markdown code blocks."""
        response = '```json\n{"moments": [{"start": 10, "end": 30, "reason": "Test"}]}\n```'
        moments = _parse_gemini_response(response, sample_transcript)
        assert len(moments) == 1

    def test_parse_empty_moments(self, sample_transcript):
        """Test parsing response with no moments."""
        response = '{"moments": []}'
        moments = _parse_gemini_response(response, sample_transcript)
        assert len(moments) == 0

    def test_parse_invalid_json(self, sample_transcript):
        """Test parsing invalid JSON returns empty list."""
        response = "This is not valid JSON"
        moments = _parse_gemini_response(response, sample_transcript)
        assert len(moments) == 0

    def test_parse_returns_all_valid_moments(
        self, sample_transcript, mock_gemini_response_with_invalid_duration
    ):
        """Test that parse returns all syntactically valid moments (filtering happens later)."""
        moments = _parse_gemini_response(
            mock_gemini_response_with_invalid_duration, sample_transcript
        )
        # All 3 moments should be returned (duration filtering happens in find_engaging_moments)
        assert len(moments) == 3
        # Verify moments are properly parsed
        durations = [m.duration for m in moments]
        assert 5.0 in durations   # Too short for default range
        assert 35.0 in durations  # Valid for default range
        assert 120.0 in durations # Too long for default range


# =============================================================================
# find_engaging_moments Function Tests
# =============================================================================

class TestFindEngagingMoments:
    """Tests for the main find_engaging_moments function."""

    def test_empty_transcript_raises_error(self):
        """Test that empty transcript raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            find_engaging_moments({})

    def test_none_transcript_raises_error(self):
        """Test that None transcript raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            find_engaging_moments(None)

    def test_no_segments_returns_empty(self, empty_transcript):
        """Test that transcript with no segments returns empty list."""
        with patch('backend.services.engaging_moments.OpenRouterClient'):
            result = find_engaging_moments(empty_transcript)
            assert result == []

    @patch('backend.services.engaging_moments.OpenRouterClient')
    def test_successful_moment_detection(
        self, mock_client_class, sample_transcript, mock_gemini_response
    ):
        """Test successful moment detection with mocked API."""
        mock_client = MagicMock()
        mock_client.call_gemini.return_value = mock_gemini_response
        mock_client_class.return_value = mock_client

        result = find_engaging_moments(sample_transcript)

        assert len(result) == 2
        assert result[0].start == 10.0
        assert result[0].end == 45.0
        assert "curiosity" in result[0].reason.lower()

    @patch('backend.services.engaging_moments.OpenRouterClient')
    def test_moments_sorted_by_start_time(
        self, mock_client_class, sample_transcript
    ):
        """Test that moments are sorted by start time."""
        mock_client = MagicMock()
        # Return moments in reverse order
        mock_client.call_gemini.return_value = json.dumps({
            "moments": [
                {"start": 45.0, "end": 60.0, "reason": "Second"},
                {"start": 10.0, "end": 30.0, "reason": "First"},
            ]
        })
        mock_client_class.return_value = mock_client

        result = find_engaging_moments(sample_transcript)

        assert result[0].start < result[1].start

    @patch('backend.services.engaging_moments.OpenRouterClient')
    def test_custom_duration_range(
        self, mock_client_class, sample_transcript
    ):
        """Test using custom min/max duration."""
        mock_client = MagicMock()
        # Moments that will pass custom 5-15s range:
        # - 8s moment (passes 5-15 filter)
        # - 20s moment (fails 5-15 filter)
        mock_client.call_gemini.return_value = json.dumps({
            "moments": [
                {"start": 0.0, "end": 8.0, "reason": "Short valid"},  # 8s - passes custom range
                {"start": 10.0, "end": 30.0, "reason": "Too long"},  # 20s - fails custom range
            ]
        })
        mock_client_class.return_value = mock_client

        result = find_engaging_moments(
            sample_transcript,
            min_duration=5.0,
            max_duration=15.0
        )

        # Only the 8s moment should pass with custom 5-15s limits
        assert len(result) == 1
        assert result[0].duration == 8.0

    @patch('backend.services.engaging_moments.OpenRouterClient')
    def test_client_closed_after_use(
        self, mock_client_class, sample_transcript, mock_gemini_response
    ):
        """Test that client is closed after use when not provided."""
        mock_client = MagicMock()
        mock_client.call_gemini.return_value = mock_gemini_response
        mock_client_class.return_value = mock_client

        find_engaging_moments(sample_transcript)

        mock_client.close.assert_called_once()

    @patch('backend.services.engaging_moments.OpenRouterClient')
    def test_provided_client_not_closed(
        self, mock_client_class, sample_transcript, mock_gemini_response
    ):
        """Test that provided client is not closed."""
        mock_client = MagicMock()
        mock_client.call_gemini.return_value = mock_gemini_response

        find_engaging_moments(sample_transcript, client=mock_client)

        mock_client.close.assert_not_called()


# =============================================================================
# Async Function Tests
# =============================================================================

class TestFindEngagingMomentsAsync:
    """Tests for async version of find_engaging_moments."""

    @pytest.mark.asyncio
    async def test_empty_transcript_raises_error(self):
        """Test that empty transcript raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            await find_engaging_moments_async({})

    @pytest.mark.asyncio
    @patch('backend.services.engaging_moments.AsyncOpenRouterClient')
    async def test_successful_async_detection(
        self, mock_client_class, sample_transcript, mock_gemini_response
    ):
        """Test successful async moment detection."""
        mock_client = AsyncMock()
        mock_client.call_gemini.return_value = mock_gemini_response
        mock_client_class.return_value = mock_client

        result = await find_engaging_moments_async(sample_transcript)

        assert len(result) == 2

    @pytest.mark.asyncio
    @patch('backend.services.engaging_moments.AsyncOpenRouterClient')
    async def test_async_client_closed(
        self, mock_client_class, sample_transcript, mock_gemini_response
    ):
        """Test that async client is closed after use."""
        mock_client = AsyncMock()
        mock_client.call_gemini.return_value = mock_gemini_response
        mock_client_class.return_value = mock_client

        await find_engaging_moments_async(sample_transcript)

        mock_client.close.assert_called_once()


# =============================================================================
# Response Wrapper Tests
# =============================================================================

class TestFindEngagingMomentsResponse:
    """Tests for the response wrapper function."""

    @patch('backend.services.engaging_moments.OpenRouterClient')
    def test_returns_structured_response(
        self, mock_client_class, sample_transcript, mock_gemini_response
    ):
        """Test that response wrapper returns structured response."""
        mock_client = MagicMock()
        mock_client.call_gemini.return_value = mock_gemini_response
        mock_client_class.return_value = mock_client

        response = find_engaging_moments_response(sample_transcript)

        assert isinstance(response, EngagingMomentsResponse)
        assert response.total_count == 2
        assert response.transcript_duration == 120.0


# =============================================================================
# Edge Cases
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    @patch('backend.services.engaging_moments.OpenRouterClient')
    def test_handles_api_error_gracefully(
        self, mock_client_class, sample_transcript
    ):
        """Test handling of API errors."""
        from backend.services.openrouter.exceptions import ServerError

        mock_client = MagicMock()
        mock_client.call_gemini.side_effect = ServerError("API Error", status_code=500)
        mock_client_class.return_value = mock_client

        with pytest.raises(ServerError):
            find_engaging_moments(sample_transcript)

    @patch('backend.services.engaging_moments.OpenRouterClient')
    def test_handles_malformed_timestamps(
        self, mock_client_class, sample_transcript
    ):
        """Test handling of malformed timestamps in response."""
        mock_client = MagicMock()
        # Create a response with one invalid entry and one valid 20s entry
        mock_client.call_gemini.return_value = json.dumps({
            "moments": [
                {"start": "invalid", "end": 30.0, "reason": "Invalid start"},
                {"start": 10.0, "end": 30.0, "reason": "Valid 20s moment"},  # 20s is within 13-60
            ]
        })
        mock_client_class.return_value = mock_client

        result = find_engaging_moments(sample_transcript)

        # Should skip invalid entry and keep the valid 20s moment
        assert len(result) == 1
        assert result[0].start == 10.0
        assert result[0].end == 30.0

    def test_transcript_with_empty_text_segments(self):
        """Test handling transcript with empty text segments."""
        transcript = {
            "segments": [
                {"id": 0, "start": 0.0, "end": 10.0, "text": ""},
                {"id": 1, "start": 10.0, "end": 30.0, "text": "Valid text"},
            ]
        }
        result = _format_transcript_for_prompt(transcript)
        assert "Valid text" in result
        assert "[0.00s - 10.00s]:" not in result  # Empty text skipped

    def test_overlapping_moments_in_response(self, sample_transcript):
        """Test handling of overlapping moments."""
        response = json.dumps({
            "moments": [
                {"start": 10.0, "end": 40.0, "reason": "First"},
                {"start": 20.0, "end": 50.0, "reason": "Overlapping"},
            ]
        })
        moments = _parse_gemini_response(response, sample_transcript)

        # Both should be included (let caller decide how to handle overlap)
        assert len(moments) == 2

    def test_exact_boundary_durations(self):
        """Test moments at exact 13s and 60s boundaries."""
        # Exactly 13 seconds
        moment_13 = EngagingMoment(start=0.0, end=13.0, reason="Test")
        assert moment_13.is_valid_hook() is True

        # Exactly 60 seconds
        moment_60 = EngagingMoment(start=0.0, end=60.0, reason="Test")
        assert moment_60.is_valid_hook() is True

        # Just under 13 seconds
        moment_under = EngagingMoment(start=0.0, end=12.9, reason="Test")
        assert moment_under.is_valid_hook() is False

        # Just over 60 seconds
        moment_over = EngagingMoment(start=0.0, end=60.1, reason="Test")
        assert moment_over.is_valid_hook() is False
