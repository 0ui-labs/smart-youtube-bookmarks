"""Tests for ARQ video processor worker."""

from unittest.mock import AsyncMock, patch

import pytest

from app.models import BookmarkList, ProcessingJob, Video
from app.workers.video_processor import process_video


@pytest.mark.asyncio
@patch("app.workers.video_processor.YouTubeClient")
async def test_process_video_updates_status_to_processing(
    mock_youtube_client, arq_context, test_db, test_user
):
    """Test video processing marks video as 'processing'."""
    # Arrange: Mock YouTube client
    mock_client_instance = AsyncMock()
    mock_client_instance.get_video_metadata.return_value = {
        "title": "Test Video",
        "channel": "Test Channel",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "duration": "PT5M30S",
        "published_at": "2024-01-01T00:00:00Z",
    }
    mock_youtube_client.return_value = mock_client_instance

    # Arrange: Create test list first (foreign key requirement)
    bookmark_list = BookmarkList(
        name="Test List", description="Test description", user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create processing job
    processing_job = ProcessingJob(
        list_id=bookmark_list.id, total_videos=1, status="running"
    )
    test_db.add(processing_job)
    await test_db.commit()
    await test_db.refresh(processing_job)

    # Arrange: Create test video
    video = Video(
        list_id=bookmark_list.id, youtube_id="dQw4w9WgXcQ", processing_status="pending"
    )
    test_db.add(video)
    await test_db.commit()

    # Act: Process video
    result = await process_video(
        arq_context, str(video.id), str(video.list_id), {}, str(processing_job.id)
    )

    # Assert: Status changed
    await test_db.refresh(video)
    assert video.processing_status in ["processing", "completed"]
    assert result["status"] in ["success", "processing"]


@pytest.mark.asyncio
async def test_process_video_idempotency(arq_context, test_db, test_user):
    """Test processing an already-completed video is idempotent."""
    # Arrange: Create test list first
    bookmark_list = BookmarkList(
        name="Test List", description="Test description", user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create processing job
    processing_job = ProcessingJob(
        list_id=bookmark_list.id, total_videos=1, status="running"
    )
    test_db.add(processing_job)
    await test_db.commit()
    await test_db.refresh(processing_job)

    # Arrange: Video already completed
    video = Video(
        list_id=bookmark_list.id,
        youtube_id="dQw4w9WgXcQ",
        processing_status="completed",
        title="Already Processed",
    )
    test_db.add(video)
    await test_db.commit()

    # Act: Process again
    result = await process_video(
        arq_context, str(video.id), str(video.list_id), {}, str(processing_job.id)
    )

    # Assert: Returns early, no changes
    assert result["status"] == "already_completed"
    await test_db.refresh(video)
    assert video.title == "Already Processed"  # Unchanged


@pytest.mark.asyncio
async def test_process_video_marks_failed_on_exception(arq_context, test_db, test_user):
    """Test video marked as failed when processing raises exception."""
    # Arrange
    bookmark_list = BookmarkList(
        name="Test List", description="Test description", user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create processing job
    processing_job = ProcessingJob(
        list_id=bookmark_list.id, total_videos=1, status="running"
    )
    test_db.add(processing_job)
    await test_db.commit()
    await test_db.refresh(processing_job)

    video = Video(
        list_id=bookmark_list.id, youtube_id="dQw4w9WgXcQ", processing_status="pending"
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Force exception by passing invalid UUID (will fail db.get)
    with pytest.raises(ValueError):
        await process_video(
            arq_context,
            "invalid-uuid-format",  # Will cause ValueError
            str(bookmark_list.id),
            {},
            str(processing_job.id),
        )


@pytest.mark.asyncio
@patch("app.workers.video_processor.YouTubeClient")
async def test_process_video_fetches_youtube_metadata(
    mock_youtube_client, arq_context, test_db, test_user
):
    """Test video processing fetches and stores YouTube metadata."""
    # Arrange: Mock YouTube client
    mock_client_instance = AsyncMock()
    mock_client_instance.get_video_metadata.return_value = {
        "title": "Rick Astley - Never Gonna Give You Up",
        "channel": "Rick Astley",
        "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        "duration": "PT3M33S",
        "published_at": "2009-10-25T06:57:33Z",
    }
    mock_youtube_client.return_value = mock_client_instance

    # Arrange: Create test list
    bookmark_list = BookmarkList(
        name="Test List", description="Test description", user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create processing job
    processing_job = ProcessingJob(
        list_id=bookmark_list.id, total_videos=1, status="running"
    )
    test_db.add(processing_job)
    await test_db.commit()
    await test_db.refresh(processing_job)

    # Arrange: Create test video with pending status
    video = Video(
        list_id=bookmark_list.id, youtube_id="dQw4w9WgXcQ", processing_status="pending"
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Act: Process video
    result = await process_video(
        arq_context, str(video.id), str(video.list_id), {}, str(processing_job.id)
    )

    # Assert: Video has YouTube metadata
    await test_db.refresh(video)
    assert video.processing_status == "completed"
    assert video.title is not None, "Title should be fetched from YouTube API"
    assert video.channel is not None, "Channel should be fetched from YouTube API"
    assert video.thumbnail_url is not None, (
        "Thumbnail URL should be fetched from YouTube API"
    )
    assert result["status"] == "success"


@pytest.mark.asyncio
@patch("app.workers.video_processor.YouTubeClient")
async def test_process_video_creates_channel(
    mock_youtube_client, arq_context, test_db, test_user
):
    """Test video processing creates a Channel entity and links it to the video."""
    from sqlalchemy import select

    from app.models.channel import Channel

    # Arrange: Mock YouTube client with channel_id
    mock_client_instance = AsyncMock()
    mock_client_instance.get_video_metadata.return_value = {
        "title": "Python Tutorial",
        "channel": "Tech Channel",
        "channel_id": "UCtech123abc",  # YouTube channel ID
        "thumbnail_url": "https://i.ytimg.com/vi/test/maxresdefault.jpg",
        "duration": "PT10M00S",
        "published_at": "2024-01-15T10:00:00Z",
    }
    mock_youtube_client.return_value = mock_client_instance

    # Arrange: Create test list
    bookmark_list = BookmarkList(
        name="Test List", description="Test description", user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    # Arrange: Create processing job
    processing_job = ProcessingJob(
        list_id=bookmark_list.id, total_videos=1, status="running"
    )
    test_db.add(processing_job)
    await test_db.commit()
    await test_db.refresh(processing_job)

    # Arrange: Create test video
    video = Video(
        list_id=bookmark_list.id,
        youtube_id="test_video_123",
        processing_status="pending",
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Act: Process video
    result = await process_video(
        arq_context, str(video.id), str(video.list_id), {}, str(processing_job.id)
    )

    # Assert: Video processing succeeded
    assert result["status"] == "success"
    await test_db.refresh(video)

    # Assert: Video has channel_id set
    assert video.channel_id is not None, "Video should have channel_id set"

    # Assert: Channel was created in DB
    channel_result = await test_db.execute(
        select(Channel).where(Channel.id == video.channel_id)
    )
    channel = channel_result.scalar_one()
    assert channel.youtube_channel_id == "UCtech123abc"
    assert channel.name == "Tech Channel"
    assert channel.user_id == test_user.id


@pytest.mark.asyncio
@patch("app.workers.video_processor.YouTubeClient")
async def test_process_video_reuses_existing_channel(
    mock_youtube_client, arq_context, test_db, test_user
):
    """Test video processing reuses existing Channel for same YouTube channel."""
    from sqlalchemy import func, select

    from app.models.channel import Channel

    # Arrange: Create existing channel
    existing_channel = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCexisting999",
        name="Existing Channel",
    )
    test_db.add(existing_channel)
    await test_db.commit()
    await test_db.refresh(existing_channel)

    # Arrange: Mock YouTube client returning same channel_id
    mock_client_instance = AsyncMock()
    mock_client_instance.get_video_metadata.return_value = {
        "title": "New Video",
        "channel": "Existing Channel",
        "channel_id": "UCexisting999",  # Same as existing channel
        "thumbnail_url": "https://example.com/thumb.jpg",
        "duration": "PT5M00S",
        "published_at": "2024-01-01T00:00:00Z",
    }
    mock_youtube_client.return_value = mock_client_instance

    # Arrange: Create test list and job
    bookmark_list = BookmarkList(
        name="Test List", description="Test description", user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    processing_job = ProcessingJob(
        list_id=bookmark_list.id, total_videos=1, status="running"
    )
    test_db.add(processing_job)
    await test_db.commit()
    await test_db.refresh(processing_job)

    video = Video(
        list_id=bookmark_list.id,
        youtube_id="new_video_123",
        processing_status="pending",
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Act: Process video
    await process_video(
        arq_context, str(video.id), str(video.list_id), {}, str(processing_job.id)
    )

    # Assert: Video linked to existing channel
    await test_db.refresh(video)
    assert video.channel_id == existing_channel.id

    # Assert: No new channel was created
    count_result = await test_db.execute(
        select(func.count()).select_from(Channel).where(Channel.user_id == test_user.id)
    )
    channel_count = count_result.scalar()
    assert channel_count == 1, "Should reuse existing channel, not create new one"
