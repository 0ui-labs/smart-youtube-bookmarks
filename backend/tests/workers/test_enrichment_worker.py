"""Tests for enrichment worker."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.video_enrichment import EnrichmentStatus
from app.workers.enrichment_worker import enrich_video


class TestEnrichVideoWorker:
    """Tests for enrich_video worker function."""

    @pytest.mark.asyncio
    async def test_enrich_video_success(self, arq_context, test_video):
        """Worker enriches video successfully."""
        with patch("app.workers.enrichment_worker.EnrichmentService") as MockService:
            mock_service = MockService.return_value
            mock_enrichment = MagicMock()
            mock_enrichment.status = EnrichmentStatus.completed.value
            mock_service.enrich_video = AsyncMock(return_value=mock_enrichment)

            result = await enrich_video(arq_context, str(test_video.id))

        assert result["status"] == "completed"
        mock_service.enrich_video.assert_called_once()

    @pytest.mark.asyncio
    async def test_enrich_video_not_found(self, arq_context):
        """Worker returns error when video not found."""
        fake_id = str(uuid4())

        result = await enrich_video(arq_context, fake_id)

        assert result["status"] == "error"
        assert "not found" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_enrich_video_partial(self, arq_context, test_video):
        """Worker handles partial enrichment."""
        with patch("app.workers.enrichment_worker.EnrichmentService") as MockService:
            mock_service = MockService.return_value
            mock_enrichment = MagicMock()
            mock_enrichment.status = EnrichmentStatus.partial.value
            mock_service.enrich_video = AsyncMock(return_value=mock_enrichment)

            result = await enrich_video(arq_context, str(test_video.id))

        assert result["status"] == "partial"

    @pytest.mark.asyncio
    async def test_enrich_video_failed(self, arq_context, test_video):
        """Worker handles failed enrichment."""
        with patch("app.workers.enrichment_worker.EnrichmentService") as MockService:
            mock_service = MockService.return_value
            mock_enrichment = MagicMock()
            mock_enrichment.status = EnrichmentStatus.failed.value
            mock_enrichment.error_message = "No captions found"
            mock_service.enrich_video = AsyncMock(return_value=mock_enrichment)

            result = await enrich_video(arq_context, str(test_video.id))

        assert result["status"] == "failed"

    @pytest.mark.asyncio
    async def test_enrich_video_handles_exception(self, arq_context, test_video):
        """Worker handles unexpected exceptions."""
        with patch("app.workers.enrichment_worker.EnrichmentService") as MockService:
            mock_service = MockService.return_value
            mock_service.enrich_video = AsyncMock(
                side_effect=Exception("Unexpected error")
            )

            result = await enrich_video(arq_context, str(test_video.id))

        assert result["status"] == "error"
