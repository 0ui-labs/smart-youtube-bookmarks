"""Audio download and chunking for Groq Whisper transcription.

Groq has a 25MB file size limit, so we:
1. Download audio at 64kbps (small file size)
2. Split into 10-minute chunks (~4.8MB each at 64kbps)
"""
import asyncio
import tempfile
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from pydub import AudioSegment


# Constants for audio chunking
CHUNK_DURATION_MS = 10 * 60 * 1000  # 10 minutes in milliseconds
AUDIO_BITRATE = "64k"  # 64kbps for small file sizes
MAX_CHUNK_SIZE_BYTES = 20 * 1024 * 1024  # 20MB (safety margin under Groq's 25MB)


@dataclass
class AudioChunk:
    """Represents a chunk of audio for transcription."""
    path: Path  # Path to the chunk file
    start_time: float  # Start time in seconds
    end_time: float  # End time in seconds
    chunk_index: int  # Index in the sequence

    @property
    def duration(self) -> float:
        """Duration of the chunk in seconds."""
        return self.end_time - self.start_time


class AudioChunker:
    """Downloads YouTube audio and splits into chunks for transcription.

    Usage:
        async with AudioChunker() as chunker:
            audio_path = await chunker.download_audio("dQw4w9WgXcQ")
            chunks = chunker.split_audio(audio_path)
            # Process chunks...
        # Cleanup happens automatically
    """

    def __init__(self):
        self._temp_dir: Optional[str] = None

    async def __aenter__(self) -> "AudioChunker":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()

    def _ensure_temp_dir(self) -> str:
        """Ensure temporary directory exists."""
        if self._temp_dir is None:
            self._temp_dir = tempfile.mkdtemp(prefix="enrichment_audio_")
        return self._temp_dir

    async def download_audio(self, youtube_id: str) -> Path:
        """Download audio from YouTube.

        Args:
            youtube_id: YouTube video ID

        Returns:
            Path to the downloaded audio file
        """
        self._ensure_temp_dir()
        return await self._download_with_ytdlp(youtube_id)

    async def _download_with_ytdlp(self, youtube_id: str) -> Path:
        """Download audio using yt-dlp.

        Args:
            youtube_id: YouTube video ID

        Returns:
            Path to downloaded MP3 file
        """
        import yt_dlp

        url = f"https://www.youtube.com/watch?v={youtube_id}"
        output_template = str(Path(self._temp_dir) / "audio.%(ext)s")

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": AUDIO_BITRATE.rstrip("k"),
            }],
            "quiet": True,
            "no_warnings": True,
        }

        # Run in thread pool to avoid blocking (Python 3.9+)
        await asyncio.to_thread(self._download_sync, url, ydl_opts)

        # Find the downloaded file
        audio_path = Path(self._temp_dir) / "audio.mp3"
        if not audio_path.exists():
            raise FileNotFoundError(f"Downloaded audio not found at {audio_path}")

        return audio_path

    def _download_sync(self, url: str, ydl_opts: dict) -> None:
        """Synchronous yt-dlp download (runs in thread pool)."""
        import yt_dlp

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

    def split_audio(self, audio_path: Path) -> List[AudioChunk]:
        """Split audio file into chunks.

        Args:
            audio_path: Path to the audio file

        Returns:
            List of AudioChunk objects
        """
        audio = AudioSegment.from_mp3(str(audio_path))
        total_duration_ms = len(audio)

        chunks: List[AudioChunk] = []
        chunk_index = 0
        start_ms = 0

        while start_ms < total_duration_ms:
            end_ms = min(start_ms + CHUNK_DURATION_MS, total_duration_ms)

            # Extract chunk
            chunk_audio = audio[start_ms:end_ms]

            # Save chunk
            chunk_path = Path(self._temp_dir) / f"chunk_{chunk_index:04d}.mp3"
            chunk_audio.export(
                str(chunk_path),
                format="mp3",
                bitrate=AUDIO_BITRATE
            )

            # Create chunk object
            chunks.append(AudioChunk(
                path=chunk_path,
                start_time=start_ms / 1000,
                end_time=end_ms / 1000,
                chunk_index=chunk_index
            ))

            chunk_index += 1
            start_ms = end_ms

        return chunks

    def cleanup(self) -> None:
        """Remove temporary directory and all files."""
        if self._temp_dir is not None:
            shutil.rmtree(self._temp_dir, ignore_errors=True)
            self._temp_dir = None
