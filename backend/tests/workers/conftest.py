"""Pytest fixtures for ARQ worker tests."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest


@pytest.fixture
def arq_context(test_db):
    """
    Fixture providing ARQ job context for worker tests.
    Simulates the context object ARQ provides to worker functions.
    """
    return {
        "job_id": "test-job-123",
        "job_try": 1,
        "enqueue_time": datetime.now(UTC),
        "redis": AsyncMock(),
        "db": test_db,  # Injected by on_job_start in production
    }


@pytest.fixture
def retry_context(test_db):
    """Context for testing retry scenarios (3rd attempt)."""
    return {
        "job_id": "test-job-retry",
        "job_try": 3,  # Third retry attempt
        "enqueue_time": datetime.now(UTC),
        "redis": AsyncMock(),
        "db": test_db,
    }
