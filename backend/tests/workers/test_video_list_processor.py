"""Tests for process_video_list ARQ worker (bulk processing)."""
import pytest
from uuid import uuid4
from app.models import Video, BookmarkList, ProcessingJob
from app.workers.video_processor import process_video_list


@pytest.mark.asyncio
async def test_process_video_list_processes_multiple_videos(arq_context, test_db, test_user):
    """Test process_video_list processes all videos in batch."""
    # Arrange: Create test list
    bookmark_list = BookmarkList(
        name="Test List",
        description="Test description",
        user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create processing job
    processing_job = ProcessingJob(
        list_id=bookmark_list.id,
        total_videos=3,
        status="running"
    )
    test_db.add(processing_job)
    await test_db.commit()
    await test_db.refresh(processing_job)

    # Arrange: Create 3 videos with pending status
    video1 = Video(
        list_id=bookmark_list.id,
        youtube_id="dQw4w9WgXcQ",  # Rick Astley - Never Gonna Give You Up
        processing_status="pending"
    )
    video2 = Video(
        list_id=bookmark_list.id,
        youtube_id="9bZkp7q19f0",  # PSY - Gangnam Style
        processing_status="pending"
    )
    video3 = Video(
        list_id=bookmark_list.id,
        youtube_id="kJQP7kiw5Fk",  # Luis Fonsi - Despacito
        processing_status="pending"
    )
    test_db.add_all([video1, video2, video3])
    await test_db.commit()
    await test_db.refresh(video1)
    await test_db.refresh(video2)
    await test_db.refresh(video3)

    video_ids = [str(video1.id), str(video2.id), str(video3.id)]

    # Act: Process video list
    result = await process_video_list(
        arq_context,
        str(processing_job.id),
        str(bookmark_list.id),
        video_ids,
        {}  # schema_fields
    )

    # Assert: All videos processed
    await test_db.refresh(video1)
    await test_db.refresh(video2)
    await test_db.refresh(video3)
    await test_db.refresh(processing_job)

    assert video1.processing_status == "completed", "Video 1 should be completed"
    assert video1.title is not None, "Video 1 should have title"
    assert video2.processing_status == "completed", "Video 2 should be completed"
    assert video2.title is not None, "Video 2 should have title"
    assert video3.processing_status == "completed", "Video 3 should be completed"
    assert video3.title is not None, "Video 3 should have title"

    # Assert: Job progress updated
    assert processing_job.processed_count == 3
    assert processing_job.failed_count == 0
    assert processing_job.status == "completed"
    assert result['status'] == 'success'
