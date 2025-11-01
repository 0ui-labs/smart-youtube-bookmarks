"""Integration tests for ARQ worker."""
import pytest
from app.workers.settings import WorkerSettings


def test_worker_settings_has_required_config():
    """Test worker settings has all required configuration."""
    assert WorkerSettings.redis_settings is not None
    assert WorkerSettings.max_jobs == 10
    assert WorkerSettings.job_timeout == 300
    assert WorkerSettings.keep_result == 3600


def test_worker_has_lifecycle_hooks():
    """Test worker has all lifecycle hooks configured."""
    assert WorkerSettings.on_startup is not None
    assert WorkerSettings.on_shutdown is not None
    assert WorkerSettings.on_job_start is not None
    assert WorkerSettings.after_job_end is not None


def test_worker_has_registered_functions():
    """Test worker has process_video function registered."""
    assert len(WorkerSettings.functions) > 0
    assert WorkerSettings.functions[0].__name__ == 'process_video'


@pytest.mark.asyncio
async def test_worker_startup_and_shutdown():
    """Test worker can start up and shut down cleanly."""
    from app.workers.db_manager import sessionmanager

    # Simulate startup
    await sessionmanager.connect()

    try:
        # Verify engine created
        assert sessionmanager.engine is not None
        assert sessionmanager.scoped_session is not None
    finally:
        # Simulate shutdown
        await sessionmanager.disconnect()

        # Verify cleanup (engine might still exist but should be disposed)
        # We can't easily check if engine is disposed, so just verify disconnect didn't crash
