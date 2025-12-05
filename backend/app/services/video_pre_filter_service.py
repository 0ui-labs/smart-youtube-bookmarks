"""
Video Pre-Filter Service using AI for relevance analysis.

This service uses Gemini AI to filter video search results based on
subscription criteria, removing irrelevant or low-quality content
before import.
"""

import json
import logging
import re
from dataclasses import dataclass

from aiolimiter import AsyncLimiter
from google import genai
from google.genai import types

from app.clients.youtube import VideoSearchResult
from app.core.config import settings
from app.models.subscription import Subscription

logger = logging.getLogger(__name__)

# Rate limiter: 100 requests per minute for Gemini API
# This prevents overwhelming the API and hitting rate limits
_gemini_rate_limiter = AsyncLimiter(100, 60)


@dataclass
class FilterResult:
    """Result from batch filtering analysis."""

    relevant_indices: list[int]
    reasoning: str


@dataclass
class DetailAnalysisResult:
    """Result from detailed video analysis with transcript."""

    relevance_score: float  # 1-10, how relevant to subscription criteria
    quality_score: float  # 1-10, estimated content quality
    clickbait_score: float  # 1-10, where 1=clickbait, 10=genuine
    recommendation: str  # "IMPORT" or "SKIP"
    reasoning: str  # Explanation for the decision


class VideoPreFilterService:
    """
    Service for AI-based video pre-filtering.

    Uses Gemini to analyze video metadata (title, description, channel)
    and determine relevance to subscription criteria. Filters out
    clickbait, irrelevant content, and low-quality videos.

    Example:
        >>> service = VideoPreFilterService()
        >>> filtered = await service.filter_videos(videos, subscription)
        >>> # filtered contains only relevant videos
    """

    def __init__(self, model: str = "gemini-2.0-flash"):
        """
        Initialize the pre-filter service.

        Args:
            model: Gemini model to use for analysis
        """
        if not settings.gemini_api_key:
            logger.warning(
                "Gemini API key not configured. AI filtering will use fallback."
            )
            self._client = None
            self.model = None
        else:
            self._client = genai.Client(api_key=settings.gemini_api_key)
            self.model = model

    async def filter_videos(
        self,
        videos: list[VideoSearchResult],
        subscription: Subscription,
    ) -> list[VideoSearchResult]:
        """
        Batch-analyze videos and filter based on subscription criteria.

        Uses AI to determine which videos are relevant to the subscription's
        keywords and filters. Falls back to keyword matching if AI fails.

        Args:
            videos: List of video search results to filter
            subscription: Subscription with filter criteria

        Returns:
            Filtered list containing only relevant videos

        Example:
            >>> videos = [video1, video2, video3]
            >>> filtered = await service.filter_videos(videos, subscription)
            >>> len(filtered) <= len(videos)
            True
        """
        if not videos:
            return []

        # Use fallback if no API key configured
        if not self._client:
            logger.info("No Gemini client, using fallback filter")
            return self.filter_videos_fallback(videos, subscription)

        prompt = self._build_batch_filter_prompt(videos, subscription)

        try:
            # Apply rate limiting before API call
            async with _gemini_rate_limiter:
                aclient = self._client.aio
                response = await aclient.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,  # Low temperature for consistent results
                    ),
                )

            result = self._parse_batch_response(response.text)

            filtered = [videos[i] for i in result.relevant_indices if i < len(videos)]

            logger.info(
                f"AI filter: {len(filtered)}/{len(videos)} videos passed "
                f"(reasoning: {result.reasoning[:100]}...)"
            )

            return filtered

        except Exception as e:
            logger.warning(f"AI filter failed, using fallback: {e}")
            return self.filter_videos_fallback(videos, subscription)

    def _build_batch_filter_prompt(
        self,
        videos: list[VideoSearchResult],
        subscription: Subscription,
    ) -> str:
        """
        Build prompt for batch video filtering.

        Creates a prompt that instructs the AI to analyze multiple videos
        and determine which are relevant to the subscription criteria.

        Args:
            videos: Videos to analyze
            subscription: Subscription with criteria

        Returns:
            Formatted prompt string
        """
        videos_text = "\n\n".join(
            [
                f"Video {i}:\n"
                f"Titel: {v.title}\n"
                f"Kanal: {v.channel_name}\n"
                f"Beschreibung: {v.description[:500] if v.description else 'Keine Beschreibung'}"
                for i, v in enumerate(videos)
            ]
        )

        # Build criteria from subscription
        criteria = []
        if subscription.keywords:
            criteria.append(f"Thema/Keywords: {', '.join(subscription.keywords)}")

        filters = subscription.filters or {}
        if cf_filters := filters.get("custom_fields"):
            for cf in cf_filters:
                if cf.get("field_id") == "quality":
                    criteria.append(
                        "Qualität: Hochwertiger, informativer Content erwartet"
                    )

        criteria_text = (
            "\n".join(f"- {c}" for c in criteria)
            if criteria
            else "- Keine spezifischen Kriterien"
        )

        return f"""Analysiere diese YouTube-Videos und bestimme welche relevant sind.

KRITERIEN FÜR RELEVANZ:
{criteria_text}

VIDEOS:
{videos_text}

ANLEITUNG:
1. Prüfe für jedes Video ob es zu den Kriterien passt
2. Clickbait oder irreführende Titel = nicht relevant
3. Im Zweifel: Lieber inkludieren (false positives sind ok)

ANTWORT-FORMAT:
Antworte NUR mit einem JSON-Objekt:
{{"relevant": [0, 2, 5], "reasoning": "Video 0 behandelt..., Video 1 ist Clickbait, ..."}}

Nur das JSON, kein anderer Text."""

    def _parse_batch_response(self, response: str) -> FilterResult:
        """
        Parse AI response to extract relevant video indices.

        Handles JSON responses, including those wrapped in markdown code blocks.
        Falls back to regex extraction if JSON parsing fails.

        Args:
            response: Raw response text from AI

        Returns:
            FilterResult with indices and reasoning
        """
        try:
            # Remove markdown code blocks if present
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```\w*\n?", "", cleaned)
                cleaned = re.sub(r"\n?```$", "", cleaned)

            data = json.loads(cleaned)
            return FilterResult(
                relevant_indices=data.get("relevant", []),
                reasoning=data.get("reasoning", ""),
            )
        except json.JSONDecodeError:
            # Fallback: Extract numbers from response
            matches = re.findall(r"\d+", response)
            return FilterResult(
                relevant_indices=[int(m) for m in matches],
                reasoning="Could not parse JSON response",
            )

    def filter_videos_fallback(
        self,
        videos: list[VideoSearchResult],
        subscription: Subscription,
    ) -> list[VideoSearchResult]:
        """
        Fallback filter using simple keyword matching.

        Used when AI filtering is unavailable or fails. Matches
        subscription keywords against video titles and descriptions.

        Args:
            videos: Videos to filter
            subscription: Subscription with keywords

        Returns:
            Videos matching at least one keyword (or all if no keywords)
        """
        if not subscription.keywords:
            return videos

        keywords_lower = [k.lower() for k in subscription.keywords]

        return [
            v
            for v in videos
            if any(
                kw in v.title.lower() or kw in (v.description or "").lower()
                for kw in keywords_lower
            )
        ]

    async def analyze_with_transcript(
        self,
        video: VideoSearchResult,
        subscription: Subscription,
        transcript: str | None = None,
        comments: list[str] | None = None,
    ) -> DetailAnalysisResult:
        """
        Perform detailed analysis of a video using transcript and comments.

        This method provides deeper analysis than batch filtering,
        using the video transcript and top comments to assess quality
        and relevance more accurately.

        Args:
            video: Video to analyze
            subscription: Subscription with criteria
            transcript: Video transcript text (optional)
            comments: Top comments from the video (optional)

        Returns:
            DetailAnalysisResult with scores and recommendation

        Example:
            >>> result = await service.analyze_with_transcript(
            ...     video=video,
            ...     subscription=sub,
            ...     transcript="Welcome to this tutorial...",
            ... )
            >>> if result.recommendation == "IMPORT":
            ...     # Import the video
        """
        # Use fallback if no API key configured
        if not self._client:
            logger.info("No Gemini client, returning default IMPORT")
            return DetailAnalysisResult(
                relevance_score=5.0,
                quality_score=5.0,
                clickbait_score=5.0,
                recommendation="IMPORT",
                reasoning="AI analysis unavailable, defaulting to import",
            )

        prompt = self._build_detail_prompt(video, subscription, transcript, comments)

        try:
            # Apply rate limiting before API call
            async with _gemini_rate_limiter:
                aclient = self._client.aio
                response = await aclient.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                    ),
                )

            result = self._parse_detail_response(response.text)

            logger.info(
                f"Detail analysis for {video.youtube_id}: "
                f"{result.recommendation} (relevance={result.relevance_score}, "
                f"quality={result.quality_score}, clickbait={result.clickbait_score})"
            )

            return result

        except Exception as e:
            logger.warning(f"Detail analysis failed for {video.youtube_id}: {e}")
            return DetailAnalysisResult(
                relevance_score=5.0,
                quality_score=5.0,
                clickbait_score=5.0,
                recommendation="IMPORT",
                reasoning=f"Analysis failed: {e}",
            )

    def _build_detail_prompt(
        self,
        video: VideoSearchResult,
        subscription: Subscription,
        transcript: str | None,
        comments: list[str] | None,
    ) -> str:
        """
        Build prompt for detailed video analysis.

        Args:
            video: Video to analyze
            subscription: Subscription with criteria
            transcript: Video transcript (optional)
            comments: Top comments (optional)

        Returns:
            Formatted prompt string
        """
        transcript_text = transcript[:3000] if transcript else "Nicht verfügbar"
        comments_text = "\n".join(comments[:10]) if comments else "Keine Kommentare"

        keywords_text = (
            ", ".join(subscription.keywords)
            if subscription.keywords
            else "Keine spezifischen Keywords"
        )

        return f"""Analysiere dieses YouTube-Video im Detail.

TITEL: {video.title}
KANAL: {video.channel_name}
BESCHREIBUNG: {video.description or "Keine Beschreibung"}

TRANSCRIPT (Auszug):
{transcript_text}

TOP-KOMMENTARE:
{comments_text}

SUBSCRIPTION-KRITERIEN:
- Keywords: {keywords_text}

BEWERTE (1-10, wobei 10 = beste):
1. Relevanz zum Thema
2. Geschätzte Content-Qualität
3. Clickbait-Wahrscheinlichkeit (1 = definitiv Clickbait, 10 = seriös)

ENTSCHEIDE:
Soll das Video importiert werden? (IMPORT oder SKIP)

ANTWORT-FORMAT (JSON):
{{
    "relevance": 8,
    "quality": 7,
    "clickbait": 9,
    "recommendation": "IMPORT",
    "reasoning": "Das Video behandelt..."
}}"""

    def _parse_detail_response(self, response: str) -> DetailAnalysisResult:
        """
        Parse detail analysis response from AI.

        Args:
            response: Raw response text

        Returns:
            DetailAnalysisResult with parsed values
        """
        try:
            # Remove markdown code blocks if present
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```\w*\n?", "", cleaned)
                cleaned = re.sub(r"\n?```$", "", cleaned)

            data = json.loads(cleaned)
            return DetailAnalysisResult(
                relevance_score=float(data.get("relevance", 5)),
                quality_score=float(data.get("quality", 5)),
                clickbait_score=float(data.get("clickbait", 5)),
                recommendation=data.get("recommendation", "IMPORT"),
                reasoning=data.get("reasoning", ""),
            )
        except (json.JSONDecodeError, KeyError) as e:
            return DetailAnalysisResult(
                relevance_score=5.0,
                quality_score=5.0,
                clickbait_score=5.0,
                recommendation="IMPORT",
                reasoning=f"Could not parse response: {e}",
            )
