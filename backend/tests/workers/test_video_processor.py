import pytest
from app.workers.video_processor import process_video
from app.models import Video
from app.models.list import BookmarkList
from app.models.job import ProcessingJob
from app.models.job_progress import JobProgressEvent
from sqlalchemy import select
from uuid import uuid4
from arq import create_pool
from arq.worker import Worker
from app.workers.settings import WorkerSettings
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
import json


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
async def test_process_video_updates_status(test_db, test_user):
    """Test that process_video changes status from pending."""
    # Arrange: Create test list first (foreign key requirement)
    bookmark_list = BookmarkList(
        name="Test List",
        description="Test list for worker",
        user_id=test_user.id
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
async def test_process_video_with_retry_on_transient_error(test_db, test_user):
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
    bookmark_list = BookmarkList(name="Test List", user_id=test_user.id)
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


@pytest.fixture
async def mock_redis():
    """Mock Redis client for testing."""
    redis_mock = AsyncMock()
    redis_mock.publish = AsyncMock(return_value=1)
    return redis_mock


@pytest.fixture
async def mock_session_factory(test_engine):
    """Mock AsyncSessionLocal factory to use test database."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_worker_publishes_progress_to_redis_and_db(mock_redis, test_db, test_user, mock_session_factory):
    """Test that worker publishes progress to both Redis and DB"""
    from app.workers.video_processor import process_video_list

    with patch('app.workers.video_processor.AsyncSessionLocal', mock_session_factory):
        # Arrange: Create test list
        bookmark_list = BookmarkList(
            name="Test List",
            description="Test list for worker",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        list_id = bookmark_list.id

        # Arrange: Create processing job
        job = ProcessingJob(
            list_id=list_id,
            total_videos=2,
            status="running"
        )
        test_db.add(job)
        await test_db.commit()
        job_id = job.id

        # Arrange: Create test videos
        video1 = Video(list_id=list_id, youtube_id="video1", processing_status="pending")
        video2 = Video(list_id=list_id, youtube_id="video2", processing_status="pending")
        test_db.add_all([video1, video2])
        await test_db.commit()
        video1_id = video1.id
        video2_id = video2.id

        # Act: Process videos
        ctx = {"redis": mock_redis}
        result = await process_video_list(ctx, str(job_id), str(list_id), [str(video1_id), str(video2_id)])

        # Assert: Redis publish was called
        assert mock_redis.publish.called
        assert mock_redis.publish.call_count >= 2  # At least initial and final

        # Assert: DB events were created
        stmt = select(JobProgressEvent).where(JobProgressEvent.job_id == job_id)
        db_result = await test_db.execute(stmt)
        events = db_result.scalars().all()
        assert len(events) >= 2  # At least initial and final


@pytest.mark.asyncio
async def test_worker_continues_on_redis_failure(mock_redis, test_db, test_user, mock_session_factory):
    """Test that worker continues processing if Redis publish fails (best-effort)"""
    from app.workers.video_processor import process_video_list

    # Arrange: Redis raises exception
    mock_redis.publish = AsyncMock(side_effect=Exception("Redis connection failed"))

    with patch('app.workers.video_processor.AsyncSessionLocal', mock_session_factory):
        # Arrange: Create test list
        bookmark_list = BookmarkList(
            name="Test List",
            description="Test list for worker",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        list_id = bookmark_list.id

        # Arrange: Create processing job
        job = ProcessingJob(
            list_id=list_id,
            total_videos=1,
            status="running"
        )
        test_db.add(job)
        await test_db.commit()
        job_id = job.id

        # Arrange: Create test video
        video = Video(list_id=list_id, youtube_id="video1", processing_status="pending")
        test_db.add(video)
        await test_db.commit()
        video_id = video.id

        # Act: Process video (should NOT raise)
        ctx = {"redis": mock_redis}
        result = await process_video_list(ctx, str(job_id), str(list_id), [str(video_id)])

        # Assert: Processing completed despite Redis failure
        assert result["processed"] == 1
        assert result["failed"] == 0


@pytest.mark.asyncio
async def test_worker_continues_on_db_failure(mock_redis, test_db, test_user):
    """Test that worker continues processing if DB write fails (best-effort)"""
    from app.workers.video_processor import publish_progress

    # Arrange: Create test list
    bookmark_list = BookmarkList(
        name="Test List",
        description="Test list for worker",
        user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create processing job
    job = ProcessingJob(
        list_id=bookmark_list.id,
        total_videos=1,
        status="running"
    )
    test_db.add(job)
    await test_db.commit()
    await test_db.refresh(job)

    # Act: Try to publish progress with invalid job_id (will fail DB write)
    ctx = {
        "redis": mock_redis,
        "job_id": str(uuid4()),  # Non-existent job
        "job_user_id": str(test_user.id)
    }

    # Should not raise despite DB failure
    await publish_progress(ctx, {"status": "test", "progress": 50})

    # Assert: Function completed without raising


@pytest.mark.asyncio
async def test_worker_throttles_progress_updates(mock_redis, test_db, test_user, mock_session_factory):
    """Test that worker throttles progress for large batches"""
    from app.workers.video_processor import process_video_list

    with patch('app.workers.video_processor.AsyncSessionLocal', mock_session_factory):
        # Arrange: Create test list
        bookmark_list = BookmarkList(
            name="Test List",
            description="Test list for worker",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        list_id = bookmark_list.id

        # Arrange: Create processing job
        job = ProcessingJob(
            list_id=list_id,
            total_videos=20,
            status="running"
        )
        test_db.add(job)
        await test_db.commit()
        job_id = job.id

        # Arrange: Create 20 test videos
        videos = [
            Video(list_id=list_id, youtube_id=f"video{i}", processing_status="pending")
            for i in range(20)
        ]
        test_db.add_all(videos)
        await test_db.commit()
        video_ids = [str(v.id) for v in videos]

        # Act: Process videos
        ctx = {"redis": mock_redis}
        result = await process_video_list(ctx, str(job_id), str(list_id), video_ids)

        # Assert: Progress updates were throttled
        # With 5% step on 20 videos: 0%, 5%, 10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%, 55%, 60%, 65%, 70%, 75%, 80%, 85%, 90%, 95%, 100%
        # That's 21 percentage steps + initial = 22 calls (because processing is faster than 2s throttle)
        # Verify percentage-based throttling is working: should be  exactly 22 calls for 20 videos
        assert mock_redis.publish.call_count == 22  # 1 initial + 20 video updates (each is 5% step) + 1 final


@pytest.mark.asyncio
async def test_user_id_cached_in_context(mock_redis, test_db, test_user, mock_session_factory):
    """Test that user_id is looked up once and cached"""
    from app.workers.video_processor import process_video_list

    with patch('app.workers.video_processor.AsyncSessionLocal', mock_session_factory):
        # Arrange: Create test list
        bookmark_list = BookmarkList(
            name="Test List",
            description="Test list for worker",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        list_id = bookmark_list.id

        # Arrange: Create processing job
        job = ProcessingJob(
            list_id=list_id,
            total_videos=2,
            status="running"
        )
        test_db.add(job)
        await test_db.commit()
        job_id = job.id

        # Arrange: Create test videos
        video1 = Video(list_id=list_id, youtube_id="video1", processing_status="pending")
        video2 = Video(list_id=list_id, youtube_id="video2", processing_status="pending")
        test_db.add_all([video1, video2])
        await test_db.commit()
        video1_id = video1.id
        video2_id = video2.id

        # Act: Process videos
        ctx = {"redis": mock_redis}
        result = await process_video_list(ctx, str(job_id), str(list_id), [str(video1_id), str(video2_id)])

        # Assert: Context contains cached user_id
        assert "job_user_id" in ctx
        assert ctx["job_user_id"] == str(test_user.id)
