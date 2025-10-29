"""
Integration tests for WebSocket progress flow.

Tests end-to-end flow: Worker processing → Database events → History API
Focus on backend integration, not WebSocket message delivery.
"""

import pytest
import json
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, patch

from app.models.list import BookmarkList
from app.models.video import Video
from app.models.job import ProcessingJob
from app.models.job_progress import JobProgressEvent
from app.models.user import User


async def wait_for_condition(condition_func, timeout_seconds=5, poll_interval=0.1):
    """
    Utility to wait for a condition to become true.

    Prevents flaky tests by polling instead of fixed sleep.

    Args:
        condition_func: Async function that returns True when condition is met
        timeout_seconds: Maximum time to wait
        poll_interval: Time between polls

    Raises:
        TimeoutError: If condition not met within timeout
    """
    import asyncio
    elapsed = 0
    while elapsed < timeout_seconds:
        if await condition_func():
            return
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval
    raise TimeoutError(f"Condition not met after {timeout_seconds}s")


@pytest.mark.asyncio
async def test_end_to_end_progress_flow(test_db: AsyncSession, test_user: User, mock_redis, mock_session_factory):
    """
    E2E test: Worker processes → Progress events in DB → History API returns events

    Verifies complete backend flow without WebSocket client testing.
    """
    from app.workers.video_processor import process_video_list

    with patch('app.workers.video_processor.AsyncSessionLocal', mock_session_factory):
        # 1. Create test list
        bookmark_list = BookmarkList(
            name="E2E Test List",
            description="Integration test",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        list_id = bookmark_list.id

        # 2. Create processing job
        job = ProcessingJob(
            list_id=list_id,
            total_videos=3,
            status="running"
        )
        test_db.add(job)
        await test_db.commit()
        job_id = job.id

        # 3. Create test videos
        videos = [
            Video(list_id=list_id, youtube_id=f"video{i}", processing_status="pending")
            for i in range(3)
        ]
        test_db.add_all(videos)
        await test_db.commit()
        video_ids = [str(v.id) for v in videos]

        # 4. Process videos (simulates worker execution)
        ctx = {"redis": mock_redis}
        result = await process_video_list(ctx, str(job_id), str(list_id), video_ids)

        assert result["processed"] == 3, "All 3 videos should be processed"

        # 5. Wait for events to be committed (condition-based, not fixed sleep)
        async def events_exist():
            await test_db.commit()  # Ensure we see latest state
            stmt = select(JobProgressEvent).where(JobProgressEvent.job_id == job_id)
            result = await test_db.execute(stmt)
            events = result.scalars().all()
            return len(events) >= 3

        await wait_for_condition(events_exist, timeout_seconds=2)

        # 6. Verify progress events were created in DB
        stmt = select(JobProgressEvent).where(
            JobProgressEvent.job_id == job_id
        ).order_by(JobProgressEvent.created_at)

        result = await test_db.execute(stmt)
        events = result.scalars().all()

        # Should have at least: initial (0%) + per-video updates + final (100%)
        assert len(events) >= 3, f"Expected at least 3 events, got {len(events)}"

        # Verify progression
        first_event = events[0]
        last_event = events[-1]

        assert first_event.progress_data["progress"] == 0, "First event should be 0%"
        assert last_event.progress_data["status"] == "completed", "Last event should be completed"
        assert last_event.progress_data["progress"] == 100, "Last event should be 100%"

        # Verify events are chronologically ordered
        for i in range(len(events) - 1):
            assert events[i].created_at <= events[i + 1].created_at, "Events should be chronologically ordered"


@pytest.mark.asyncio
async def test_dual_write_verification(test_db: AsyncSession, test_user: User, mock_redis, mock_session_factory):
    """
    Test that worker writes progress to BOTH Redis pubsub AND database.

    Verifies dual-write strategy for resilience.
    """
    from app.workers.video_processor import process_video_list

    with patch('app.workers.video_processor.AsyncSessionLocal', mock_session_factory):
        # Arrange: Create test list
        bookmark_list = BookmarkList(
            name="Dual-Write Test List",
            description="Testing dual-write",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        list_id = bookmark_list.id

        # Arrange: Create processing job
        job = ProcessingJob(
            list_id=list_id,
            total_videos=3,
            status="running"
        )
        test_db.add(job)
        await test_db.commit()
        job_id = job.id

        # Arrange: Create test videos
        videos = [
            Video(list_id=list_id, youtube_id=f"video{i}", processing_status="pending")
            for i in range(3)
        ]
        test_db.add_all(videos)
        await test_db.commit()
        video_ids = [str(v.id) for v in videos]

        # Act: Process videos with mocked Redis
        ctx = {"redis": mock_redis}
        result = await process_video_list(ctx, str(job_id), str(list_id), video_ids)

        # Assert: Processing completed
        assert result["processed"] == 3, "All 3 videos should be processed"

        # Assert: Redis pubsub was called (verifies Redis write path)
        assert mock_redis.publish.called, "Redis publish should be called"
        redis_call_count = mock_redis.publish.call_count
        assert redis_call_count >= 2, f"Expected at least 2 Redis calls, got {redis_call_count}"

        # Assert: Database events were created (verifies DB write path)
        stmt = select(JobProgressEvent).where(JobProgressEvent.job_id == job_id)
        db_result = await test_db.execute(stmt)
        db_events = db_result.scalars().all()

        assert len(db_events) >= 2, f"Expected at least 2 DB events, got {len(db_events)}"

        # Assert: Both stores have consistent progress values
        # Extract progress values from Redis calls
        redis_progress_values = set()
        for call_args in mock_redis.publish.call_args_list:
            if len(call_args[0]) >= 2:
                _, message = call_args[0]  # Use underscore for unused variable
                try:
                    message_data = json.loads(message)
                    if "progress" in message_data:
                        redis_progress_values.add(message_data["progress"])
                except (json.JSONDecodeError, KeyError):
                    continue

        # Extract progress values from DB events
        db_progress_values = {event.progress_data.get("progress") for event in db_events}

        # Find intersection - should have at least one matching progress value
        matching_values = redis_progress_values & db_progress_values
        assert len(matching_values) > 0, \
            f"Redis and DB should have matching progress values. Redis: {redis_progress_values}, DB: {db_progress_values}"

        # Verify both channels captured start (0%) and end (100%)
        assert 0 in db_progress_values, "DB should have 0% progress event"
        assert 100 in db_progress_values, "DB should have 100% progress event"


@pytest.mark.asyncio
async def test_user_isolation_in_progress_updates(test_db: AsyncSession, user_factory, mock_redis, mock_session_factory):
    """
    Test that users only receive their own progress updates.

    User A should not see User B's job progress in DB.
    Redis channels are user-specific: progress:user:{user_id}
    """
    from app.workers.video_processor import process_video_list

    with patch('app.workers.video_processor.AsyncSessionLocal', mock_session_factory):
        # Create User A and User B using factory
        user_a = await user_factory("alice")
        user_b = await user_factory("bob")

        # Create list for User A
        list_a = BookmarkList(name="User A List", user_id=user_a.id)
        test_db.add(list_a)
        await test_db.commit()

        # Create list for User B
        list_b = BookmarkList(name="User B List", user_id=user_b.id)
        test_db.add(list_b)
        await test_db.commit()

        # Create job for User A
        job_a = ProcessingJob(list_id=list_a.id, total_videos=2, status="running")
        test_db.add(job_a)
        await test_db.commit()
        job_a_id = job_a.id

        # Create job for User B
        job_b = ProcessingJob(list_id=list_b.id, total_videos=2, status="running")
        test_db.add(job_b)
        await test_db.commit()
        job_b_id = job_b.id

        # Create videos for User A
        videos_a = [
            Video(list_id=list_a.id, youtube_id=f"usera_video{i}", processing_status="pending")
            for i in range(2)
        ]
        test_db.add_all(videos_a)
        await test_db.commit()
        video_ids_a = [str(v.id) for v in videos_a]

        # Process User A's videos
        ctx_a = {"redis": mock_redis}
        await process_video_list(ctx_a, str(job_a_id), str(list_a.id), video_ids_a)

        # Verify Redis channel includes user_id for isolation
        assert mock_redis.publish.called, "Redis publish should be called"

        # Check at least one call has user-specific channel
        user_specific_channels = []
        for call_args in mock_redis.publish.call_args_list:
            if len(call_args[0]) >= 1:
                channel = call_args[0][0]
                if f":{user_a.id}" in channel or f"user_{user_a.id}" in channel:
                    user_specific_channels.append(channel)

        assert len(user_specific_channels) > 0, \
            f"Redis channel should include user_id for isolation. Found channels: {[c[0][0] for c in mock_redis.publish.call_args_list if len(c[0]) >= 1]}"

        # Verify DB events are tied to specific job_id (which ties to user via list)
        stmt_a = select(JobProgressEvent).where(JobProgressEvent.job_id == job_a_id)
        result_a = await test_db.execute(stmt_a)
        events_a = result_a.scalars().all()

        assert len(events_a) > 0, "User A should have events for their job"

        # Verify User B has NO events for User A's job
        stmt_b = select(JobProgressEvent).where(JobProgressEvent.job_id == job_b_id)
        result_b = await test_db.execute(stmt_b)
        events_b = result_b.scalars().all()

        assert len(events_b) == 0, "User B should have no events yet (their job hasn't run)"

        # Verify job_id isolation: User A's events only reference job_a_id
        for event in events_a:
            assert event.job_id == job_a_id, f"User A's event should only have job_a_id, got {event.job_id}"
            assert event.job_id != job_b_id, "User A's events should never reference User B's job"


@pytest.mark.asyncio
async def test_history_api_pagination(test_db: AsyncSession, test_user: User, client):
    """
    Test history API pagination with 'since' parameter.

    Verifies that history API can filter events by timestamp.
    """
    # Arrange: Create test list
    bookmark_list = BookmarkList(
        name="Pagination Test List",
        user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    list_id = bookmark_list.id

    # Arrange: Create processing job
    job = ProcessingJob(
        list_id=list_id,
        total_videos=10,
        status="running"
    )
    test_db.add(job)
    await test_db.commit()
    job_id = job.id

    # Arrange: Create multiple progress events
    from datetime import datetime, timedelta, timezone
    base_time = datetime.now(timezone.utc)

    events = []
    for i in range(10):
        event = JobProgressEvent(
            job_id=job_id,
            progress_data={"progress": i * 10, "status": "processing"},
            created_at=base_time + timedelta(seconds=i)
        )
        events.append(event)

    test_db.add_all(events)
    await test_db.commit()

    # Act: Get full history (include user_id query param)
    response_all = await client.get(
        f"/api/jobs/{job_id}/progress-history",
        params={"user_id": str(test_user.id)}
    )
    assert response_all.status_code == 200
    history_all = response_all.json()
    assert len(history_all) == 10, "Should return all 10 events"

    # Act: Get history since midpoint
    midpoint_time = (base_time + timedelta(seconds=5)).isoformat()
    response_since = await client.get(
        f"/api/jobs/{job_id}/progress-history",
        params={"user_id": str(test_user.id), "since": midpoint_time}
    )

    assert response_since.status_code == 200
    history_since = response_since.json()

    # Should return events created after midpoint (events 6-9 = 4 events)
    assert len(history_since) <= 5, f"Should return at most 5 events after midpoint, got {len(history_since)}"
    assert len(history_since) > 0, "Should return some events"

    # Verify all returned events are after the since timestamp
    for event in history_since:
        event_time = datetime.fromisoformat(event["created_at"].replace("Z", "+00:00"))
        since_time = datetime.fromisoformat(midpoint_time.replace("Z", "+00:00"))
        assert event_time >= since_time, "All events should be after 'since' timestamp"


@pytest.mark.asyncio
async def test_unauthorized_access_to_progress_history(test_db: AsyncSession, user_factory, client):
    """
    Test that users cannot access other users' progress history.

    Verifies 403 Forbidden response when user_id doesn't match job owner.
    """
    # Create User A and User B using factory
    user_a = await user_factory("alice")
    user_b = await user_factory("bob")

    # User A creates a list and job
    list_a = BookmarkList(name="User A List", user_id=user_a.id)
    test_db.add(list_a)
    await test_db.commit()

    job_a = ProcessingJob(list_id=list_a.id, total_videos=1, status="running")
    test_db.add(job_a)
    await test_db.commit()
    job_a_id = job_a.id

    # Create progress event for User A's job
    event = JobProgressEvent(
        job_id=job_a_id,
        progress_data={"progress": 50, "status": "processing"}
    )
    test_db.add(event)
    await test_db.commit()

    # User A can access their own job history (baseline check)
    response_authorized = await client.get(
        f"/api/jobs/{job_a_id}/progress-history",
        params={"user_id": str(user_a.id)}
    )
    assert response_authorized.status_code == 200, "User A should access their own job"

    # User B tries to access User A's job history (should be forbidden)
    response_unauthorized = await client.get(
        f"/api/jobs/{job_a_id}/progress-history",
        params={"user_id": str(user_b.id)}
    )

    # Assert: Should return 403 Forbidden
    assert response_unauthorized.status_code == 403, \
        f"Expected 403 Forbidden, got {response_unauthorized.status_code}"

    # Assert: Error message should indicate authorization failure
    error_detail = response_unauthorized.json()
    assert "detail" in error_detail, "Response should contain error detail"
    assert "not authorized" in error_detail["detail"].lower() or \
           "forbidden" in error_detail["detail"].lower() or \
           "access denied" in error_detail["detail"].lower(), \
        f"Error message should indicate authorization failure: {error_detail['detail']}"


@pytest.mark.asyncio
async def test_throttling_verification(test_db: AsyncSession, test_user: User, mock_redis, mock_session_factory):
    """
    Test that worker throttles progress updates for large batches.

    100 videos should NOT create 100 progress events (throttling should reduce frequency).
    """
    from app.workers.video_processor import process_video_list

    with patch('app.workers.video_processor.AsyncSessionLocal', mock_session_factory):
        # Arrange: Create test list
        bookmark_list = BookmarkList(
            name="Throttling Test List",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        list_id = bookmark_list.id

        # Arrange: Create processing job with 100 videos
        job = ProcessingJob(
            list_id=list_id,
            total_videos=100,
            status="running"
        )
        test_db.add(job)
        await test_db.commit()
        job_id = job.id

        # Arrange: Create 100 test videos
        videos = [
            Video(list_id=list_id, youtube_id=f"video{i}", processing_status="pending")
            for i in range(100)
        ]
        test_db.add_all(videos)
        await test_db.commit()
        video_ids = [str(v.id) for v in videos]

        # Act: Process videos
        ctx = {"redis": mock_redis}
        result = await process_video_list(ctx, str(job_id), str(list_id), video_ids)

        # Assert: Processing completed
        assert result["processed"] == 100, "All 100 videos should be processed"

        # Assert: Progress updates were throttled
        redis_call_count = mock_redis.publish.call_count

        # With 5% step on 100 videos: 0%, 5%, 10%, ..., 95%, 100% = 21 updates
        # Allow some tolerance for implementation details
        expected_max_calls = 30  # Should be significantly less than 100

        assert redis_call_count < expected_max_calls, \
            f"Expected < {expected_max_calls} Redis calls for 100 videos (throttling), got {redis_call_count}"

        # Assert: DB events were also throttled
        stmt = select(JobProgressEvent).where(JobProgressEvent.job_id == job_id)
        db_result = await test_db.execute(stmt)
        db_events = db_result.scalars().all()

        assert len(db_events) < expected_max_calls, \
            f"Expected < {expected_max_calls} DB events for 100 videos (throttling), got {len(db_events)}"

        # Verify throttling ratio
        throttle_ratio = redis_call_count / 100
        assert throttle_ratio < 0.3, \
            f"Throttle ratio should be < 30% (got {throttle_ratio:.1%}), indicating effective throttling"
