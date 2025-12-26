# OpenRouter API Client - Comprehensive Test Strategy

**Version:** 1.0.0
**Created:** 2025-12-27
**Author:** Tester Agent (Hive Mind Swarm)
**Swarm ID:** swarm-1766783188711-bh1sruf65

---

## 1. Executive Summary

This document defines a comprehensive testing strategy for the OpenRouter API client that will be used to access Gemini models (2.5 Pro / 3.0 Preview) for AI-powered clip recommendations. The strategy covers unit tests, integration patterns, mock fixtures, and edge case handling without making real API calls.

### Test Pyramid Distribution

```
        /\
       /E2E\           5% - Full pipeline with mocked API
      /------\
     / Integ. \       20% - Service integration tests
    /----------\
   /   Unit     \     75% - Component unit tests
  /--------------\
```

### Coverage Targets

| Component | Target | Priority |
|-----------|--------|----------|
| OpenRouterClient class | 95% | Critical |
| Request/Response models | 90% | High |
| Error handling | 95% | Critical |
| Rate limiting | 90% | High |
| Environment loading | 85% | Medium |
| Retry logic | 90% | High |

---

## 2. Test File Structure

```
/Users/serg1kk/Local Documents /AI Clips/
|
+-- tests/
|   +-- __init__.py
|   +-- conftest.py                    # Shared fixtures (existing)
|   |
|   +-- unit/
|   |   +-- __init__.py
|   |   +-- test_openrouter_client.py  # Core client unit tests
|   |   +-- test_openrouter_models.py  # Request/response model tests
|   |   +-- test_openrouter_errors.py  # Error class tests
|   |   +-- test_openrouter_config.py  # Configuration/env tests
|   |
|   +-- integration/
|   |   +-- __init__.py
|   |   +-- test_openrouter_service.py # Service integration tests
|   |   +-- test_clip_analysis.py      # Clip analysis workflow tests
|   |
|   +-- fixtures/
|   |   +-- __init__.py
|   |   +-- openrouter_fixtures.py     # Shared fixtures for OpenRouter
|   |   +-- mock_responses/
|   |   |   +-- success_response.json
|   |   |   +-- rate_limit_response.json
|   |   |   +-- auth_error_response.json
|   |   |   +-- server_error_response.json
|   |   |   +-- malformed_response.json
|   |   |   +-- empty_response.json
|   |   |   +-- streaming_response.jsonl
|   |
|   +-- mocks/
|       +-- __init__.py
|       +-- mock_httpx.py              # HTTPX client mocks
|       +-- mock_openrouter_server.py  # Fake server for testing
```

---

## 3. Pytest Fixtures

### 3.1 Core Fixtures (`tests/fixtures/openrouter_fixtures.py`)

```python
"""
OpenRouter API Client Test Fixtures

Provides comprehensive fixtures for testing OpenRouter integration
without making real API calls.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Generator, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx


# =============================================================================
# Environment Fixtures
# =============================================================================

@pytest.fixture
def mock_env_vars(monkeypatch):
    """Set up mock environment variables for OpenRouter."""
    env_vars = {
        "OPENROUTER_API_KEY": "sk-or-v1-test-key-12345678901234567890",
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


# =============================================================================
# Response Fixtures
# =============================================================================

@pytest.fixture
def success_response() -> Dict[str, Any]:
    """Mock successful OpenRouter API response."""
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
                                "score": 0.92,
                                "reasoning": "Engaging story with emotional hook",
                                "hook_type": "story",
                                "topics": ["personal growth", "motivation"],
                                "transcript_excerpt": "And that's when I realized..."
                            },
                            {
                                "start_time": 456.0,
                                "end_time": 498.7,
                                "score": 0.88,
                                "reasoning": "Controversial opinion with debate potential",
                                "hook_type": "controversy",
                                "topics": ["technology", "AI ethics"],
                                "transcript_excerpt": "I completely disagree with..."
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
    """Response with no clip recommendations."""
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
                    "content": json.dumps({"clips": []})
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {"prompt_tokens": 2500, "completion_tokens": 20, "total_tokens": 2520}
    }


@pytest.fixture
def rate_limit_response() -> httpx.Response:
    """Mock 429 rate limit response."""
    return httpx.Response(
        status_code=429,
        json={
            "error": {
                "message": "Rate limit exceeded. Please slow down.",
                "type": "rate_limit_error",
                "code": "rate_limit_exceeded"
            }
        },
        headers={
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "1703645000",
            "Retry-After": "60"
        }
    )


@pytest.fixture
def auth_error_response() -> httpx.Response:
    """Mock 401 authentication error response."""
    return httpx.Response(
        status_code=401,
        json={
            "error": {
                "message": "Invalid API key provided.",
                "type": "authentication_error",
                "code": "invalid_api_key"
            }
        }
    )


@pytest.fixture
def insufficient_credits_response() -> httpx.Response:
    """Mock 402 insufficient credits response."""
    return httpx.Response(
        status_code=402,
        json={
            "error": {
                "message": "Insufficient credits. Please add more credits.",
                "type": "payment_error",
                "code": "insufficient_credits"
            }
        }
    )


@pytest.fixture
def server_error_response() -> httpx.Response:
    """Mock 500 server error response."""
    return httpx.Response(
        status_code=500,
        json={
            "error": {
                "message": "Internal server error",
                "type": "server_error",
                "code": "internal_error"
            }
        }
    )


@pytest.fixture
def service_unavailable_response() -> httpx.Response:
    """Mock 503 service unavailable response."""
    return httpx.Response(
        status_code=503,
        json={
            "error": {
                "message": "Service temporarily unavailable",
                "type": "server_error",
                "code": "service_unavailable"
            }
        },
        headers={"Retry-After": "30"}
    )


@pytest.fixture
def malformed_json_response() -> httpx.Response:
    """Mock response with malformed JSON."""
    return httpx.Response(
        status_code=200,
        content=b'{"incomplete": json',
        headers={"Content-Type": "application/json"}
    )


@pytest.fixture
def non_json_response() -> httpx.Response:
    """Mock response with non-JSON content."""
    return httpx.Response(
        status_code=200,
        content=b'<html>Error page</html>',
        headers={"Content-Type": "text/html"}
    )


@pytest.fixture
def empty_response() -> httpx.Response:
    """Mock empty response body."""
    return httpx.Response(
        status_code=200,
        content=b'',
        headers={"Content-Type": "application/json"}
    )


@pytest.fixture
def timeout_error():
    """Mock network timeout error."""
    return httpx.TimeoutException("Connection timed out")


@pytest.fixture
def connection_error():
    """Mock network connection error."""
    return httpx.ConnectError("Failed to establish connection")


@pytest.fixture
def dns_error():
    """Mock DNS resolution error."""
    return httpx.ConnectError("DNS resolution failed for openrouter.ai")


# =============================================================================
# Transcription Fixtures
# =============================================================================

@pytest.fixture
def sample_transcription() -> Dict[str, Any]:
    """Sample transcription for clip analysis."""
    return {
        "text": "Hello everyone, welcome to the show. Today we're going to discuss...",
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 5.5,
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
                "start": 5.5,
                "end": 12.0,
                "text": "Today we're going to discuss some amazing topics.",
                "words": [
                    {"word": "Today", "start": 5.5, "end": 6.0, "confidence": 0.98},
                    {"word": "we're", "start": 6.1, "end": 6.4, "confidence": 0.97},
                ]
            }
        ],
        "language": "en",
        "duration": 7200.0  # 2 hours
    }


@pytest.fixture
def long_transcription() -> Dict[str, Any]:
    """Long transcription for testing token limits."""
    # Generate ~50000 words (typical 2-hour podcast)
    words = []
    segments = []
    current_time = 0.0

    for i in range(5000):  # 5000 segments
        segment_words = []
        segment_start = current_time

        for j in range(10):  # 10 words per segment
            word_start = current_time
            word_end = current_time + 0.3
            segment_words.append({
                "word": f"word{i}_{j}",
                "start": word_start,
                "end": word_end,
                "confidence": 0.95
            })
            current_time = word_end + 0.1

        segments.append({
            "id": i,
            "start": segment_start,
            "end": current_time,
            "text": " ".join([w["word"] for w in segment_words]),
            "words": segment_words
        })

    return {
        "text": " ".join([s["text"] for s in segments]),
        "segments": segments,
        "language": "en",
        "duration": current_time
    }


# =============================================================================
# Client Fixtures
# =============================================================================

@pytest.fixture
def mock_httpx_client():
    """Create a mock HTTPX AsyncClient."""
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


@pytest.fixture
def openrouter_client(mock_env_vars, mock_httpx_client):
    """Create OpenRouterClient with mocked dependencies."""
    # This will be replaced with actual import once service is created
    # from backend.services.openrouter_service import OpenRouterClient

    class MockOpenRouterClient:
        def __init__(self):
            self.api_key = os.getenv("OPENROUTER_API_KEY")
            self.model = os.getenv("GEMINI_MODEL", "google/gemini-2.5-pro-preview")
            self.base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
            self.timeout = int(os.getenv("OPENROUTER_TIMEOUT", "30"))
            self.max_retries = int(os.getenv("OPENROUTER_MAX_RETRIES", "3"))
            self._client = mock_httpx_client

    return MockOpenRouterClient()


# =============================================================================
# Streaming Fixtures
# =============================================================================

@pytest.fixture
def streaming_response_chunks():
    """Mock streaming response chunks (SSE format)."""
    return [
        b'data: {"id":"gen-1","choices":[{"delta":{"content":"{"}}]}\n\n',
        b'data: {"id":"gen-1","choices":[{"delta":{"content":"\\"clips\\":"}}]}\n\n',
        b'data: {"id":"gen-1","choices":[{"delta":{"content":"["}}]}\n\n',
        b'data: {"id":"gen-1","choices":[{"delta":{"content":"{\\"start_time\\":125.5}"}}]}\n\n',
        b'data: {"id":"gen-1","choices":[{"delta":{"content":"]}"}}]}\n\n',
        b'data: [DONE]\n\n',
    ]


# =============================================================================
# Retry Scenario Fixtures
# =============================================================================

@pytest.fixture
def retry_then_success_responses(success_response):
    """Responses that fail twice then succeed."""
    return [
        httpx.Response(status_code=503, json={"error": {"message": "Temporary error"}}),
        httpx.Response(status_code=503, json={"error": {"message": "Temporary error"}}),
        httpx.Response(status_code=200, json=success_response),
    ]


@pytest.fixture
def always_fail_responses():
    """Responses that always fail (for max retry testing)."""
    return [
        httpx.Response(status_code=503, json={"error": {"message": "Persistent error"}})
        for _ in range(5)
    ]
```

---

## 4. Mock Patterns for HTTPX

### 4.1 Basic Request Mocking (`tests/mocks/mock_httpx.py`)

```python
"""
HTTPX Mock Patterns for OpenRouter Testing

Provides comprehensive mock patterns for testing HTTP interactions
without making real network requests.
"""

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, Callable, Dict, List, Optional, Union
from unittest.mock import AsyncMock, MagicMock, patch

import httpx


class MockHTTPXResponse:
    """Mock HTTPX response with customizable behavior."""

    def __init__(
        self,
        status_code: int = 200,
        json_data: Optional[Dict] = None,
        content: Optional[bytes] = None,
        headers: Optional[Dict[str, str]] = None,
        raise_for_status: Optional[Exception] = None,
    ):
        self.status_code = status_code
        self._json_data = json_data
        self._content = content or (json.dumps(json_data).encode() if json_data else b'')
        self.headers = httpx.Headers(headers or {})
        self._raise_for_status_error = raise_for_status
        self.is_success = 200 <= status_code < 300
        self.is_error = status_code >= 400

    def json(self) -> Dict[str, Any]:
        if self._json_data is not None:
            return self._json_data
        return json.loads(self._content)

    @property
    def content(self) -> bytes:
        return self._content

    @property
    def text(self) -> str:
        return self._content.decode('utf-8')

    def raise_for_status(self):
        if self._raise_for_status_error:
            raise self._raise_for_status_error
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                message=f"HTTP {self.status_code}",
                request=MagicMock(),
                response=self
            )


class MockHTTPXClient:
    """Mock HTTPX AsyncClient for testing."""

    def __init__(self, responses: Optional[List[MockHTTPXResponse]] = None):
        self._responses = responses or []
        self._response_index = 0
        self._requests: List[Dict] = []

    async def post(
        self,
        url: str,
        json: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: Optional[float] = None,
        **kwargs
    ) -> MockHTTPXResponse:
        """Mock POST request."""
        self._requests.append({
            "method": "POST",
            "url": url,
            "json": json,
            "headers": headers,
            "timeout": timeout,
            **kwargs
        })

        if self._response_index < len(self._responses):
            response = self._responses[self._response_index]
            self._response_index += 1
            return response

        # Default success response
        return MockHTTPXResponse(status_code=200, json_data={"success": True})

    async def get(self, url: str, **kwargs) -> MockHTTPXResponse:
        """Mock GET request."""
        self._requests.append({"method": "GET", "url": url, **kwargs})

        if self._response_index < len(self._responses):
            response = self._responses[self._response_index]
            self._response_index += 1
            return response

        return MockHTTPXResponse(status_code=200, json_data={"success": True})

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def aclose(self):
        pass

    def get_requests(self) -> List[Dict]:
        """Get all captured requests."""
        return self._requests

    def reset(self):
        """Reset client state."""
        self._response_index = 0
        self._requests.clear()


class SequentialResponseMock:
    """Mock that returns different responses on each call."""

    def __init__(self, responses: List[Union[MockHTTPXResponse, Exception]]):
        self.responses = responses
        self.call_count = 0
        self.calls: List[Dict] = []

    async def __call__(self, *args, **kwargs) -> MockHTTPXResponse:
        self.calls.append({"args": args, "kwargs": kwargs})

        if self.call_count >= len(self.responses):
            raise IndexError(f"No more mock responses (called {self.call_count + 1} times)")

        response = self.responses[self.call_count]
        self.call_count += 1

        if isinstance(response, Exception):
            raise response

        return response


@asynccontextmanager
async def mock_httpx_post(response: MockHTTPXResponse):
    """Context manager to mock httpx.AsyncClient.post."""
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post.return_value = response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client
        yield mock_client


def create_error_response(
    status_code: int,
    error_type: str,
    message: str,
    code: Optional[str] = None
) -> MockHTTPXResponse:
    """Create a standardized error response."""
    return MockHTTPXResponse(
        status_code=status_code,
        json_data={
            "error": {
                "type": error_type,
                "message": message,
                "code": code or error_type
            }
        }
    )


# Pre-built error responses
RATE_LIMIT_ERROR = create_error_response(
    429, "rate_limit_error", "Rate limit exceeded", "rate_limit_exceeded"
)
AUTH_ERROR = create_error_response(
    401, "authentication_error", "Invalid API key", "invalid_api_key"
)
SERVER_ERROR = create_error_response(
    500, "server_error", "Internal server error", "internal_error"
)
SERVICE_UNAVAILABLE = create_error_response(
    503, "server_error", "Service unavailable", "service_unavailable"
)
```

---

## 5. Test Cases with Expected Behaviors

### 5.1 Unit Tests - OpenRouter Client (`tests/unit/test_openrouter_client.py`)

```python
"""
Unit Tests for OpenRouter API Client

Tests cover all client methods, error handling, and edge cases.
"""

import json
import os
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

# Import fixtures
from tests.fixtures.openrouter_fixtures import *
from tests.mocks.mock_httpx import MockHTTPXClient, MockHTTPXResponse


class TestOpenRouterClientInit:
    """Tests for client initialization."""

    def test_init_with_valid_api_key(self, mock_env_vars):
        """Client initializes successfully with valid API key."""
        # Arrange/Act
        from backend.services.openrouter_service import OpenRouterClient
        client = OpenRouterClient()

        # Assert
        assert client.api_key == mock_env_vars["OPENROUTER_API_KEY"]
        assert client.model == mock_env_vars["GEMINI_MODEL"]
        assert client.base_url == "https://openrouter.ai/api/v1"

    def test_init_without_api_key_raises(self, missing_api_key):
        """Client raises error when API key is missing."""
        from backend.services.openrouter_service import OpenRouterClient, ConfigurationError

        with pytest.raises(ConfigurationError) as exc_info:
            OpenRouterClient()

        assert "OPENROUTER_API_KEY" in str(exc_info.value)

    def test_init_with_invalid_key_format(self, invalid_api_key):
        """Client validates API key format on init."""
        from backend.services.openrouter_service import OpenRouterClient, ConfigurationError

        with pytest.raises(ConfigurationError) as exc_info:
            OpenRouterClient()

        assert "Invalid API key format" in str(exc_info.value)

    def test_init_with_custom_model(self, mock_env_vars, monkeypatch):
        """Client accepts custom model override."""
        monkeypatch.setenv("GEMINI_MODEL", "google/gemini-pro")
        from backend.services.openrouter_service import OpenRouterClient

        client = OpenRouterClient()
        assert client.model == "google/gemini-pro"

    def test_init_with_custom_timeout(self, mock_env_vars, monkeypatch):
        """Client accepts custom timeout setting."""
        monkeypatch.setenv("OPENROUTER_TIMEOUT", "60")
        from backend.services.openrouter_service import OpenRouterClient

        client = OpenRouterClient()
        assert client.timeout == 60


class TestOpenRouterAnalyzeClips:
    """Tests for analyze_clips method."""

    @pytest.mark.asyncio
    async def test_analyze_clips_success(
        self, mock_env_vars, sample_transcription, success_response
    ):
        """Successfully analyze transcription and get clip recommendations."""
        from backend.services.openrouter_service import OpenRouterClient

        mock_client = MockHTTPXClient([
            MockHTTPXResponse(status_code=200, json_data=success_response)
        ])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()
            result = await client.analyze_clips(
                transcription=sample_transcription,
                min_duration=13,
                max_duration=60,
                clip_count=10
            )

        # Assert
        assert "clips" in result
        assert len(result["clips"]) == 2
        assert result["clips"][0]["score"] == 0.92
        assert result["clips"][0]["hook_type"] == "story"

    @pytest.mark.asyncio
    async def test_analyze_clips_empty_result(
        self, mock_env_vars, sample_transcription, empty_clips_response
    ):
        """Handle transcription with no engaging moments."""
        from backend.services.openrouter_service import OpenRouterClient

        mock_client = MockHTTPXClient([
            MockHTTPXResponse(status_code=200, json_data=empty_clips_response)
        ])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()
            result = await client.analyze_clips(sample_transcription)

        assert result["clips"] == []

    @pytest.mark.asyncio
    async def test_analyze_clips_validates_duration_range(
        self, mock_env_vars, sample_transcription
    ):
        """Validate min/max duration parameters."""
        from backend.services.openrouter_service import OpenRouterClient, ValidationError

        client = OpenRouterClient()

        # min > max should raise
        with pytest.raises(ValidationError):
            await client.analyze_clips(
                sample_transcription,
                min_duration=60,
                max_duration=13
            )

    @pytest.mark.asyncio
    async def test_analyze_clips_validates_clip_count(
        self, mock_env_vars, sample_transcription
    ):
        """Validate clip count is positive."""
        from backend.services.openrouter_service import OpenRouterClient, ValidationError

        client = OpenRouterClient()

        with pytest.raises(ValidationError):
            await client.analyze_clips(sample_transcription, clip_count=0)

        with pytest.raises(ValidationError):
            await client.analyze_clips(sample_transcription, clip_count=-5)


class TestOpenRouterErrorHandling:
    """Tests for error handling scenarios."""

    @pytest.mark.asyncio
    async def test_handles_401_authentication_error(
        self, mock_env_vars, sample_transcription, auth_error_response
    ):
        """Raise AuthenticationError on 401 response."""
        from backend.services.openrouter_service import OpenRouterClient, AuthenticationError

        mock_client = MockHTTPXClient([auth_error_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(AuthenticationError) as exc_info:
                await client.analyze_clips(sample_transcription)

            assert "Invalid API key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_handles_429_rate_limit(
        self, mock_env_vars, sample_transcription
    ):
        """Raise RateLimitError on 429 response with retry info."""
        from backend.services.openrouter_service import OpenRouterClient, RateLimitError

        mock_response = MockHTTPXResponse(
            status_code=429,
            json_data={"error": {"message": "Rate limit exceeded"}},
            headers={"Retry-After": "60", "X-RateLimit-Reset": "1703645000"}
        )
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(RateLimitError) as exc_info:
                await client.analyze_clips(sample_transcription)

            assert exc_info.value.retry_after == 60

    @pytest.mark.asyncio
    async def test_handles_402_insufficient_credits(
        self, mock_env_vars, sample_transcription, insufficient_credits_response
    ):
        """Raise InsufficientCreditsError on 402 response."""
        from backend.services.openrouter_service import OpenRouterClient, InsufficientCreditsError

        mock_client = MockHTTPXClient([insufficient_credits_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(InsufficientCreditsError):
                await client.analyze_clips(sample_transcription)

    @pytest.mark.asyncio
    async def test_handles_500_server_error(
        self, mock_env_vars, sample_transcription, server_error_response
    ):
        """Raise ServerError on 500 response."""
        from backend.services.openrouter_service import OpenRouterClient, ServerError

        mock_client = MockHTTPXClient([server_error_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(ServerError):
                await client.analyze_clips(sample_transcription)

    @pytest.mark.asyncio
    async def test_handles_network_timeout(
        self, mock_env_vars, sample_transcription, timeout_error
    ):
        """Raise TimeoutError on network timeout."""
        from backend.services.openrouter_service import OpenRouterClient, APITimeoutError

        mock_client = AsyncMock()
        mock_client.post.side_effect = timeout_error
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(APITimeoutError):
                await client.analyze_clips(sample_transcription)

    @pytest.mark.asyncio
    async def test_handles_connection_error(
        self, mock_env_vars, sample_transcription, connection_error
    ):
        """Raise ConnectionError on network failure."""
        from backend.services.openrouter_service import OpenRouterClient, APIConnectionError

        mock_client = AsyncMock()
        mock_client.post.side_effect = connection_error
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(APIConnectionError):
                await client.analyze_clips(sample_transcription)


class TestOpenRouterMalformedResponses:
    """Tests for handling malformed API responses."""

    @pytest.mark.asyncio
    async def test_handles_malformed_json(
        self, mock_env_vars, sample_transcription
    ):
        """Raise ParseError on malformed JSON response."""
        from backend.services.openrouter_service import OpenRouterClient, ParseError

        mock_response = MockHTTPXResponse(
            status_code=200,
            content=b'{"incomplete": json'
        )
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(ParseError):
                await client.analyze_clips(sample_transcription)

    @pytest.mark.asyncio
    async def test_handles_non_json_response(
        self, mock_env_vars, sample_transcription
    ):
        """Raise ParseError on non-JSON response."""
        from backend.services.openrouter_service import OpenRouterClient, ParseError

        mock_response = MockHTTPXResponse(
            status_code=200,
            content=b'<html>Error page</html>'
        )
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(ParseError):
                await client.analyze_clips(sample_transcription)

    @pytest.mark.asyncio
    async def test_handles_empty_response(
        self, mock_env_vars, sample_transcription
    ):
        """Raise ParseError on empty response body."""
        from backend.services.openrouter_service import OpenRouterClient, ParseError

        mock_response = MockHTTPXResponse(status_code=200, content=b'')
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(ParseError):
                await client.analyze_clips(sample_transcription)

    @pytest.mark.asyncio
    async def test_handles_missing_choices_field(
        self, mock_env_vars, sample_transcription
    ):
        """Raise ParseError when 'choices' field is missing."""
        from backend.services.openrouter_service import OpenRouterClient, ParseError

        mock_response = MockHTTPXResponse(
            status_code=200,
            json_data={"id": "gen-123", "model": "gpt-4"}  # No choices
        )
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(ParseError) as exc_info:
                await client.analyze_clips(sample_transcription)

            assert "choices" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_handles_invalid_clip_format_in_response(
        self, mock_env_vars, sample_transcription
    ):
        """Handle response where AI returns invalid clip format."""
        from backend.services.openrouter_service import OpenRouterClient, ParseError

        # AI returns clips without required fields
        invalid_clips_response = {
            "id": "gen-123",
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "clips": [{"invalid": "structure"}]
                    })
                }
            }]
        }
        mock_response = MockHTTPXResponse(status_code=200, json_data=invalid_clips_response)
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(ParseError):
                await client.analyze_clips(sample_transcription)


class TestOpenRouterRetryLogic:
    """Tests for retry behavior on transient failures."""

    @pytest.mark.asyncio
    async def test_retries_on_503_then_succeeds(
        self, mock_env_vars, sample_transcription, success_response
    ):
        """Retry on 503 and succeed on subsequent attempt."""
        from backend.services.openrouter_service import OpenRouterClient
        from tests.mocks.mock_httpx import SequentialResponseMock

        responses = [
            MockHTTPXResponse(status_code=503, json_data={"error": {"message": "Temporary"}}),
            MockHTTPXResponse(status_code=503, json_data={"error": {"message": "Temporary"}}),
            MockHTTPXResponse(status_code=200, json_data=success_response),
        ]

        mock = SequentialResponseMock(responses)
        mock_client = AsyncMock()
        mock_client.post = mock
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()
            result = await client.analyze_clips(sample_transcription)

        assert mock.call_count == 3
        assert "clips" in result

    @pytest.mark.asyncio
    async def test_respects_max_retries(
        self, mock_env_vars, sample_transcription
    ):
        """Stop retrying after max_retries attempts."""
        from backend.services.openrouter_service import OpenRouterClient, ServerError
        from tests.mocks.mock_httpx import SequentialResponseMock

        # 5 failures (more than default max_retries=3)
        responses = [
            MockHTTPXResponse(status_code=503, json_data={"error": {"message": "Permanent"}})
            for _ in range(5)
        ]

        mock = SequentialResponseMock(responses)
        mock_client = AsyncMock()
        mock_client.post = mock
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(ServerError):
                await client.analyze_clips(sample_transcription)

        # Should have tried max_retries + 1 times (initial + retries)
        assert mock.call_count == 4  # 1 initial + 3 retries

    @pytest.mark.asyncio
    async def test_no_retry_on_401(
        self, mock_env_vars, sample_transcription
    ):
        """Do not retry on authentication errors."""
        from backend.services.openrouter_service import OpenRouterClient, AuthenticationError
        from tests.mocks.mock_httpx import SequentialResponseMock

        responses = [
            MockHTTPXResponse(status_code=401, json_data={"error": {"message": "Invalid key"}})
        ]

        mock = SequentialResponseMock(responses)
        mock_client = AsyncMock()
        mock_client.post = mock
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(AuthenticationError):
                await client.analyze_clips(sample_transcription)

        assert mock.call_count == 1  # No retries

    @pytest.mark.asyncio
    async def test_exponential_backoff_timing(
        self, mock_env_vars, sample_transcription
    ):
        """Verify exponential backoff between retries."""
        from backend.services.openrouter_service import OpenRouterClient
        from tests.mocks.mock_httpx import SequentialResponseMock
        import time

        responses = [
            MockHTTPXResponse(status_code=503, json_data={"error": {"message": "Temporary"}}),
            MockHTTPXResponse(status_code=503, json_data={"error": {"message": "Temporary"}}),
            MockHTTPXResponse(status_code=200, json_data={"choices": [{"message": {"content": '{"clips":[]}'}}]}),
        ]

        mock = SequentialResponseMock(responses)
        call_times = []

        original_call = mock.__call__
        async def timed_call(*args, **kwargs):
            call_times.append(time.time())
            return await original_call(*args, **kwargs)
        mock.__call__ = timed_call

        mock_client = AsyncMock()
        mock_client.post = mock
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                client = OpenRouterClient()
                await client.analyze_clips(sample_transcription)

        # Verify sleep was called with exponential backoff
        sleep_calls = [call.args[0] for call in mock_sleep.call_args_list]
        assert len(sleep_calls) == 2  # 2 retries = 2 sleeps
        # Second delay should be larger than first (exponential)
        if len(sleep_calls) >= 2:
            assert sleep_calls[1] > sleep_calls[0]


class TestOpenRouterRateLimiting:
    """Tests for rate limit handling."""

    @pytest.mark.asyncio
    async def test_extracts_retry_after_header(
        self, mock_env_vars, sample_transcription
    ):
        """Extract retry-after from rate limit response."""
        from backend.services.openrouter_service import OpenRouterClient, RateLimitError

        mock_response = MockHTTPXResponse(
            status_code=429,
            json_data={"error": {"message": "Rate limited"}},
            headers={"Retry-After": "45"}
        )
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(RateLimitError) as exc_info:
                await client.analyze_clips(sample_transcription)

            assert exc_info.value.retry_after == 45

    @pytest.mark.asyncio
    async def test_extracts_rate_limit_headers(
        self, mock_env_vars, sample_transcription
    ):
        """Extract rate limit info from headers."""
        from backend.services.openrouter_service import OpenRouterClient, RateLimitError

        mock_response = MockHTTPXResponse(
            status_code=429,
            json_data={"error": {"message": "Rate limited"}},
            headers={
                "X-RateLimit-Limit": "100",
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": "1703645000"
            }
        )
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()

            with pytest.raises(RateLimitError) as exc_info:
                await client.analyze_clips(sample_transcription)

            assert exc_info.value.limit == 100
            assert exc_info.value.remaining == 0


class TestOpenRouterTokenCounting:
    """Tests for token counting and limits."""

    @pytest.mark.asyncio
    async def test_truncates_long_transcription(
        self, mock_env_vars, long_transcription, success_response
    ):
        """Truncate transcription that exceeds token limit."""
        from backend.services.openrouter_service import OpenRouterClient

        mock_client = MockHTTPXClient([
            MockHTTPXResponse(status_code=200, json_data=success_response)
        ])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()
            result = await client.analyze_clips(long_transcription)

        # Verify request was made (with truncated content)
        request = mock_client.get_requests()[0]
        prompt = request["json"]["messages"][0]["content"]

        # Prompt should be under token limit (rough estimate: 4 chars = 1 token)
        # Max context is typically 128k tokens
        assert len(prompt) < 500000  # Safety margin

    @pytest.mark.asyncio
    async def test_tracks_usage_in_response(
        self, mock_env_vars, sample_transcription, success_response
    ):
        """Track token usage from response."""
        from backend.services.openrouter_service import OpenRouterClient

        mock_client = MockHTTPXClient([
            MockHTTPXResponse(status_code=200, json_data=success_response)
        ])

        with patch("httpx.AsyncClient", return_value=mock_client):
            client = OpenRouterClient()
            result = await client.analyze_clips(sample_transcription)

        assert result["usage"]["prompt_tokens"] == 2500
        assert result["usage"]["completion_tokens"] == 350
        assert result["usage"]["total_tokens"] == 2850
```

### 5.2 Configuration Tests (`tests/unit/test_openrouter_config.py`)

```python
"""
Tests for OpenRouter Configuration and Environment Loading
"""

import os
from unittest.mock import patch

import pytest


class TestEnvironmentVariables:
    """Tests for environment variable loading."""

    def test_loads_api_key_from_env(self, mock_env_vars):
        """Load API key from OPENROUTER_API_KEY env var."""
        from backend.services.openrouter_service import OpenRouterConfig

        config = OpenRouterConfig()
        assert config.api_key == mock_env_vars["OPENROUTER_API_KEY"]

    def test_loads_model_from_env(self, mock_env_vars):
        """Load model from GEMINI_MODEL env var."""
        from backend.services.openrouter_service import OpenRouterConfig

        config = OpenRouterConfig()
        assert config.model == "google/gemini-2.5-pro-preview"

    def test_default_model_when_not_set(self, mock_env_vars, monkeypatch):
        """Use default model when env var not set."""
        monkeypatch.delenv("GEMINI_MODEL", raising=False)
        from backend.services.openrouter_service import OpenRouterConfig

        config = OpenRouterConfig()
        assert config.model == "google/gemini-2.5-pro-preview"  # Default

    def test_loads_timeout_from_env(self, mock_env_vars):
        """Load timeout from OPENROUTER_TIMEOUT env var."""
        from backend.services.openrouter_service import OpenRouterConfig

        config = OpenRouterConfig()
        assert config.timeout == 30

    def test_default_timeout_when_not_set(self, mock_env_vars, monkeypatch):
        """Use default timeout when env var not set."""
        monkeypatch.delenv("OPENROUTER_TIMEOUT", raising=False)
        from backend.services.openrouter_service import OpenRouterConfig

        config = OpenRouterConfig()
        assert config.timeout == 30  # Default

    def test_invalid_timeout_raises(self, mock_env_vars, monkeypatch):
        """Raise error for invalid timeout value."""
        monkeypatch.setenv("OPENROUTER_TIMEOUT", "not-a-number")
        from backend.services.openrouter_service import OpenRouterConfig, ConfigurationError

        with pytest.raises(ConfigurationError):
            OpenRouterConfig()


class TestAPIKeyValidation:
    """Tests for API key format validation."""

    def test_valid_key_format(self, mock_env_vars):
        """Accept valid API key format."""
        from backend.services.openrouter_service import validate_api_key

        assert validate_api_key("sk-or-v1-1234567890abcdef") is True

    def test_invalid_key_prefix(self):
        """Reject key with wrong prefix."""
        from backend.services.openrouter_service import validate_api_key

        assert validate_api_key("invalid-key-format") is False

    def test_empty_key(self):
        """Reject empty API key."""
        from backend.services.openrouter_service import validate_api_key

        assert validate_api_key("") is False
        assert validate_api_key(None) is False

    def test_key_too_short(self):
        """Reject key that is too short."""
        from backend.services.openrouter_service import validate_api_key

        assert validate_api_key("sk-or-v1-short") is False


class TestModelValidation:
    """Tests for model name validation."""

    def test_valid_gemini_models(self):
        """Accept valid Gemini model names."""
        from backend.services.openrouter_service import validate_model

        valid_models = [
            "google/gemini-2.5-pro-preview",
            "google/gemini-pro",
            "google/gemini-1.5-pro",
            "google/gemini-1.5-flash",
        ]

        for model in valid_models:
            assert validate_model(model) is True

    def test_invalid_model_format(self):
        """Reject invalid model name format."""
        from backend.services.openrouter_service import validate_model

        assert validate_model("gemini-pro") is False  # Missing provider
        assert validate_model("openai/gpt-4") is True  # Other providers OK
        assert validate_model("") is False
```

---

## 6. Integration Test Patterns

### 6.1 Service Integration Tests (`tests/integration/test_openrouter_service.py`)

```python
"""
Integration Tests for OpenRouter Service

Tests the complete service layer including client, caching, and error handling.
"""

import pytest
from unittest.mock import AsyncMock, patch

from tests.fixtures.openrouter_fixtures import *
from tests.mocks.mock_httpx import MockHTTPXClient, MockHTTPXResponse


class TestClipAnalysisWorkflow:
    """Integration tests for complete clip analysis workflow."""

    @pytest.mark.asyncio
    async def test_full_analysis_workflow(
        self, mock_env_vars, sample_transcription, success_response
    ):
        """Test complete workflow from transcription to clip recommendations."""
        from backend.services.openrouter_service import OpenRouterService

        mock_client = MockHTTPXClient([
            MockHTTPXResponse(status_code=200, json_data=success_response)
        ])

        with patch("httpx.AsyncClient", return_value=mock_client):
            service = OpenRouterService()

            # Analyze clips
            result = await service.analyze_transcription_for_clips(
                transcription=sample_transcription,
                preferences={
                    "min_duration": 15,
                    "max_duration": 45,
                    "clip_count": 5,
                    "topics": ["technology", "AI"]
                }
            )

        # Verify result structure
        assert "clips" in result
        assert "usage" in result
        assert "model" in result

        # Verify clips have required fields
        for clip in result["clips"]:
            assert "start_time" in clip
            assert "end_time" in clip
            assert "score" in clip
            assert "reasoning" in clip

    @pytest.mark.asyncio
    async def test_caches_identical_requests(
        self, mock_env_vars, sample_transcription, success_response
    ):
        """Verify caching prevents duplicate API calls."""
        from backend.services.openrouter_service import OpenRouterService

        mock_client = MockHTTPXClient([
            MockHTTPXResponse(status_code=200, json_data=success_response)
        ])

        with patch("httpx.AsyncClient", return_value=mock_client):
            service = OpenRouterService(enable_cache=True)

            # First call
            result1 = await service.analyze_transcription_for_clips(sample_transcription)

            # Second call with same input
            result2 = await service.analyze_transcription_for_clips(sample_transcription)

        # Only one API call should be made
        assert len(mock_client.get_requests()) == 1
        assert result1 == result2

    @pytest.mark.asyncio
    async def test_graceful_degradation_on_error(
        self, mock_env_vars, sample_transcription
    ):
        """Service returns empty result on API failure."""
        from backend.services.openrouter_service import OpenRouterService

        mock_client = MockHTTPXClient([
            MockHTTPXResponse(status_code=500, json_data={"error": {"message": "Server error"}})
        ])

        with patch("httpx.AsyncClient", return_value=mock_client):
            service = OpenRouterService(graceful_failure=True)

            result = await service.analyze_transcription_for_clips(sample_transcription)

        # Should return empty result instead of raising
        assert result["clips"] == []
        assert "error" in result


class TestServiceHealth:
    """Tests for service health and connectivity."""

    @pytest.mark.asyncio
    async def test_health_check_success(self, mock_env_vars):
        """Health check passes when API is reachable."""
        from backend.services.openrouter_service import OpenRouterService

        mock_response = MockHTTPXResponse(
            status_code=200,
            json_data={"status": "ok"}
        )
        mock_client = MockHTTPXClient([mock_response])

        with patch("httpx.AsyncClient", return_value=mock_client):
            service = OpenRouterService()
            health = await service.health_check()

        assert health["status"] == "healthy"
        assert health["api_reachable"] is True

    @pytest.mark.asyncio
    async def test_health_check_failure(self, mock_env_vars):
        """Health check reports unhealthy when API is down."""
        from backend.services.openrouter_service import OpenRouterService

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.ConnectError("Connection refused")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_client):
            service = OpenRouterService()
            health = await service.health_check()

        assert health["status"] == "unhealthy"
        assert health["api_reachable"] is False
        assert "error" in health
```

---

## 7. Edge Cases Test Matrix

| Category | Test Case | Expected Behavior |
|----------|-----------|-------------------|
| **Empty Input** | Empty transcription | Return empty clips list |
| **Empty Input** | Transcription with no segments | Return empty clips list |
| **Empty Input** | Single-word transcription | Process normally, likely empty result |
| **Large Input** | 2+ hour transcription (50k+ words) | Truncate to token limit, process |
| **Unicode** | Non-ASCII characters (Russian, Chinese) | Process correctly, preserve encoding |
| **Special Chars** | JSON special characters in transcript | Escape properly, no parse errors |
| **Timing** | Request timeout (>30s) | Raise TimeoutError after configured timeout |
| **Timing** | Slow response (25s) | Complete successfully |
| **Concurrent** | 10 simultaneous requests | Handle all without race conditions |
| **Network** | DNS failure | Raise ConnectionError with clear message |
| **Network** | SSL certificate error | Raise ConnectionError |
| **Network** | Connection reset mid-response | Retry or raise with partial data info |
| **Response** | Empty choices array | Raise ParseError |
| **Response** | Null content field | Raise ParseError |
| **Response** | Content is not JSON | Raise ParseError |
| **Response** | Clips with negative timestamps | Validate and reject |
| **Response** | Clips with end < start | Validate and reject |
| **Response** | Duplicate clips | Deduplicate by timestamp |
| **Rate Limit** | Hit rate limit | Wait for Retry-After, then retry |
| **Rate Limit** | No Retry-After header | Use default backoff |
| **Auth** | Expired API key | Clear error message with resolution |
| **Auth** | Revoked API key | Clear error message |
| **Model** | Model not available | Fallback to alternative or clear error |
| **Model** | Model quota exceeded | Report quota status |

---

## 8. Running Tests

### 8.1 Test Commands

```bash
# Run all OpenRouter tests
pytest tests/unit/test_openrouter_*.py tests/integration/test_openrouter_*.py -v

# Run with coverage
pytest tests/unit/test_openrouter_*.py --cov=backend/services/openrouter_service --cov-report=html

# Run specific test class
pytest tests/unit/test_openrouter_client.py::TestOpenRouterErrorHandling -v

# Run tests matching pattern
pytest -k "rate_limit" -v

# Run with verbose output and show locals on failure
pytest tests/unit/test_openrouter_client.py -v --tb=long -l

# Run integration tests only
pytest tests/integration/ -v -m integration
```

### 8.2 Test Requirements (`tests/requirements-test.txt`)

```
# Testing framework
pytest==8.0.0
pytest-asyncio==0.23.3
pytest-cov==4.1.0
pytest-mock==3.12.0
pytest-timeout==2.2.0

# HTTP mocking
httpx==0.26.0
respx==0.20.2

# Test utilities
factory-boy==3.3.0
faker==22.0.0
freezegun==1.4.0

# Coverage
coverage[toml]==7.4.0
```

---

## 9. Coverage Report Template

```
Name                                      Stmts   Miss  Cover   Missing
------------------------------------------------------------------------
backend/services/openrouter_service.py      250     12    95%   145-148, 220-225
backend/services/openrouter_models.py        80      4    95%   55-58
backend/services/openrouter_errors.py        45      2    96%   38-39
backend/services/openrouter_config.py        35      3    91%   28-30
------------------------------------------------------------------------
TOTAL                                       410     21    95%

Coverage HTML report: htmlcov/index.html
```

---

## 10. Memory Coordination

Test results are stored in the hive mind memory:

```json
{
  "namespace": "hive/tester",
  "key": "openrouter-test-strategy",
  "content": {
    "version": "1.0.0",
    "test_file_count": 6,
    "fixture_count": 25,
    "test_case_count": 48,
    "coverage_target": "95%",
    "edge_cases_documented": 24,
    "status": "strategy_complete"
  }
}
```

---

*This test strategy provides comprehensive coverage for the OpenRouter API client, ensuring robust error handling, proper mocking patterns, and thorough edge case testing without making real API calls.*
