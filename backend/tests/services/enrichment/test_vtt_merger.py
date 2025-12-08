"""Tests for VTT merging utilities."""

from app.services.enrichment.utils.vtt_merger import (
    TranscriptChunk,
    merge_transcripts,
    merge_vtt_files,
)


class TestTranscriptChunk:
    """Tests for TranscriptChunk dataclass."""

    def test_transcript_chunk_creation(self):
        """TranscriptChunk can be created."""
        chunk = TranscriptChunk(
            vtt_content="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello",
            start_offset=0.0,
            chunk_index=0,
        )

        assert chunk.vtt_content.startswith("WEBVTT")
        assert chunk.start_offset == 0.0
        assert chunk.chunk_index == 0


class TestMergeVttFiles:
    """Tests for merging VTT content."""

    def test_merge_single_vtt(self):
        """Merge single VTT returns same content."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world"""

        result = merge_vtt_files([vtt], [0.0])

        assert "WEBVTT" in result
        assert "Hello world" in result
        assert "00:00:00.000 --> 00:00:05.000" in result

    def test_merge_multiple_vtt_with_offset(self):
        """Merge multiple VTT files with offsets."""
        vtt1 = """WEBVTT

00:00:00.000 --> 00:00:05.000
First chunk"""

        vtt2 = """WEBVTT

00:00:00.000 --> 00:00:05.000
Second chunk"""

        # Second chunk starts at 10 minutes (600 seconds)
        result = merge_vtt_files([vtt1, vtt2], [0.0, 600.0])

        assert "First chunk" in result
        assert "Second chunk" in result
        # Second chunk should have offset timestamps
        assert "00:10:00.000 --> 00:10:05.000" in result

    def test_merge_preserves_order(self):
        """Merged VTT preserves chronological order."""
        vtt1 = """WEBVTT

00:00:00.000 --> 00:00:05.000
First"""

        vtt2 = """WEBVTT

00:00:00.000 --> 00:00:05.000
Second"""

        vtt3 = """WEBVTT

00:00:00.000 --> 00:00:05.000
Third"""

        result = merge_vtt_files([vtt1, vtt2, vtt3], [0.0, 600.0, 1200.0])

        # Find positions
        first_pos = result.find("First")
        second_pos = result.find("Second")
        third_pos = result.find("Third")

        assert first_pos < second_pos < third_pos

    def test_merge_empty_list(self):
        """Merge empty list returns minimal VTT."""
        result = merge_vtt_files([], [])

        assert result == "WEBVTT\n"

    def test_merge_handles_multiple_cues_per_chunk(self):
        """Merge handles chunks with multiple cues."""
        vtt1 = """WEBVTT

00:00:00.000 --> 00:00:05.000
Line one

00:00:05.000 --> 00:00:10.000
Line two"""

        vtt2 = """WEBVTT

00:00:00.000 --> 00:00:05.000
Line three"""

        result = merge_vtt_files([vtt1, vtt2], [0.0, 600.0])

        assert "Line one" in result
        assert "Line two" in result
        assert "Line three" in result


class TestMergeTranscripts:
    """Tests for merging TranscriptChunk objects."""

    def test_merge_transcripts_basic(self):
        """Merge TranscriptChunk objects."""
        chunks = [
            TranscriptChunk(
                vtt_content="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nChunk 1",
                start_offset=0.0,
                chunk_index=0,
            ),
            TranscriptChunk(
                vtt_content="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nChunk 2",
                start_offset=600.0,
                chunk_index=1,
            ),
        ]

        result = merge_transcripts(chunks)

        assert "Chunk 1" in result
        assert "Chunk 2" in result

    def test_merge_transcripts_reorders_by_index(self):
        """Merge reorders chunks by index if out of order."""
        chunks = [
            TranscriptChunk(
                vtt_content="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nSecond",
                start_offset=600.0,
                chunk_index=1,
            ),
            TranscriptChunk(
                vtt_content="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nFirst",
                start_offset=0.0,
                chunk_index=0,
            ),
        ]

        result = merge_transcripts(chunks)

        first_pos = result.find("First")
        second_pos = result.find("Second")
        assert first_pos < second_pos

    def test_merge_transcripts_empty(self):
        """Merge empty chunks returns minimal VTT."""
        result = merge_transcripts([])

        assert result == "WEBVTT\n"

    def test_merge_transcripts_uses_offset(self):
        """Merge uses start_offset for timestamp calculation."""
        chunks = [
            TranscriptChunk(
                vtt_content="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nAt start",
                start_offset=0.0,
                chunk_index=0,
            ),
            TranscriptChunk(
                vtt_content="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nAt 20 min",
                start_offset=1200.0,  # 20 minutes
                chunk_index=1,
            ),
        ]

        result = merge_transcripts(chunks)

        # Second chunk should be at 20:00
        assert "00:20:00.000 --> 00:20:05.000" in result
