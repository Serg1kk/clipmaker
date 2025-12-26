"""
Mock Utilities Package for AI Clips Testing

Contains mock classes and utilities for testing HTTP interactions.
"""

from .mock_httpx import (
    MockHTTPXResponse,
    MockHTTPXClient,
    SequentialResponseMock,
    mock_httpx_post,
    create_error_response,
    RATE_LIMIT_ERROR,
    AUTH_ERROR,
    SERVER_ERROR,
    SERVICE_UNAVAILABLE,
)
