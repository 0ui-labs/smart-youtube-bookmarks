"""Chapter extraction from YouTube videos."""

import asyncio
import logging
import re
from dataclasses import dataclass

import yt_dlp
from yt_dlp.utils import DownloadError, ExtractorError

logger = logging.getLogger(__name__)


@dataclass
class Chapter:
    """A chapter in a video."""

    title: str
    start: float  # Start time in seconds
    end: float  # End time in seconds

    @property
    def duration(self) -> float:
        """Duration of the chapter in seconds."""
        return self.end - self.start


class ChapterExtractor:
    """Extracts chapters from YouTube videos.

    Supports two methods:
    1. YouTube native chapters (from video metadata)
    2. Parsing timestamps from video description
    """

    def __init__(self):
        """Initialize the chapter extractor."""
        self._ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
        }

    async def fetch_youtube_chapters(self, youtube_id: str) -> list[Chapter] | None:
        """Fetch chapters from YouTube video metadata.

        Args:
            youtube_id: YouTube video ID

        Returns:
            List of Chapter objects, or None if no chapters found
        """
        try:
            info = await self._extract_info(youtube_id)

            if not info:
                return None

            chapters_data = info.get("chapters")
            if not chapters_data:
                return None

            chapters = [
                Chapter(
                    title=ch.get("title", f"Chapter {i + 1}"),
                    start=float(ch.get("start_time", 0)),
                    end=float(ch.get("end_time", 0)),
                )
                for i, ch in enumerate(chapters_data)
            ]

            return chapters if chapters else None

        except (KeyboardInterrupt, SystemExit):
            # Re-raise critical exceptions - don't swallow these
            raise
        except (DownloadError, ExtractorError) as e:
            # yt-dlp specific errors (video unavailable, geo-blocked, etc.)
            logger.warning(
                f"fetch_youtube_chapters: yt-dlp error for youtube_id={youtube_id}: {e}"
            )
            return None
        except (KeyError, TypeError, ValueError) as e:
            # Parsing/data structure errors from chapter extraction
            logger.warning(
                f"fetch_youtube_chapters: parsing error for youtube_id={youtube_id}: {e}",
                exc_info=True,
            )
            return None
        except Exception as e:
            # Unexpected errors - log full stacktrace for debugging
            logger.exception(
                f"fetch_youtube_chapters: unexpected error for youtube_id={youtube_id}: {e}"
            )
            return None

    async def _extract_info(self, youtube_id: str) -> dict | None:
        """Extract video info using yt-dlp.

        Args:
            youtube_id: YouTube video ID

        Returns:
            Video info dict or None on error
        """
        url = f"https://www.youtube.com/watch?v={youtube_id}"

        def _sync_extract():
            with yt_dlp.YoutubeDL(self._ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        # Run in thread pool to avoid blocking (Python 3.9+)
        return await asyncio.to_thread(_sync_extract)

    def parse_description_chapters(
        self, description: str, duration: float
    ) -> list[Chapter] | None:
        """Parse chapters from video description timestamps.

        Supports formats:
        - 0:00 Title
        - 00:00 Title
        - 0:00:00 Title
        - 0:00 - Title

        Args:
            description: Video description text
            duration: Total video duration in seconds

        Returns:
            List of Chapter objects, or None if not enough timestamps found
        """
        # Pattern matches timestamps like 0:00, 00:00, 0:00:00, 00:00:00
        # Dash character class includes: hyphen-minus (-), en dash (–), em dash (—)
        timestamp_pattern = r"^(\d{1,2}:\d{2}(?::\d{2})?)\s*[\-\u2013\u2014]?\s*(.+)$"

        chapters: list[tuple] = []

        for line in description.split("\n"):
            line = line.strip()
            if not line:
                continue

            match = re.match(timestamp_pattern, line)
            if match:
                timestamp_str = match.group(1)
                title = match.group(2).strip()

                seconds = self._parse_timestamp(timestamp_str)
                if seconds is not None:
                    chapters.append((seconds, title))

        # Need at least 2 timestamps to form chapters
        if len(chapters) < 2:
            return None

        # Sort by timestamp
        chapters.sort(key=lambda x: x[0])

        # Convert to Chapter objects with end times
        result: list[Chapter] = []
        for i, (start, title) in enumerate(chapters):
            if i < len(chapters) - 1:
                end = chapters[i + 1][0]
            else:
                end = duration

            result.append(Chapter(title=title, start=start, end=end))

        return result

    def _parse_timestamp(self, timestamp: str) -> float | None:
        """Parse timestamp string to seconds.

        Args:
            timestamp: Timestamp string (e.g., "1:30", "01:30", "1:30:00")

        Returns:
            Time in seconds, or None if invalid
        """
        parts = timestamp.split(":")

        try:
            if len(parts) == 2:
                # MM:SS format
                minutes, seconds = int(parts[0]), int(parts[1])
                return minutes * 60 + seconds
            elif len(parts) == 3:
                # HH:MM:SS format
                hours, minutes, seconds = int(parts[0]), int(parts[1]), int(parts[2])
                return hours * 3600 + minutes * 60 + seconds
        except ValueError:
            pass

        return None


def chapters_to_vtt(chapters: list[Chapter]) -> str:
    """Convert chapters to VTT format for chapter markers.

    Args:
        chapters: List of Chapter objects

    Returns:
        VTT formatted string
    """
    if not chapters:
        return "WEBVTT\n"

    lines = ["WEBVTT", ""]

    for chapter in chapters:
        start_time = _format_vtt_time(chapter.start)
        end_time = _format_vtt_time(chapter.end)

        lines.append(f"{start_time} --> {end_time}")
        lines.append(chapter.title)
        lines.append("")

    return "\n".join(lines)


def chapters_to_json(chapters: list[Chapter]) -> list[dict]:
    """Convert chapters to JSON-serializable format.

    Args:
        chapters: List of Chapter objects

    Returns:
        List of chapter dictionaries
    """
    return [
        {"title": chapter.title, "start": chapter.start, "end": chapter.end}
        for chapter in chapters
    ]


def _format_vtt_time(seconds: float) -> str:
    """Format seconds as VTT timestamp.

    Args:
        seconds: Time in seconds

    Returns:
        VTT timestamp string (HH:MM:SS.mmm)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)

    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
