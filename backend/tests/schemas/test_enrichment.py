"""Tests for Enrichment schemas."""
import pytest
from uuid import uuid4
from datetime import datetime

from app.schemas.enrichment import (
    EnrichmentStatus,
    ChapterSchema,
    EnrichmentResponse,
    EnrichmentRetryResponse,
)


class TestEnrichmentStatus:
    """Tests for EnrichmentStatus enum."""

    def test_status_values(self):
        """All expected status values exist."""
        assert EnrichmentStatus.pending == "pending"
        assert EnrichmentStatus.processing == "processing"
        assert EnrichmentStatus.completed == "completed"
        assert EnrichmentStatus.partial == "partial"
        assert EnrichmentStatus.failed == "failed"


class TestChapterSchema:
    """Tests for ChapterSchema."""

    def test_chapter_creation(self):
        """ChapterSchema can be created with all fields."""
        chapter = ChapterSchema(
            title="Introduction",
            start=0.0,
            end=60.0
        )

        assert chapter.title == "Introduction"
        assert chapter.start == 0.0
        assert chapter.end == 60.0


class TestEnrichmentResponse:
    """Tests for EnrichmentResponse schema."""

    def test_response_minimal(self):
        """Response can be created with minimal fields."""
        response = EnrichmentResponse(
            id=uuid4(),
            video_id=uuid4(),
            status=EnrichmentStatus.pending
        )

        assert response.status == EnrichmentStatus.pending
        assert response.captions_vtt is None
        assert response.chapters is None

    def test_response_with_captions(self):
        """Response includes caption data."""
        response = EnrichmentResponse(
            id=uuid4(),
            video_id=uuid4(),
            status=EnrichmentStatus.completed,
            captions_vtt="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello",
            captions_language="en",
            captions_source="youtube_manual"
        )

        assert response.captions_vtt is not None
        assert response.captions_language == "en"
        assert response.captions_source == "youtube_manual"

    def test_response_with_chapters(self):
        """Response includes chapter data."""
        chapters = [
            ChapterSchema(title="Intro", start=0.0, end=60.0),
            ChapterSchema(title="Main", start=60.0, end=300.0),
        ]

        response = EnrichmentResponse(
            id=uuid4(),
            video_id=uuid4(),
            status=EnrichmentStatus.completed,
            chapters=chapters,
            chapters_source="youtube"
        )

        assert response.chapters is not None
        assert len(response.chapters) == 2
        assert response.chapters[0].title == "Intro"

    def test_response_with_error(self):
        """Response includes error information."""
        response = EnrichmentResponse(
            id=uuid4(),
            video_id=uuid4(),
            status=EnrichmentStatus.failed,
            error_message="No captions found",
            retry_count=2
        )

        assert response.status == EnrichmentStatus.failed
        assert response.error_message == "No captions found"
        assert response.retry_count == 2

    def test_response_with_timestamps(self):
        """Response includes timestamps."""
        now = datetime.now()
        response = EnrichmentResponse(
            id=uuid4(),
            video_id=uuid4(),
            status=EnrichmentStatus.completed,
            created_at=now,
            updated_at=now,
            processed_at=now
        )

        assert response.created_at == now
        assert response.processed_at == now


class TestEnrichmentRetryResponse:
    """Tests for EnrichmentRetryResponse schema."""

    def test_retry_response(self):
        """Retry response includes message and enrichment."""
        enrichment = EnrichmentResponse(
            id=uuid4(),
            video_id=uuid4(),
            status=EnrichmentStatus.pending
        )

        response = EnrichmentRetryResponse(
            message="Enrichment retry started",
            enrichment=enrichment
        )

        assert response.message == "Enrichment retry started"
        assert response.enrichment.status == EnrichmentStatus.pending
