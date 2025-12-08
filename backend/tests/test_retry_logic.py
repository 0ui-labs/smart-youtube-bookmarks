"""
Tests for fetch_with_retry helper.
"""

from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_fetch_with_retry_returns_on_success():
    """Test that successful call returns immediately."""
    from app.workers.video_processor import fetch_with_retry

    mock_func = AsyncMock(return_value="success")

    result = await fetch_with_retry(mock_func, "arg1", "arg2")

    assert result == "success"
    assert mock_func.call_count == 1
    mock_func.assert_called_with("arg1", "arg2")


@pytest.mark.asyncio
async def test_fetch_with_retry_retries_on_failure():
    """Test that function retries on failure."""
    from app.workers.video_processor import fetch_with_retry

    # Fail twice, then succeed
    mock_func = AsyncMock(
        side_effect=[Exception("Error 1"), Exception("Error 2"), "success"]
    )

    result = await fetch_with_retry(mock_func, max_retries=3, base_delay=0.01)

    assert result == "success"
    assert mock_func.call_count == 3


@pytest.mark.asyncio
async def test_fetch_with_retry_raises_after_max_retries():
    """Test that exception is raised after max retries exhausted."""
    from app.workers.video_processor import fetch_with_retry

    mock_func = AsyncMock(side_effect=Exception("Persistent error"))

    with pytest.raises(Exception, match="Persistent error"):
        await fetch_with_retry(mock_func, max_retries=2, base_delay=0.01)

    # Should have tried 3 times (initial + 2 retries)
    assert mock_func.call_count == 3


@pytest.mark.asyncio
async def test_fetch_with_retry_exponential_backoff():
    """Test that delay increases exponentially."""
    import time

    from app.workers.video_processor import fetch_with_retry

    # Track timing
    call_times = []

    async def slow_fail():
        call_times.append(time.time())
        if len(call_times) < 3:
            raise Exception("Fail")
        return "success"

    start = time.time()
    await fetch_with_retry(slow_fail, max_retries=3, base_delay=0.05)
    total_time = time.time() - start

    # With base_delay=0.05 and exponential backoff:
    # Wait 1: 0.05s (2^0 * 0.05)
    # Wait 2: 0.10s (2^1 * 0.05)
    # Total: at least 0.15s
    assert total_time >= 0.1, f"Expected exponential backoff, got {total_time}s"


@pytest.mark.asyncio
async def test_fetch_with_retry_passes_kwargs():
    """Test that kwargs are passed to function."""
    from app.workers.video_processor import fetch_with_retry

    mock_func = AsyncMock(return_value="result")

    await fetch_with_retry(mock_func, "arg", key="value", max_retries=1)

    mock_func.assert_called_with("arg", key="value")
