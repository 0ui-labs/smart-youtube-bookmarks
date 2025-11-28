"""Video enrichment service for captions and chapters.

Rate Limiting Strategy:
-----------------------
YouTube API has strict rate limits that return 429 errors when exceeded.
To avoid throttling ALL worker jobs (video imports, list processing), we use
a module-level asyncio.Semaphore to limit concurrent YouTube API calls to 1.

This allows:
- Multiple video imports to run concurrently (max_jobs=10 in worker settings)
- Enrichment jobs to queue and process sequentially for YouTube API calls
- Better overall throughput vs global max_jobs=1

The semaphore is combined with a 2-second delay between YouTube API calls
to stay well under rate limits.

Monitoring:
- Check ARQ queue depth: `arq info` or Redis LLEN on arq:queue:default
- Watch for 429 errors in logs: grep "429" or "rate limit"
- Consider adding metrics for enrichment_queue_depth, enrichment_wait_time

Future improvements:
- Exponential backoff retry on 429 responses
- Separate ARQ worker instance for enrichment with max_jobs=1
- Redis-based distributed rate limiter for multi-worker deployments
"""
import asyncio
import os
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus
from app.core.config import settings
from .providers.base import CaptionProvider, CaptionResult
from .providers.youtube_captions import YoutubeCaptionProvider
from .providers.chapter_extractor import Chapter, ChapterExtractor, chapters_to_json, chapters_to_vtt
from .providers.audio_chunker import AudioChunker
from .providers.groq_transcriber import GroqTranscriber
import logging

logger = logging.getLogger(__name__)

# Module-level semaphore to limit concurrent YouTube API calls across all
# EnrichmentService instances. This prevents 429 rate limit errors while
# allowing other worker jobs (video imports) to run concurrently.
# Set to 3 to allow parallel enrichment (matches rate limiter max_concurrent)
_youtube_api_semaphore = asyncio.Semaphore(3)


class EnrichmentService:
    """Service for enriching videos with captions and chapters.

    Features:
    - Provider chain: YouTube Captions → Groq Whisper fallback
    - Chapter extraction from YouTube or description
    - Status management for async processing
    """

    def __init__(self, db: AsyncSession):
        """Initialize enrichment service.

        Args:
            db: SQLAlchemy async session
        """
        self._db = db

        # Initialize caption providers in priority order
        self._caption_providers: List[CaptionProvider] = [
            YoutubeCaptionProvider(),
        ]

    async def _update_progress(
        self,
        enrichment: VideoEnrichment,
        message: str
    ) -> None:
        """Update enrichment progress message and flush to DB.

        This allows frontend polling to see real-time progress.

        Args:
            enrichment: VideoEnrichment to update
            message: Progress message to display
        """
        enrichment.progress_message = message
        await self._db.flush()

    async def _get_or_create_enrichment(
        self,
        video_id: UUID,
        retry: bool = False
    ) -> VideoEnrichment:
        """Get existing enrichment or create new one.

        Args:
            video_id: Video UUID
            retry: If True, reset failed enrichments to pending

        Returns:
            VideoEnrichment instance
        """
        # Query existing enrichment
        stmt = select(VideoEnrichment).where(VideoEnrichment.video_id == video_id)
        result = await self._db.execute(stmt)
        enrichment = result.scalar_one_or_none()

        if enrichment:
            # Reset failed enrichment if retry requested
            if retry and enrichment.status == EnrichmentStatus.failed:
                enrichment.status = EnrichmentStatus.pending
                enrichment.error_message = None
                await self._db.flush()
            return enrichment

        # Create new enrichment
        enrichment = VideoEnrichment(
            video_id=video_id,
            status=EnrichmentStatus.pending
        )
        self._db.add(enrichment)
        await self._db.flush()

        return enrichment

    async def _fetch_captions(
        self,
        enrichment: VideoEnrichment,
        video: Video
    ) -> bool:
        """Fetch captions using provider chain.

        Tries each provider in order until one succeeds.

        Args:
            enrichment: VideoEnrichment to update
            video: Video to fetch captions for

        Returns:
            True if captions were fetched, False otherwise
        """
        for provider in self._caption_providers:
            try:
                result = await provider.fetch(video.youtube_id, video.duration or 0)

                if result:
                    enrichment.captions_vtt = result.vtt
                    enrichment.captions_language = result.language
                    enrichment.captions_source = result.source
                    logger.info(
                        f"Captions fetched from {provider.name} for video {video.youtube_id}"
                    )
                    return True

            except Exception as e:
                logger.warning(
                    f"Provider {provider.name} failed for video {video.youtube_id}: {e}"
                )
                continue

        logger.warning(f"No captions available from YouTube for video {video.youtube_id}")
        return False

    async def _fetch_captions_groq(
        self,
        enrichment: VideoEnrichment,
        video: Video
    ) -> bool:
        """Fetch captions using Groq Whisper transcription as fallback.

        Downloads audio, splits into chunks, and transcribes via Groq API.

        Args:
            enrichment: VideoEnrichment to update
            video: Video to transcribe

        Returns:
            True if transcription succeeded, False otherwise
        """
        # Check if Groq API key is configured
        if not settings.groq_api_key:
            logger.warning("Groq API key not configured, skipping Whisper fallback")
            return False

        try:
            async with AudioChunker() as chunker:
                # Download audio
                await self._update_progress(enrichment, "Downloading audio for transcription...")
                audio_path = await chunker.download_audio(video.youtube_id)

                # Split into chunks
                await self._update_progress(enrichment, "Splitting audio into chunks...")
                chunks = chunker.split_audio(audio_path)

                if not chunks:
                    logger.warning(f"No audio chunks created for video {video.youtube_id}")
                    return False

                # Transcribe with Groq
                await self._update_progress(
                    enrichment,
                    f"Transcribing audio ({len(chunks)} chunks)..."
                )
                transcriber = GroqTranscriber(api_key=settings.groq_api_key)
                results = await transcriber.transcribe_chunks(chunks)

                if not results:
                    logger.warning(f"No transcription results for video {video.youtube_id}")
                    return False

                # Convert to VTT
                chunk_offsets = [chunk.start_time for chunk in chunks]
                vtt_content = transcriber.results_to_vtt(results, chunk_offsets)

                # Detect language from first result
                language = results[0].language if results else "en"

                enrichment.captions_vtt = vtt_content
                enrichment.captions_language = language
                enrichment.captions_source = "groq_whisper"

                logger.info(
                    f"Captions transcribed via Groq Whisper for video {video.youtube_id}"
                )
                return True

        except Exception as e:
            logger.warning(
                f"Groq transcription failed for video {video.youtube_id}: {e}"
            )
            return False

    async def _fetch_chapters(
        self,
        enrichment: VideoEnrichment,
        video: Video
    ) -> bool:
        """Fetch chapters from YouTube or parse from description.

        Args:
            enrichment: VideoEnrichment to update
            video: Video to fetch chapters for

        Returns:
            True if chapters were found, False otherwise
        """
        try:
            extractor = ChapterExtractor()

            # Try YouTube native chapters first
            chapters = await extractor.fetch_youtube_chapters(video.youtube_id)

            if chapters:
                enrichment.chapters_json = chapters_to_json(chapters)
                enrichment.chapters_source = "youtube"
                logger.info(
                    f"Chapters fetched from YouTube for video {video.youtube_id}"
                )
                return True

            # Fall back to description parsing
            description = video.description or ""
            duration = video.duration or 0

            chapters = extractor.parse_description_chapters(description, duration)

            if chapters:
                enrichment.chapters_json = chapters_to_json(chapters)
                enrichment.chapters_source = "description"
                logger.info(
                    f"Chapters parsed from description for video {video.youtube_id}"
                )
                return True

            logger.info(f"No chapters found for video {video.youtube_id}")
            return False

        except Exception as e:
            logger.warning(
                f"Chapter extraction failed for video {video.youtube_id}: {e}"
            )
            return False

    async def _get_video(self, video_id: UUID) -> Optional[Video]:
        """Get video by ID.

        Args:
            video_id: Video UUID

        Returns:
            Video instance or None
        """
        stmt = select(Video).where(Video.id == video_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def enrich_video(
        self,
        video_id: UUID,
        retry: bool = False
    ) -> VideoEnrichment:
        """Enrich a video with captions and chapters.

        Main entry point for video enrichment.

        Args:
            video_id: Video UUID to enrich
            retry: If True, retry failed enrichments

        Returns:
            VideoEnrichment with updated status
        """
        # Get or create enrichment record
        enrichment = await self._get_or_create_enrichment(video_id, retry=retry)

        # Get video
        video = await self._get_video(video_id)
        if not video:
            enrichment.status = EnrichmentStatus.failed
            enrichment.error_message = "Video not found"
            await self._db.commit()
            return enrichment

        # Set status to processing
        enrichment.status = EnrichmentStatus.processing
        enrichment.progress_message = "Starting enrichment..."
        await self._db.flush()

        try:
            # Use semaphore to limit concurrent YouTube API calls across all workers
            # This prevents 429 rate limit errors while allowing other jobs to proceed
            async with _youtube_api_semaphore:
                logger.debug(f"Acquired YouTube API semaphore for video {video_id}")

                # Fetch captions - try YouTube first, then Groq Whisper fallback
                await self._update_progress(enrichment, "Fetching captions from YouTube...")
                # NOTE: import_stage/import_progress updates moved to enrich_video worker
                # to avoid duplicate updates and enable WebSocket broadcasting

                has_captions = await self._fetch_captions(enrichment, video)

                # If YouTube failed, try Groq Whisper as fallback (outside rate limit)
                if not has_captions:
                    await self._update_progress(enrichment, "YouTube unavailable, trying Groq Whisper...")
                    has_captions = await self._fetch_captions_groq(enrichment, video)

                # Short delay between API calls (yt-dlp has its own rate limiting)
                await asyncio.sleep(0.5)

                # Fetch chapters
                await self._update_progress(enrichment, "Extracting chapters...")
                # NOTE: import_stage/import_progress updates moved to enrich_video worker

                has_chapters = await self._fetch_chapters(enrichment, video)

                logger.debug(f"Released YouTube API semaphore for video {video_id}")

            # Generate chapters VTT if we have chapters
            if has_chapters and enrichment.chapters_json:
                await self._update_progress(enrichment, "Generating chapter markers...")
                chapters = [
                    Chapter(
                        title=ch["title"],
                        start=ch["start"],
                        end=ch["end"]
                    )
                    for ch in enrichment.chapters_json
                ]
                enrichment.chapters_vtt = chapters_to_vtt(chapters)

            # Determine final status
            # NOTE: import_stage/import_progress updates moved to enrich_video worker
            if has_captions:
                enrichment.status = EnrichmentStatus.completed
                enrichment.progress_message = None  # Clear progress on completion
            elif has_chapters:
                enrichment.status = EnrichmentStatus.partial
                enrichment.progress_message = None
            else:
                enrichment.status = EnrichmentStatus.failed
                enrichment.error_message = "No captions or chapters found"
                enrichment.progress_message = None

            await self._db.commit()

        except Exception as e:
            logger.error(f"Enrichment failed for video {video_id}: {e}")
            enrichment.status = EnrichmentStatus.failed
            enrichment.error_message = str(e)
            # NOTE: import_stage/import_progress error handling moved to enrich_video worker
            await self._db.commit()

        return enrichment
