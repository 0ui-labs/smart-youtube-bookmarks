"""Tests for EnrichmentService."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.video import Video
from app.models.video_enrichment import EnrichmentStatus, VideoEnrichment
from app.services.enrichment.enrichment_service import EnrichmentService
from app.services.enrichment.providers.base import CaptionResult
from app.services.enrichment.providers.chapter_extractor import Chapter


class TestEnrichmentServiceInit:
    """Tests for EnrichmentService initialization."""

    def test_service_initialization(self):
        """EnrichmentService can be initialized with db session."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        assert service is not None
        assert service._db is mock_db

    def test_service_has_caption_providers(self):
        """Service initializes with caption provider list."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        assert hasattr(service, "_caption_providers")
        # Should have at least YouTube provider
        assert len(service._caption_providers) >= 1


class TestGetOrCreateEnrichment:
    """Tests for _get_or_create_enrichment method."""

    @pytest.mark.asyncio
    async def test_creates_new_enrichment(self):
        """Creates new enrichment if none exists."""
        mock_db = MagicMock()
        video_id = uuid4()

        # Mock query to return None (no existing enrichment)
        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        service = EnrichmentService(mock_db)
        enrichment = await service._get_or_create_enrichment(video_id)

        assert enrichment is not None
        assert enrichment.video_id == video_id
        assert enrichment.status == EnrichmentStatus.pending
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_existing_enrichment(self):
        """Returns existing enrichment if one exists."""
        mock_db = MagicMock()
        video_id = uuid4()

        existing = VideoEnrichment(video_id=video_id, status=EnrichmentStatus.completed)

        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=existing))
        )

        service = EnrichmentService(mock_db)
        enrichment = await service._get_or_create_enrichment(video_id)

        assert enrichment is existing
        assert enrichment.status == EnrichmentStatus.completed

    @pytest.mark.asyncio
    async def test_resets_failed_enrichment(self):
        """Resets status if existing enrichment was failed."""
        mock_db = MagicMock()
        video_id = uuid4()

        existing = VideoEnrichment(video_id=video_id, status=EnrichmentStatus.failed)

        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=existing))
        )
        mock_db.flush = AsyncMock()

        service = EnrichmentService(mock_db)
        enrichment = await service._get_or_create_enrichment(video_id, retry=True)

        assert enrichment.status == EnrichmentStatus.pending


class TestFetchCaptions:
    """Tests for _fetch_captions method."""

    @pytest.mark.asyncio
    async def test_fetch_captions_from_youtube(self):
        """Fetch captions from YouTube provider."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        enrichment = VideoEnrichment(
            video_id=uuid4(), status=EnrichmentStatus.processing
        )
        video = MagicMock(spec=Video)
        video.youtube_id = "test123"
        video.duration = 600

        mock_result = CaptionResult(
            vtt="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello",
            language="en",
            source="youtube_manual",
        )

        with patch.object(
            service._caption_providers[0], "fetch", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = mock_result

            result = await service._fetch_captions(enrichment, video)

        assert result is True
        assert enrichment.captions_vtt == mock_result.vtt
        assert enrichment.captions_language == "en"
        assert enrichment.captions_source == "youtube_manual"

    @pytest.mark.asyncio
    async def test_fetch_captions_no_captions_available(self):
        """Handle case when no provider returns captions."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        enrichment = VideoEnrichment(
            video_id=uuid4(), status=EnrichmentStatus.processing
        )
        video = MagicMock(spec=Video)
        video.youtube_id = "test123"
        video.duration = 600

        with patch.object(
            service._caption_providers[0], "fetch", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = None

            result = await service._fetch_captions(enrichment, video)

        assert result is False
        assert enrichment.captions_vtt is None

    @pytest.mark.asyncio
    async def test_fetch_captions_tries_all_providers(self):
        """Service tries all providers until one succeeds."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        # Add a second mock provider
        mock_provider2 = MagicMock()
        mock_provider2.name = "groq"
        mock_provider2.fetch = AsyncMock(
            return_value=CaptionResult(
                vtt="WEBVTT\n\nGroq transcript", language="en", source="groq_whisper"
            )
        )
        service._caption_providers.append(mock_provider2)

        enrichment = VideoEnrichment(
            video_id=uuid4(), status=EnrichmentStatus.processing
        )
        video = MagicMock(spec=Video)
        video.youtube_id = "test123"
        video.duration = 600

        # First provider returns None
        with patch.object(
            service._caption_providers[0], "fetch", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = None

            result = await service._fetch_captions(enrichment, video)

        assert result is True
        assert enrichment.captions_source == "groq_whisper"

    @pytest.mark.asyncio
    async def test_fetch_captions_handles_provider_error(self):
        """Service handles provider errors gracefully."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        enrichment = VideoEnrichment(
            video_id=uuid4(), status=EnrichmentStatus.processing
        )
        video = MagicMock(spec=Video)
        video.youtube_id = "test123"
        video.duration = 600

        with patch.object(
            service._caption_providers[0], "fetch", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.side_effect = Exception("Provider error")

            result = await service._fetch_captions(enrichment, video)

        # Should not crash, returns False
        assert result is False


class TestFetchChapters:
    """Tests for _fetch_chapters method."""

    @pytest.mark.asyncio
    async def test_fetch_chapters_from_youtube(self):
        """Fetch chapters from YouTube metadata."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        enrichment = VideoEnrichment(
            video_id=uuid4(), status=EnrichmentStatus.processing
        )
        video = MagicMock(spec=Video)
        video.youtube_id = "test123"
        video.duration = 600
        video.description = ""

        mock_chapters = [
            Chapter(title="Intro", start=0.0, end=60.0),
            Chapter(title="Main", start=60.0, end=300.0),
            Chapter(title="End", start=300.0, end=600.0),
        ]

        with patch(
            "app.services.enrichment.enrichment_service.ChapterExtractor"
        ) as MockExtractor:
            mock_extractor = MockExtractor.return_value
            mock_extractor.fetch_youtube_chapters = AsyncMock(
                return_value=mock_chapters
            )

            result = await service._fetch_chapters(enrichment, video)

        assert result is True
        assert enrichment.chapters_json is not None
        assert len(enrichment.chapters_json) == 3
        assert enrichment.chapters_source == "youtube"

    @pytest.mark.asyncio
    async def test_fetch_chapters_from_description(self):
        """Fallback to description parsing when YouTube has no chapters."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        enrichment = VideoEnrichment(
            video_id=uuid4(), status=EnrichmentStatus.processing
        )
        video = MagicMock(spec=Video)
        video.youtube_id = "test123"
        video.duration = 600
        video.description = "0:00 Start\n5:00 Middle\n10:00 End"

        mock_chapters = [
            Chapter(title="Start", start=0.0, end=300.0),
            Chapter(title="Middle", start=300.0, end=600.0),
        ]

        with patch(
            "app.services.enrichment.enrichment_service.ChapterExtractor"
        ) as MockExtractor:
            mock_extractor = MockExtractor.return_value
            mock_extractor.fetch_youtube_chapters = AsyncMock(return_value=None)
            mock_extractor.parse_description_chapters = MagicMock(
                return_value=mock_chapters
            )

            result = await service._fetch_chapters(enrichment, video)

        assert result is True
        assert enrichment.chapters_json is not None
        assert enrichment.chapters_source == "description"

    @pytest.mark.asyncio
    async def test_fetch_chapters_none_available(self):
        """Returns False when no chapters found."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        enrichment = VideoEnrichment(
            video_id=uuid4(), status=EnrichmentStatus.processing
        )
        video = MagicMock(spec=Video)
        video.youtube_id = "test123"
        video.duration = 600
        video.description = "No timestamps here"

        with patch(
            "app.services.enrichment.enrichment_service.ChapterExtractor"
        ) as MockExtractor:
            mock_extractor = MockExtractor.return_value
            mock_extractor.fetch_youtube_chapters = AsyncMock(return_value=None)
            mock_extractor.parse_description_chapters = MagicMock(return_value=None)

            result = await service._fetch_chapters(enrichment, video)

        assert result is False
        assert enrichment.chapters_json is None

    @pytest.mark.asyncio
    async def test_fetch_chapters_handles_error(self):
        """Gracefully handles errors in chapter extraction."""
        mock_db = MagicMock()
        service = EnrichmentService(mock_db)

        enrichment = VideoEnrichment(
            video_id=uuid4(), status=EnrichmentStatus.processing
        )
        video = MagicMock(spec=Video)
        video.youtube_id = "test123"
        video.duration = 600
        video.description = ""

        with patch(
            "app.services.enrichment.enrichment_service.ChapterExtractor"
        ) as MockExtractor:
            mock_extractor = MockExtractor.return_value
            mock_extractor.fetch_youtube_chapters = AsyncMock(
                side_effect=Exception("Error")
            )

            result = await service._fetch_chapters(enrichment, video)

        assert result is False


class TestEnrichVideo:
    """Tests for main enrich_video method."""

    @pytest.mark.asyncio
    async def test_enrich_video_completed(self):
        """Enrichment completes when captions are found."""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        service = EnrichmentService(mock_db)
        video_id = uuid4()

        video = MagicMock(spec=Video)
        video.id = video_id
        video.youtube_id = "test123"
        video.duration = 600
        video.description = ""

        with patch.object(
            service, "_get_video", new_callable=AsyncMock
        ) as mock_get_video:
            mock_get_video.return_value = video

            with patch.object(
                service, "_fetch_captions", new_callable=AsyncMock
            ) as mock_captions:
                mock_captions.return_value = True

                with patch.object(
                    service, "_fetch_chapters", new_callable=AsyncMock
                ) as mock_chapters:
                    mock_chapters.return_value = True

                    result = await service.enrich_video(video_id)

        assert result.status == EnrichmentStatus.completed

    @pytest.mark.asyncio
    async def test_enrich_video_partial(self):
        """Enrichment is partial when only chapters found (no captions)."""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        service = EnrichmentService(mock_db)
        video_id = uuid4()

        video = MagicMock(spec=Video)
        video.id = video_id
        video.youtube_id = "test123"
        video.duration = 600
        video.description = ""

        with patch.object(
            service, "_get_video", new_callable=AsyncMock
        ) as mock_get_video:
            mock_get_video.return_value = video

            with patch.object(
                service, "_fetch_captions", new_callable=AsyncMock
            ) as mock_captions:
                mock_captions.return_value = False

                with patch.object(
                    service, "_fetch_chapters", new_callable=AsyncMock
                ) as mock_chapters:
                    mock_chapters.return_value = True

                    result = await service.enrich_video(video_id)

        assert result.status == EnrichmentStatus.partial

    @pytest.mark.asyncio
    async def test_enrich_video_failed(self):
        """Enrichment fails when nothing found."""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        service = EnrichmentService(mock_db)
        video_id = uuid4()

        video = MagicMock(spec=Video)
        video.id = video_id
        video.youtube_id = "test123"
        video.duration = 600
        video.description = ""

        with patch.object(
            service, "_get_video", new_callable=AsyncMock
        ) as mock_get_video:
            mock_get_video.return_value = video

            with patch.object(
                service, "_fetch_captions", new_callable=AsyncMock
            ) as mock_captions:
                mock_captions.return_value = False

                with patch.object(
                    service, "_fetch_chapters", new_callable=AsyncMock
                ) as mock_chapters:
                    mock_chapters.return_value = False

                    result = await service.enrich_video(video_id)

        assert result.status == EnrichmentStatus.failed

    @pytest.mark.asyncio
    async def test_enrich_video_updates_status_to_processing(self):
        """Enrichment sets status to processing during execution."""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        service = EnrichmentService(mock_db)
        video_id = uuid4()

        video = MagicMock(spec=Video)
        video.id = video_id
        video.youtube_id = "test123"
        video.duration = 600
        video.description = ""

        processing_status = None

        async def capture_status(enrichment, video):
            nonlocal processing_status
            processing_status = enrichment.status
            return True

        with patch.object(
            service, "_get_video", new_callable=AsyncMock
        ) as mock_get_video:
            mock_get_video.return_value = video

            with patch.object(service, "_fetch_captions", side_effect=capture_status):
                with patch.object(
                    service, "_fetch_chapters", new_callable=AsyncMock
                ) as mock_chapters:
                    mock_chapters.return_value = True

                    await service.enrich_video(video_id)

        assert processing_status == EnrichmentStatus.processing
