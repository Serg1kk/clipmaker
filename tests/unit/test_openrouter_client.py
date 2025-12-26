"""Unit Tests for OpenRouter API Client"""

import json
import os
from unittest.mock import MagicMock, patch

import httpx
import pytest

# Add backend to path for imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from backend.services.openrouter import (
    OpenRouterClient,
    AsyncOpenRouterClient,
    OpenRouterConfig,
    RateLimiter,
    GEMINI_25_PRO,
    # Exceptions
    AuthenticationError,
    BadRequestError,
    ContentModerationError,
    InsufficientCreditsError,
    MissingAPIKeyError,
    ModelUnavailableError,
    NotFoundError,
    RateLimitError,
    ResponseParseError,
    ServerError,
    TimeoutError,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def mock_api_key():
    """Provide a test API key."""
    return "sk-or-test-api-key-12345"


@pytest.fixture
def mock_env(mock_api_key, monkeypatch):
    """Set up environment with API key."""
    monkeypatch.setenv("OPENROUTER_API_KEY", mock_api_key)


@pytest.fixture
def config(mock_api_key):
    """Create test configuration."""
    return OpenRouterConfig(
        api_key=mock_api_key,
        timeout=30.0,
        max_retries=2,
    )


@pytest.fixture
def client(config):
    """Create test client."""
    return OpenRouterClient(config=config)


@pytest.fixture
def success_response():
    """Mock successful chat completion response."""
    return {
        "id": "gen-abc123",
        "object": "chat.completion",
        "created": 1703699392,
        "model": "google/gemini-2.5-pro",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello! I'm Gemini 2.5 Pro. How can I help you?"
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 15,
            "total_tokens": 25
        }
    }


@pytest.fixture
def rate_limit_response():
    """Mock rate limit error response."""
    return {
        "error": {
            "code": 429,
            "message": "Rate limit exceeded. Please try again later.",
            "type": "rate_limit_error"
        }
    }


@pytest.fixture
def auth_error_response():
    """Mock authentication error response."""
    return {
        "error": {
            "code": 401,
            "message": "Invalid API key",
            "type": "authentication_error"
        }
    }


# ============================================================================
# Configuration Tests
# ============================================================================

class TestOpenRouterConfig:
    """Tests for OpenRouterConfig."""

    def test_config_from_explicit_key(self, mock_api_key):
        """Test configuration with explicit API key."""
        config = OpenRouterConfig(api_key=mock_api_key)
        assert config.api_key == mock_api_key
        assert config.base_url == "https://openrouter.ai/api/v1"
        assert config.default_model == "google/gemini-2.5-pro"

    def test_config_from_env(self, mock_env, mock_api_key):
        """Test configuration from environment variable."""
        config = OpenRouterConfig.from_env()
        assert config.api_key == mock_api_key

    def test_config_missing_api_key(self, monkeypatch):
        """Test error when API key is missing."""
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        with pytest.raises(MissingAPIKeyError):
            OpenRouterConfig.from_env()

    def test_config_custom_values(self, mock_api_key):
        """Test configuration with custom values."""
        config = OpenRouterConfig(
            api_key=mock_api_key,
            timeout=120.0,
            max_retries=5,
            http_referer="https://myapp.com",
            site_name="My App",
        )
        assert config.timeout == 120.0
        assert config.max_retries == 5
        assert config.http_referer == "https://myapp.com"
        assert config.site_name == "My App"

    def test_config_get_headers(self, mock_api_key):
        """Test header generation."""
        config = OpenRouterConfig(
            api_key=mock_api_key,
            http_referer="https://test.com",
            site_name="Test App",
        )
        headers = config.get_headers()
        assert headers["Authorization"] == f"Bearer {mock_api_key}"
        assert headers["Content-Type"] == "application/json"
        assert headers["HTTP-Referer"] == "https://test.com"
        assert headers["X-Title"] == "Test App"


# ============================================================================
# Rate Limiter Tests
# ============================================================================

class TestRateLimiter:
    """Tests for RateLimiter."""

    def test_initial_backoff(self):
        """Test initial backoff delay."""
        limiter = RateLimiter(base_delay=1.0)
        delay = limiter.calculate_backoff(0)
        # Should be around base_delay with jitter
        assert 0.8 <= delay <= 1.2

    def test_exponential_backoff(self):
        """Test exponential backoff increases."""
        limiter = RateLimiter(base_delay=1.0, max_delay=60.0, jitter_factor=0)

        delay1 = limiter.calculate_backoff(0)
        delay2 = limiter.calculate_backoff(1)
        delay3 = limiter.calculate_backoff(2)

        # Each delay should generally increase (with decorrelated jitter)
        assert delay1 <= limiter.max_delay
        assert delay2 <= limiter.max_delay
        assert delay3 <= limiter.max_delay

    def test_retry_after_respected(self):
        """Test that Retry-After header is respected."""
        limiter = RateLimiter()
        delay = limiter.calculate_backoff(0, retry_after=30.0)
        # Should be around 30 with small jitter
        assert 29 <= delay <= 33

    def test_max_delay_cap(self):
        """Test that delay is capped at max_delay."""
        limiter = RateLimiter(max_delay=10.0)
        delay = limiter.calculate_backoff(0, retry_after=100.0)
        assert delay <= 10.0

    def test_should_retry(self):
        """Test retry logic."""
        limiter = RateLimiter(max_retries=3)
        assert limiter.should_retry(0) is True
        assert limiter.should_retry(1) is True
        assert limiter.should_retry(2) is True
        assert limiter.should_retry(3) is False

    def test_reset(self):
        """Test state reset after success."""
        limiter = RateLimiter()
        limiter.calculate_backoff(2)  # Simulate failures
        limiter.reset()
        stats = limiter.get_stats()
        assert stats["consecutive_failures"] == 0
        assert stats["last_delay"] == 0.0


# ============================================================================
# Client Initialization Tests
# ============================================================================

class TestClientInitialization:
    """Tests for client initialization."""

    def test_client_with_api_key(self, mock_api_key):
        """Test client initialization with explicit API key."""
        client = OpenRouterClient(api_key=mock_api_key)
        assert client.config.api_key == mock_api_key
        client.close()

    def test_client_from_env(self, mock_env, mock_api_key):
        """Test client initialization from environment."""
        client = OpenRouterClient()
        assert client.config.api_key == mock_api_key
        client.close()

    def test_client_missing_api_key(self, monkeypatch):
        """Test error when API key is missing."""
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        with pytest.raises(MissingAPIKeyError):
            OpenRouterClient()

    def test_client_context_manager(self, config):
        """Test context manager usage."""
        with OpenRouterClient(config=config) as client:
            assert client.config.api_key == config.api_key
        # Client should be closed after context


# ============================================================================
# Chat Completion Tests
# ============================================================================

class TestChatCompletion:
    """Tests for chat completion."""

    def test_call_gemini_success(self, client, success_response):
        """Test successful Gemini call."""
        mock_response = httpx.Response(
            status_code=200,
            json=success_response,
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            result = client.call_gemini("Hello!")

            assert result == "Hello! I'm Gemini 2.5 Pro. How can I help you?"
            mock_http_client.request.assert_called_once()

    def test_call_gemini_with_system_prompt(self, client, success_response):
        """Test Gemini call with system prompt."""
        mock_response = httpx.Response(
            status_code=200,
            json=success_response,
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            client.call_gemini(
                "Hello!",
                system_prompt="You are a helpful assistant.",
            )

            call_args = mock_http_client.request.call_args
            payload = call_args.kwargs["json"]

            assert len(payload["messages"]) == 2
            assert payload["messages"][0]["role"] == "system"
            assert payload["messages"][1]["role"] == "user"

    def test_chat_completion_with_parameters(self, client, success_response):
        """Test chat completion with all parameters."""
        mock_response = httpx.Response(
            status_code=200,
            json=success_response,
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            client.chat_completion(
                messages=[{"role": "user", "content": "Test"}],
                model=GEMINI_25_PRO,
                temperature=0.5,
                max_tokens=1000,
                top_p=0.9,
            )

            call_args = mock_http_client.request.call_args
            payload = call_args.kwargs["json"]

            assert payload["temperature"] == 0.5
            assert payload["max_tokens"] == 1000
            assert payload["top_p"] == 0.9


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestErrorHandling:
    """Tests for error handling."""

    def test_authentication_error(self, client, auth_error_response):
        """Test authentication error handling."""
        mock_response = httpx.Response(
            status_code=401,
            json=auth_error_response,
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with pytest.raises(AuthenticationError) as exc_info:
                client.call_gemini("Test")

            assert exc_info.value.status_code == 401

    def test_rate_limit_error(self, client, rate_limit_response):
        """Test rate limit error after retries exhausted."""
        mock_response = httpx.Response(
            status_code=429,
            json=rate_limit_response,
            headers={"Retry-After": "5"},
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            # Patch sleep to avoid actual waiting
            with patch.object(client._rate_limiter, "wait"):
                with pytest.raises(RateLimitError) as exc_info:
                    client.call_gemini("Test")

                assert exc_info.value.status_code == 429

    def test_bad_request_error(self, client):
        """Test bad request error handling."""
        mock_response = httpx.Response(
            status_code=400,
            json={"error": {"message": "Invalid model", "type": "invalid_request"}},
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with pytest.raises(BadRequestError) as exc_info:
                client.call_gemini("Test")

            assert exc_info.value.status_code == 400

    def test_insufficient_credits_error(self, client):
        """Test insufficient credits error handling."""
        mock_response = httpx.Response(
            status_code=402,
            json={"error": {"message": "No credits remaining", "type": "payment_required"}},
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with pytest.raises(InsufficientCreditsError) as exc_info:
                client.call_gemini("Test")

            assert exc_info.value.status_code == 402

    def test_content_moderation_error(self, client):
        """Test content moderation error handling."""
        mock_response = httpx.Response(
            status_code=403,
            json={"error": {"message": "Content flagged", "type": "moderation_error"}},
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with pytest.raises(ContentModerationError) as exc_info:
                client.call_gemini("Test")

            assert exc_info.value.status_code == 403

    def test_not_found_error(self, client):
        """Test not found error handling."""
        mock_response = httpx.Response(
            status_code=404,
            json={"error": {"message": "Model not found", "type": "not_found"}},
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with pytest.raises(NotFoundError) as exc_info:
                client.call_gemini("Test")

            assert exc_info.value.status_code == 404

    def test_server_error_with_retry(self, client, success_response):
        """Test server error triggers retry."""
        error_response = httpx.Response(
            status_code=500,
            json={"error": {"message": "Internal error"}},
        )
        success_resp = httpx.Response(
            status_code=200,
            json=success_response,
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            # First call fails, second succeeds
            mock_http_client.request.side_effect = [error_response, success_resp]
            mock_get_client.return_value = mock_http_client

            with patch.object(client._rate_limiter, "wait"):
                result = client.call_gemini("Test")

            assert result == "Hello! I'm Gemini 2.5 Pro. How can I help you?"
            assert mock_http_client.request.call_count == 2

    def test_model_unavailable_error(self, client):
        """Test model unavailable error handling."""
        mock_response = httpx.Response(
            status_code=503,
            json={"error": {"message": "Model unavailable", "type": "model_unavailable"}},
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with patch.object(client._rate_limiter, "wait"):
                with pytest.raises(ModelUnavailableError) as exc_info:
                    client.call_gemini("Test")

                assert exc_info.value.status_code == 503

    def test_timeout_error(self, client):
        """Test timeout error handling."""
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.side_effect = httpx.TimeoutException("Timeout")
            mock_get_client.return_value = mock_http_client

            with patch.object(client._rate_limiter, "wait"):
                with pytest.raises(TimeoutError):
                    client.call_gemini("Test")


# ============================================================================
# Response Parsing Tests
# ============================================================================

class TestResponseParsing:
    """Tests for response parsing."""

    def test_malformed_json_response(self, client):
        """Test handling of malformed JSON response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("", "", 0)
        mock_response.text = "invalid json"

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with pytest.raises(ResponseParseError):
                client.call_gemini("Test")

    def test_missing_choices_in_response(self, client):
        """Test handling of response missing choices."""
        incomplete_response = {
            "id": "gen-123",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "google/gemini-2.5-pro",
            # Missing 'choices' field
        }

        mock_response = httpx.Response(
            status_code=200,
            json=incomplete_response,
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with pytest.raises(ResponseParseError):
                client.call_gemini("Test")


# ============================================================================
# Retry Logic Tests
# ============================================================================

class TestRetryLogic:
    """Tests for retry logic."""

    def test_max_retries_exhausted(self, client):
        """Test behavior when max retries are exhausted."""
        mock_response = httpx.Response(
            status_code=500,
            json={"error": {"message": "Server error"}},
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.return_value = mock_response
            mock_get_client.return_value = mock_http_client

            with patch.object(client._rate_limiter, "wait"):
                with pytest.raises(ServerError):
                    client.call_gemini("Test")

            # Should have tried max_retries + 1 times
            assert mock_http_client.request.call_count == client.config.max_retries + 1

    def test_successful_after_retry(self, client, success_response):
        """Test successful response after initial failure."""
        error_response = httpx.Response(
            status_code=429,
            json={"error": {"message": "Rate limited"}},
        )
        success_resp = httpx.Response(
            status_code=200,
            json=success_response,
        )

        with patch.object(client, "_get_client") as mock_get_client:
            mock_http_client = MagicMock()
            mock_http_client.request.side_effect = [error_response, success_resp]
            mock_get_client.return_value = mock_http_client

            with patch.object(client._rate_limiter, "wait"):
                result = client.call_gemini("Test")

            assert "Gemini" in result


# ============================================================================
# Async Client Tests
# ============================================================================

class TestAsyncClient:
    """Tests for AsyncOpenRouterClient."""

    @pytest.mark.asyncio
    async def test_async_client_initialization(self, mock_env, mock_api_key):
        """Test async client initialization."""
        async with AsyncOpenRouterClient() as client:
            assert client.config.api_key == mock_api_key

    @pytest.mark.asyncio
    async def test_async_call_gemini(self, config, success_response):
        """Test async Gemini call."""
        async with AsyncOpenRouterClient(config=config) as client:
            mock_response = httpx.Response(
                status_code=200,
                json=success_response,
            )

            with patch.object(client, "_get_client") as mock_get_client:
                mock_http_client = MagicMock()
                mock_http_client.request = MagicMock(return_value=mock_response)

                # Make it awaitable
                async def async_request(*args, **kwargs):
                    return mock_response
                mock_http_client.request = async_request

                async def get_client():
                    return mock_http_client
                mock_get_client.side_effect = get_client

                result = await client.call_gemini("Hello!")

                assert "Gemini" in result


# ============================================================================
# Integration-like Tests (still mocked but test full flow)
# ============================================================================

class TestFullFlow:
    """Integration-like tests for complete request/response flow."""

    def test_complete_chat_flow(self, mock_env, success_response):
        """Test complete chat flow from init to response."""
        with OpenRouterClient() as client:
            mock_response = httpx.Response(
                status_code=200,
                json=success_response,
            )

            with patch.object(client, "_get_client") as mock_get_client:
                mock_http_client = MagicMock()
                mock_http_client.request.return_value = mock_response
                mock_get_client.return_value = mock_http_client

                result = client.call_gemini(
                    "What is Python?",
                    system_prompt="You are a programming expert.",
                    temperature=0.5,
                    max_tokens=2000,
                )

                # Verify the request was made correctly
                call_args = mock_http_client.request.call_args
                assert call_args.args[0] == "POST"
                assert call_args.args[1] == "/chat/completions"

                payload = call_args.kwargs["json"]
                assert payload["model"] == GEMINI_25_PRO
                assert payload["temperature"] == 0.5
                assert payload["max_tokens"] == 2000
                assert len(payload["messages"]) == 2

                # Verify the response
                assert isinstance(result, str)
                assert len(result) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
