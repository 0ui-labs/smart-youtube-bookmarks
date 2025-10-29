import pytest
from datetime import datetime
from uuid import uuid4
from app.models.job_progress import JobProgressEvent
from app.models.job import ProcessingJob

@pytest.mark.asyncio
async def test_create_job_progress_event(test_db, test_list):
    """Test creating a job progress event with JSONB data"""
    # Create a processing job first
    job = ProcessingJob(
        list_id=test_list.id,
        total_videos=10,
        processed_count=0,
        failed_count=0,
        status="running"
    )
    test_db.add(job)
    await test_db.commit()
    await test_db.refresh(job)

    progress_data = {
        "job_id": str(job.id),
        "status": "processing",
        "progress": 50,
        "current_video": 5,
        "total_videos": 10,
        "message": "Processing video 5/10"
    }

    event = JobProgressEvent(
        job_id=job.id,
        progress_data=progress_data
    )

    test_db.add(event)
    await test_db.commit()
    await test_db.refresh(event)

    assert event.id is not None
    assert event.job_id == job.id
    assert event.progress_data["progress"] == 50
    assert event.created_at is not None

@pytest.mark.asyncio
async def test_query_events_chronologically(test_db, test_list):
    """Test querying events in chronological order"""
    # Create a processing job first
    job = ProcessingJob(
        list_id=test_list.id,
        total_videos=10,
        processed_count=0,
        failed_count=0,
        status="running"
    )
    test_db.add(job)
    await test_db.commit()
    await test_db.refresh(job)

    # Create multiple events
    for i in range(3):
        event = JobProgressEvent(
            job_id=job.id,
            progress_data={"progress": i * 30, "current_video": i + 1}
        )
        test_db.add(event)

    await test_db.commit()

    # Query events ordered by created_at
    from sqlalchemy import select
    stmt = select(JobProgressEvent).where(
        JobProgressEvent.job_id == job.id
    ).order_by(JobProgressEvent.created_at)

    result = await test_db.execute(stmt)
    events = result.scalars().all()

    assert len(events) == 3
    assert events[0].progress_data["progress"] == 0
    assert events[1].progress_data["progress"] == 30
    assert events[2].progress_data["progress"] == 60

@pytest.mark.asyncio
async def test_cascade_delete_job_progress_events(test_db, test_list):
    """Test that deleting a ProcessingJob cascades to delete all progress events"""
    # Create a processing job
    job = ProcessingJob(
        list_id=test_list.id,
        total_videos=5,
        processed_count=0,
        failed_count=0,
        status="running"
    )
    test_db.add(job)
    await test_db.commit()
    await test_db.refresh(job)

    # Create multiple progress events for this job
    for i in range(3):
        event = JobProgressEvent(
            job_id=job.id,
            progress_data={
                "progress": i * 33,
                "current_video": i + 1,
                "message": f"Processing video {i + 1}"
            }
        )
        test_db.add(event)

    await test_db.commit()

    # Verify events exist
    from sqlalchemy import select
    stmt = select(JobProgressEvent).where(JobProgressEvent.job_id == job.id)
    result = await test_db.execute(stmt)
    events_before = result.scalars().all()
    assert len(events_before) == 3

    # Delete the job
    await test_db.delete(job)
    await test_db.commit()

    # Verify all progress events are cascade deleted
    stmt = select(JobProgressEvent).where(JobProgressEvent.job_id == job.id)
    result = await test_db.execute(stmt)
    events_after = result.scalars().all()
    assert len(events_after) == 0
