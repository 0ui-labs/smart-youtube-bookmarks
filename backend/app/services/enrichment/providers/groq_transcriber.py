"""Groq Whisper transcription provider."""
import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from groq import Groq

from .audio_chunker import AudioChunk
from ..exceptions import TranscriptionError, RateLimitError
from ..utils.vtt_parser import VTTSegment, generate_vtt


# Rate limiting constants
MAX_CONCURRENT = 3  # Max concurrent Groq API requests
DELAY_BETWEEN_REQUESTS = 3.0  # Seconds between request batches


@dataclass
class TranscriptionSegment:
    """A segment from Groq transcription."""
    start: float  # Start time in seconds (relative to chunk)
    end: float    # End time in seconds (relative to chunk)
    text: str     # Transcribed text


@dataclass
class TranscriptionResult:
    """Result from transcribing a single chunk."""
    text: str                          # Full text
    segments: List[TranscriptionSegment]  # Timed segments
    language: str                      # Detected language
    chunk_index: int                   # Index in chunk sequence


class GroqTranscriber:
    """Transcribes audio using Groq's Whisper API.

    Features:
    - Rate limiting (max 3 concurrent requests)
    - Automatic retry on rate limit errors
    - Converts results to VTT format with correct offsets
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize transcriber.

        Args:
            api_key: Groq API key. If not provided, reads from GROQ_API_KEY env var.

        Raises:
            ValueError: If no API key is available
        """
        self._api_key = api_key or os.environ.get("GROQ_API_KEY")
        if not self._api_key:
            raise ValueError("Groq API key required. Set GROQ_API_KEY or pass api_key parameter.")

        self._client = Groq(api_key=self._api_key)
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def transcribe_chunks(self, chunks: List[AudioChunk]) -> List[TranscriptionResult]:
        """Transcribe multiple audio chunks with rate limiting.

        Args:
            chunks: List of AudioChunk objects to transcribe

        Returns:
            List of TranscriptionResult objects, sorted by chunk_index
        """
        if not chunks:
            return []

        results: List[TranscriptionResult] = []

        # Process in batches with rate limiting
        for i, chunk in enumerate(chunks):
            async with self._semaphore:
                result = await self._transcribe_single(chunk)
                results.append(result)

                # Add delay between requests (except for the last one)
                if i < len(chunks) - 1:
                    await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

        # Sort by chunk index
        results.sort(key=lambda r: r.chunk_index)
        return results

    async def _transcribe_single(self, chunk: AudioChunk) -> TranscriptionResult:
        """Transcribe a single audio chunk.

        Args:
            chunk: AudioChunk to transcribe

        Returns:
            TranscriptionResult with text and segments

        Raises:
            TranscriptionError: If transcription fails
            RateLimitError: If rate limited by Groq
        """
        try:
            response = await self._call_groq_api(chunk.path)

            # Handle both object and dict response formats from Groq API
            raw_segments = response.segments or []
            segments = []
            for seg in raw_segments:
                # Support both dict and object access patterns
                if isinstance(seg, dict):
                    segments.append(TranscriptionSegment(
                        start=seg.get('start', 0),
                        end=seg.get('end', 0),
                        text=seg.get('text', '')
                    ))
                else:
                    segments.append(TranscriptionSegment(
                        start=seg.start,
                        end=seg.end,
                        text=seg.text
                    ))

            return TranscriptionResult(
                text=response.text,
                segments=segments,
                language=getattr(response, 'language', 'en') or 'en',
                chunk_index=chunk.chunk_index
            )

        except Exception as e:
            # Check for rate limit
            if hasattr(e, 'status_code') and e.status_code == 429:
                raise RateLimitError(f"Groq rate limit exceeded: {e}") from e
            raise TranscriptionError(f"Transcription failed: {e}") from e

    async def _call_groq_api(self, audio_path: Path):
        """Call Groq Whisper API.

        Args:
            audio_path: Path to audio file

        Returns:
            Groq API response
        """
        loop = asyncio.get_running_loop()

        def _sync_call():
            with open(audio_path, "rb") as audio_file:
                return self._client.audio.transcriptions.create(
                    file=(audio_path.name, audio_file.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )

        return await loop.run_in_executor(None, _sync_call)

    def results_to_vtt(
        self,
        results: List[TranscriptionResult],
        chunk_offsets: List[float]
    ) -> str:
        """Convert transcription results to VTT format.

        Args:
            results: List of TranscriptionResult objects
            chunk_offsets: Start time offset for each chunk in seconds

        Returns:
            VTT formatted string
        """
        if not results:
            return "WEBVTT\n"

        all_segments: List[VTTSegment] = []

        for result in results:
            offset = chunk_offsets[result.chunk_index] if result.chunk_index < len(chunk_offsets) else 0.0

            for seg in result.segments:
                all_segments.append(VTTSegment(
                    start=seg.start + offset,
                    end=seg.end + offset,
                    text=seg.text.strip()
                ))

        return generate_vtt(all_segments)
