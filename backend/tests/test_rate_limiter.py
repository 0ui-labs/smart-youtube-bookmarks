"""
Tests for AdaptiveRateLimiter.

Tests concurrent request limiting, circuit breaker behavior, and adaptive delays.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
import time


@pytest.mark.asyncio
async def test_max_concurrent_enforced():
    """Test that max_concurrent limit is enforced."""
    from app.services.rate_limiter import AdaptiveRateLimiter

    limiter = AdaptiveRateLimiter(max_concurrent=2, base_delay=0.1)

    # Track concurrent executions
    concurrent_count = 0
    max_seen = 0

    async def task():
        nonlocal concurrent_count, max_seen
        async with limiter.acquire():
            concurrent_count += 1
            max_seen = max(max_seen, concurrent_count)
            await asyncio.sleep(0.1)  # Simulate work
            concurrent_count -= 1

    # Start 5 tasks concurrently
    await asyncio.gather(*[task() for _ in range(5)])

    # Should never exceed max_concurrent
    assert max_seen <= 2, f"Max concurrent was {max_seen}, expected <= 2"


@pytest.mark.asyncio
async def test_acquire_releases_slot():
    """Test that acquire properly releases slot after context exit."""
    from app.services.rate_limiter import AdaptiveRateLimiter

    limiter = AdaptiveRateLimiter(max_concurrent=1, base_delay=0)

    # First acquire should work
    async with limiter.acquire():
        pass

    # Second acquire should also work (slot was released)
    async with limiter.acquire():
        pass

    # If we get here without hanging, the test passes


@pytest.mark.asyncio
async def test_base_delay_applied():
    """Test that base delay is applied between requests."""
    from app.services.rate_limiter import AdaptiveRateLimiter

    limiter = AdaptiveRateLimiter(max_concurrent=1, base_delay=0.1)

    start = time.time()

    async with limiter.acquire():
        pass

    async with limiter.acquire():
        pass

    elapsed = time.time() - start

    # Should have at least one delay between the two acquires
    assert elapsed >= 0.1, f"Expected >= 0.1s delay, got {elapsed}s"


@pytest.mark.asyncio
async def test_circuit_breaker_opens_on_failures():
    """Test that circuit breaker opens after consecutive failures."""
    from app.services.rate_limiter import AdaptiveRateLimiter

    limiter = AdaptiveRateLimiter(max_concurrent=2, base_delay=0, failure_threshold=3)

    # Record 3 failures
    for _ in range(3):
        limiter.on_failure(is_rate_limit=True)

    # Circuit should be open
    assert limiter.is_circuit_open(), "Circuit should be open after 3 failures"


@pytest.mark.asyncio
async def test_circuit_breaker_closes_on_success():
    """Test that circuit breaker closes after success."""
    from app.services.rate_limiter import AdaptiveRateLimiter

    limiter = AdaptiveRateLimiter(max_concurrent=2, base_delay=0, failure_threshold=2)

    # Open circuit
    limiter.on_failure(is_rate_limit=True)
    limiter.on_failure(is_rate_limit=True)
    assert limiter.is_circuit_open()

    # Success should close it
    limiter.on_success()
    assert not limiter.is_circuit_open(), "Circuit should close after success"


@pytest.mark.asyncio
async def test_backoff_increases_on_rate_limit():
    """Test that delay increases when rate limited."""
    from app.services.rate_limiter import AdaptiveRateLimiter

    limiter = AdaptiveRateLimiter(max_concurrent=2, base_delay=1.0)
    initial_delay = limiter.current_delay

    # Simulate rate limit error
    limiter.on_failure(is_rate_limit=True)

    # Delay should have increased
    assert limiter.current_delay > initial_delay, "Delay should increase after rate limit"


@pytest.mark.asyncio
async def test_delay_decreases_on_success():
    """Test that delay decreases after successful requests."""
    from app.services.rate_limiter import AdaptiveRateLimiter

    limiter = AdaptiveRateLimiter(max_concurrent=2, base_delay=1.0)

    # First increase delay
    limiter.on_failure(is_rate_limit=True)
    increased_delay = limiter.current_delay

    # Then record success
    limiter.on_success()

    # Delay should decrease (but not below base)
    assert limiter.current_delay < increased_delay, "Delay should decrease after success"
    assert limiter.current_delay >= limiter.base_delay, "Delay should not go below base"
