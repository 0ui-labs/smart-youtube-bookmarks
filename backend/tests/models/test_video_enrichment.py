"""Tests for VideoEnrichment model."""
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.video import Video
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus


class TestEnrichmentStatus:
    """Tests for EnrichmentStatus enum."""

    def test_pending_status_value(self):
        """EnrichmentStatus.pending has correct string value."""
        assert EnrichmentStatus.pending.value == "pending"

    def test_processing_status_value(self):
        """EnrichmentStatus.processing has correct string value."""
        assert EnrichmentStatus.processing.value == "processing"

    def test_completed_status_value(self):
        """EnrichmentStatus.completed has correct string value."""
        assert EnrichmentStatus.completed.value == "completed"

    def test_partial_status_value(self):
        """EnrichmentStatus.partial has correct string value."""
        assert EnrichmentStatus.partial.value == "partial"

    def test_failed_status_value(self):
        """EnrichmentStatus.failed has correct string value."""
        assert EnrichmentStatus.failed.value == "failed"

    def test_status_is_string_enum(self):
        """EnrichmentStatus values are strings for DB storage."""
        assert isinstance(EnrichmentStatus.pending.value, str)


class TestVideoEnrichmentModel:
    """Tests for VideoEnrichment model."""

    @pytest.mark.asyncio
    async def test_create_enrichment(self, test_db, test_video):
        """VideoEnrichment can be created with minimal fields."""
        enrichment = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.pending
        )
        test_db.add(enrichment)
        await test_db.commit()
        await test_db.refresh(enrichment)

        assert enrichment.id is not None
        assert enrichment.video_id == test_video.id
        assert enrichment.status == EnrichmentStatus.pending
        assert enrichment.created_at is not None
        assert enrichment.updated_at is not None

    @pytest.mark.asyncio
    async def test_enrichment_default_status(self, test_db, test_video):
        """VideoEnrichment defaults to pending status."""
        enrichment = VideoEnrichment(video_id=test_video.id)
        test_db.add(enrichment)
        await test_db.commit()
        await test_db.refresh(enrichment)

        assert enrichment.status == EnrichmentStatus.pending

    @pytest.mark.asyncio
    async def test_enrichment_with_captions(self, test_db, test_video):
        """VideoEnrichment can store caption data."""
        vtt_content = "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world"

        enrichment = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.completed,
            captions_vtt=vtt_content,
            captions_language="en",
            captions_source="youtube_auto"
        )
        test_db.add(enrichment)
        await test_db.commit()
        await test_db.refresh(enrichment)

        assert enrichment.captions_vtt == vtt_content
        assert enrichment.captions_language == "en"
        assert enrichment.captions_source == "youtube_auto"

    @pytest.mark.asyncio
    async def test_enrichment_with_chapters(self, test_db, test_video):
        """VideoEnrichment can store chapter data."""
        chapters_vtt = "WEBVTT\n\nchapter-1\n00:00:00.000 --> 00:02:30.000\nIntro"
        chapters_json = [
            {"start": 0, "end": 150, "title": "Intro"},
            {"start": 150, "end": 600, "title": "Main"}
        ]

        enrichment = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.completed,
            chapters_vtt=chapters_vtt,
            chapters_json=chapters_json,
            chapters_source="youtube"
        )
        test_db.add(enrichment)
        await test_db.commit()
        await test_db.refresh(enrichment)

        assert enrichment.chapters_vtt == chapters_vtt
        assert enrichment.chapters_json == chapters_json
        assert enrichment.chapters_source == "youtube"

    @pytest.mark.asyncio
    async def test_enrichment_with_error(self, test_db, test_video):
        """VideoEnrichment can store error state."""
        enrichment = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.failed,
            error_message="Video not available",
            retry_count=3
        )
        test_db.add(enrichment)
        await test_db.commit()
        await test_db.refresh(enrichment)

        assert enrichment.status == EnrichmentStatus.failed
        assert enrichment.error_message == "Video not available"
        assert enrichment.retry_count == 3

    @pytest.mark.asyncio
    async def test_enrichment_default_retry_count(self, test_db, test_video):
        """VideoEnrichment retry_count defaults to 0."""
        enrichment = VideoEnrichment(video_id=test_video.id)
        test_db.add(enrichment)
        await test_db.commit()
        await test_db.refresh(enrichment)

        assert enrichment.retry_count == 0


class TestVideoEnrichmentRelationship:
    """Tests for VideoEnrichment relationship with Video."""

    @pytest.mark.asyncio
    async def test_video_enrichment_relationship(self, test_db, test_video):
        """Video.enrichment returns associated VideoEnrichment."""
        enrichment = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.completed
        )
        test_db.add(enrichment)
        await test_db.commit()

        # Query video with enrichment loaded (async SQLAlchemy requires explicit loading)
        result = await test_db.execute(
            select(Video)
            .where(Video.id == test_video.id)
            .options(selectinload(Video.enrichment))
        )
        video = result.scalar_one()

        assert video.enrichment is not None
        assert video.enrichment.id == enrichment.id

    @pytest.mark.asyncio
    async def test_enrichment_video_relationship(self, test_db, test_video):
        """VideoEnrichment.video returns associated Video."""
        enrichment = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.pending
        )
        test_db.add(enrichment)
        await test_db.commit()
        await test_db.refresh(enrichment)

        assert enrichment.video is not None
        assert enrichment.video.id == test_video.id

    @pytest.mark.asyncio
    async def test_cascade_delete(self, test_db, test_list, test_video):
        """VideoEnrichment is deleted when Video is deleted."""
        enrichment = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.completed
        )
        test_db.add(enrichment)
        await test_db.commit()
        enrichment_id = enrichment.id

        # Delete the video
        await test_db.delete(test_video)
        await test_db.commit()

        # Enrichment should be deleted
        result = await test_db.execute(
            select(VideoEnrichment).where(VideoEnrichment.id == enrichment_id)
        )
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_unique_video_constraint(self, test_db, test_video):
        """Only one enrichment per video is allowed."""
        enrichment1 = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.completed
        )
        test_db.add(enrichment1)
        await test_db.commit()

        # Try to create second enrichment for same video
        enrichment2 = VideoEnrichment(
            video_id=test_video.id,
            status=EnrichmentStatus.pending
        )
        test_db.add(enrichment2)

        with pytest.raises(IntegrityError):
            await test_db.commit()

        # Rollback to clean up session state after IntegrityError
        await test_db.rollback()
