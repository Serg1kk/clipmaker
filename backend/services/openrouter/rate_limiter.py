"""Rate Limiting with Exponential Backoff and Jitter"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class RateLimitState:
    """
    Tracks rate limit state for backoff calculation.

    Attributes:
        consecutive_failures: Number of consecutive rate limit hits
        last_retry_time: Timestamp of last retry
        last_delay: Last calculated delay
    """
    consecutive_failures: int = 0
    last_retry_time: float = 0.0
    last_delay: float = 0.0


class RateLimiter:
    """
    Rate limiter with exponential backoff and jitter.

    Implements the "decorrelated jitter" algorithm for optimal
    distributed system behavior:

        delay = min(max_delay, random_between(base_delay, last_delay * 3))

    This provides:
        - Fast recovery for transient errors
        - Spread of retries across time
        - Prevention of thundering herd

    Attributes:
        max_retries: Maximum retry attempts (default: 3)
        base_delay: Initial delay in seconds (default: 1.0)
        max_delay: Maximum delay cap in seconds (default: 60.0)
        jitter_factor: Random jitter range 0.0-1.0 (default: 0.1)
    """

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        jitter_factor: float = 0.1,
    ) -> None:
        """
        Initialize rate limiter.

        Args:
            max_retries: Maximum retry attempts before giving up
            base_delay: Initial backoff delay in seconds
            max_delay: Maximum delay cap in seconds
            jitter_factor: Jitter as fraction of delay (0.0-1.0)
        """
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter_factor = jitter_factor
        self._state = RateLimitState()

    def calculate_backoff(
        self,
        attempt: int,
        retry_after: Optional[float] = None,
    ) -> float:
        """
        Calculate backoff delay for a retry attempt.

        Uses decorrelated jitter algorithm:
        - If retry_after is provided by server, respects it with jitter
        - Otherwise uses exponential backoff with decorrelated jitter

        Args:
            attempt: Current retry attempt number (0-indexed)
            retry_after: Server-suggested wait time (from Retry-After header)

        Returns:
            Delay in seconds before next retry
        """
        if retry_after is not None:
            # Respect server-suggested delay with small jitter
            delay = retry_after * (1 + random.uniform(0, self.jitter_factor))
            return min(delay, self.max_delay)

        # Decorrelated jitter: delay = random(base, last_delay * 3)
        if attempt == 0:
            # First retry: use base delay with jitter
            delay = self.base_delay
        else:
            # Subsequent retries: decorrelated jitter
            delay = random.uniform(
                self.base_delay,
                min(self._state.last_delay * 3, self.max_delay),
            )

        # Apply jitter
        delay = self._add_jitter(delay)

        # Cap at max delay
        delay = min(delay, self.max_delay)

        # Update state
        self._state.last_delay = delay
        self._state.consecutive_failures = attempt + 1

        return delay

    def _add_jitter(self, delay: float) -> float:
        """
        Add random jitter to delay.

        Args:
            delay: Base delay value

        Returns:
            Delay with jitter applied
        """
        jitter = delay * self.jitter_factor * random.uniform(-1, 1)
        return max(0, delay + jitter)

    def should_retry(self, attempt: int) -> bool:
        """
        Check if another retry should be attempted.

        Args:
            attempt: Current attempt number (0-indexed)

        Returns:
            True if retry should be attempted
        """
        return attempt < self.max_retries

    def wait(self, delay: float) -> None:
        """
        Synchronous wait for specified delay.

        Args:
            delay: Seconds to wait
        """
        logger.debug(f"Rate limited. Waiting {delay:.2f}s before retry")
        time.sleep(delay)
        self._state.last_retry_time = time.time()

    async def wait_async(self, delay: float) -> None:
        """
        Asynchronous wait for specified delay.

        Args:
            delay: Seconds to wait
        """
        logger.debug(f"Rate limited. Waiting {delay:.2f}s before retry")
        await asyncio.sleep(delay)
        self._state.last_retry_time = time.time()

    def reset(self) -> None:
        """Reset rate limit state after successful request."""
        self._state = RateLimitState()

    def get_stats(self) -> dict[str, float]:
        """
        Get current rate limiter statistics.

        Returns:
            Dictionary with state information
        """
        return {
            "consecutive_failures": self._state.consecutive_failures,
            "last_delay": self._state.last_delay,
            "last_retry_time": self._state.last_retry_time,
        }
