"""
HTTPX Mock Patterns for OpenRouter Testing

Provides comprehensive mock patterns for testing HTTP interactions
without making real network requests.

Usage:
    from tests.mocks.mock_httpx import MockHTTPXClient, MockHTTPXResponse

    # Create mock responses
    response = MockHTTPXResponse(status_code=200, json_data={"success": True})

    # Create mock client with sequential responses
    client = MockHTTPXClient([response1, response2, response3])

    # Use in tests
    with patch("httpx.AsyncClient", return_value=client):
        result = await my_function()
"""

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, Callable, Dict, List, Optional, Union
from unittest.mock import AsyncMock, MagicMock, patch

# Conditional import - httpx may not be installed in test environment
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    httpx = None
    HTTPX_AVAILABLE = False


class MockHTTPXHeaders:
    """Mock for httpx.Headers with dict-like interface."""

    def __init__(self, headers: Optional[Dict[str, str]] = None):
        self._headers = {k.lower(): v for k, v in (headers or {}).items()}

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        return self._headers.get(key.lower(), default)

    def __getitem__(self, key: str) -> str:
        return self._headers[key.lower()]

    def __contains__(self, key: str) -> bool:
        return key.lower() in self._headers

    def __iter__(self):
        return iter(self._headers)

    def items(self):
        return self._headers.items()


class MockHTTPXResponse:
    """
    Mock HTTPX response with customizable behavior.

    Simulates httpx.Response interface for testing without network calls.

    Attributes:
        status_code: HTTP status code
        headers: Response headers
        is_success: True if 2xx status
        is_error: True if 4xx or 5xx status

    Example:
        response = MockHTTPXResponse(
            status_code=200,
            json_data={"result": "success"},
            headers={"X-Request-Id": "abc123"}
        )
    """

    def __init__(
        self,
        status_code: int = 200,
        json_data: Optional[Dict] = None,
        content: Optional[bytes] = None,
        headers: Optional[Dict[str, str]] = None,
        raise_on_status: Optional[Exception] = None,
    ):
        self.status_code = status_code
        self._json_data = json_data
        self._content = content
        self._headers_dict = headers or {}
        self.headers = MockHTTPXHeaders(self._headers_dict)
        self._raise_on_status = raise_on_status

        # Set content from JSON if not provided
        if self._content is None and json_data is not None:
            self._content = json.dumps(json_data).encode('utf-8')
        elif self._content is None:
            self._content = b''

        # Computed properties
        self.is_success = 200 <= status_code < 300
        self.is_error = status_code >= 400
        self.is_client_error = 400 <= status_code < 500
        self.is_server_error = status_code >= 500

    def json(self) -> Dict[str, Any]:
        """
        Parse response content as JSON.

        Returns:
            Parsed JSON data

        Raises:
            json.JSONDecodeError: If content is not valid JSON
        """
        if self._json_data is not None:
            return self._json_data
        return json.loads(self._content.decode('utf-8'))

    @property
    def content(self) -> bytes:
        """Raw response content as bytes."""
        return self._content

    @property
    def text(self) -> str:
        """Response content as string."""
        return self._content.decode('utf-8')

    def raise_for_status(self) -> None:
        """
        Raise exception if response indicates an error.

        Raises:
            httpx.HTTPStatusError: If status code >= 400
            Custom exception: If raise_on_status was set
        """
        if self._raise_on_status:
            raise self._raise_on_status

        if self.status_code >= 400:
            if HTTPX_AVAILABLE:
                raise httpx.HTTPStatusError(
                    message=f"HTTP {self.status_code}",
                    request=MagicMock(),
                    response=self
                )
            else:
                raise Exception(f"HTTP Error: {self.status_code}")


class MockHTTPXClient:
    """
    Mock HTTPX AsyncClient for testing.

    Supports sequential responses and request capturing.

    Attributes:
        requests: List of all captured requests

    Example:
        responses = [
            MockHTTPXResponse(status_code=503),  # First call fails
            MockHTTPXResponse(status_code=200, json_data={"ok": True})  # Retry succeeds
        ]
        client = MockHTTPXClient(responses)

        with patch("httpx.AsyncClient", return_value=client):
            result = await my_api_call()  # Will retry and succeed

        # Verify requests
        assert len(client.get_requests()) == 2
    """

    def __init__(
        self,
        responses: Optional[List[MockHTTPXResponse]] = None,
        default_response: Optional[MockHTTPXResponse] = None
    ):
        self._responses = responses or []
        self._response_index = 0
        self._requests: List[Dict[str, Any]] = []
        self._default_response = default_response or MockHTTPXResponse(
            status_code=200,
            json_data={"success": True}
        )

    async def post(
        self,
        url: str,
        json: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: Optional[float] = None,
        **kwargs
    ) -> MockHTTPXResponse:
        """
        Mock POST request.

        Captures request details and returns next response in queue.
        """
        self._requests.append({
            "method": "POST",
            "url": url,
            "json": json,
            "headers": headers,
            "timeout": timeout,
            **kwargs
        })

        return self._get_next_response()

    async def get(
        self,
        url: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: Optional[float] = None,
        **kwargs
    ) -> MockHTTPXResponse:
        """Mock GET request."""
        self._requests.append({
            "method": "GET",
            "url": url,
            "params": params,
            "headers": headers,
            "timeout": timeout,
            **kwargs
        })

        return self._get_next_response()

    async def put(
        self,
        url: str,
        json: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        **kwargs
    ) -> MockHTTPXResponse:
        """Mock PUT request."""
        self._requests.append({
            "method": "PUT",
            "url": url,
            "json": json,
            "headers": headers,
            **kwargs
        })

        return self._get_next_response()

    async def delete(
        self,
        url: str,
        headers: Optional[Dict] = None,
        **kwargs
    ) -> MockHTTPXResponse:
        """Mock DELETE request."""
        self._requests.append({
            "method": "DELETE",
            "url": url,
            "headers": headers,
            **kwargs
        })

        return self._get_next_response()

    def _get_next_response(self) -> MockHTTPXResponse:
        """Get next response from queue or return default."""
        if self._response_index < len(self._responses):
            response = self._responses[self._response_index]
            self._response_index += 1
            return response

        return self._default_response

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, *args):
        """Async context manager exit."""
        pass

    async def aclose(self):
        """Close the client (no-op for mock)."""
        pass

    def get_requests(self) -> List[Dict[str, Any]]:
        """Get all captured requests."""
        return self._requests.copy()

    def get_last_request(self) -> Optional[Dict[str, Any]]:
        """Get the most recent request."""
        return self._requests[-1] if self._requests else None

    def reset(self):
        """Reset client state for reuse."""
        self._response_index = 0
        self._requests.clear()

    @property
    def call_count(self) -> int:
        """Number of requests made."""
        return len(self._requests)


class SequentialResponseMock:
    """
    Mock that returns different responses on each call.

    Useful for testing retry logic where each attempt may have different outcome.

    Example:
        responses = [
            MockHTTPXResponse(status_code=503),  # First: fail
            MockHTTPXResponse(status_code=503),  # Second: fail
            MockHTTPXResponse(status_code=200),  # Third: succeed
        ]
        mock = SequentialResponseMock(responses)

        # First call returns 503
        # Second call returns 503
        # Third call returns 200
    """

    def __init__(self, responses: List[Union[MockHTTPXResponse, Exception]]):
        self.responses = responses
        self.call_count = 0
        self.calls: List[Dict[str, Any]] = []

    async def __call__(self, *args, **kwargs) -> MockHTTPXResponse:
        """Handle call, returning next response or raising exception."""
        self.calls.append({"args": args, "kwargs": kwargs})

        if self.call_count >= len(self.responses):
            raise IndexError(
                f"No more mock responses available. "
                f"Expected at most {len(self.responses)} calls, "
                f"but got call #{self.call_count + 1}"
            )

        response = self.responses[self.call_count]
        self.call_count += 1

        if isinstance(response, Exception):
            raise response

        return response

    def reset(self):
        """Reset for reuse."""
        self.call_count = 0
        self.calls.clear()


@asynccontextmanager
async def mock_httpx_post(response: MockHTTPXResponse):
    """
    Context manager to mock httpx.AsyncClient.post.

    Example:
        async with mock_httpx_post(MockHTTPXResponse(status_code=200)) as mock:
            result = await my_api_call()
            assert mock.post.called
    """
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client
        yield mock_client


def create_error_response(
    status_code: int,
    error_type: str,
    message: str,
    code: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None
) -> MockHTTPXResponse:
    """
    Create a standardized OpenRouter error response.

    Args:
        status_code: HTTP status code
        error_type: Error type (e.g., "authentication_error")
        message: Human-readable error message
        code: Error code (defaults to error_type)
        headers: Optional response headers

    Returns:
        MockHTTPXResponse configured as an error
    """
    return MockHTTPXResponse(
        status_code=status_code,
        json_data={
            "error": {
                "type": error_type,
                "message": message,
                "code": code or error_type
            }
        },
        headers=headers
    )


# =============================================================================
# Pre-built Error Responses
# =============================================================================

RATE_LIMIT_ERROR = create_error_response(
    status_code=429,
    error_type="rate_limit_error",
    message="Rate limit exceeded. Please slow down your requests.",
    code="rate_limit_exceeded",
    headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"}
)

AUTH_ERROR = create_error_response(
    status_code=401,
    error_type="authentication_error",
    message="Invalid API key provided.",
    code="invalid_api_key"
)

INSUFFICIENT_CREDITS_ERROR = create_error_response(
    status_code=402,
    error_type="payment_error",
    message="Insufficient credits. Please add more credits.",
    code="insufficient_credits"
)

SERVER_ERROR = create_error_response(
    status_code=500,
    error_type="server_error",
    message="Internal server error. Please try again later.",
    code="internal_error"
)

SERVICE_UNAVAILABLE = create_error_response(
    status_code=503,
    error_type="server_error",
    message="Service temporarily unavailable.",
    code="service_unavailable",
    headers={"Retry-After": "30"}
)

MODEL_NOT_FOUND = create_error_response(
    status_code=404,
    error_type="invalid_request_error",
    message="The specified model was not found.",
    code="model_not_found"
)

CONTEXT_LENGTH_EXCEEDED = create_error_response(
    status_code=400,
    error_type="invalid_request_error",
    message="This model's maximum context length is 128000 tokens.",
    code="context_length_exceeded"
)


# =============================================================================
# Export All
# =============================================================================

__all__ = [
    # Response mocking
    "MockHTTPXResponse",
    "MockHTTPXClient",
    "MockHTTPXHeaders",
    "SequentialResponseMock",
    # Context managers
    "mock_httpx_post",
    # Utilities
    "create_error_response",
    # Pre-built errors
    "RATE_LIMIT_ERROR",
    "AUTH_ERROR",
    "INSUFFICIENT_CREDITS_ERROR",
    "SERVER_ERROR",
    "SERVICE_UNAVAILABLE",
    "MODEL_NOT_FOUND",
    "CONTEXT_LENGTH_EXCEEDED",
    # Constants
    "HTTPX_AVAILABLE",
]
