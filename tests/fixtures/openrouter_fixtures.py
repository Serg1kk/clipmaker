"""
OpenRouter API Client Test Fixtures

Provides comprehensive fixtures for testing OpenRouter integration
without making real API calls.

Usage:
    from tests.fixtures.openrouter_fixtures import *

    # In test functions:
    def test_something(mock_env_vars, success_response):
        # mock_env_vars sets up environment
        # success_response provides mock API response
        pass
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Conditional import for httpx
try:
    import httpx
except ImportError:
    httpx = None  # Will be mocked if not available


# =============================================================================
# Environment Fixtures
# =============================================================================


@pytest.fixture
def mock_env_vars(monkeypatch):
    """
    Set up mock environment variables for OpenRouter.

    Returns:
        Dict with all configured environment variables
    """
    env_vars = {
        "OPENROUTER_API_KEY": "sk-or-v1-test-key-1234567890abcdef1234567890abcdef",
        "GEMINI_MODEL": "google/gemini-2.5-pro-preview",
        "OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1",
        "OPENROUTER_TIMEOUT": "30",
        "OPENROUTER_MAX_RETRIES": "3",
    }
    for key, value in env_vars.items():
        monkeypatch.setenv(key, value)
    return env_vars


@pytest.fixture
def missing_api_key(monkeypatch):
    """Environment with missing API key."""
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    return None


@pytest.fixture
def invalid_api_key(monkeypatch):
    """Environment with invalid API key format."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "invalid-key-format")
    return "invalid-key-format"


@pytest.fixture
def empty_api_key(monkeypatch):
    """Environment with empty API key."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    return ""


# =============================================================================
# Response Fixtures - Success Cases
# =============================================================================


@pytest.fixture
def success_response() -> Dict[str, Any]:
    """
    Mock successful OpenRouter API response with clip recommendations.

    Returns:
        Dict matching OpenRouter chat completion response format
    """
    return {
        "id": "gen-test-12345",
        "model": "google/gemini-2.5-pro-preview",
        "object": "chat.completion",
        "created": 1703644800,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "clips": [
                            {
                                "start_time": 125.5,
                                "end_time": 158.2,
                                "duration": 32.7,
                                "score": 0.92,
                                "reasoning": "Engaging story with emotional hook about personal transformation",
                                "hook_type": "story",
                                "topics": ["personal growth", "motivation", "success"],
                                "transcript_excerpt": "And that's when I realized everything was about to change..."
                            },
                            {
                                "start_time": 456.0,
                                "end_time": 498.7,
                                "duration": 42.7,
                                "score": 0.88,
                                "reasoning": "Controversial opinion with high debate potential",
                                "hook_type": "controversy",
                                "topics": ["technology", "AI ethics", "future"],
                                "transcript_excerpt": "I completely disagree with the mainstream view on AI..."
                            },
                            {
                                "start_time": 789.3,
                                "end_time": 832.1,
                                "duration": 42.8,
                                "score": 0.85,
                                "reasoning": "Surprising revelation that challenges assumptions",
                                "hook_type": "revelation",
                                "topics": ["science", "discovery"],
                                "transcript_excerpt": "What nobody tells you about this is..."
                            }
                        ]
                    })
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 2500,
            "completion_tokens": 350,
            "total_tokens": 2850
        }
    }


@pytest.fixture
def empty_clips_response() -> Dict[str, Any]:
    """Response with no clip recommendations (valid but empty)."""
    return {
        "id": "gen-empty-12345",
        "model": "google/gemini-2.5-pro-preview",
        "object": "chat.completion",
        "created": 1703644800,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "clips": [],
                        "reasoning": "No sufficiently engaging moments found in this transcription."
                    })
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {"prompt_tokens": 2500, "completion_tokens": 20, "total_tokens": 2520}
    }


@pytest.fixture
def single_clip_response() -> Dict[str, Any]:
    """Response with exactly one clip recommendation."""
    return {
        "id": "gen-single-12345",
        "model": "google/gemini-2.5-pro-preview",
        "object": "chat.completion",
        "created": 1703644800,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "clips": [
                            {
                                "start_time": 300.0,
                                "end_time": 345.5,
                                "duration": 45.5,
                                "score": 0.95,
                                "reasoning": "Highly engaging question that hooks viewers",
                                "hook_type": "question",
                                "topics": ["philosophy", "life"],
                                "transcript_excerpt": "Have you ever asked yourself why..."
                            }
                        ]
                    })
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {"prompt_tokens": 1500, "completion_tokens": 150, "total_tokens": 1650}
    }


# =============================================================================
# Response Fixtures - Error Cases
# =============================================================================


@pytest.fixture
def rate_limit_response_data() -> Dict[str, Any]:
    """Data for 429 rate limit response."""
    return {
        "status_code": 429,
        "json_data": {
            "error": {
                "message": "Rate limit exceeded. Please slow down your requests.",
                "type": "rate_limit_error",
                "code": "rate_limit_exceeded"
            }
        },
        "headers": {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "1703645000",
            "Retry-After": "60"
        }
    }


@pytest.fixture
def auth_error_response_data() -> Dict[str, Any]:
    """Data for 401 authentication error response."""
    return {
        "status_code": 401,
        "json_data": {
            "error": {
                "message": "Invalid API key provided. Please check your API key.",
                "type": "authentication_error",
                "code": "invalid_api_key"
            }
        },
        "headers": {}
    }


@pytest.fixture
def insufficient_credits_response_data() -> Dict[str, Any]:
    """Data for 402 insufficient credits response."""
    return {
        "status_code": 402,
        "json_data": {
            "error": {
                "message": "Insufficient credits. Please add more credits to your account.",
                "type": "payment_error",
                "code": "insufficient_credits"
            }
        },
        "headers": {}
    }


@pytest.fixture
def server_error_response_data() -> Dict[str, Any]:
    """Data for 500 internal server error response."""
    return {
        "status_code": 500,
        "json_data": {
            "error": {
                "message": "Internal server error. Please try again later.",
                "type": "server_error",
                "code": "internal_error"
            }
        },
        "headers": {}
    }


@pytest.fixture
def service_unavailable_response_data() -> Dict[str, Any]:
    """Data for 503 service unavailable response."""
    return {
        "status_code": 503,
        "json_data": {
            "error": {
                "message": "Service temporarily unavailable. Please try again later.",
                "type": "server_error",
                "code": "service_unavailable"
            }
        },
        "headers": {"Retry-After": "30"}
    }


@pytest.fixture
def model_not_found_response_data() -> Dict[str, Any]:
    """Data for 404 model not found response."""
    return {
        "status_code": 404,
        "json_data": {
            "error": {
                "message": "Model 'google/gemini-unknown' not found.",
                "type": "invalid_request_error",
                "code": "model_not_found"
            }
        },
        "headers": {}
    }


# =============================================================================
# Response Fixtures - Malformed Cases
# =============================================================================


@pytest.fixture
def malformed_json_content() -> bytes:
    """Malformed JSON that will fail to parse."""
    return b'{"incomplete": json, "missing": '


@pytest.fixture
def non_json_content() -> bytes:
    """HTML content instead of JSON."""
    return b'<!DOCTYPE html><html><body><h1>503 Service Unavailable</h1></body></html>'


@pytest.fixture
def empty_content() -> bytes:
    """Empty response body."""
    return b''


@pytest.fixture
def missing_choices_response() -> Dict[str, Any]:
    """Response missing the 'choices' field."""
    return {
        "id": "gen-12345",
        "model": "google/gemini-2.5-pro-preview",
        "object": "chat.completion",
        "created": 1703644800,
        # "choices" field is missing
        "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}
    }


@pytest.fixture
def empty_choices_response() -> Dict[str, Any]:
    """Response with empty choices array."""
    return {
        "id": "gen-12345",
        "model": "google/gemini-2.5-pro-preview",
        "object": "chat.completion",
        "created": 1703644800,
        "choices": [],
        "usage": {"prompt_tokens": 100, "completion_tokens": 0, "total_tokens": 100}
    }


@pytest.fixture
def null_content_response() -> Dict[str, Any]:
    """Response with null content field."""
    return {
        "id": "gen-12345",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": None
                },
                "finish_reason": "stop"
            }
        ]
    }


@pytest.fixture
def invalid_clips_format_response() -> Dict[str, Any]:
    """Response where clips have invalid structure."""
    return {
        "id": "gen-12345",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "clips": [
                            {"invalid": "structure", "no_required_fields": True},
                            "not_an_object",
                            123
                        ]
                    })
                },
                "finish_reason": "stop"
            }
        ]
    }


@pytest.fixture
def invalid_timestamps_response() -> Dict[str, Any]:
    """Response with invalid timestamps (end < start)."""
    return {
        "id": "gen-12345",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "clips": [
                            {
                                "start_time": 100.0,
                                "end_time": 50.0,  # Invalid: end < start
                                "score": 0.9,
                                "reasoning": "Test clip"
                            }
                        ]
                    })
                },
                "finish_reason": "stop"
            }
        ]
    }


@pytest.fixture
def negative_timestamps_response() -> Dict[str, Any]:
    """Response with negative timestamps."""
    return {
        "id": "gen-12345",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "clips": [
                            {
                                "start_time": -10.0,  # Invalid: negative
                                "end_time": 50.0,
                                "score": 0.9,
                                "reasoning": "Test clip"
                            }
                        ]
                    })
                },
                "finish_reason": "stop"
            }
        ]
    }


# =============================================================================
# Transcription Fixtures
# =============================================================================


@pytest.fixture
def sample_transcription() -> Dict[str, Any]:
    """
    Sample transcription for clip analysis testing.
    Represents a ~5 second audio clip with word-level timestamps.
    """
    return {
        "text": "Hello everyone, welcome to the show. Today we're going to discuss some amazing topics that will change your perspective.",
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 3.5,
                "text": "Hello everyone, welcome to the show.",
                "words": [
                    {"word": "Hello", "start": 0.0, "end": 0.5, "confidence": 0.98},
                    {"word": "everyone,", "start": 0.6, "end": 1.2, "confidence": 0.97},
                    {"word": "welcome", "start": 1.3, "end": 1.8, "confidence": 0.99},
                    {"word": "to", "start": 1.9, "end": 2.0, "confidence": 0.98},
                    {"word": "the", "start": 2.1, "end": 2.3, "confidence": 0.99},
                    {"word": "show.", "start": 2.4, "end": 3.0, "confidence": 0.96},
                ]
            },
            {
                "id": 1,
                "start": 3.5,
                "end": 8.0,
                "text": "Today we're going to discuss some amazing topics that will change your perspective.",
                "words": [
                    {"word": "Today", "start": 3.5, "end": 3.9, "confidence": 0.98},
                    {"word": "we're", "start": 4.0, "end": 4.3, "confidence": 0.97},
                    {"word": "going", "start": 4.4, "end": 4.7, "confidence": 0.98},
                    {"word": "to", "start": 4.8, "end": 4.9, "confidence": 0.99},
                    {"word": "discuss", "start": 5.0, "end": 5.5, "confidence": 0.96},
                    {"word": "some", "start": 5.6, "end": 5.8, "confidence": 0.97},
                    {"word": "amazing", "start": 5.9, "end": 6.4, "confidence": 0.95},
                    {"word": "topics", "start": 6.5, "end": 6.9, "confidence": 0.98},
                    {"word": "that", "start": 7.0, "end": 7.2, "confidence": 0.99},
                    {"word": "will", "start": 7.3, "end": 7.5, "confidence": 0.97},
                    {"word": "change", "start": 7.6, "end": 7.8, "confidence": 0.96},
                    {"word": "your", "start": 7.85, "end": 7.9, "confidence": 0.98},
                    {"word": "perspective.", "start": 7.95, "end": 8.0, "confidence": 0.94},
                ]
            }
        ],
        "language": "en",
        "duration": 8.0
    }


@pytest.fixture
def empty_transcription() -> Dict[str, Any]:
    """Empty transcription with no text."""
    return {
        "text": "",
        "segments": [],
        "language": "en",
        "duration": 0.0
    }


@pytest.fixture
def minimal_transcription() -> Dict[str, Any]:
    """Transcription with minimal content (single word)."""
    return {
        "text": "Hello",
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 0.5,
                "text": "Hello",
                "words": [
                    {"word": "Hello", "start": 0.0, "end": 0.5, "confidence": 0.98}
                ]
            }
        ],
        "language": "en",
        "duration": 0.5
    }


@pytest.fixture
def long_transcription() -> Dict[str, Any]:
    """
    Long transcription simulating a 2-hour podcast.
    Contains ~500 segments (condensed for testing).
    """
    segments = []
    current_time = 0.0

    for i in range(500):
        segment_duration = 5.0 + (i % 10)  # Vary segment length
        words = []
        word_time = current_time

        # Generate 10 words per segment
        for j in range(10):
            word_end = word_time + 0.4
            words.append({
                "word": f"word_{i}_{j}",
                "start": word_time,
                "end": word_end,
                "confidence": 0.95
            })
            word_time = word_end + 0.1

        segments.append({
            "id": i,
            "start": current_time,
            "end": current_time + segment_duration,
            "text": " ".join([w["word"] for w in words]),
            "words": words
        })

        current_time += segment_duration

    return {
        "text": " ".join([s["text"] for s in segments]),
        "segments": segments,
        "language": "en",
        "duration": current_time  # ~7200 seconds (2 hours)
    }


@pytest.fixture
def russian_transcription() -> Dict[str, Any]:
    """Transcription in Russian to test non-ASCII handling."""
    return {
        "text": "Привет всем, добро пожаловать на шоу.",
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 3.0,
                "text": "Привет всем, добро пожаловать на шоу.",
                "words": [
                    {"word": "Привет", "start": 0.0, "end": 0.5, "confidence": 0.95},
                    {"word": "всем,", "start": 0.6, "end": 1.0, "confidence": 0.94},
                    {"word": "добро", "start": 1.1, "end": 1.5, "confidence": 0.96},
                    {"word": "пожаловать", "start": 1.6, "end": 2.2, "confidence": 0.93},
                    {"word": "на", "start": 2.3, "end": 2.5, "confidence": 0.98},
                    {"word": "шоу.", "start": 2.6, "end": 3.0, "confidence": 0.95},
                ]
            }
        ],
        "language": "ru",
        "duration": 3.0
    }


@pytest.fixture
def special_chars_transcription() -> Dict[str, Any]:
    """Transcription with special characters that need JSON escaping."""
    return {
        "text": 'He said "Hello!" and then asked: What\'s the deal? <script>alert("xss")</script>',
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 5.0,
                "text": 'He said "Hello!" and then asked: What\'s the deal? <script>alert("xss")</script>',
                "words": [
                    {"word": "He", "start": 0.0, "end": 0.3, "confidence": 0.98},
                    {"word": "said", "start": 0.4, "end": 0.7, "confidence": 0.97},
                    {"word": '"Hello!"', "start": 0.8, "end": 1.5, "confidence": 0.95},
                ]
            }
        ],
        "language": "en",
        "duration": 5.0
    }


# =============================================================================
# Clip Analysis Preferences Fixtures
# =============================================================================


@pytest.fixture
def default_preferences() -> Dict[str, Any]:
    """Default clip analysis preferences."""
    return {
        "min_duration": 13,
        "max_duration": 60,
        "clip_count": 10,
        "topics": None
    }


@pytest.fixture
def short_clips_preferences() -> Dict[str, Any]:
    """Preferences for very short clips."""
    return {
        "min_duration": 5,
        "max_duration": 15,
        "clip_count": 20,
        "topics": None
    }


@pytest.fixture
def long_clips_preferences() -> Dict[str, Any]:
    """Preferences for longer clips."""
    return {
        "min_duration": 45,
        "max_duration": 120,
        "clip_count": 5,
        "topics": None
    }


@pytest.fixture
def topic_filtered_preferences() -> Dict[str, Any]:
    """Preferences with topic filtering."""
    return {
        "min_duration": 13,
        "max_duration": 60,
        "clip_count": 10,
        "topics": ["AI", "technology", "future"]
    }


# =============================================================================
# Network Error Fixtures
# =============================================================================


@pytest.fixture
def timeout_error():
    """Network timeout error."""
    if httpx:
        return httpx.TimeoutException("Connection timed out after 30s")
    return Exception("Connection timed out after 30s")


@pytest.fixture
def connection_error():
    """Network connection error."""
    if httpx:
        return httpx.ConnectError("Failed to establish connection to openrouter.ai")
    return Exception("Failed to establish connection to openrouter.ai")


@pytest.fixture
def dns_error():
    """DNS resolution error."""
    if httpx:
        return httpx.ConnectError("DNS resolution failed for openrouter.ai")
    return Exception("DNS resolution failed for openrouter.ai")


@pytest.fixture
def ssl_error():
    """SSL certificate error."""
    if httpx:
        return httpx.ConnectError("SSL certificate verification failed")
    return Exception("SSL certificate verification failed")


@pytest.fixture
def connection_reset_error():
    """Connection reset by peer error."""
    if httpx:
        return httpx.RemoteProtocolError("Connection reset by peer")
    return Exception("Connection reset by peer")


# =============================================================================
# Retry Scenario Fixtures
# =============================================================================


@pytest.fixture
def retry_then_success_scenario(success_response, service_unavailable_response_data) -> List[Dict]:
    """Scenario: fail twice with 503, then succeed."""
    return [
        {"type": "error", **service_unavailable_response_data},
        {"type": "error", **service_unavailable_response_data},
        {"type": "success", "status_code": 200, "json_data": success_response},
    ]


@pytest.fixture
def always_fail_scenario(server_error_response_data) -> List[Dict]:
    """Scenario: always fail with 500 (for max retry testing)."""
    return [
        {"type": "error", **server_error_response_data}
        for _ in range(5)
    ]


@pytest.fixture
def rate_limit_then_success_scenario(success_response, rate_limit_response_data) -> List[Dict]:
    """Scenario: rate limited once, then succeed."""
    return [
        {"type": "error", **rate_limit_response_data},
        {"type": "success", "status_code": 200, "json_data": success_response},
    ]


# =============================================================================
# Export All Fixtures
# =============================================================================

__all__ = [
    # Environment
    "mock_env_vars",
    "missing_api_key",
    "invalid_api_key",
    "empty_api_key",
    # Success responses
    "success_response",
    "empty_clips_response",
    "single_clip_response",
    # Error responses
    "rate_limit_response_data",
    "auth_error_response_data",
    "insufficient_credits_response_data",
    "server_error_response_data",
    "service_unavailable_response_data",
    "model_not_found_response_data",
    # Malformed responses
    "malformed_json_content",
    "non_json_content",
    "empty_content",
    "missing_choices_response",
    "empty_choices_response",
    "null_content_response",
    "invalid_clips_format_response",
    "invalid_timestamps_response",
    "negative_timestamps_response",
    # Transcriptions
    "sample_transcription",
    "empty_transcription",
    "minimal_transcription",
    "long_transcription",
    "russian_transcription",
    "special_chars_transcription",
    # Preferences
    "default_preferences",
    "short_clips_preferences",
    "long_clips_preferences",
    "topic_filtered_preferences",
    # Network errors
    "timeout_error",
    "connection_error",
    "dns_error",
    "ssl_error",
    "connection_reset_error",
    # Retry scenarios
    "retry_then_success_scenario",
    "always_fail_scenario",
    "rate_limit_then_success_scenario",
]
