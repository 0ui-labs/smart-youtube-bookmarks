"""VTT merging utilities for combining transcripts from multiple chunks."""
from dataclasses import dataclass
from typing import List

from .vtt_parser import parse_vtt, generate_vtt, VTTSegment


@dataclass
class TranscriptChunk:
    """A chunk of transcript with offset information."""
    vtt_content: str   # VTT content for this chunk
    start_offset: float  # Start time offset in seconds
    chunk_index: int    # Index in the sequence


def merge_vtt_files(vtt_contents: List[str], offsets: List[float]) -> str:
    """Merge multiple VTT files with timestamp offsets.

    Args:
        vtt_contents: List of VTT file contents
        offsets: Start time offset for each VTT file in seconds

    Returns:
        Merged VTT content with corrected timestamps
    """
    if not vtt_contents:
        return "WEBVTT\n"

    all_segments: List[VTTSegment] = []

    for vtt_content, offset in zip(vtt_contents, offsets):
        segments = parse_vtt(vtt_content)

        for segment in segments:
            all_segments.append(VTTSegment(
                start=segment.start + offset,
                end=segment.end + offset,
                text=segment.text
            ))

    # Sort by start time to ensure chronological order
    all_segments.sort(key=lambda s: s.start)

    return generate_vtt(all_segments)


def merge_transcripts(chunks: List[TranscriptChunk]) -> str:
    """Merge TranscriptChunk objects into single VTT.

    Args:
        chunks: List of TranscriptChunk objects

    Returns:
        Merged VTT content
    """
    if not chunks:
        return "WEBVTT\n"

    # Sort by chunk index
    sorted_chunks = sorted(chunks, key=lambda c: c.chunk_index)

    vtt_contents = [chunk.vtt_content for chunk in sorted_chunks]
    offsets = [chunk.start_offset for chunk in sorted_chunks]

    return merge_vtt_files(vtt_contents, offsets)
