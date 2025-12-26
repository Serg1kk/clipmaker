"""OpenRouter API Client for Gemini 2.5 Pro"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator, Iterator, Optional, TypeVar

import httpx

from .config import OpenRouterConfig
from .exceptions import (
    APIError,
    AuthenticationError,
    BadRequestError,
    ContentModerationError,
    InsufficientCreditsError,
    ModelUnavailableError,
    NotFoundError,
    RateLimitError,
    ResponseParseError,
    ServerError,
    TimeoutError as OpenRouterTimeoutError,
)
from .models import (
    ChatRequest,
    ChatResponse,
    CreditsInfo,
    GenerationInfo,
    Message,
    ModelInfo,
    StreamChunk,
)
from .rate_limiter import RateLimiter

logger = logging.getLogger(__name__)
T = TypeVar("T")

# Default model for this client
GEMINI_25_PRO = "google/gemini-2.5-pro"


class OpenRouterClient:
    """
    Synchronous OpenRouter API client with Gemini 2.5 Pro support.

    Thread-safe client with connection pooling, automatic retries,
    and rate limit handling with exponential backoff.

    Usage:
        >>> client = OpenRouterClient()  # Uses OPENROUTER_API_KEY env var
        >>> response = client.call_gemini("What is Python?")
        >>> print(response)

        # With context manager
        >>> with OpenRouterClient() as client:
        ...     response = client.call_gemini("Hello!")
        ...     print(response)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        config: Optional[OpenRouterConfig] = None,
        **config_kwargs,
    ) -> None:
        """
        Initialize the synchronous client.

        Args:
            api_key: OpenRouter API key (or use OPENROUTER_API_KEY env var)
            config: Pre-built configuration object
            **config_kwargs: Additional config options
        """
        if config is not None:
            self.config = config
        else:
            self.config = OpenRouterConfig.from_env(api_key=api_key, **config_kwargs)

        self._rate_limiter = RateLimiter(
            max_retries=self.config.max_retries,
            base_delay=self.config.rate_limit_base_delay,
            max_delay=self.config.rate_limit_max_delay,
            jitter_factor=self.config.rate_limit_jitter_factor,
        )

        self._client: Optional[httpx.Client] = None

    def _get_client(self) -> httpx.Client:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.Client(
                base_url=self.config.base_url,
                headers=self.config.get_headers(),
                timeout=httpx.Timeout(self.config.timeout),
            )
        return self._client

    def __enter__(self) -> "OpenRouterClient":
        """Context manager entry."""
        return self

    def __exit__(self, *args) -> None:
        """Context manager exit with cleanup."""
        self.close()

    def close(self) -> None:
        """Close HTTP session and release resources."""
        if self._client is not None:
            self._client.close()
            self._client = None

    def call_gemini(
        self,
        prompt: str,
        *,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> str:
        """
        Call Gemini 2.5 Pro with a simple prompt.

        This is a convenience method for common use cases.

        Args:
            prompt: User message/prompt
            system_prompt: Optional system instructions
            temperature: Sampling temperature (0.0 to 2.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters for chat_completion

        Returns:
            Generated text response

        Raises:
            AuthenticationError: Invalid API key
            RateLimitError: Rate limit exceeded
            ServerError: OpenRouter server error
        """
        messages: list[dict[str, Any]] = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        response = self.chat_completion(
            messages=messages,
            model=GEMINI_25_PRO,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )

        return response.choices[0].message.content or ""

    def chat_completion(
        self,
        messages: list[Message | dict[str, Any]],
        model: Optional[str] = None,
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        top_p: Optional[float] = None,
        frequency_penalty: Optional[float] = None,
        presence_penalty: Optional[float] = None,
        stop: Optional[list[str]] = None,
        tools: Optional[list[dict[str, Any]]] = None,
        tool_choice: Optional[str | dict[str, Any]] = None,
        response_format: Optional[dict[str, Any]] = None,
        seed: Optional[int] = None,
        provider: Optional[dict[str, Any]] = None,
        transforms: Optional[list[str]] = None,
        route: Optional[str] = None,
    ) -> ChatResponse:
        """
        Create a chat completion.

        Args:
            messages: List of conversation messages
            model: Model identifier (default: google/gemini-2.5-pro)
            temperature: Sampling temperature (0.0 to 2.0)
            max_tokens: Maximum tokens to generate
            top_p: Nucleus sampling parameter
            frequency_penalty: Frequency penalty (-2.0 to 2.0)
            presence_penalty: Presence penalty (-2.0 to 2.0)
            stop: Stop sequences
            tools: Tool/function definitions
            tool_choice: Tool selection strategy
            response_format: Response format (e.g., {"type": "json_object"})
            seed: Random seed for reproducibility
            provider: Provider-specific settings
            transforms: Prompt transforms to apply
            route: Routing strategy

        Returns:
            ChatResponse with generated completion

        Raises:
            AuthenticationError: Invalid API key
            RateLimitError: Rate limit exceeded
            BadRequestError: Invalid request parameters
            ServerError: OpenRouter server error
        """
        # Build request payload
        payload: dict[str, Any] = {
            "model": model or self.config.default_model,
            "messages": [
                m.model_dump() if isinstance(m, Message) else m
                for m in messages
            ],
        }

        # Add optional parameters
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if top_p is not None:
            payload["top_p"] = top_p
        if frequency_penalty is not None:
            payload["frequency_penalty"] = frequency_penalty
        if presence_penalty is not None:
            payload["presence_penalty"] = presence_penalty
        if stop is not None:
            payload["stop"] = stop
        if tools is not None:
            payload["tools"] = tools
        if tool_choice is not None:
            payload["tool_choice"] = tool_choice
        if response_format is not None:
            payload["response_format"] = response_format
        if seed is not None:
            payload["seed"] = seed
        if provider is not None:
            payload["provider"] = provider
        if transforms is not None:
            payload["transforms"] = transforms
        if route is not None:
            payload["route"] = route

        response = self._make_request("POST", "/chat/completions", json=payload)
        return self._parse_response(response, ChatResponse)

    def stream_completion(
        self,
        messages: list[Message | dict[str, Any]],
        model: Optional[str] = None,
        **kwargs,
    ) -> Iterator[StreamChunk]:
        """
        Stream a chat completion.

        Yields chunks of the response as they are generated.

        Args:
            messages: List of conversation messages
            model: Model identifier
            **kwargs: Additional chat completion parameters

        Yields:
            StreamChunk objects with incremental content
        """
        payload: dict[str, Any] = {
            "model": model or self.config.default_model,
            "messages": [
                m.model_dump() if isinstance(m, Message) else m
                for m in messages
            ],
            "stream": True,
        }
        payload.update(kwargs)

        client = self._get_client()

        with client.stream("POST", "/chat/completions", json=payload) as response:
            self._handle_error(response)

            for line in response.iter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk_data = json.loads(data)
                        yield StreamChunk.model_validate(chunk_data)
                    except json.JSONDecodeError:
                        continue

    def list_models(self) -> list[ModelInfo]:
        """
        List available models.

        Returns:
            List of ModelInfo objects
        """
        response = self._make_request("GET", "/models")
        data = response.json()
        return [ModelInfo.model_validate(m) for m in data.get("data", [])]

    def get_credits(self) -> CreditsInfo:
        """
        Get current credit balance and usage.

        Returns:
            CreditsInfo with balance and usage data
        """
        response = self._make_request("GET", "/auth/key")
        data = response.json()
        return CreditsInfo.model_validate(data.get("data", data))

    def get_generation(self, generation_id: str) -> GenerationInfo:
        """
        Get information about a past generation.

        Args:
            generation_id: Generation ID from a previous response

        Returns:
            GenerationInfo with generation details
        """
        response = self._make_request("GET", f"/generation/{generation_id}")
        data = response.json()
        return GenerationInfo.model_validate(data.get("data", data))

    def _make_request(
        self,
        method: str,
        endpoint: str,
        *,
        json: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> httpx.Response:
        """
        Make an HTTP request with retry and rate limiting.

        Args:
            method: HTTP method
            endpoint: API endpoint
            json: JSON body
            params: Query parameters

        Returns:
            HTTP response

        Raises:
            Appropriate APIError subclass
        """
        client = self._get_client()
        last_exception: Optional[Exception] = None

        for attempt in range(self.config.max_retries + 1):
            try:
                response = client.request(
                    method,
                    endpoint,
                    json=json,
                    params=params,
                )

                # Check for errors
                if response.status_code >= 400:
                    # Handle rate limiting
                    if response.status_code == 429:
                        if self._rate_limiter.should_retry(attempt):
                            retry_after = self._get_retry_after(response)
                            delay = self._rate_limiter.calculate_backoff(
                                attempt, retry_after
                            )
                            logger.warning(
                                f"Rate limited (attempt {attempt + 1}). "
                                f"Waiting {delay:.2f}s"
                            )
                            self._rate_limiter.wait(delay)
                            continue

                    # Handle server errors with retry
                    if response.status_code >= 500:
                        if self._rate_limiter.should_retry(attempt):
                            delay = self._rate_limiter.calculate_backoff(attempt)
                            logger.warning(
                                f"Server error {response.status_code} "
                                f"(attempt {attempt + 1}). Waiting {delay:.2f}s"
                            )
                            self._rate_limiter.wait(delay)
                            continue

                    self._handle_error(response)

                # Success - reset rate limiter
                self._rate_limiter.reset()
                return response

            except httpx.TimeoutException as e:
                last_exception = e
                if self._rate_limiter.should_retry(attempt):
                    delay = self._rate_limiter.calculate_backoff(attempt)
                    logger.warning(
                        f"Request timeout (attempt {attempt + 1}). "
                        f"Waiting {delay:.2f}s"
                    )
                    self._rate_limiter.wait(delay)
                    continue
                raise OpenRouterTimeoutError(
                    "Request timed out",
                    timeout_seconds=self.config.timeout,
                )

            except httpx.HTTPError as e:
                last_exception = e
                if self._rate_limiter.should_retry(attempt):
                    delay = self._rate_limiter.calculate_backoff(attempt)
                    logger.warning(
                        f"HTTP error (attempt {attempt + 1}): {e}. "
                        f"Waiting {delay:.2f}s"
                    )
                    self._rate_limiter.wait(delay)
                    continue
                raise ServerError(f"HTTP error: {e}")

        # All retries exhausted
        if last_exception:
            raise ServerError(f"Max retries exceeded: {last_exception}")
        raise ServerError("Max retries exceeded")

    def _get_retry_after(self, response: httpx.Response) -> Optional[float]:
        """Extract Retry-After header value."""
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                return float(retry_after)
            except ValueError:
                pass
        return None

    def _handle_error(self, response: httpx.Response) -> None:
        """
        Handle error responses by raising appropriate exceptions.

        Args:
            response: HTTP response to check

        Raises:
            Appropriate APIError subclass
        """
        if response.status_code < 400:
            return

        # Try to parse error details
        error_data: dict[str, Any] = {}
        try:
            error_data = response.json().get("error", {})
        except (json.JSONDecodeError, KeyError):
            pass

        message = error_data.get("message", response.text or "Unknown error")
        error_type = error_data.get("type")
        error_code = error_data.get("code")

        status = response.status_code

        if status == 400:
            raise BadRequestError(message, error_type=error_type, error_code=error_code)
        elif status == 401:
            raise AuthenticationError(message, error_type=error_type, error_code=error_code)
        elif status == 402:
            raise InsufficientCreditsError(message, error_type=error_type, error_code=error_code)
        elif status == 403:
            raise ContentModerationError(message, error_type=error_type, error_code=error_code)
        elif status == 404:
            raise NotFoundError(message, error_type=error_type, error_code=error_code)
        elif status == 408:
            raise OpenRouterTimeoutError(message, error_type=error_type, error_code=error_code)
        elif status == 429:
            retry_after = self._get_retry_after(response)
            raise RateLimitError(
                message,
                retry_after=retry_after,
                error_type=error_type,
                error_code=error_code,
            )
        elif status in (502, 503):
            raise ModelUnavailableError(
                message,
                status_code=status,
                error_type=error_type,
                error_code=error_code,
            )
        elif status >= 500:
            raise ServerError(
                message,
                status_code=status,
                error_type=error_type,
                error_code=error_code,
            )
        else:
            raise APIError(
                message,
                status_code=status,
                error_type=error_type,
                error_code=error_code,
            )

    def _parse_response(
        self,
        response: httpx.Response,
        response_model: type[T],
    ) -> T:
        """
        Parse and validate response JSON.

        Args:
            response: HTTP response
            response_model: Pydantic model for validation

        Returns:
            Validated response object

        Raises:
            ResponseParseError: Invalid response format
        """
        try:
            data = response.json()
            return response_model.model_validate(data)
        except json.JSONDecodeError as e:
            raise ResponseParseError(
                f"Invalid JSON response: {e}",
                raw_response=response.text,
            )
        except Exception as e:
            raise ResponseParseError(
                f"Failed to parse response: {e}",
                raw_response=response.text,
            )


class AsyncOpenRouterClient:
    """
    Asynchronous OpenRouter API client with Gemini 2.5 Pro support.

    Async/await-compatible client with connection pooling,
    automatic retries, and rate limit handling.

    Usage:
        >>> async with AsyncOpenRouterClient() as client:
        ...     response = await client.call_gemini("Hello!")
        ...     print(response)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        config: Optional[OpenRouterConfig] = None,
        **config_kwargs,
    ) -> None:
        """Initialize the async client."""
        if config is not None:
            self.config = config
        else:
            self.config = OpenRouterConfig.from_env(api_key=api_key, **config_kwargs)

        self._rate_limiter = RateLimiter(
            max_retries=self.config.max_retries,
            base_delay=self.config.rate_limit_base_delay,
            max_delay=self.config.rate_limit_max_delay,
            jitter_factor=self.config.rate_limit_jitter_factor,
        )

        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.config.base_url,
                headers=self.config.get_headers(),
                timeout=httpx.Timeout(self.config.timeout),
            )
        return self._client

    async def __aenter__(self) -> "AsyncOpenRouterClient":
        """Async context manager entry."""
        return self

    async def __aexit__(self, *args) -> None:
        """Async context manager exit with cleanup."""
        await self.close()

    async def close(self) -> None:
        """Close async HTTP session."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def call_gemini(
        self,
        prompt: str,
        *,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> str:
        """
        Call Gemini 2.5 Pro with a simple prompt.

        Args:
            prompt: User message/prompt
            system_prompt: Optional system instructions
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters

        Returns:
            Generated text response
        """
        messages: list[dict[str, Any]] = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        response = await self.chat_completion(
            messages=messages,
            model=GEMINI_25_PRO,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )

        return response.choices[0].message.content or ""

    async def chat_completion(
        self,
        messages: list[Message | dict[str, Any]],
        model: Optional[str] = None,
        **kwargs,
    ) -> ChatResponse:
        """Async version of chat_completion."""
        payload: dict[str, Any] = {
            "model": model or self.config.default_model,
            "messages": [
                m.model_dump() if isinstance(m, Message) else m
                for m in messages
            ],
        }
        payload.update({k: v for k, v in kwargs.items() if v is not None})

        response = await self._make_request("POST", "/chat/completions", json=payload)
        return self._parse_response(response, ChatResponse)

    async def stream_completion(
        self,
        messages: list[Message | dict[str, Any]],
        model: Optional[str] = None,
        **kwargs,
    ) -> AsyncIterator[StreamChunk]:
        """
        Async streaming chat completion.

        Usage:
            async for chunk in client.stream_completion(messages, model):
                if chunk.choices[0].delta.content:
                    print(chunk.choices[0].delta.content, end="")
        """
        payload: dict[str, Any] = {
            "model": model or self.config.default_model,
            "messages": [
                m.model_dump() if isinstance(m, Message) else m
                for m in messages
            ],
            "stream": True,
        }
        payload.update(kwargs)

        client = await self._get_client()

        async with client.stream("POST", "/chat/completions", json=payload) as response:
            self._handle_error(response)

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk_data = json.loads(data)
                        yield StreamChunk.model_validate(chunk_data)
                    except json.JSONDecodeError:
                        continue

    async def list_models(self) -> list[ModelInfo]:
        """Async version of list_models."""
        response = await self._make_request("GET", "/models")
        data = response.json()
        return [ModelInfo.model_validate(m) for m in data.get("data", [])]

    async def get_credits(self) -> CreditsInfo:
        """Async version of get_credits."""
        response = await self._make_request("GET", "/auth/key")
        data = response.json()
        return CreditsInfo.model_validate(data.get("data", data))

    async def get_generation(self, generation_id: str) -> GenerationInfo:
        """Async version of get_generation."""
        response = await self._make_request("GET", f"/generation/{generation_id}")
        data = response.json()
        return GenerationInfo.model_validate(data.get("data", data))

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        *,
        json: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> httpx.Response:
        """Async version of _make_request with retry logic."""
        client = await self._get_client()
        last_exception: Optional[Exception] = None

        for attempt in range(self.config.max_retries + 1):
            try:
                response = await client.request(
                    method,
                    endpoint,
                    json=json,
                    params=params,
                )

                if response.status_code >= 400:
                    if response.status_code == 429:
                        if self._rate_limiter.should_retry(attempt):
                            retry_after = self._get_retry_after(response)
                            delay = self._rate_limiter.calculate_backoff(
                                attempt, retry_after
                            )
                            logger.warning(
                                f"Rate limited (attempt {attempt + 1}). "
                                f"Waiting {delay:.2f}s"
                            )
                            await self._rate_limiter.wait_async(delay)
                            continue

                    if response.status_code >= 500:
                        if self._rate_limiter.should_retry(attempt):
                            delay = self._rate_limiter.calculate_backoff(attempt)
                            logger.warning(
                                f"Server error {response.status_code} "
                                f"(attempt {attempt + 1}). Waiting {delay:.2f}s"
                            )
                            await self._rate_limiter.wait_async(delay)
                            continue

                    self._handle_error(response)

                self._rate_limiter.reset()
                return response

            except httpx.TimeoutException as e:
                last_exception = e
                if self._rate_limiter.should_retry(attempt):
                    delay = self._rate_limiter.calculate_backoff(attempt)
                    await self._rate_limiter.wait_async(delay)
                    continue
                raise OpenRouterTimeoutError(
                    "Request timed out",
                    timeout_seconds=self.config.timeout,
                )

            except httpx.HTTPError as e:
                last_exception = e
                if self._rate_limiter.should_retry(attempt):
                    delay = self._rate_limiter.calculate_backoff(attempt)
                    await self._rate_limiter.wait_async(delay)
                    continue
                raise ServerError(f"HTTP error: {e}")

        if last_exception:
            raise ServerError(f"Max retries exceeded: {last_exception}")
        raise ServerError("Max retries exceeded")

    def _get_retry_after(self, response: httpx.Response) -> Optional[float]:
        """Extract Retry-After header value."""
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                return float(retry_after)
            except ValueError:
                pass
        return None

    def _handle_error(self, response: httpx.Response) -> None:
        """Handle error responses."""
        if response.status_code < 400:
            return

        error_data: dict[str, Any] = {}
        try:
            error_data = response.json().get("error", {})
        except (json.JSONDecodeError, KeyError):
            pass

        message = error_data.get("message", response.text or "Unknown error")
        error_type = error_data.get("type")
        error_code = error_data.get("code")

        status = response.status_code

        if status == 400:
            raise BadRequestError(message, error_type=error_type, error_code=error_code)
        elif status == 401:
            raise AuthenticationError(message, error_type=error_type, error_code=error_code)
        elif status == 402:
            raise InsufficientCreditsError(message, error_type=error_type, error_code=error_code)
        elif status == 403:
            raise ContentModerationError(message, error_type=error_type, error_code=error_code)
        elif status == 404:
            raise NotFoundError(message, error_type=error_type, error_code=error_code)
        elif status == 408:
            raise OpenRouterTimeoutError(message, error_type=error_type, error_code=error_code)
        elif status == 429:
            retry_after = self._get_retry_after(response)
            raise RateLimitError(
                message,
                retry_after=retry_after,
                error_type=error_type,
                error_code=error_code,
            )
        elif status in (502, 503):
            raise ModelUnavailableError(
                message,
                status_code=status,
                error_type=error_type,
                error_code=error_code,
            )
        elif status >= 500:
            raise ServerError(
                message,
                status_code=status,
                error_type=error_type,
                error_code=error_code,
            )
        else:
            raise APIError(
                message,
                status_code=status,
                error_type=error_type,
                error_code=error_code,
            )

    def _parse_response(
        self,
        response: httpx.Response,
        response_model: type[T],
    ) -> T:
        """Parse and validate response JSON."""
        try:
            data = response.json()
            return response_model.model_validate(data)
        except json.JSONDecodeError as e:
            raise ResponseParseError(
                f"Invalid JSON response: {e}",
                raw_response=response.text,
            )
        except Exception as e:
            raise ResponseParseError(
                f"Failed to parse response: {e}",
                raw_response=response.text,
            )
