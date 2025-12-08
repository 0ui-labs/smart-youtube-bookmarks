"""VTT (WebVTT) parsing and generation utilities."""

import re
from dataclasses import dataclass


@dataclass
class VTTSegment:
    """A single VTT cue segment."""

    start: float  # Start time in seconds
    end: float  # End time in seconds
    text: str  # Cue text content

    @property
    def duration(self) -> float:
        """Duration of the segment in seconds."""
        return self.end - self.start


# Regex pattern for timestamp line: "00:00:00.000 --> 00:00:05.000"
TIMESTAMP_LINE_PATTERN = re.compile(
    r"^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*"
    r"(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})"
)


def _timestamp_to_seconds(timestamp: str) -> float:
    """Convert VTT timestamp to seconds.

    Args:
        timestamp: VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm)

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


def _seconds_to_timestamp(seconds: float) -> str:
    """Convert seconds to VTT timestamp.

    Args:
        seconds: Time in seconds

    Returns:
        VTT timestamp (HH:MM:SS.mmm)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60

    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def parse_vtt(vtt_content: str) -> list[VTTSegment]:
    """Parse VTT content into segments.

    Args:
        vtt_content: Raw VTT file content

    Returns:
        List of VTTSegment objects
    """
    segments: list[VTTSegment] = []

    # Skip header check
    if not vtt_content.strip().startswith("WEBVTT"):
        return segments

    lines = vtt_content.split("\n")

    current_start: float | None = None
    current_end: float | None = None
    current_text_lines: list[str] = []
    in_style_block = False

    for line in lines:
        line_stripped = line.strip()

        # Skip STYLE blocks
        if line_stripped == "STYLE":
            in_style_block = True
            continue
        if in_style_block:
            if line_stripped == "":
                in_style_block = False
            continue

        # Check if this is a timestamp line
        match = TIMESTAMP_LINE_PATTERN.match(line_stripped)
        if match:
            # Save previous cue if we have one
            if current_start is not None and current_text_lines:
                text = "\n".join(current_text_lines).strip()
                if text:
                    segments.append(
                        VTTSegment(start=current_start, end=current_end, text=text)
                    )

            # Start new cue
            current_start = _timestamp_to_seconds(match.group(1))
            current_end = _timestamp_to_seconds(match.group(2))
            current_text_lines = []
        elif current_start is not None:
            # This is cue text (could be empty line ending the cue or text content)
            if line_stripped == "":
                # Empty line - save cue and reset
                if current_text_lines:
                    text = "\n".join(current_text_lines).strip()
                    if text:
                        segments.append(
                            VTTSegment(start=current_start, end=current_end, text=text)
                        )
                current_start = None
                current_end = None
                current_text_lines = []
            else:
                # Add text line (but not cue identifiers or header lines)
                if (
                    not line_stripped.startswith("WEBVTT")
                    and not line_stripped.startswith("Kind:")
                    and not line_stripped.startswith("Language:")
                ):
                    current_text_lines.append(line_stripped)

    # Don't forget the last cue
    if current_start is not None and current_text_lines:
        text = "\n".join(current_text_lines).strip()
        if text:
            segments.append(VTTSegment(start=current_start, end=current_end, text=text))

    return segments


def generate_vtt(segments: list[VTTSegment]) -> str:
    """Generate VTT content from segments.

    Args:
        segments: List of VTTSegment objects

    Returns:
        VTT file content as string
    """
    lines = ["WEBVTT", ""]

    for segment in segments:
        start_ts = _seconds_to_timestamp(segment.start)
        end_ts = _seconds_to_timestamp(segment.end)

        lines.append(f"{start_ts} --> {end_ts}")
        lines.append(segment.text)
        lines.append("")

    return "\n".join(lines)


def vtt_to_text(vtt_content: str) -> str:
    """Convert VTT to plain text, removing duplicates from rolling captions.

    YouTube auto-captions often repeat text as it scrolls. This function
    removes these duplicates to produce clean text.

    Args:
        vtt_content: Raw VTT file content

    Returns:
        Plain text extracted from captions
    """
    segments = parse_vtt(vtt_content)

    if not segments:
        return ""

    # Remove duplicate text from rolling captions
    seen_texts: list[str] = []
    result_parts: list[str] = []

    for segment in segments:
        text = segment.text.strip()

        # Check if this text starts with something we've already seen
        is_continuation = False
        for seen in reversed(seen_texts[-5:]):  # Check last 5 segments
            if text.startswith(seen) and len(text) > len(seen):
                # This is a continuation - extract only the new part
                new_part = text[len(seen) :].strip()
                if new_part:
                    result_parts.append(new_part)
                is_continuation = True
                break
            elif seen.startswith(text):
                # This is a subset of something we've seen - skip it
                is_continuation = True
                break

        if not is_continuation:
            result_parts.append(text)

        seen_texts.append(text)

    return " ".join(result_parts)
