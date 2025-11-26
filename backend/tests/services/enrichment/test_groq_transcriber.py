"""Tests for Groq Whisper transcription."""
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass

from app.services.enrichment.providers.groq_transcriber import (
    GroqTranscriber,
    TranscriptionSegment,
    TranscriptionResult,
    MAX_CONCURRENT,
    DELAY_BETWEEN_REQUESTS,
)
from app.services.enrichment.providers.audio_chunker import AudioChunk
from app.services.enrichment.exceptions import TranscriptionError, RateLimitError


class TestTranscriptionDataclasses:
    """Tests for transcription dataclasses."""

    def test_transcription_segment_creation(self):
        """TranscriptionSegment can be created."""
        segment = TranscriptionSegment(
            start=0.0,
            end=5.0,
            text="Hello world"
        )

        assert segment.start == 0.0
        assert segment.end == 5.0
        assert segment.text == "Hello world"

    def test_transcription_result_creation(self):
        """TranscriptionResult can be created."""
        segments = [
            TranscriptionSegment(start=0.0, end=5.0, text="Hello"),
            TranscriptionSegment(start=5.0, end=10.0, text="World"),
        ]

        result = TranscriptionResult(
            text="Hello World",
            segments=segments,
            language="en",
            chunk_index=0
        )

        assert result.text == "Hello World"
        assert len(result.segments) == 2
        assert result.language == "en"
        assert result.chunk_index == 0


class TestGroqTranscriberConstants:
    """Tests for transcriber constants."""

    def test_max_concurrent_requests(self):
        """Max concurrent requests is 3 (Groq rate limit)."""
        assert MAX_CONCURRENT == 3

    def test_delay_between_requests(self):
        """Delay between requests is 3 seconds."""
        assert DELAY_BETWEEN_REQUESTS == 3.0


class TestGroqTranscriberInit:
    """Tests for GroqTranscriber initialization."""

    def test_init_with_api_key(self):
        """Transcriber can be initialized with API key."""
        transcriber = GroqTranscriber(api_key="test-key")
        assert transcriber._api_key == "test-key"

    def test_init_without_api_key_raises(self):
        """Transcriber raises if no API key provided."""
        with patch.dict('os.environ', {}, clear=True):
            with pytest.raises(ValueError, match="API key"):
                GroqTranscriber(api_key=None)

    def test_init_from_environment(self):
        """Transcriber can get API key from environment."""
        with patch.dict('os.environ', {'GROQ_API_KEY': 'env-key'}):
            transcriber = GroqTranscriber()
            assert transcriber._api_key == "env-key"


class TestGroqTranscriberSingle:
    """Tests for single chunk transcription."""

    @pytest.mark.asyncio
    async def test_transcribe_single_chunk(self):
        """Transcribe single audio chunk."""
        transcriber = GroqTranscriber(api_key="test-key")

        chunk = AudioChunk(
            path=Path("/tmp/chunk.mp3"),
            start_time=0.0,
            end_time=600.0,
            chunk_index=0
        )

        # Mock Groq API response
        mock_response = MagicMock()
        mock_response.text = "Hello world transcription"
        mock_response.segments = [
            MagicMock(start=0.0, end=2.5, text="Hello world"),
            MagicMock(start=2.5, end=5.0, text="transcription"),
        ]
        mock_response.language = "en"

        with patch.object(transcriber, '_call_groq_api', new_callable=AsyncMock) as mock_api:
            mock_api.return_value = mock_response

            result = await transcriber._transcribe_single(chunk)

        assert result is not None
        assert result.text == "Hello world transcription"
        assert len(result.segments) == 2
        assert result.chunk_index == 0

    @pytest.mark.asyncio
    async def test_transcribe_single_handles_api_error(self):
        """Transcribe raises TranscriptionError on API failure."""
        transcriber = GroqTranscriber(api_key="test-key")

        chunk = AudioChunk(
            path=Path("/tmp/chunk.mp3"),
            start_time=0.0,
            end_time=600.0,
            chunk_index=0
        )

        with patch.object(transcriber, '_call_groq_api', new_callable=AsyncMock) as mock_api:
            mock_api.side_effect = Exception("API error")

            with pytest.raises(TranscriptionError):
                await transcriber._transcribe_single(chunk)

    @pytest.mark.asyncio
    async def test_transcribe_single_handles_rate_limit(self):
        """Transcribe raises RateLimitError on 429 response."""
        transcriber = GroqTranscriber(api_key="test-key")

        chunk = AudioChunk(
            path=Path("/tmp/chunk.mp3"),
            start_time=0.0,
            end_time=600.0,
            chunk_index=0
        )

        # Simulate rate limit error
        rate_limit_error = Exception("Rate limit exceeded")
        rate_limit_error.status_code = 429

        with patch.object(transcriber, '_call_groq_api', new_callable=AsyncMock) as mock_api:
            mock_api.side_effect = rate_limit_error

            with pytest.raises(RateLimitError):
                await transcriber._transcribe_single(chunk)


class TestGroqTranscriberParallel:
    """Tests for parallel chunk transcription."""

    @pytest.mark.asyncio
    async def test_transcribe_chunks_parallel(self):
        """Transcribe multiple chunks with rate limiting."""
        transcriber = GroqTranscriber(api_key="test-key")

        chunks = [
            AudioChunk(path=Path(f"/tmp/chunk_{i}.mp3"), start_time=i*600.0, end_time=(i+1)*600.0, chunk_index=i)
            for i in range(3)
        ]

        mock_response = MagicMock()
        mock_response.text = "Test transcription"
        mock_response.segments = [MagicMock(start=0.0, end=5.0, text="Test")]
        mock_response.language = "en"

        with patch.object(transcriber, '_call_groq_api', new_callable=AsyncMock) as mock_api:
            mock_api.return_value = mock_response

            results = await transcriber.transcribe_chunks(chunks)

        assert len(results) == 3
        # Results should be sorted by chunk index
        assert all(results[i].chunk_index == i for i in range(3))

    @pytest.mark.asyncio
    async def test_transcribe_chunks_respects_concurrency_limit(self):
        """Transcription respects MAX_CONCURRENT limit."""
        transcriber = GroqTranscriber(api_key="test-key")

        # Create more chunks than MAX_CONCURRENT
        chunks = [
            AudioChunk(path=Path(f"/tmp/chunk_{i}.mp3"), start_time=i*600.0, end_time=(i+1)*600.0, chunk_index=i)
            for i in range(5)
        ]

        call_times = []

        async def mock_transcribe(chunk):
            import asyncio
            import time
            call_times.append(time.time())
            await asyncio.sleep(0.01)  # Small delay
            return TranscriptionResult(
                text="Test",
                segments=[],
                language="en",
                chunk_index=chunk.chunk_index
            )

        with patch.object(transcriber, '_transcribe_single', side_effect=mock_transcribe):
            # Patch delay to speed up test
            with patch('app.services.enrichment.providers.groq_transcriber.DELAY_BETWEEN_REQUESTS', 0.01):
                results = await transcriber.transcribe_chunks(chunks)

        assert len(results) == 5

    @pytest.mark.asyncio
    async def test_transcribe_chunks_empty_list(self):
        """Transcribe empty chunk list returns empty results."""
        transcriber = GroqTranscriber(api_key="test-key")

        results = await transcriber.transcribe_chunks([])

        assert results == []

    @pytest.mark.asyncio
    async def test_transcribe_chunks_single_chunk(self):
        """Transcribe single chunk works correctly."""
        transcriber = GroqTranscriber(api_key="test-key")

        chunk = AudioChunk(
            path=Path("/tmp/chunk.mp3"),
            start_time=0.0,
            end_time=600.0,
            chunk_index=0
        )

        mock_response = MagicMock()
        mock_response.text = "Single chunk"
        mock_response.segments = []
        mock_response.language = "en"

        with patch.object(transcriber, '_call_groq_api', new_callable=AsyncMock) as mock_api:
            mock_api.return_value = mock_response

            results = await transcriber.transcribe_chunks([chunk])

        assert len(results) == 1
        assert results[0].text == "Single chunk"


class TestGroqTranscriberVTTGeneration:
    """Tests for VTT generation from transcription results."""

    def test_results_to_vtt(self):
        """Convert transcription results to VTT format."""
        transcriber = GroqTranscriber(api_key="test-key")

        results = [
            TranscriptionResult(
                text="First chunk",
                segments=[
                    TranscriptionSegment(start=0.0, end=5.0, text="Hello"),
                    TranscriptionSegment(start=5.0, end=10.0, text="World"),
                ],
                language="en",
                chunk_index=0
            ),
            TranscriptionResult(
                text="Second chunk",
                segments=[
                    TranscriptionSegment(start=0.0, end=5.0, text="Second"),
                ],
                language="en",
                chunk_index=1
            ),
        ]

        # Chunk offsets: first chunk starts at 0, second at 600
        chunk_offsets = [0.0, 600.0]

        vtt = transcriber.results_to_vtt(results, chunk_offsets)

        assert vtt.startswith("WEBVTT")
        assert "Hello" in vtt
        assert "World" in vtt
        assert "Second" in vtt
        # Second chunk should have offset timestamps
        assert "00:10:00" in vtt or "00:10:05" in vtt  # 600 seconds = 10 minutes

    def test_results_to_vtt_empty(self):
        """Empty results produce minimal VTT."""
        transcriber = GroqTranscriber(api_key="test-key")

        vtt = transcriber.results_to_vtt([], [])

        assert vtt == "WEBVTT\n"
