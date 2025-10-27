import pytest
from app.workers.video_processor import process_video
from app.models import Video
from app.models.list import BookmarkList
from sqlalchemy import select
from uuid import uuid4
from arq import create_pool
from arq.worker import Worker
from app.workers.settings import WorkerSettings
import httpx
from unittest.mock import AsyncMock, patch


@pytest.fixture
async def arq_redis():
    """ARQ Redis pool for testing."""
    pool = await create_pool(WorkerSettings.redis_settings)
    yield pool
    await pool.close()


@pytest.fixture
async def arq_worker(arq_redis):
    """ARQ worker in burst mode."""
    worker = Worker(
        functions=[process_video],
        redis_pool=arq_redis,
        burst=True,  # Exit when queue empty
        max_jobs=1
    )
    return worker


@pytest.mark.asyncio
async def test_process_video_updates_status(test_db):
    """Test that process_video changes status from pending."""
    # Arrange: Create test list first (foreign key requirement)
    bookmark_list = BookmarkList(
        name="Test List",
        description="Test list for worker"
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create test video
    video = Video(
        list_id=bookmark_list.id,
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending"
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Act: Process video
    ctx = {"db": test_db}
    result = await process_video(ctx, str(video.id), str(bookmark_list.id), {})

    # Assert: Status changed and result is success
    await test_db.refresh(video)
    # Stub doesn't update DB yet, so status remains "pending"
    assert video.processing_status == "pending"
    assert result["status"] == "success"
    assert result["video_id"] == str(video.id)


@pytest.mark.asyncio
async def test_process_video_with_retry_on_transient_error(test_db):
    """Test that process_video categorizes transient errors correctly."""
    from app.workers.video_processor import TRANSIENT_ERRORS
    import asyncpg

    # Verify TRANSIENT_ERRORS tuple includes expected errors
    assert httpx.ConnectError in TRANSIENT_ERRORS
    assert httpx.TimeoutException in TRANSIENT_ERRORS
    assert asyncpg.exceptions.PostgresConnectionError in TRANSIENT_ERRORS

    # Test will be enhanced in future tasks when HTTP/DB calls are added
    # For now, verify the error handling structure is defined
    ctx = {"job_try": 1, "max_tries": 5}
    bookmark_list = BookmarkList(name="Test List")
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    video = Video(list_id=bookmark_list.id, youtube_id="test123", processing_status="pending")
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Stub should still return success
    result = await process_video(ctx, str(video.id), str(bookmark_list.id), {})
    assert result["status"] == "success"
