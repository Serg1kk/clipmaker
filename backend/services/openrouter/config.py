"""OpenRouter Configuration Management"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from .exceptions import MissingAPIKeyError, InvalidConfigError


@dataclass(frozen=True)
class OpenRouterConfig:
    """
    Configuration for OpenRouter API client.

    Supports loading from environment variables or explicit parameters.

    Attributes:
        api_key: OpenRouter API key (required)
        base_url: API base URL (default: https://openrouter.ai/api/v1)
        timeout: Request timeout in seconds (default: 60.0)
        max_retries: Maximum retry attempts for transient errors (default: 3)
        http_referer: Optional HTTP-Referer header for API attribution
        site_name: Optional X-Title header for site identification
        default_model: Default model to use if not specified
    """
    api_key: str
    base_url: str = "https://openrouter.ai/api/v1"
    timeout: float = 60.0
    max_retries: int = 3
    http_referer: Optional[str] = None
    site_name: Optional[str] = None
    default_model: str = "google/gemini-2.5-pro"

    # Rate limiting configuration
    rate_limit_base_delay: float = 1.0
    rate_limit_max_delay: float = 60.0
    rate_limit_jitter_factor: float = 0.1

    @classmethod
    def from_env(
        cls,
        api_key: Optional[str] = None,
        load_dotenv: bool = True,
        dotenv_path: Optional[str] = None,
        **overrides,
    ) -> "OpenRouterConfig":
        """
        Create configuration from environment variables.

        Environment variables:
            OPENROUTER_API_KEY: API key (required if not passed)
            OPENROUTER_BASE_URL: Base URL override
            OPENROUTER_TIMEOUT: Request timeout
            OPENROUTER_MAX_RETRIES: Max retry attempts
            OPENROUTER_HTTP_REFERER: HTTP Referer header
            OPENROUTER_SITE_NAME: Site name for X-Title header
            OPENROUTER_DEFAULT_MODEL: Default model

        Args:
            api_key: Override API key (uses env var if None)
            load_dotenv: Whether to load .env file
            dotenv_path: Custom path to .env file
            **overrides: Additional config overrides

        Returns:
            OpenRouterConfig instance

        Raises:
            MissingAPIKeyError: If API key not found
        """
        # Optionally load .env file
        if load_dotenv:
            try:
                from dotenv import load_dotenv as _load_dotenv
                _load_dotenv(dotenv_path)
            except ImportError:
                pass  # python-dotenv not installed, skip

        # Get API key
        resolved_api_key = api_key or os.environ.get("OPENROUTER_API_KEY")
        if not resolved_api_key:
            raise MissingAPIKeyError()

        # Build config from environment
        config_kwargs = {
            "api_key": resolved_api_key,
            "base_url": os.environ.get(
                "OPENROUTER_BASE_URL",
                "https://openrouter.ai/api/v1"
            ),
            "timeout": float(os.environ.get("OPENROUTER_TIMEOUT", "60.0")),
            "max_retries": int(os.environ.get("OPENROUTER_MAX_RETRIES", "3")),
            "http_referer": os.environ.get("OPENROUTER_HTTP_REFERER"),
            "site_name": os.environ.get("OPENROUTER_SITE_NAME"),
            "default_model": os.environ.get(
                "OPENROUTER_DEFAULT_MODEL",
                "google/gemini-2.5-pro"
            ),
        }

        # Apply overrides
        config_kwargs.update(overrides)

        config = cls(**config_kwargs)
        config.validate()
        return config

    def validate(self) -> None:
        """
        Validate configuration values.

        Raises:
            InvalidConfigError: If configuration is invalid
        """
        if not self.api_key:
            raise MissingAPIKeyError()

        if self.timeout <= 0:
            raise InvalidConfigError(f"Timeout must be positive, got {self.timeout}")

        if self.max_retries < 0:
            raise InvalidConfigError(
                f"max_retries must be non-negative, got {self.max_retries}"
            )

        if not self.base_url.startswith(("http://", "https://")):
            raise InvalidConfigError(
                f"base_url must be a valid URL, got {self.base_url}"
            )

    def get_headers(self) -> dict[str, str]:
        """
        Get HTTP headers for API requests.

        Returns:
            Dictionary of headers including Authorization
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if self.http_referer:
            headers["HTTP-Referer"] = self.http_referer

        if self.site_name:
            headers["X-Title"] = self.site_name

        return headers
