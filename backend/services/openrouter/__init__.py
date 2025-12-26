"""OpenRouter API Client Package for Gemini 2.5 Pro"""

from .client import (
    OpenRouterClient,
    AsyncOpenRouterClient,
    GEMINI_25_PRO,
)
from .config import OpenRouterConfig
from .exceptions import (
    OpenRouterError,
    ConfigurationError,
    MissingAPIKeyError,
    InvalidConfigError,
    APIError,
    AuthenticationError,
    InsufficientCreditsError,
    RateLimitError,
    BadRequestError,
    ContentModerationError,
    NotFoundError,
    TimeoutError,
    ServerError,
    ModelUnavailableError,
    ValidationError,
    ResponseParseError,
    InvalidModelError,
)
from .models import (
    Message,
    Role,
    ChatRequest,
    ChatResponse,
    Choice,
    Usage,
    ModelInfo,
    Pricing,
    CreditsInfo,
    GenerationInfo,
    StreamChunk,
    StreamChoice,
    ChoiceDelta,
)
from .rate_limiter import RateLimiter

__version__ = "1.0.0"
__all__ = [
    # Version
    "__version__",
    # Clients
    "OpenRouterClient",
    "AsyncOpenRouterClient",
    # Constants
    "GEMINI_25_PRO",
    # Config
    "OpenRouterConfig",
    # Rate Limiter
    "RateLimiter",
    # Exceptions
    "OpenRouterError",
    "ConfigurationError",
    "MissingAPIKeyError",
    "InvalidConfigError",
    "APIError",
    "AuthenticationError",
    "InsufficientCreditsError",
    "RateLimitError",
    "BadRequestError",
    "ContentModerationError",
    "NotFoundError",
    "TimeoutError",
    "ServerError",
    "ModelUnavailableError",
    "ValidationError",
    "ResponseParseError",
    "InvalidModelError",
    # Models
    "Message",
    "Role",
    "ChatRequest",
    "ChatResponse",
    "Choice",
    "Usage",
    "ModelInfo",
    "Pricing",
    "CreditsInfo",
    "GenerationInfo",
    "StreamChunk",
    "StreamChoice",
    "ChoiceDelta",
]
