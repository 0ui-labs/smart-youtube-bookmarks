"""Timestamp utility functions for enrichment service."""

import re

from .vtt_parser import VTTSegment, generate_vtt, parse_vtt


def seconds_to_vtt_time(seconds: float) -> str:
    """Convert seconds to VTT timestamp format (HH:MM:SS.mmm).

    Args:
        seconds: Time in seconds

    Returns:
        VTT timestamp string
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60

    # Format with exactly 3 decimal places
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def vtt_time_to_seconds(timestamp: str) -> float:
    """Convert VTT timestamp to seconds.

    Supports both HH:MM:SS.mmm and MM:SS.mmm formats.

    Args:
        timestamp: VTT timestamp string

    Returns:
        Time in seconds
    """
    parts = timestamp.replace(",", ".").split(":")

    if len(parts) == 3:
        # HH:MM:SS.mmm
        hours, minutes, seconds = parts
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    elif len(parts) == 2:
        # MM:SS.mmm
        minutes, seconds = parts
        return int(minutes) * 60 + float(seconds)
    else:
        raise ValueError(f"Invalid timestamp format: {timestamp}")


def offset_timestamps(vtt_content: str, offset_seconds: float) -> str:
    """Offset all timestamps in a VTT file.

    Args:
        vtt_content: Raw VTT file content
        offset_seconds: Seconds to add to all timestamps

    Returns:
        VTT content with offset timestamps. Timestamps are clamped to >= 0.0,
        and segments where end <= start after clamping are dropped.
    """
    if offset_seconds == 0.0:
        return vtt_content

    segments = parse_vtt(vtt_content)

    offset_segments = []
    for seg in segments:
        # Apply offset and clamp to non-negative
        start = max(0.0, seg.start + offset_seconds)
        end = max(0.0, seg.end + offset_seconds)

        # Drop segments where end is not after start (invalid after clamping)
        if end <= start:
            continue

        offset_segments.append(VTTSegment(start=start, end=end, text=seg.text))

    return generate_vtt(offset_segments)


# Pattern for description timestamps: "0:00", "2:30", "1:30:00", etc.
DESCRIPTION_TIMESTAMP_PATTERN = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?")


def parse_description_timestamp(text: str) -> float | None:
    """Parse a timestamp from video description text.

    Handles formats like:
    - "0:00"
    - "2:30"
    - "1:30:00"
    - "0:00 Intro" (extracts just the timestamp)

    Args:
        text: Text potentially containing a timestamp

    Returns:
        Time in seconds, or None if no valid timestamp found
    """
    if not text:
        return None

    text = text.strip()
    match = DESCRIPTION_TIMESTAMP_PATTERN.match(text)

    if not match:
        return None

    first, second, third = match.groups()

    try:
        if third is not None:
            # HH:MM:SS format
            return int(first) * 3600 + int(second) * 60 + int(third)
        else:
            # MM:SS or M:SS format
            return int(first) * 60 + int(second)
    except ValueError:
        return None


def format_display_time(seconds: int) -> str:
    """Format seconds as human-readable time for display.

    Args:
        seconds: Time in seconds

    Returns:
        Formatted time string (e.g., "2:05" or "1:01:01")
    """
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"
