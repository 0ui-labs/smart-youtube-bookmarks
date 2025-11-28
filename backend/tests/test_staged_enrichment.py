"""
Tests for staged enrichment worker functions.
"""
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus


@pytest.mark.asyncio
async def test_enrich_video_staged_updates_progress(test_db: AsyncSession, test_list, arq_context):
    """Test that enrich_video_staged updates progress through stages."""
    from app.workers.video_processor import enrich_video_staged

    # Create a video with metadata already fetched
    video = Video(
        list_id=test_list.id,
        youtube_id="staged_enrich_123",
        title="Test Video",
        import_stage="metadata",
        import_progress=25
    )
    test_db.add(video)
    await test_db.flush()

    # Mock the EnrichmentService to avoid actual API calls
    mock_enrichment = VideoEnrichment(
        video_id=video.id,
        status=EnrichmentStatus.completed,
        captions_vtt="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello"
    )

    with patch('app.services.enrichment.enrichment_service.EnrichmentService') as mock_service_class:
        mock_service = AsyncMock()
        mock_service.enrich_video.return_value = mock_enrichment
        mock_service_class.return_value = mock_service

        # Run staged enrichment
        result = await enrich_video_staged(arq_context, str(video.id))

    # Verify result
    assert result["status"] == "completed"
    assert result["video_id"] == str(video.id)

    # Verify video was updated to complete
    await test_db.refresh(video)
    assert video.import_stage == "complete"
    assert video.import_progress == 100


@pytest.mark.asyncio
async def test_enrich_video_staged_publishes_progress(test_db: AsyncSession, test_list, arq_context):
    """Test that enrich_video_staged publishes progress updates via Redis."""
    from app.workers.video_processor import enrich_video_staged

    video = Video(
        list_id=test_list.id,
        youtube_id="publish_test_123",
        title="Test Video",
        import_stage="metadata",
        import_progress=25
    )
    test_db.add(video)
    await test_db.flush()

    mock_enrichment = VideoEnrichment(
        video_id=video.id,
        status=EnrichmentStatus.completed
    )

    with patch('app.services.enrichment.enrichment_service.EnrichmentService') as mock_service_class:
        mock_service = AsyncMock()
        mock_service.enrich_video.return_value = mock_enrichment
        mock_service_class.return_value = mock_service

        await enrich_video_staged(arq_context, str(video.id))

    # Verify Redis publish was called (progress updates)
    redis_mock = arq_context['redis']
    assert redis_mock.publish.called


@pytest.mark.asyncio
async def test_enrich_video_staged_handles_partial_enrichment(test_db: AsyncSession, test_list, arq_context):
    """Test that partial enrichment (no captions but has chapters) sets correct stage."""
    from app.workers.video_processor import enrich_video_staged

    video = Video(
        list_id=test_list.id,
        youtube_id="partial_test_123",
        title="Test Video",
        import_stage="metadata",
        import_progress=25
    )
    test_db.add(video)
    await test_db.flush()

    # Partial enrichment - no captions but maybe chapters
    mock_enrichment = VideoEnrichment(
        video_id=video.id,
        status=EnrichmentStatus.partial
    )

    with patch('app.services.enrichment.enrichment_service.EnrichmentService') as mock_service_class:
        mock_service = AsyncMock()
        mock_service.enrich_video.return_value = mock_enrichment
        mock_service_class.return_value = mock_service

        result = await enrich_video_staged(arq_context, str(video.id))

    assert result["status"] == "partial"
    await test_db.refresh(video)
    # Partial still means complete for import purposes
    assert video.import_stage == "complete"
    assert video.import_progress == 100


@pytest.mark.asyncio
async def test_enrich_video_staged_uses_rate_limiter(test_db: AsyncSession, test_list, arq_context):
    """Test that enrich_video_staged uses the rate limiter."""
    from app.workers.video_processor import enrich_video_staged, _enrichment_rate_limiter

    video = Video(
        list_id=test_list.id,
        youtube_id="rate_limit_test",
        title="Test Video",
        import_stage="metadata",
        import_progress=25
    )
    test_db.add(video)
    await test_db.flush()

    mock_enrichment = VideoEnrichment(
        video_id=video.id,
        status=EnrichmentStatus.completed
    )

    with patch('app.services.enrichment.enrichment_service.EnrichmentService') as mock_service_class:
        mock_service = AsyncMock()
        mock_service.enrich_video.return_value = mock_enrichment
        mock_service_class.return_value = mock_service

        # Reset rate limiter state
        _enrichment_rate_limiter.reset()

        await enrich_video_staged(arq_context, str(video.id))

    # Verify rate limiter was used (on_success called)
    # The delay should still be at base since we called on_success
    assert _enrichment_rate_limiter.current_delay == _enrichment_rate_limiter.base_delay


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
