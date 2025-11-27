"""
Adaptive Rate Limiter with Circuit Breaker.

Provides concurrent request limiting with adaptive delays based on success/failure rates.
Includes circuit breaker pattern to prevent cascading failures during rate limiting.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


class AdaptiveRateLimiter:
    """
    Rate limiter with adaptive delays and circuit breaker.

    Features:
    - Limits concurrent requests via semaphore
    - Applies configurable delay between requests
    - Increases delay on rate limit errors (exponential backoff)
    - Decreases delay on successful requests
    - Circuit breaker opens after consecutive failures

    Usage:
        limiter = AdaptiveRateLimiter(max_concurrent=3, base_delay=2.0)

        async with limiter.acquire():
            result = await make_api_call()
            limiter.on_success()  # or limiter.on_failure(is_rate_limit=True)
    """

    def __init__(
        self,
        max_concurrent: int = 3,
        base_delay: float = 2.0,
        max_delay: float = 60.0,
        backoff_multiplier: float = 2.0,
        recovery_multiplier: float = 0.8,
        failure_threshold: int = 5,
        circuit_timeout: float = 30.0
    ):
        """
        Initialize rate limiter.

        Args:
            max_concurrent: Maximum concurrent requests
            base_delay: Base delay between requests (seconds)
            max_delay: Maximum delay cap (seconds)
            backoff_multiplier: Multiply delay by this on rate limit
            recovery_multiplier: Multiply delay by this on success
            failure_threshold: Consecutive failures to open circuit
            circuit_timeout: Time to keep circuit open (seconds)
        """
        self.max_concurrent = max_concurrent
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_multiplier = backoff_multiplier
        self.recovery_multiplier = recovery_multiplier
        self.failure_threshold = failure_threshold
        self.circuit_timeout = circuit_timeout

        # Internal state
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._current_delay = base_delay
        self._consecutive_failures = 0
        self._circuit_open_until: float | None = None
        self._last_request_time: float = 0
        self._lock = asyncio.Lock()

    @property
    def current_delay(self) -> float:
        """Current delay between requests."""
        return self._current_delay

    def is_circuit_open(self) -> bool:
        """Check if circuit breaker is open."""
        if self._circuit_open_until is None:
            return False

        import time
        if time.time() >= self._circuit_open_until:
            # Circuit timeout expired, close it
            self._circuit_open_until = None
            return False

        return True

    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[None, None]:
        """
        Acquire a slot for making a request.

        Waits for available slot and applies delay between requests.
        """
        # Check circuit breaker
        if self.is_circuit_open():
            logger.warning("Circuit breaker is open, waiting for timeout")
            await asyncio.sleep(self.circuit_timeout)

        # Acquire semaphore slot
        await self._semaphore.acquire()

        try:
            # Apply delay since last request
            async with self._lock:
                import time
                now = time.time()
                time_since_last = now - self._last_request_time

                if time_since_last < self._current_delay:
                    wait_time = self._current_delay - time_since_last
                    await asyncio.sleep(wait_time)

                self._last_request_time = time.time()

            yield

        finally:
            self._semaphore.release()

    def on_success(self) -> None:
        """Record successful request. Decreases delay and closes circuit."""
        self._consecutive_failures = 0
        self._circuit_open_until = None

        # Decrease delay (but not below base)
        self._current_delay = max(
            self.base_delay,
            self._current_delay * self.recovery_multiplier
        )

        logger.debug(f"Rate limiter: success, delay now {self._current_delay:.2f}s")

    def on_failure(self, is_rate_limit: bool = False) -> None:
        """
        Record failed request.

        Args:
            is_rate_limit: True if failure was due to rate limiting (429)
        """
        self._consecutive_failures += 1

        if is_rate_limit:
            # Increase delay on rate limit
            self._current_delay = min(
                self.max_delay,
                self._current_delay * self.backoff_multiplier
            )
            logger.warning(
                f"Rate limiter: rate limit hit, delay now {self._current_delay:.2f}s"
            )

        # Check if we should open circuit
        if self._consecutive_failures >= self.failure_threshold:
            import time
            self._circuit_open_until = time.time() + self.circuit_timeout
            logger.warning(
                f"Rate limiter: circuit breaker opened after {self._consecutive_failures} failures"
            )

    def reset(self) -> None:
        """Reset rate limiter to initial state."""
        self._current_delay = self.base_delay
        self._consecutive_failures = 0
        self._circuit_open_until = None
        self._last_request_time = 0
        logger.info("Rate limiter reset to initial state")
