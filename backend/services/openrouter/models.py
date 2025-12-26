"""Pydantic Models for OpenRouter API"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Role(str, Enum):
    """Message role types."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class FunctionCall(BaseModel):
    """Function call in assistant response."""
    model_config = ConfigDict(extra="allow")

    name: str
    arguments: str  # JSON string


class ToolCall(BaseModel):
    """Tool call from assistant."""
    model_config = ConfigDict(extra="allow")

    id: str
    type: Literal["function"] = "function"
    function: FunctionCall


class Message(BaseModel):
    """
    Chat message structure.

    Compatible with OpenAI message format.
    """
    model_config = ConfigDict(extra="allow")

    role: Role | str
    content: Optional[str] = None
    name: Optional[str] = None
    tool_calls: Optional[list[ToolCall]] = None
    tool_call_id: Optional[str] = None


class Usage(BaseModel):
    """Token usage information."""
    model_config = ConfigDict(extra="allow")

    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)


class ChoiceDelta(BaseModel):
    """Streaming delta content."""
    model_config = ConfigDict(extra="allow")

    role: Optional[str] = None
    content: Optional[str] = None
    tool_calls: Optional[list[ToolCall]] = None


class Choice(BaseModel):
    """Completion choice."""
    model_config = ConfigDict(extra="allow")

    index: int = Field(ge=0)
    message: Message
    finish_reason: Optional[str] = None
    logprobs: Optional[Any] = None


class StreamChoice(BaseModel):
    """Streaming completion choice."""
    model_config = ConfigDict(extra="allow")

    index: int = Field(ge=0)
    delta: ChoiceDelta
    finish_reason: Optional[str] = None


class ChatResponse(BaseModel):
    """
    Chat completion response.

    OpenAI-compatible response format with OpenRouter extensions.
    """
    model_config = ConfigDict(extra="allow")

    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: list[Choice]
    usage: Optional[Usage] = None
    system_fingerprint: Optional[str] = None
    provider: Optional[str] = None


class StreamChunk(BaseModel):
    """
    Streaming response chunk.

    Used for Server-Sent Events (SSE) streaming.
    """
    model_config = ConfigDict(extra="allow")

    id: str
    object: Literal["chat.completion.chunk"] = "chat.completion.chunk"
    created: int
    model: str
    choices: list[StreamChoice]
    usage: Optional[Usage] = None


class ChatRequest(BaseModel):
    """
    Chat completion request.

    Matches OpenAI API with OpenRouter extensions.
    """
    model_config = ConfigDict(extra="forbid")

    model: str = Field(
        ...,
        description="Model identifier (e.g., 'google/gemini-2.5-pro')"
    )
    messages: list[dict[str, Any] | Message]

    # Generation parameters
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1)
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    frequency_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    presence_penalty: Optional[float] = Field(None, ge=-2.0, le=2.0)
    stop: Optional[list[str]] = None
    stream: bool = False

    # Tool use
    tools: Optional[list[dict[str, Any]]] = None
    tool_choice: Optional[Union[str, dict[str, Any]]] = None

    # Response format
    response_format: Optional[dict[str, Any]] = None
    seed: Optional[int] = None

    # OpenRouter-specific
    provider: Optional[dict[str, Any]] = None
    transforms: Optional[list[str]] = None
    route: Optional[str] = None

    @field_validator("model")
    @classmethod
    def validate_model_format(cls, v: str) -> str:
        """Validate model identifier format."""
        if "/" not in v and v != "openrouter/auto":
            raise ValueError(
                f"Invalid model format: '{v}'. "
                "Expected 'provider/model-name' or 'openrouter/auto'"
            )
        return v


class Pricing(BaseModel):
    """Model pricing information."""
    model_config = ConfigDict(extra="allow")

    prompt: str  # Price per 1M tokens as string
    completion: str
    image: Optional[str] = None
    request: Optional[str] = None


class ModelInfo(BaseModel):
    """
    Model information from /models endpoint.
    """
    model_config = ConfigDict(extra="allow")

    id: str = Field(..., description="Model identifier")
    name: str = Field(..., description="Human-readable name")
    description: Optional[str] = None
    context_length: int = Field(..., ge=1)
    pricing: Pricing
    architecture: Optional[dict[str, Any]] = None
    top_provider: Optional[dict[str, Any]] = None
    per_request_limits: Optional[dict[str, Any]] = None
    created: Optional[int] = None


class CreditsInfo(BaseModel):
    """Credit balance information from /auth/key endpoint."""
    model_config = ConfigDict(extra="allow")

    label: Optional[str] = None
    usage: float = Field(..., ge=0.0, description="Credits used")
    limit: Optional[float] = Field(None, description="Credit limit")
    limit_remaining: Optional[float] = Field(None, description="Credits remaining")
    is_free_tier: bool = False
    rate_limit: Optional[dict[str, Any]] = None


class GenerationInfo(BaseModel):
    """Past generation information from /generation/{id} endpoint."""
    model_config = ConfigDict(extra="allow")

    id: str
    model: str
    streamed: bool
    generation_time: Optional[float] = None
    tokens_prompt: int = Field(ge=0)
    tokens_completion: int = Field(ge=0)
    native_tokens_prompt: Optional[int] = None
    native_tokens_completion: Optional[int] = None
    num_media_prompt: Optional[int] = None
    num_media_completion: Optional[int] = None
    origin: Optional[str] = None
    usage: Optional[float] = None
