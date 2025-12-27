"""
Engaging Moments Detection Service.

This module provides functionality to analyze video transcripts and identify
engaging moments (hooks) using Gemini 2.5 Pro via OpenRouter.

Hooks are complete phrases between 13-60 seconds that would capture viewer attention.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from .openrouter.client import OpenRouterClient, AsyncOpenRouterClient
from .openrouter.exceptions import APIError

logger = logging.getLogger(__name__)


class EngagingMoment(BaseModel):
    """
    Represents an engaging moment (hook) detected in a transcript.

    Attributes:
        start: Start time in seconds
        end: End time in seconds
        reason: Explanation of why this moment is engaging
        text: The transcript text for this moment
        confidence: Confidence score (0.0-1.0)
    """
    start: float = Field(..., ge=0.0, description="Start time in seconds")
    end: float = Field(..., ge=0.0, description="End time in seconds")
    reason: str = Field(..., min_length=1, description="Why this moment is engaging")
    text: str = Field(default="", description="Transcript text for this moment")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="Confidence score")

    @field_validator('end')
    @classmethod
    def end_must_be_after_start(cls, v: float, info) -> float:
        """Validate that end time is after start time."""
        if 'start' in info.data and v <= info.data['start']:
            raise ValueError('end must be greater than start')
        return v

    @property
    def duration(self) -> float:
        """Duration of the moment in seconds."""
        return self.end - self.start

    def is_valid_hook(self, min_duration: float = 13.0, max_duration: float = 60.0) -> bool:
        """Check if moment meets hook duration requirements."""
        return min_duration <= self.duration <= max_duration


class EngagingMomentsResponse(BaseModel):
    """Response containing all detected engaging moments."""
    moments: list[EngagingMoment] = Field(default_factory=list)
    total_count: int = Field(default=0, ge=0)
    transcript_duration: float = Field(default=0.0, ge=0.0)

    def model_post_init(self, __context) -> None:
        """Calculate total count after initialization."""
        if self.total_count == 0 and self.moments:
            object.__setattr__(self, 'total_count', len(self.moments))


# System prompt for Gemini to analyze transcripts
ENGAGING_MOMENTS_SYSTEM_PROMPT = """You are an expert video content analyst specializing in identifying engaging moments (hooks) in video transcripts.

Your task is to analyze the provided transcript and identify moments that would make compelling video hooks or clips. These moments should:

1. Be COMPLETE PHRASES - never cut off mid-sentence or mid-thought
2. Be between 13-60 seconds in duration
3. Capture viewer attention immediately
4. Contain interesting, surprising, emotional, or valuable content
5. Work as standalone content without needing additional context

For each engaging moment you identify, provide:
- start: The start time in seconds (use the exact timestamps from the transcript)
- end: The end time in seconds (ensure the phrase is complete)
- reason: A SHORT (1-2 sentences) explanation of why this moment is engaging

CRITICAL RULES:
- WRITE THE "reason" FIELD IN THE SAME LANGUAGE AS THE TRANSCRIPT (if Russian, write in Russian; if English, write in English, etc.)
- Always use the EXACT timestamps provided in the transcript segments
- Ensure each moment contains COMPLETE sentences/thoughts
- Prefer moments that start at natural sentence boundaries
- Keep reasons SHORT to avoid response truncation

Respond ONLY with valid JSON in this exact format:
{
  "moments": [
    {
      "start": 12.5,
      "end": 45.2,
      "reason": "Short reason in transcript language"
    }
  ]
}

If no engaging moments are found, respond with:
{
  "moments": []
}"""


def _format_transcript_for_prompt(transcript_json: dict[str, Any] | list) -> str:
    """
    Format transcript JSON into a readable format for the LLM prompt.

    Args:
        transcript_json: Transcript data containing segments with timing info

    Returns:
        Formatted string representation of the transcript
    """
    # Handle list format directly
    if isinstance(transcript_json, list):
        segments = transcript_json
    else:
        segments = transcript_json.get("segments", [])
        if not segments:
            # Try alternative formats
            if "transcription" in transcript_json:
                segments = transcript_json["transcription"].get("segments", [])

    if not segments:
        return "No transcript segments found."

    formatted_lines = []
    for segment in segments:
        start = segment.get("start", 0)
        end = segment.get("end", 0)
        text = segment.get("text", "").strip()

        if text:
            formatted_lines.append(f"[{start:.2f}s - {end:.2f}s]: {text}")

    return "\n".join(formatted_lines)


def _extract_text_for_moment(
    transcript_json: dict[str, Any],
    start: float,
    end: float
) -> str:
    """
    Extract transcript text for a given time range.

    Args:
        transcript_json: Full transcript data
        start: Start time in seconds
        end: End time in seconds

    Returns:
        Combined text for the time range
    """
    segments = transcript_json.get("segments", [])
    if not segments:
        if isinstance(transcript_json, list):
            segments = transcript_json
        elif "transcription" in transcript_json:
            segments = transcript_json["transcription"].get("segments", [])

    texts = []
    for segment in segments:
        seg_start = segment.get("start", 0)
        seg_end = segment.get("end", 0)

        # Check if segment overlaps with our time range
        if seg_start < end and seg_end > start:
            texts.append(segment.get("text", "").strip())

    return " ".join(texts)


def _get_transcript_duration(transcript_json: dict[str, Any]) -> float:
    """Get the total duration of the transcript."""
    segments = transcript_json.get("segments", [])
    if not segments:
        if isinstance(transcript_json, list):
            segments = transcript_json
        elif "transcription" in transcript_json:
            segments = transcript_json["transcription"].get("segments", [])

    if not segments:
        return 0.0

    return max(seg.get("end", 0) for seg in segments)


def _extract_json_from_response(response_text: str) -> str:
    """
    Extract JSON from Gemini response, handling various formats including truncated responses.

    Gemini often wraps JSON in markdown code blocks or adds explanatory text.
    This function extracts the actual JSON object, handling truncation gracefully.

    Args:
        response_text: Raw response from Gemini

    Returns:
        Extracted JSON string (possibly repaired if truncated)
    """
    text = response_text.strip()

    # Try 1: Extract from markdown code block (```json ... ``` or ``` ... ```)
    code_block_pattern = r'```(?:json)?\s*(\{[\s\S]*?\})\s*```'
    match = re.search(code_block_pattern, text)
    if match:
        return match.group(1)

    # Try 2: Find JSON object anywhere in the text using brace matching
    start_idx = text.find('{')
    if start_idx != -1:
        # Find matching closing brace
        brace_count = 0
        end_idx = start_idx
        found_match = False
        for i, char in enumerate(text[start_idx:], start=start_idx):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i
                    found_match = True
                    break

        if found_match and end_idx > start_idx:
            return text[start_idx:end_idx + 1]

        # JSON is truncated - try to repair it
        # Find the last complete object in the array
        json_text = text[start_idx:]
        return _repair_truncated_json(json_text)

    # Try 3: Return cleaned text as-is (original behavior)
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    return text.strip()


def _repair_truncated_json(json_text: str) -> str:
    """
    Attempt to repair truncated JSON by closing unclosed brackets.

    This handles cases where the LLM response was cut off mid-JSON.

    Args:
        json_text: Potentially truncated JSON string

    Returns:
        Repaired JSON string
    """
    # Find the last complete object in moments array
    # Look for pattern: }, followed by potential start of new object or end
    last_complete_idx = -1

    # Find positions of all "}," which indicate end of complete array items
    brace_count = 0
    in_string = False
    escape_next = False

    for i, char in enumerate(json_text):
        if escape_next:
            escape_next = False
            continue

        if char == '\\':
            escape_next = True
            continue

        if char == '"' and not escape_next:
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            # Check if this closes an array item (next non-whitespace is comma or ])
            rest = json_text[i+1:].lstrip()
            if rest.startswith(',') or rest.startswith(']'):
                last_complete_idx = i

    if last_complete_idx > 0:
        # Truncate to last complete item
        repaired = json_text[:last_complete_idx + 1]

        # Count remaining open braces/brackets
        open_braces = repaired.count('{') - repaired.count('}')
        open_brackets = repaired.count('[') - repaired.count(']')

        # Close the array and object
        if open_brackets > 0:
            repaired += '\n  ]'
            open_brackets -= 1
        if open_braces > 0:
            repaired += '\n}'
            open_braces -= 1

        # Close any remaining
        repaired += ']' * open_brackets + '}' * open_braces

        logger.warning(f"Repaired truncated JSON response (cut at char {last_complete_idx})")
        return repaired

    # Couldn't repair - return as-is and let json.loads fail with better error
    return json_text


def _parse_gemini_response(
    response_text: str,
    transcript_json: dict[str, Any]
) -> list[EngagingMoment]:
    """
    Parse Gemini's JSON response into EngagingMoment objects.

    Args:
        response_text: Raw response from Gemini
        transcript_json: Original transcript for text extraction

    Returns:
        List of validated EngagingMoment objects
    """
    try:
        # Extract JSON from response (handles markdown blocks, explanatory text, etc.)
        json_str = _extract_json_from_response(response_text)

        logger.debug(f"Extracted JSON string (first 500 chars): {json_str[:500]}")

        data = json.loads(json_str)
        moments_data = data.get("moments", [])

        moments = []
        for m in moments_data:
            try:
                start = float(m.get("start", 0))
                end = float(m.get("end", 0))
                reason = m.get("reason", "Engaging content")

                # Extract text for this moment
                text = _extract_text_for_moment(transcript_json, start, end)

                moment = EngagingMoment(
                    start=start,
                    end=end,
                    reason=reason,
                    text=text,
                    confidence=0.85
                )

                # Add all valid moments - duration filtering happens in caller
                moments.append(moment)

            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid moment data: {e}")
                continue

        return moments

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        logger.error(f"Raw response (first 1000 chars): {response_text[:1000]}")
        return []
    except Exception as e:
        logger.error(f"Error parsing Gemini response: {e}")
        logger.error(f"Raw response (first 1000 chars): {response_text[:1000]}")
        return []


def find_engaging_moments(
    transcript_json: dict[str, Any],
    *,
    client: Optional[OpenRouterClient] = None,
    temperature: float = 0.3,
    max_tokens: int = 8192,
    min_duration: float = 13.0,
    max_duration: float = 60.0,
    max_moments: int = 7,
) -> list[EngagingMoment]:
    """
    Analyze a transcript and find engaging moments (hooks) using Gemini 2.5 Pro.

    This function takes a transcript JSON (containing segments with timing info)
    and uses Gemini to identify moments that would make compelling video hooks.
    Each moment is a complete phrase between 13-60 seconds.

    Args:
        transcript_json: Transcript data containing segments with timing info.
            Expected format:
            {
                "segments": [
                    {"id": 0, "start": 0.0, "end": 5.2, "text": "..."},
                    ...
                ]
            }
        client: Optional OpenRouterClient instance. Creates new one if not provided.
        temperature: LLM temperature for response generation (default: 0.3 for consistency)
        max_tokens: Maximum tokens in response (default: 4096)
        min_duration: Minimum moment duration in seconds (default: 13.0)
        max_duration: Maximum moment duration in seconds (default: 60.0)

    Returns:
        List of EngagingMoment objects, each containing:
        - start: Start time in seconds
        - end: End time in seconds
        - reason: Why this moment is engaging
        - text: The transcript text for this moment
        - confidence: Confidence score (0.0-1.0)

    Raises:
        APIError: If the OpenRouter API call fails
        ValueError: If transcript_json is empty or invalid

    Example:
        >>> transcript = {
        ...     "segments": [
        ...         {"id": 0, "start": 0.0, "end": 15.0, "text": "Welcome to our show..."},
        ...         {"id": 1, "start": 15.0, "end": 45.0, "text": "Today we reveal..."},
        ...     ]
        ... }
        >>> moments = find_engaging_moments(transcript)
        >>> for m in moments:
        ...     print(f"{m.start}-{m.end}s: {m.reason}")
    """
    # Validate input
    if not transcript_json:
        raise ValueError("transcript_json cannot be empty")

    # Format transcript for the prompt
    formatted_transcript = _format_transcript_for_prompt(transcript_json)
    if formatted_transcript == "No transcript segments found.":
        logger.warning("No transcript segments found in input")
        return []

    # Build the user prompt
    user_prompt = f"""Analyze the following transcript and identify the TOP {max_moments} most engaging moments (hooks) that are between {min_duration:.0f}-{max_duration:.0f} seconds long.

TRANSCRIPT:
{formatted_transcript}

Remember:
- Return MAXIMUM {max_moments} moments (the best ones only)
- Each moment MUST be a complete phrase (never cut mid-sentence)
- Duration must be between {min_duration:.0f}-{max_duration:.0f} seconds
- Use the EXACT timestamps from the transcript
- Keep the "reason" field SHORT (1-2 sentences max)

Respond with JSON only."""

    # Create client if not provided
    should_close_client = client is None
    if client is None:
        client = OpenRouterClient()

    try:
        # Call Gemini via OpenRouter
        response = client.call_gemini(
            prompt=user_prompt,
            system_prompt=ENGAGING_MOMENTS_SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # Parse response into EngagingMoment objects
        moments = _parse_gemini_response(response, transcript_json)

        # Filter by duration requirements
        valid_moments = [
            m for m in moments
            if min_duration <= m.duration <= max_duration
        ]

        # Sort by start time
        valid_moments.sort(key=lambda m: m.start)

        logger.info(f"Found {len(valid_moments)} engaging moments")
        return valid_moments

    finally:
        if should_close_client and client is not None:
            client.close()


async def find_engaging_moments_async(
    transcript_json: dict[str, Any],
    *,
    client: Optional[AsyncOpenRouterClient] = None,
    temperature: float = 0.3,
    max_tokens: int = 8192,
    min_duration: float = 13.0,
    max_duration: float = 60.0,
    max_moments: int = 7,
) -> list[EngagingMoment]:
    """
    Async version of find_engaging_moments.

    Analyze a transcript and find engaging moments (hooks) using Gemini 2.5 Pro.

    Args:
        transcript_json: Transcript data containing segments with timing info
        client: Optional AsyncOpenRouterClient instance
        temperature: LLM temperature (default: 0.3)
        max_tokens: Maximum tokens in response (default: 4096)
        min_duration: Minimum moment duration in seconds (default: 13.0)
        max_duration: Maximum moment duration in seconds (default: 60.0)

    Returns:
        List of EngagingMoment objects

    Raises:
        APIError: If the OpenRouter API call fails
        ValueError: If transcript_json is empty or invalid
    """
    # Validate input
    if not transcript_json:
        raise ValueError("transcript_json cannot be empty")

    # Format transcript for the prompt
    formatted_transcript = _format_transcript_for_prompt(transcript_json)
    if formatted_transcript == "No transcript segments found.":
        logger.warning("No transcript segments found in input")
        return []

    # Build the user prompt
    user_prompt = f"""Analyze the following transcript and identify the TOP {max_moments} most engaging moments (hooks) that are between {min_duration:.0f}-{max_duration:.0f} seconds long.

TRANSCRIPT:
{formatted_transcript}

Remember:
- Return MAXIMUM {max_moments} moments (the best ones only)
- Each moment MUST be a complete phrase (never cut mid-sentence)
- Duration must be between {min_duration:.0f}-{max_duration:.0f} seconds
- Use the EXACT timestamps from the transcript
- Keep the "reason" field SHORT (1-2 sentences max)

Respond with JSON only."""

    # Create client if not provided
    should_close_client = client is None
    if client is None:
        client = AsyncOpenRouterClient()

    try:
        # Call Gemini via OpenRouter
        response = await client.call_gemini(
            prompt=user_prompt,
            system_prompt=ENGAGING_MOMENTS_SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # Parse response into EngagingMoment objects
        moments = _parse_gemini_response(response, transcript_json)

        # Filter by duration requirements
        valid_moments = [
            m for m in moments
            if min_duration <= m.duration <= max_duration
        ]

        # Sort by start time
        valid_moments.sort(key=lambda m: m.start)

        logger.info(f"Found {len(valid_moments)} engaging moments")
        return valid_moments

    finally:
        if should_close_client and client is not None:
            await client.close()


def find_engaging_moments_response(
    transcript_json: dict[str, Any],
    **kwargs
) -> EngagingMomentsResponse:
    """
    Find engaging moments and return as structured response.

    This is a convenience wrapper that returns an EngagingMomentsResponse
    object with additional metadata.

    Args:
        transcript_json: Transcript data
        **kwargs: Additional arguments passed to find_engaging_moments

    Returns:
        EngagingMomentsResponse with moments and metadata
    """
    moments = find_engaging_moments(transcript_json, **kwargs)
    duration = _get_transcript_duration(transcript_json)

    return EngagingMomentsResponse(
        moments=moments,
        total_count=len(moments),
        transcript_duration=duration
    )
