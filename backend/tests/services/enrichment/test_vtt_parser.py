"""Tests for VTT parsing utilities."""

from app.services.enrichment.utils.vtt_parser import (
    VTTSegment,
    generate_vtt,
    parse_vtt,
    vtt_to_text,
)


class TestParseVtt:
    """Tests for VTT parsing."""

    def test_parse_simple_vtt(self):
        """Parse a simple VTT file with one cue."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world"""
        segments = parse_vtt(vtt)

        assert len(segments) == 1
        assert segments[0].start == 0.0
        assert segments[0].end == 5.0
        assert segments[0].text == "Hello world"

    def test_parse_multiple_cues(self):
        """Parse VTT with multiple cues."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
First line

00:00:05.000 --> 00:00:10.000
Second line"""
        segments = parse_vtt(vtt)

        assert len(segments) == 2
        assert segments[0].text == "First line"
        assert segments[1].text == "Second line"
        assert segments[1].start == 5.0

    def test_parse_multiline_cue(self):
        """Parse cue with multiple lines of text."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Line one
Line two"""
        segments = parse_vtt(vtt)

        assert len(segments) == 1
        assert segments[0].text == "Line one\nLine two"

    def test_parse_vtt_with_hours(self):
        """Parse timestamps with hours."""
        vtt = """WEBVTT

01:30:00.000 --> 01:30:05.500
After 90 minutes"""
        segments = parse_vtt(vtt)

        assert len(segments) == 1
        assert segments[0].start == 5400.0  # 90 * 60
        assert segments[0].end == 5405.5

    def test_parse_vtt_with_cue_identifiers(self):
        """Parse VTT with optional cue identifiers."""
        vtt = """WEBVTT

cue-1
00:00:00.000 --> 00:00:05.000
First cue

cue-2
00:00:05.000 --> 00:00:10.000
Second cue"""
        segments = parse_vtt(vtt)

        assert len(segments) == 2
        assert segments[0].text == "First cue"
        assert segments[1].text == "Second cue"

    def test_parse_empty_vtt(self):
        """Parse empty VTT file."""
        vtt = "WEBVTT\n"
        segments = parse_vtt(vtt)

        assert len(segments) == 0

    def test_parse_vtt_with_styling(self):
        """Parse VTT with STYLE block (should be ignored)."""
        vtt = """WEBVTT

STYLE
::cue {
  color: white;
}

00:00:00.000 --> 00:00:05.000
Styled text"""
        segments = parse_vtt(vtt)

        assert len(segments) == 1
        assert segments[0].text == "Styled text"

    def test_parse_youtube_auto_caption_format(self):
        """Parse YouTube's auto-generated caption format."""
        vtt = """WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.500 align:start position:0%
hello and welcome

00:00:02.500 --> 00:00:05.000 align:start position:0%
to this video"""
        segments = parse_vtt(vtt)

        assert len(segments) == 2
        assert segments[0].text == "hello and welcome"
        assert segments[1].text == "to this video"


class TestGenerateVtt:
    """Tests for VTT generation."""

    def test_generate_simple_vtt(self):
        """Generate VTT from segments."""
        segments = [
            VTTSegment(start=0.0, end=5.0, text="Hello world"),
        ]
        vtt = generate_vtt(segments)

        assert vtt.startswith("WEBVTT")
        assert "00:00:00.000 --> 00:00:05.000" in vtt
        assert "Hello world" in vtt

    def test_generate_vtt_with_hours(self):
        """Generate VTT with hour timestamps."""
        segments = [
            VTTSegment(start=5400.0, end=5405.5, text="At 90 minutes"),
        ]
        vtt = generate_vtt(segments)

        assert "01:30:00.000 --> 01:30:05.500" in vtt

    def test_generate_vtt_multiple_segments(self):
        """Generate VTT with multiple segments."""
        segments = [
            VTTSegment(start=0.0, end=5.0, text="First"),
            VTTSegment(start=5.0, end=10.0, text="Second"),
        ]
        vtt = generate_vtt(segments)

        assert "First" in vtt
        assert "Second" in vtt
        assert "00:00:05.000 --> 00:00:10.000" in vtt

    def test_generate_empty_segments(self):
        """Generate VTT from empty segment list."""
        vtt = generate_vtt([])

        assert vtt == "WEBVTT\n"

    def test_roundtrip_parse_generate(self):
        """Parsing and regenerating should produce equivalent VTT."""
        original_segments = [
            VTTSegment(start=0.0, end=5.0, text="Hello"),
            VTTSegment(start=5.0, end=10.0, text="World"),
        ]

        vtt = generate_vtt(original_segments)
        parsed_segments = parse_vtt(vtt)

        assert len(parsed_segments) == len(original_segments)
        for orig, parsed in zip(original_segments, parsed_segments, strict=False):
            assert orig.start == parsed.start
            assert orig.end == parsed.end
            assert orig.text == parsed.text


class TestVttToText:
    """Tests for VTT to plain text conversion."""

    def test_vtt_to_text_simple(self):
        """Convert VTT to plain text."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
Hello

00:00:05.000 --> 00:00:10.000
world"""
        text = vtt_to_text(vtt)

        assert "Hello" in text
        assert "world" in text

    def test_vtt_to_text_removes_duplicates(self):
        """Remove duplicate text from consecutive cues (YouTube auto-captions)."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:02.000
Hello world

00:00:02.000 --> 00:00:04.000
Hello world how are you

00:00:04.000 --> 00:00:06.000
how are you today"""
        text = vtt_to_text(vtt)

        # Should not have repeated "Hello world" multiple times
        assert text.count("Hello world") == 1

    def test_vtt_to_text_joins_sentences(self):
        """Join text from multiple cues into readable text."""
        vtt = """WEBVTT

00:00:00.000 --> 00:00:05.000
This is

00:00:05.000 --> 00:00:10.000
a complete sentence."""
        text = vtt_to_text(vtt)

        # Text should flow naturally
        assert "This is" in text
        assert "a complete sentence." in text

    def test_vtt_to_text_empty(self):
        """Convert empty VTT to empty text."""
        vtt = "WEBVTT\n"
        text = vtt_to_text(vtt)

        assert text == ""


class TestVTTSegment:
    """Tests for VTTSegment dataclass."""

    def test_segment_creation(self):
        """VTTSegment can be created with required fields."""
        segment = VTTSegment(start=0.0, end=5.0, text="Hello")

        assert segment.start == 0.0
        assert segment.end == 5.0
        assert segment.text == "Hello"

    def test_segment_duration(self):
        """VTTSegment duration property."""
        segment = VTTSegment(start=10.0, end=15.5, text="Test")

        assert segment.duration == 5.5
