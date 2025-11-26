"""Tests for audio chunking functionality."""
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
import tempfile
import os

from app.services.enrichment.providers.audio_chunker import (
    AudioChunker,
    AudioChunk,
    CHUNK_DURATION_MS,
    AUDIO_BITRATE,
    MAX_CHUNK_SIZE_BYTES,
)


class TestAudioChunk:
    """Tests for AudioChunk dataclass."""

    def test_audio_chunk_creation(self):
        """AudioChunk can be created with required fields."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(b"fake audio data")
            path = Path(f.name)

        try:
            chunk = AudioChunk(
                path=path,
                start_time=0.0,
                end_time=600.0,
                chunk_index=0
            )

            assert chunk.path == path
            assert chunk.start_time == 0.0
            assert chunk.end_time == 600.0
            assert chunk.chunk_index == 0
        finally:
            path.unlink()

    def test_audio_chunk_duration(self):
        """AudioChunk duration property works correctly."""
        chunk = AudioChunk(
            path=Path("/tmp/test.mp3"),
            start_time=600.0,
            end_time=1200.0,
            chunk_index=1
        )

        assert chunk.duration == 600.0


class TestAudioChunkerConstants:
    """Tests for audio chunker constants."""

    def test_chunk_duration_is_10_minutes(self):
        """Chunk duration is 10 minutes (600,000 ms)."""
        assert CHUNK_DURATION_MS == 10 * 60 * 1000  # 10 minutes in ms

    def test_audio_bitrate_is_64k(self):
        """Audio bitrate is 64kbps for small file sizes."""
        assert AUDIO_BITRATE == "64k"

    def test_max_chunk_size_under_groq_limit(self):
        """Max chunk size is under Groq's 25MB limit (using 20MB for safety)."""
        assert MAX_CHUNK_SIZE_BYTES < 25 * 1024 * 1024
        assert MAX_CHUNK_SIZE_BYTES == 20 * 1024 * 1024


class TestAudioChunkerDownload:
    """Tests for audio download functionality."""

    def test_chunker_initialization(self):
        """AudioChunker can be initialized."""
        chunker = AudioChunker()
        assert chunker._temp_dir is None

    @pytest.mark.asyncio
    async def test_download_audio_creates_temp_dir(self):
        """Download creates temporary directory."""
        chunker = AudioChunker()

        with patch.object(chunker, '_download_with_ytdlp', new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = Path("/tmp/test.mp3")

            await chunker.download_audio("dQw4w9WgXcQ")

            assert chunker._temp_dir is not None

    @pytest.mark.asyncio
    async def test_download_audio_returns_path(self):
        """Download returns path to audio file."""
        chunker = AudioChunker()

        with patch.object(chunker, '_download_with_ytdlp', new_callable=AsyncMock) as mock_dl:
            expected_path = Path("/tmp/audio.mp3")
            mock_dl.return_value = expected_path

            result = await chunker.download_audio("dQw4w9WgXcQ")

            assert result == expected_path

    @pytest.mark.asyncio
    async def test_download_audio_uses_correct_format(self):
        """Download requests audio-only format."""
        chunker = AudioChunker()

        with patch.object(chunker, '_download_with_ytdlp', new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = Path("/tmp/test.mp3")

            await chunker.download_audio("dQw4w9WgXcQ")

            # Verify yt-dlp was called
            mock_dl.assert_called_once()

    def test_cleanup_removes_temp_dir(self):
        """Cleanup removes temporary directory."""
        chunker = AudioChunker()

        # Create a real temp dir
        import tempfile
        chunker._temp_dir = tempfile.mkdtemp()
        temp_path = chunker._temp_dir

        # Create a file in it
        test_file = Path(temp_path) / "test.mp3"
        test_file.touch()

        chunker.cleanup()

        assert not os.path.exists(temp_path)
        assert chunker._temp_dir is None

    def test_cleanup_handles_missing_temp_dir(self):
        """Cleanup handles case where temp dir doesn't exist."""
        chunker = AudioChunker()
        chunker._temp_dir = None

        # Should not raise
        chunker.cleanup()

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """AudioChunker works as async context manager."""
        with patch.object(AudioChunker, 'cleanup') as mock_cleanup:
            async with AudioChunker() as chunker:
                assert isinstance(chunker, AudioChunker)

            mock_cleanup.assert_called_once()


class TestAudioChunkerSplit:
    """Tests for audio splitting functionality."""

    @pytest.mark.asyncio
    async def test_split_short_audio_returns_single_chunk(self):
        """Audio shorter than chunk duration returns single chunk."""
        chunker = AudioChunker()

        # Mock pydub AudioSegment
        mock_audio = MagicMock()
        mock_audio.__len__ = MagicMock(return_value=5 * 60 * 1000)  # 5 minutes

        with patch('app.services.enrichment.providers.audio_chunker.AudioSegment') as mock_as:
            mock_as.from_mp3.return_value = mock_audio
            mock_audio.__getitem__ = MagicMock(return_value=mock_audio)
            mock_audio.export = MagicMock()

            with tempfile.TemporaryDirectory() as temp_dir:
                chunker._temp_dir = temp_dir
                audio_path = Path(temp_dir) / "test.mp3"
                audio_path.touch()

                chunks = chunker.split_audio(audio_path)

                assert len(chunks) == 1
                assert chunks[0].start_time == 0.0
                assert chunks[0].chunk_index == 0

    @pytest.mark.asyncio
    async def test_split_long_audio_creates_multiple_chunks(self):
        """Audio longer than chunk duration creates multiple chunks."""
        chunker = AudioChunker()

        # Mock 25-minute audio (should create 3 chunks)
        mock_audio = MagicMock()
        mock_audio.__len__ = MagicMock(return_value=25 * 60 * 1000)  # 25 minutes

        chunk_mock = MagicMock()
        chunk_mock.export = MagicMock()

        with patch('app.services.enrichment.providers.audio_chunker.AudioSegment') as mock_as:
            mock_as.from_mp3.return_value = mock_audio
            mock_audio.__getitem__ = MagicMock(return_value=chunk_mock)

            with tempfile.TemporaryDirectory() as temp_dir:
                chunker._temp_dir = temp_dir
                audio_path = Path(temp_dir) / "test.mp3"
                audio_path.touch()

                chunks = chunker.split_audio(audio_path)

                assert len(chunks) == 3
                assert chunks[0].start_time == 0.0
                assert chunks[1].start_time == 600.0  # 10 min
                assert chunks[2].start_time == 1200.0  # 20 min

    def test_split_calculates_correct_timestamps(self):
        """Split calculates correct start/end timestamps."""
        chunker = AudioChunker()

        # Mock 35-minute audio
        mock_audio = MagicMock()
        mock_audio.__len__ = MagicMock(return_value=35 * 60 * 1000)

        chunk_mock = MagicMock()
        chunk_mock.export = MagicMock()

        with patch('app.services.enrichment.providers.audio_chunker.AudioSegment') as mock_as:
            mock_as.from_mp3.return_value = mock_audio
            mock_audio.__getitem__ = MagicMock(return_value=chunk_mock)

            with tempfile.TemporaryDirectory() as temp_dir:
                chunker._temp_dir = temp_dir
                audio_path = Path(temp_dir) / "test.mp3"
                audio_path.touch()

                chunks = chunker.split_audio(audio_path)

                # 4 chunks: 0-10, 10-20, 20-30, 30-35
                assert len(chunks) == 4
                assert chunks[0].end_time == 600.0
                assert chunks[1].end_time == 1200.0
                assert chunks[2].end_time == 1800.0
                assert chunks[3].end_time == 2100.0  # 35 min


class TestAudioChunkerIntegration:
    """Integration tests for AudioChunker (with mocked external deps)."""

    @pytest.mark.asyncio
    async def test_full_workflow(self):
        """Test complete download and split workflow."""
        with patch('app.services.enrichment.providers.audio_chunker.AudioSegment') as mock_as:
            # Mock 15-minute audio
            mock_audio = MagicMock()
            mock_audio.__len__ = MagicMock(return_value=15 * 60 * 1000)

            chunk_mock = MagicMock()
            chunk_mock.export = MagicMock()

            mock_as.from_mp3.return_value = mock_audio
            mock_audio.__getitem__ = MagicMock(return_value=chunk_mock)

            async with AudioChunker() as chunker:
                with patch.object(chunker, '_download_with_ytdlp', new_callable=AsyncMock) as mock_dl:
                    # Create a real temp file for the download mock to return
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                        f.write(b"fake")
                        mock_dl.return_value = Path(f.name)

                        audio_path = await chunker.download_audio("dQw4w9WgXcQ")
                        chunks = chunker.split_audio(audio_path)

                        assert len(chunks) == 2
                        assert all(isinstance(c, AudioChunk) for c in chunks)

                        # Clean up
                        Path(f.name).unlink(missing_ok=True)
