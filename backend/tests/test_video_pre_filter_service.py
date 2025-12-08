"""
Tests for VideoPreFilterService.

TDD RED Phase - these tests define the expected behavior
of the AI-based video pre-filtering service.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.clients.youtube import VideoSearchResult


@pytest.fixture
def sample_videos() -> list[VideoSearchResult]:
    """Create sample video search results for testing."""
    return [
        VideoSearchResult(
            youtube_id="video1",
            title="Python Tutorial for Beginners - Complete Course",
            description="Learn Python programming from scratch in this comprehensive tutorial.",
            channel_id="channel1",
            channel_name="Programming Academy",
            thumbnail_url="https://example.com/thumb1.jpg",
            published_at=datetime(2024, 1, 1, tzinfo=UTC),
        ),
        VideoSearchResult(
            youtube_id="video2",
            title="TOP 10 PYTHON TRICKS YOU WON'T BELIEVE!!!",
            description="Click here to see amazing Python tricks! Subscribe now!",
            channel_id="channel2",
            channel_name="Clickbait Tech",
            thumbnail_url="https://example.com/thumb2.jpg",
            published_at=datetime(2024, 1, 2, tzinfo=UTC),
        ),
        VideoSearchResult(
            youtube_id="video3",
            title="Advanced Python: Decorators and Metaclasses",
            description="Deep dive into Python's advanced features for experienced developers.",
            channel_id="channel3",
            channel_name="Code Masters",
            thumbnail_url="https://example.com/thumb3.jpg",
            published_at=datetime(2024, 1, 3, tzinfo=UTC),
        ),
    ]


@pytest.fixture
def mock_subscription() -> MagicMock:
    """Create a mock subscription object."""
    mock_sub = MagicMock()
    mock_sub.id = uuid4()
    mock_sub.keywords = ["Python", "tutorial"]
    mock_sub.filters = {"ai_filter": {"enabled": True}}
    return mock_sub


class TestFilterVideosBatch:
    """Test batch filtering of videos."""

    async def test_filter_videos_returns_relevant_indices(
        self, sample_videos: list[VideoSearchResult], mock_subscription: MagicMock
    ):
        """AI filter should return only videos marked as relevant."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        # Mock Gemini response
        mock_response = MagicMock()
        mock_response.text = '{"relevant": [0, 2], "reasoning": "Videos 0 and 2 are educational Python tutorials. Video 1 appears to be clickbait."}'

        # Mock the entire genai client
        with patch("app.services.video_pre_filter_service.genai") as mock_genai:
            mock_client = MagicMock()
            mock_aio = AsyncMock()
            mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_client.aio = mock_aio
            mock_genai.Client.return_value = mock_client

            service = VideoPreFilterService()
            result = await service.filter_videos(sample_videos, mock_subscription)

        # Should only return videos at indices 0 and 2
        assert len(result) == 2
        assert result[0].youtube_id == "video1"
        assert result[1].youtube_id == "video3"

    async def test_filter_videos_empty_list(self, mock_subscription: MagicMock):
        """Empty input should return empty output without calling AI."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        # Mock the genai client
        with patch("app.services.video_pre_filter_service.genai") as mock_genai:
            mock_client = MagicMock()
            mock_aio = AsyncMock()
            mock_aio.models.generate_content = AsyncMock()
            mock_client.aio = mock_aio
            mock_genai.Client.return_value = mock_client

            service = VideoPreFilterService()
            result = await service.filter_videos([], mock_subscription)

        # Should return empty list without calling AI
        assert result == []
        mock_aio.models.generate_content.assert_not_called()

    async def test_filter_videos_ai_failure_returns_all(
        self, sample_videos: list[VideoSearchResult], mock_subscription: MagicMock
    ):
        """If AI fails, fallback should return all videos (fail-open)."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        # Mock the genai client to raise an exception
        with patch("app.services.video_pre_filter_service.genai") as mock_genai:
            mock_client = MagicMock()
            mock_aio = AsyncMock()
            mock_aio.models.generate_content = AsyncMock(
                side_effect=Exception("API Error")
            )
            mock_client.aio = mock_aio
            mock_genai.Client.return_value = mock_client

            service = VideoPreFilterService()
            result = await service.filter_videos(sample_videos, mock_subscription)

        # Should return all videos as fallback (fallback uses keyword matching)
        # All videos contain "Python" which is in mock_subscription.keywords
        assert len(result) == 3


class TestParseResponse:
    """Test JSON response parsing."""

    async def test_parse_batch_response_json(self):
        """Valid JSON response should be parsed correctly."""
        from app.services.video_pre_filter_service import (
            FilterResult,
            VideoPreFilterService,
        )

        service = VideoPreFilterService()
        response = (
            '{"relevant": [0, 2, 4], "reasoning": "These are educational videos."}'
        )

        result = service._parse_batch_response(response)

        assert isinstance(result, FilterResult)
        assert result.relevant_indices == [0, 2, 4]
        assert "educational" in result.reasoning

    async def test_parse_batch_response_with_markdown_codeblock(self):
        """JSON wrapped in markdown code blocks should be parsed."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        response = """```json
{"relevant": [1, 3], "reasoning": "Selected videos"}
```"""

        result = service._parse_batch_response(response)

        assert result.relevant_indices == [1, 3]

    async def test_parse_batch_response_fallback_extracts_numbers(self):
        """Invalid JSON should fall back to extracting numbers."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        response = "Videos 0, 2, and 5 are relevant."

        result = service._parse_batch_response(response)

        assert result.relevant_indices == [0, 2, 5]
        assert "Could not parse JSON" in result.reasoning


class TestBuildPrompt:
    """Test prompt construction."""

    async def test_build_prompt_includes_keywords(
        self, sample_videos: list[VideoSearchResult], mock_subscription: MagicMock
    ):
        """Prompt should include subscription keywords."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        prompt = service._build_batch_filter_prompt(sample_videos, mock_subscription)

        assert "Python" in prompt
        assert "tutorial" in prompt

    async def test_build_prompt_includes_video_info(
        self, sample_videos: list[VideoSearchResult], mock_subscription: MagicMock
    ):
        """Prompt should include video titles and descriptions."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        prompt = service._build_batch_filter_prompt(sample_videos, mock_subscription)

        assert "Python Tutorial for Beginners" in prompt
        assert "Video 0" in prompt
        assert "Video 1" in prompt
        assert "Video 2" in prompt


class TestFallbackFilter:
    """Test fallback keyword-based filtering."""

    async def test_fallback_filters_by_keyword(
        self, sample_videos: list[VideoSearchResult], mock_subscription: MagicMock
    ):
        """Fallback should filter by keyword matching."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        mock_subscription.keywords = ["Advanced"]

        result = service.filter_videos_fallback(sample_videos, mock_subscription)

        # Only video3 has "Advanced" in title
        assert len(result) == 1
        assert result[0].youtube_id == "video3"

    async def test_fallback_no_keywords_returns_all(
        self, sample_videos: list[VideoSearchResult], mock_subscription: MagicMock
    ):
        """Fallback with no keywords should return all videos."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        mock_subscription.keywords = None

        result = service.filter_videos_fallback(sample_videos, mock_subscription)

        assert len(result) == 3

    async def test_fallback_case_insensitive(
        self, sample_videos: list[VideoSearchResult], mock_subscription: MagicMock
    ):
        """Fallback keyword matching should be case-insensitive."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        mock_subscription.keywords = ["PYTHON"]

        result = service.filter_videos_fallback(sample_videos, mock_subscription)

        # All videos mention Python/python
        assert len(result) == 3


class TestDetailAnalysis:
    """Test detail analysis with transcript."""

    @pytest.fixture
    def sample_video(self) -> VideoSearchResult:
        """Create a single sample video for detail analysis."""
        return VideoSearchResult(
            youtube_id="detail_video",
            title="Complete Python Course - Learn Programming",
            description="A comprehensive Python programming course for all levels.",
            channel_id="channel1",
            channel_name="Code Academy",
            thumbnail_url="https://example.com/thumb.jpg",
            published_at=datetime(2024, 1, 1, tzinfo=UTC),
        )

    async def test_analyze_with_transcript_returns_import(
        self, sample_video: VideoSearchResult, mock_subscription: MagicMock
    ):
        """Detail analysis should return IMPORT recommendation for good videos."""
        from app.services.video_pre_filter_service import (
            DetailAnalysisResult,
            VideoPreFilterService,
        )

        # Mock AI response for a good video
        mock_response = MagicMock()
        mock_response.text = """{
            "relevance": 9,
            "quality": 8,
            "clickbait": 9,
            "recommendation": "IMPORT",
            "reasoning": "High quality educational content about Python programming."
        }"""

        with patch("app.services.video_pre_filter_service.genai") as mock_genai:
            mock_client = MagicMock()
            mock_aio = AsyncMock()
            mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_client.aio = mock_aio
            mock_genai.Client.return_value = mock_client

            service = VideoPreFilterService()
            result = await service.analyze_with_transcript(
                video=sample_video,
                subscription=mock_subscription,
                transcript="Welcome to this Python course...",
                comments=["Great tutorial!", "Very helpful"],
            )

        assert isinstance(result, DetailAnalysisResult)
        assert result.recommendation == "IMPORT"
        assert result.relevance_score == 9.0
        assert result.quality_score == 8.0
        assert result.clickbait_score == 9.0

    async def test_analyze_with_transcript_returns_skip_for_clickbait(
        self, sample_video: VideoSearchResult, mock_subscription: MagicMock
    ):
        """Detail analysis should return SKIP for clickbait videos."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        mock_response = MagicMock()
        mock_response.text = """{
            "relevance": 3,
            "quality": 2,
            "clickbait": 2,
            "recommendation": "SKIP",
            "reasoning": "Video appears to be clickbait with misleading title."
        }"""

        with patch("app.services.video_pre_filter_service.genai") as mock_genai:
            mock_client = MagicMock()
            mock_aio = AsyncMock()
            mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_client.aio = mock_aio
            mock_genai.Client.return_value = mock_client

            service = VideoPreFilterService()
            result = await service.analyze_with_transcript(
                video=sample_video,
                subscription=mock_subscription,
            )

        assert result.recommendation == "SKIP"
        assert result.clickbait_score == 2.0

    async def test_analyze_with_transcript_handles_ai_failure(
        self, sample_video: VideoSearchResult, mock_subscription: MagicMock
    ):
        """Detail analysis should return default IMPORT on AI failure."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        with patch("app.services.video_pre_filter_service.genai") as mock_genai:
            mock_client = MagicMock()
            mock_aio = AsyncMock()
            mock_aio.models.generate_content = AsyncMock(
                side_effect=Exception("API Error")
            )
            mock_client.aio = mock_aio
            mock_genai.Client.return_value = mock_client

            service = VideoPreFilterService()
            result = await service.analyze_with_transcript(
                video=sample_video,
                subscription=mock_subscription,
            )

        # Should default to IMPORT on failure (fail-open)
        assert result.recommendation == "IMPORT"
        assert (
            "failed" in result.reasoning.lower() or "error" in result.reasoning.lower()
        )

    async def test_analyze_with_transcript_without_transcript(
        self, sample_video: VideoSearchResult, mock_subscription: MagicMock
    ):
        """Detail analysis should work without transcript."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        mock_response = MagicMock()
        mock_response.text = """{
            "relevance": 7,
            "quality": 6,
            "clickbait": 8,
            "recommendation": "IMPORT",
            "reasoning": "Based on title and description, appears relevant."
        }"""

        with patch("app.services.video_pre_filter_service.genai") as mock_genai:
            mock_client = MagicMock()
            mock_aio = AsyncMock()
            mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_client.aio = mock_aio
            mock_genai.Client.return_value = mock_client

            service = VideoPreFilterService()
            result = await service.analyze_with_transcript(
                video=sample_video,
                subscription=mock_subscription,
                transcript=None,  # No transcript available
                comments=None,
            )

        assert result.recommendation == "IMPORT"


class TestParseDetailResponse:
    """Test detail analysis response parsing."""

    async def test_parse_detail_response_valid_json(self):
        """Valid JSON should be parsed correctly."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        response = """{
            "relevance": 8,
            "quality": 7,
            "clickbait": 9,
            "recommendation": "IMPORT",
            "reasoning": "Good educational content"
        }"""

        result = service._parse_detail_response(response)

        assert result.relevance_score == 8.0
        assert result.quality_score == 7.0
        assert result.clickbait_score == 9.0
        assert result.recommendation == "IMPORT"
        assert result.reasoning == "Good educational content"

    async def test_parse_detail_response_with_markdown(self):
        """JSON in markdown code block should be parsed."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        response = """```json
{
    "relevance": 6,
    "quality": 5,
    "clickbait": 7,
    "recommendation": "SKIP",
    "reasoning": "Not relevant"
}
```"""

        result = service._parse_detail_response(response)

        assert result.recommendation == "SKIP"
        assert result.relevance_score == 6.0

    async def test_parse_detail_response_invalid_returns_default(self):
        """Invalid JSON should return default IMPORT."""
        from app.services.video_pre_filter_service import VideoPreFilterService

        service = VideoPreFilterService()
        response = "This is not valid JSON at all"

        result = service._parse_detail_response(response)

        assert result.recommendation == "IMPORT"
        assert result.relevance_score == 5.0
        assert "Could not parse" in result.reasoning
