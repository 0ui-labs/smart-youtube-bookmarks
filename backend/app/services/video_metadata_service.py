"""Video metadata service."""

import logging
import re
from datetime import datetime

from isodate import parse_duration

logger = logging.getLogger(__name__)


def parse_youtube_duration(iso_duration: str | None) -> int | None:
    """Parse ISO 8601 duration to seconds."""
    if not iso_duration:
        return None
    try:
        duration_obj = parse_duration(iso_duration)
        return int(duration_obj.total_seconds())
    except (ValueError, AttributeError, TypeError) as e:
        # ValueError: Invalid ISO 8601 format
        # AttributeError: duration_obj is None or missing total_seconds()
        # TypeError: Unexpected type passed to parse_duration
        logger.debug(f"Invalid duration format '{iso_duration}': {e}")
        return None


def parse_youtube_timestamp(timestamp: str | None) -> datetime | None:
    """Parse YouTube API timestamp to timezone-aware datetime."""
    if not timestamp:
        return None
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as e:
        logger.debug(f"Invalid timestamp format '{timestamp}': {e}")
        return None


def extract_youtube_id(url: str) -> str:
    """
    Extract YouTube video ID from URL.

    Supports formats:
    - youtube.com/watch?v=VIDEO_ID
    - youtu.be/VIDEO_ID
    - youtube.com/embed/VIDEO_ID
    - m.youtube.com/watch?v=VIDEO_ID

    Args:
        url: YouTube video URL

    Returns:
        str: 11-character YouTube video ID

    Raises:
        ValueError: If video ID cannot be extracted
    """
    patterns = [
        r"(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})",
        r"youtube\.com\/embed\/([a-zA-Z0-9_-]{11})",
        r"m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})",
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    raise ValueError("Could not extract YouTube video ID from URL")
