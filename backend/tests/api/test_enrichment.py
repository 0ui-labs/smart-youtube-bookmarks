"""Tests for Enrichment API endpoints."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.video import Video
from app.models.video_enrichment import EnrichmentStatus, VideoEnrichment


class TestGetEnrichment:
    """Tests for GET /api/videos/{video_id}/enrichment endpoint."""

    @pytest.mark.asyncio
    async def test_get_enrichment_success(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Get enrichment returns data when exists."""
        # Create video
        video = Video(
            list_id=test_list.id, youtube_id="test123", title="Test Video", duration=600
        )
        test_db.add(video)
        await test_db.flush()

        # Create enrichment
        enrichment = VideoEnrichment(
            video_id=video.id,
            status=EnrichmentStatus.completed.value,
            captions_vtt="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello",
            captions_language="en",
            captions_source="youtube_manual",
        )
        test_db.add(enrichment)
        await test_db.commit()

        response = await client.get(f"/api/videos/{video.id}/enrichment")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
        assert data["captions_language"] == "en"

    @pytest.mark.asyncio
    async def test_get_enrichment_not_found(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Get enrichment returns 404 when not exists."""
        # Create video without enrichment
        video = Video(
            list_id=test_list.id, youtube_id="test456", title="Test Video", duration=600
        )
        test_db.add(video)
        await test_db.commit()

        response = await client.get(f"/api/videos/{video.id}/enrichment")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_get_enrichment_video_not_found(self, client: AsyncClient):
        """Get enrichment returns 404 when video doesn't exist."""
        fake_id = uuid4()
        response = await client.get(f"/api/videos/{fake_id}/enrichment")

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestRetryEnrichment:
    """Tests for POST /api/videos/{video_id}/enrichment/retry endpoint."""

    @pytest.mark.asyncio
    async def test_retry_enrichment_success(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Retry enrichment starts new job."""
        # Create video
        video = Video(
            list_id=test_list.id,
            youtube_id="retry123",
            title="Test Video",
            duration=600,
        )
        test_db.add(video)
        await test_db.flush()

        # Create failed enrichment
        enrichment = VideoEnrichment(
            video_id=video.id,
            status=EnrichmentStatus.failed.value,
            error_message="Previous error",
        )
        test_db.add(enrichment)
        await test_db.commit()

        with patch("app.api.enrichment.get_arq_pool") as mock_pool:
            mock_redis = AsyncMock()
            mock_pool.return_value = mock_redis

            response = await client.post(f"/api/videos/{video.id}/enrichment/retry")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Enrichment retry started"
        assert data["enrichment"]["status"] == "pending"

    @pytest.mark.asyncio
    async def test_retry_enrichment_already_processing(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Retry returns 409 when already processing."""
        # Create video
        video = Video(
            list_id=test_list.id,
            youtube_id="processing123",
            title="Test Video",
            duration=600,
        )
        test_db.add(video)
        await test_db.flush()

        # Create processing enrichment
        enrichment = VideoEnrichment(
            video_id=video.id, status=EnrichmentStatus.processing.value
        )
        test_db.add(enrichment)
        await test_db.commit()

        response = await client.post(f"/api/videos/{video.id}/enrichment/retry")

        assert response.status_code == status.HTTP_409_CONFLICT

    @pytest.mark.asyncio
    async def test_retry_enrichment_video_not_found(self, client: AsyncClient):
        """Retry returns 404 when video doesn't exist."""
        fake_id = uuid4()
        response = await client.post(f"/api/videos/{fake_id}/enrichment/retry")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_retry_creates_enrichment_if_none(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Retry creates new enrichment if none exists."""
        # Create video without enrichment
        video = Video(
            list_id=test_list.id, youtube_id="new123", title="Test Video", duration=600
        )
        test_db.add(video)
        await test_db.commit()

        with patch("app.api.enrichment.get_arq_pool") as mock_pool:
            mock_redis = AsyncMock()
            mock_pool.return_value = mock_redis

            response = await client.post(f"/api/videos/{video.id}/enrichment/retry")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["enrichment"]["status"] == "pending"
