"""OpenRouter Exception Hierarchy"""

from __future__ import annotations

from typing import Any, Optional


class OpenRouterError(Exception):
    """
    Base exception for all OpenRouter errors.

    Attributes:
        message: Human-readable error message
        details: Additional error details (if available)
    """

    def __init__(
        self,
        message: str,
        *,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.message = message
        self.details = details or {}
        super().__init__(message)

    def __str__(self) -> str:
        if self.details:
            return f"{self.message} | Details: {self.details}"
        return self.message


# Configuration Errors
class ConfigurationError(OpenRouterError):
    """Base class for configuration-related errors."""
    pass


class MissingAPIKeyError(ConfigurationError):
    """
    Raised when API key is not provided and not found in environment.

    Resolution:
        - Set OPENROUTER_API_KEY environment variable
        - Pass api_key parameter to client constructor
    """

    def __init__(self) -> None:
        super().__init__(
            "OpenRouter API key not found. Set OPENROUTER_API_KEY "
            "environment variable or pass api_key to the client."
        )


class InvalidConfigError(ConfigurationError):
    """
    Raised when configuration values are invalid.

    Examples:
        - Invalid URL format for base_url
        - Negative timeout value
        - Invalid model format
    """
    pass


# API Errors
class APIError(OpenRouterError):
    """
    Base class for API-related errors.

    Attributes:
        status_code: HTTP status code
        error_type: OpenRouter error type (if available)
        error_code: OpenRouter error code (if available)
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        error_type: Optional[str] = None,
        error_code: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.status_code = status_code
        self.error_type = error_type
        self.error_code = error_code
        super().__init__(message, details=details)

    def __str__(self) -> str:
        parts = [f"[{self.status_code}] {self.message}"]
        if self.error_type:
            parts.append(f"Type: {self.error_type}")
        if self.error_code:
            parts.append(f"Code: {self.error_code}")
        return " | ".join(parts)


class AuthenticationError(APIError):
    """
    Raised for authentication failures (HTTP 401).

    Causes:
        - Invalid API key
        - Expired API key
        - Revoked API key
    """

    def __init__(
        self,
        message: str = "Invalid or expired API key",
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=401, **kwargs)


class InsufficientCreditsError(APIError):
    """
    Raised when account has insufficient credits (HTTP 402).

    Resolution:
        - Add credits to your OpenRouter account
    """

    def __init__(
        self,
        message: str = "Insufficient credits",
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=402, **kwargs)


class RateLimitError(APIError):
    """
    Raised when rate limit is exceeded (HTTP 429).

    Attributes:
        retry_after: Suggested wait time in seconds (if provided)
        limit_type: Type of limit hit (requests, tokens, etc.)

    The client automatically retries with exponential backoff.
    This exception is raised when retries are exhausted.
    """

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        *,
        retry_after: Optional[float] = None,
        limit_type: Optional[str] = None,
        **kwargs,
    ) -> None:
        self.retry_after = retry_after
        self.limit_type = limit_type
        super().__init__(message, status_code=429, **kwargs)


class BadRequestError(APIError):
    """
    Raised for invalid request parameters (HTTP 400).

    Common causes:
        - Invalid model identifier
        - Invalid message format
        - Missing required parameters
        - Parameter value out of range
    """

    def __init__(
        self,
        message: str = "Invalid request parameters",
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=400, **kwargs)


class ContentModerationError(APIError):
    """
    Raised when content is flagged by moderation (HTTP 403).

    Resolution:
        - Modify input content to comply with policies
    """

    def __init__(
        self,
        message: str = "Content flagged by moderation",
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=403, **kwargs)


class NotFoundError(APIError):
    """
    Raised when requested resource is not found (HTTP 404).

    Common causes:
        - Model does not exist
        - Generation ID not found
        - Endpoint does not exist
    """

    def __init__(
        self,
        message: str = "Resource not found",
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=404, **kwargs)


class TimeoutError(APIError):
    """
    Raised when request times out (HTTP 408).

    Resolution:
        - Increase timeout in configuration
        - Use a faster model
        - Reduce max_tokens
    """

    def __init__(
        self,
        message: str = "Request timed out",
        *,
        timeout_seconds: Optional[float] = None,
        **kwargs,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        super().__init__(message, status_code=408, **kwargs)


class ServerError(APIError):
    """
    Raised for server-side errors (HTTP 5xx).

    The client automatically retries on 500, 502, 503, 504.
    This exception is raised when retries are exhausted.
    """

    def __init__(
        self,
        message: str = "OpenRouter server error",
        *,
        status_code: int = 500,
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=status_code, **kwargs)


class ModelUnavailableError(APIError):
    """
    Raised when the model is unavailable (HTTP 502/503).

    Resolution:
        - Try a different model
        - Check OpenRouter status page
    """

    def __init__(
        self,
        message: str = "Model unavailable",
        *,
        status_code: int = 503,
        **kwargs,
    ) -> None:
        super().__init__(message, status_code=status_code, **kwargs)


# Validation Errors
class ValidationError(OpenRouterError):
    """Base class for validation errors."""
    pass


class ResponseParseError(ValidationError):
    """
    Raised when API response cannot be parsed.

    Causes:
        - Invalid JSON response
        - Missing required fields
        - Unexpected response structure
    """

    def __init__(
        self,
        message: str = "Failed to parse API response",
        *,
        raw_response: Optional[str] = None,
        **kwargs,
    ) -> None:
        self.raw_response = raw_response
        super().__init__(message, **kwargs)


class InvalidModelError(ValidationError):
    """
    Raised when model identifier is invalid.

    Valid format: "provider/model-name"
    Example: "google/gemini-2.5-pro"
    """

    def __init__(
        self,
        model: str,
        **kwargs,
    ) -> None:
        self.model = model
        super().__init__(
            f"Invalid model identifier: '{model}'. "
            "Expected format: 'provider/model-name'",
            **kwargs,
        )
