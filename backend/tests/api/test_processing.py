import pytest
from uuid import uuid4
from datetime import datetime, timedelta, timezone


async def ensure_video_pending_status(test_db, list_id):
    """
    Helper function to ensure all videos in a list have 'pending' status.
    This is needed because videos may be created with 'completed' status
    if YouTube API succeeds, but processing tests require 'pending' videos.
    """
    from sqlalchemy import select, update
    from app.models import Video

    # Update all videos in the list to pending status
    await test_db.execute(
        update(Video)
        .where(Video.list_id == list_id)
        .values(processing_status='pending')
    )
    await test_db.commit()


@pytest.mark.asyncio
async def test_start_processing_job(client, test_db):
    # Create list with video
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    # Ensure video has pending status for processing
    await ensure_video_pending_status(test_db, list_id)

    # Start processing
    response = await client.post(f"/api/lists/{list_id}/process")
    assert response.status_code == 201
    data = response.json()
    assert "job_id" in data
    assert data["total_videos"] == 1


@pytest.mark.asyncio
async def test_start_processing_no_pending_videos(client):
    # Create list without videos
    list_response = await client.post(
        "/api/lists",
        json={"name": "Empty List"}
    )
    list_id = list_response.json()["id"]

    # Try to start processing
    response = await client.post(f"/api/lists/{list_id}/process")
    assert response.status_code == 400
    assert response.json()["detail"] == "No pending videos to process"


@pytest.mark.asyncio
async def test_get_job_status(client, test_db):
    # Create list with video and start processing
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    # Ensure video has pending status for processing
    await ensure_video_pending_status(test_db, list_id)

    job_response = await client.post(f"/api/lists/{list_id}/process")
    job_id = job_response.json()["job_id"]

    # Get job status
    response = await client.get(f"/api/jobs/{job_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job_id
    assert data["status"] == "running"


@pytest.mark.asyncio
async def test_get_job_status_not_found(client):
    # Try to get status for non-existent job
    fake_job_id = str(uuid4())
    response = await client.get(f"/api/jobs/{fake_job_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


@pytest.mark.asyncio
async def test_pause_job(client, test_db):
    # Create list with video and start processing
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    # Ensure video has pending status for processing
    await ensure_video_pending_status(test_db, list_id)

    job_response = await client.post(f"/api/lists/{list_id}/process")
    job_id = job_response.json()["job_id"]

    # Pause the job
    response = await client.post(f"/api/jobs/{job_id}/pause")
    assert response.status_code == 204

    # Verify job is paused
    status_response = await client.get(f"/api/jobs/{job_id}")
    assert status_response.json()["status"] == "paused"


@pytest.mark.asyncio
async def test_pause_job_not_found(client):
    # Try to pause non-existent job
    fake_job_id = str(uuid4())
    response = await client.post(f"/api/jobs/{fake_job_id}/pause")
    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


@pytest.mark.asyncio
async def test_pause_already_paused_job(client, test_db):
    # Create list with video and start processing
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    # Ensure video has pending status for processing
    await ensure_video_pending_status(test_db, list_id)

    job_response = await client.post(f"/api/lists/{list_id}/process")
    job_id = job_response.json()["job_id"]

    # Pause the job first time
    await client.post(f"/api/jobs/{job_id}/pause")

    # Try to pause again
    response = await client.post(f"/api/jobs/{job_id}/pause")
    assert response.status_code == 400
    assert "Cannot pause job with status 'paused'" in response.json()["detail"]


@pytest.mark.asyncio
async def test_pause_completed_job(client, test_db):
    from app.models import ProcessingJob

    # Create list with video and start processing
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    # Ensure video has pending status for processing
    await ensure_video_pending_status(test_db, list_id)

    job_response = await client.post(f"/api/lists/{list_id}/process")
    job_id = job_response.json()["job_id"]

    # Manually mark job as completed
    from sqlalchemy import select
    result = await test_db.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_id)
    )
    job = result.scalar_one()
    job.status = "completed"
    await test_db.commit()

    # Try to pause completed job
    response = await client.post(f"/api/jobs/{job_id}/pause")
    assert response.status_code == 400
    assert "Cannot pause job with status 'completed'" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_progress_history(client, test_db, test_user, test_list):
    """Test retrieving progress history for a job"""
    from app.models import ProcessingJob
    from app.models.job_progress import JobProgressEvent
    from sqlalchemy import select

    # Create a processing job
    job = ProcessingJob(
        list_id=test_list.id,
        total_videos=10,
        status="running"
    )
    test_db.add(job)
    await test_db.flush()
    await test_db.refresh(job)

    # Create progress events
    for i in range(3):
        event = JobProgressEvent(
            job_id=job.id,
            progress_data={
                "job_id": str(job.id),
                "status": "processing",
                "progress": i * 30,
                "current_video": i + 1,
                "total_videos": 10,
                "message": f"Processing video {i+1}/10"
            }
        )
        test_db.add(event)
    await test_db.commit()

    # Request history (simulate authentication by adding user_id to request)
    response = await client.get(
        f"/api/jobs/{job.id}/progress-history",
        params={"user_id": str(test_user.id)}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    # Verify chronological order
    assert data[0]["progress_data"]["progress"] == 0
    assert data[1]["progress_data"]["progress"] == 30
    assert data[2]["progress_data"]["progress"] == 60
    # Verify response schema matches JobProgressEventRead
    assert "id" in data[0]
    assert "job_id" in data[0]
    assert "created_at" in data[0]
    assert "progress_data" in data[0]


@pytest.mark.asyncio
async def test_get_progress_history_with_since_filter(client, test_db, test_user, test_list):
    """Test filtering progress history by timestamp"""
    from app.models import ProcessingJob
    from app.models.job_progress import JobProgressEvent

    # Create a processing job
    job = ProcessingJob(
        list_id=test_list.id,
        total_videos=10,
        status="running"
    )
    test_db.add(job)
    await test_db.flush()
    await test_db.refresh(job)

    # Create events at different times
    now = datetime.now(timezone.utc)
    for i in range(5):
        event = JobProgressEvent(
            job_id=job.id,
            progress_data={
                "job_id": str(job.id),
                "status": "processing",
                "progress": i * 20,
                "current_video": i + 1,
                "total_videos": 10,
                "message": f"Processing video {i+1}/10"
            }
        )
        test_db.add(event)
        await test_db.flush()
        # Manually set created_at to simulate time progression
        event.created_at = now - timedelta(minutes=5-i)
    await test_db.commit()

    # Query with since parameter (get events from 3 minutes ago onwards - inclusive)
    # This should return events with i=2 (now - 3min), i=3 (now - 2min), i=4 (now - 1min)
    since_time = now - timedelta(minutes=3)
    response = await client.get(
        f"/api/jobs/{job.id}/progress-history",
        params={
            "user_id": str(test_user.id),
            "since": since_time.isoformat()
        }
    )

    assert response.status_code == 200
    data = response.json()
    # Should return events created at or after 3 minutes ago (i=2, i=3, i=4)
    # Using >= (inclusive) ensures clients don't miss events on reconnect
    assert len(data) == 3
    assert data[0]["progress_data"]["progress"] == 40  # i=2
    assert data[1]["progress_data"]["progress"] == 60  # i=3
    assert data[2]["progress_data"]["progress"] == 80  # i=4


@pytest.mark.asyncio
async def test_get_progress_history_pagination(client, test_db, test_user, test_list):
    """Test pagination with offset/limit"""
    from app.models import ProcessingJob
    from app.models.job_progress import JobProgressEvent

    # Create a processing job
    job = ProcessingJob(
        list_id=test_list.id,
        total_videos=10,
        status="running"
    )
    test_db.add(job)
    await test_db.flush()
    await test_db.refresh(job)

    # Create 10 progress events
    for i in range(10):
        event = JobProgressEvent(
            job_id=job.id,
            progress_data={
                "job_id": str(job.id),
                "status": "processing",
                "progress": i * 10,
                "current_video": i + 1,
                "total_videos": 10,
                "message": f"Processing video {i+1}/10"
            }
        )
        test_db.add(event)
    await test_db.commit()

    # Query with offset=5, limit=3
    response = await client.get(
        f"/api/jobs/{job.id}/progress-history",
        params={
            "user_id": str(test_user.id),
            "offset": 5,
            "limit": 3
        }
    )

    assert response.status_code == 200
    data = response.json()
    # Should return events 5-7 (indices 5, 6, 7)
    assert len(data) == 3
    assert data[0]["progress_data"]["progress"] == 50
    assert data[1]["progress_data"]["progress"] == 60
    assert data[2]["progress_data"]["progress"] == 70


@pytest.mark.asyncio
async def test_get_progress_history_unauthorized(client, test_db, test_user, test_list):
    """Test authorization: user cannot access other user's jobs"""
    from app.models import ProcessingJob, User
    from app.models.job_progress import JobProgressEvent

    # Create another user with their own list
    other_user = User(
        email=f"other-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(other_user)
    await test_db.flush()
    await test_db.refresh(other_user)

    from app.models import BookmarkList
    other_list = BookmarkList(
        name="Other User's List",
        user_id=other_user.id
    )
    test_db.add(other_list)
    await test_db.flush()
    await test_db.refresh(other_list)

    # Create job for other user
    other_job = ProcessingJob(
        list_id=other_list.id,
        total_videos=5,
        status="running"
    )
    test_db.add(other_job)
    await test_db.flush()
    await test_db.refresh(other_job)

    # Create progress event
    event = JobProgressEvent(
        job_id=other_job.id,
        progress_data={
            "job_id": str(other_job.id),
            "status": "processing",
            "progress": 50,
            "current_video": 1,
            "total_videos": 5,
            "message": "Processing"
        }
    )
    test_db.add(event)
    await test_db.commit()

    # Try to access other user's job with test_user credentials
    response = await client.get(
        f"/api/jobs/{other_job.id}/progress-history",
        params={"user_id": str(test_user.id)}
    )

    # Should return 403 Forbidden
    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized to access this job"
