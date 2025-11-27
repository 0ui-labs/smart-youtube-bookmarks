"""
Tests for staged enrichment worker functions.
"""
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video


@pytest.mark.asyncio
async def test_update_stage_saves_to_db(test_db: AsyncSession, test_list):
    """Test that update_stage saves stage and progress to database."""
    from app.workers.video_processor import update_stage

    # Create a video
    video = Video(
        list_id=test_list.id,
        youtube_id="test_stage_123",
        import_stage="created",
        import_progress=0
    )
    test_db.add(video)
    await test_db.flush()

    # Update stage
    await update_stage(test_db, video, "metadata", 25)

    # Verify in-memory update
    assert video.import_stage == "metadata"
    assert video.import_progress == 25

    # Refresh from DB to verify persistence
    await test_db.refresh(video)
    assert video.import_stage == "metadata"
    assert video.import_progress == 25


@pytest.mark.asyncio
async def test_update_stage_multiple_stages(test_db: AsyncSession, test_list):
    """Test updating through multiple stages."""
    from app.workers.video_processor import update_stage

    video = Video(
        list_id=test_list.id,
        youtube_id="test_multi_stage",
        import_stage="created",
        import_progress=0
    )
    test_db.add(video)
    await test_db.flush()

    # Progress through stages
    stages = [
        ("metadata", 25),
        ("captions", 60),
        ("chapters", 90),
        ("complete", 100)
    ]

    for stage, progress in stages:
        await update_stage(test_db, video, stage, progress)
        assert video.import_stage == stage
        assert video.import_progress == progress


@pytest.mark.asyncio
async def test_publish_progress_sends_to_redis(test_db: AsyncSession, test_list, mock_redis):
    """Test that publish_progress sends correct message to Redis."""
    from app.workers.video_processor import publish_progress

    video = Video(
        list_id=test_list.id,
        youtube_id="test_publish",
        import_stage="created",
        import_progress=0
    )
    test_db.add(video)
    await test_db.flush()

    # Publish progress
    user_id = str(test_list.user_id)
    await publish_progress(mock_redis, user_id, str(video.id), 60, "captions")

    # Verify Redis publish was called
    mock_redis.publish.assert_called_once()
    call_args = mock_redis.publish.call_args

    # Check channel
    assert call_args[0][0] == f"progress:user:{user_id}"

    # Check message content
    import json
    message = json.loads(call_args[0][1])
    assert message["type"] == "import_progress"
    assert message["video_id"] == str(video.id)
    assert message["progress"] == 60
    assert message["stage"] == "captions"
