"""Tests for chapter extraction functionality."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.enrichment.providers.chapter_extractor import (
    Chapter,
    ChapterExtractor,
    chapters_to_json,
    chapters_to_vtt,
)


class TestChapter:
    """Tests for Chapter dataclass."""

    def test_chapter_creation(self):
        """Chapter can be created with required fields."""
        chapter = Chapter(title="Introduction", start=0.0, end=120.0)

        assert chapter.title == "Introduction"
        assert chapter.start == 0.0
        assert chapter.end == 120.0

    def test_chapter_duration(self):
        """Chapter duration property."""
        chapter = Chapter(title="Test", start=60.0, end=180.0)
        assert chapter.duration == 120.0


class TestChapterExtractor:
    """Tests for ChapterExtractor class."""

    def test_extractor_initialization(self):
        """ChapterExtractor can be initialized."""
        extractor = ChapterExtractor()
        assert extractor is not None


class TestYouTubeChapterExtraction:
    """Tests for YouTube chapter extraction via yt-dlp."""

    @pytest.mark.asyncio
    async def test_fetch_youtube_chapters_success(self):
        """Fetch chapters from YouTube metadata."""
        extractor = ChapterExtractor()

        mock_info = {
            "chapters": [
                {"title": "Intro", "start_time": 0, "end_time": 60},
                {"title": "Main Content", "start_time": 60, "end_time": 300},
                {"title": "Conclusion", "start_time": 300, "end_time": 360},
            ]
        }

        with patch.object(
            extractor, "_extract_info", new_callable=AsyncMock
        ) as mock_extract:
            mock_extract.return_value = mock_info

            chapters = await extractor.fetch_youtube_chapters("dQw4w9WgXcQ")

        assert len(chapters) == 3
        assert chapters[0].title == "Intro"
        assert chapters[0].start == 0.0
        assert chapters[0].end == 60.0
        assert chapters[1].title == "Main Content"

    @pytest.mark.asyncio
    async def test_fetch_youtube_chapters_no_chapters(self):
        """Return None when video has no chapters."""
        extractor = ChapterExtractor()

        mock_info = {"chapters": None}

        with patch.object(
            extractor, "_extract_info", new_callable=AsyncMock
        ) as mock_extract:
            mock_extract.return_value = mock_info

            chapters = await extractor.fetch_youtube_chapters("dQw4w9WgXcQ")

        assert chapters is None

    @pytest.mark.asyncio
    async def test_fetch_youtube_chapters_empty_list(self):
        """Return None when chapters list is empty."""
        extractor = ChapterExtractor()

        mock_info = {"chapters": []}

        with patch.object(
            extractor, "_extract_info", new_callable=AsyncMock
        ) as mock_extract:
            mock_extract.return_value = mock_info

            chapters = await extractor.fetch_youtube_chapters("dQw4w9WgXcQ")

        assert chapters is None

    @pytest.mark.asyncio
    async def test_fetch_youtube_chapters_handles_error(self):
        """Return None on extraction error."""
        extractor = ChapterExtractor()

        with patch.object(
            extractor, "_extract_info", new_callable=AsyncMock
        ) as mock_extract:
            mock_extract.side_effect = Exception("yt-dlp failed")

            chapters = await extractor.fetch_youtube_chapters("invalid")

        assert chapters is None


class TestDescriptionChapterParsing:
    """Tests for parsing chapters from video description."""

    def test_parse_simple_timestamps(self):
        """Parse simple timestamp format."""
        extractor = ChapterExtractor()
        description = """0:00 Intro
2:30 Setup
10:15 Demo
15:00 Conclusion"""
        duration = 1200  # 20 minutes

        chapters = extractor.parse_description_chapters(description, duration)

        assert len(chapters) == 4
        assert chapters[0].title == "Intro"
        assert chapters[0].start == 0.0
        assert chapters[1].title == "Setup"
        assert chapters[1].start == 150.0  # 2:30
        assert chapters[2].title == "Demo"
        assert chapters[2].start == 615.0  # 10:15

    def test_parse_timestamps_with_dash(self):
        """Parse timestamps with dash separator."""
        extractor = ChapterExtractor()
        description = """0:00 - Intro
2:30 - Main Part
5:00 - End"""
        duration = 600

        chapters = extractor.parse_description_chapters(description, duration)

        assert len(chapters) == 3
        assert chapters[0].title == "Intro"
        assert chapters[1].title == "Main Part"

    def test_parse_timestamps_with_hours(self):
        """Parse timestamps with hours."""
        extractor = ChapterExtractor()
        description = """0:00:00 Intro
1:30:00 Part Two
2:00:00 Finale"""
        duration = 8000

        chapters = extractor.parse_description_chapters(description, duration)

        assert len(chapters) == 3
        assert chapters[1].start == 5400.0  # 1:30:00

    def test_parse_calculates_end_times(self):
        """End times are calculated from next chapter start."""
        extractor = ChapterExtractor()
        description = """0:00 First
5:00 Second
10:00 Third"""
        duration = 900  # 15 minutes

        chapters = extractor.parse_description_chapters(description, duration)

        assert chapters[0].end == 300.0  # Ends when "Second" starts
        assert chapters[1].end == 600.0  # Ends when "Third" starts
        assert chapters[2].end == 900.0  # Ends at video duration

    def test_parse_returns_none_for_no_timestamps(self):
        """Return None when no timestamps found."""
        extractor = ChapterExtractor()
        description = "This is a video about programming. No timestamps here!"
        duration = 600

        chapters = extractor.parse_description_chapters(description, duration)

        assert chapters is None

    def test_parse_returns_none_for_single_timestamp(self):
        """Return None when only one timestamp (not useful as chapters)."""
        extractor = ChapterExtractor()
        description = "0:00 Start"
        duration = 600

        chapters = extractor.parse_description_chapters(description, duration)

        assert chapters is None

    def test_parse_handles_various_formats(self):
        """Parse various timestamp formats."""
        extractor = ChapterExtractor()
        description = """00:00 Intro
02:30 Part 1
10:00 Part 2"""
        duration = 900

        chapters = extractor.parse_description_chapters(description, duration)

        assert len(chapters) == 3

    def test_parse_ignores_invalid_lines(self):
        """Ignore lines without valid timestamps."""
        extractor = ChapterExtractor()
        description = """Check out my channel!
0:00 Intro
Subscribe for more!
5:00 Content
Thanks for watching!
10:00 End"""
        duration = 900

        chapters = extractor.parse_description_chapters(description, duration)

        assert len(chapters) == 3


class TestChaptersToVtt:
    """Tests for VTT generation from chapters."""

    def test_chapters_to_vtt_basic(self):
        """Convert chapters to VTT format."""
        chapters = [
            Chapter(title="Intro", start=0.0, end=60.0),
            Chapter(title="Main", start=60.0, end=300.0),
        ]

        vtt = chapters_to_vtt(chapters)

        assert vtt.startswith("WEBVTT")
        assert "Intro" in vtt
        assert "Main" in vtt
        assert "00:00:00.000 --> 00:01:00.000" in vtt

    def test_chapters_to_vtt_empty(self):
        """Empty chapters produce minimal VTT."""
        vtt = chapters_to_vtt([])
        assert vtt == "WEBVTT\n"


class TestChaptersToJson:
    """Tests for JSON export of chapters."""

    def test_chapters_to_json_basic(self):
        """Convert chapters to JSON format."""
        chapters = [
            Chapter(title="Intro", start=0.0, end=60.0),
            Chapter(title="Main", start=60.0, end=300.0),
        ]

        json_data = chapters_to_json(chapters)

        assert len(json_data) == 2
        assert json_data[0]["title"] == "Intro"
        assert json_data[0]["start"] == 0.0
        assert json_data[0]["end"] == 60.0
        assert json_data[1]["title"] == "Main"

    def test_chapters_to_json_empty(self):
        """Empty chapters produce empty list."""
        json_data = chapters_to_json([])
        assert json_data == []
