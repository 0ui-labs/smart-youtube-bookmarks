"""Tests for Transcript Search API endpoints."""
import pytest
from uuid import uuid4

from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from app.models.list import BookmarkList
from app.models.user import User
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus


class TestTranscriptSearch:
    """Tests for GET /api/search endpoint."""

    @pytest.mark.asyncio
    async def test_search_returns_matching_videos(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Search returns videos with matching transcript text."""
        # Create video with enrichment
        video = Video(
            list_id=test_list.id,
            youtube_id="search123",
            title="Python Tutorial",
            duration=600
        )
        test_db.add(video)
        await test_db.flush()

        enrichment = VideoEnrichment(
            video_id=video.id,
            status=EnrichmentStatus.completed.value,
            transcript_text="Learn Python programming basics and advanced concepts"
        )
        test_db.add(enrichment)
        await test_db.commit()

        response = await client.get("/api/search", params={"q": "Python programming"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) == 1
        assert data["results"][0]["video_id"] == str(video.id)
        assert data["results"][0]["title"] == "Python Tutorial"

    @pytest.mark.asyncio
    async def test_search_returns_empty_when_no_match(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Search returns empty results when no transcript matches."""
        # Create video with enrichment
        video = Video(
            list_id=test_list.id,
            youtube_id="nomatch123",
            title="Cooking Show",
            duration=600
        )
        test_db.add(video)
        await test_db.flush()

        enrichment = VideoEnrichment(
            video_id=video.id,
            status=EnrichmentStatus.completed.value,
            transcript_text="How to make delicious pasta from scratch"
        )
        test_db.add(enrichment)
        await test_db.commit()

        response = await client.get("/api/search", params={"q": "javascript"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) == 0

    @pytest.mark.asyncio
    async def test_search_requires_query_parameter(self, client: AsyncClient):
        """Search returns 422 when query parameter is missing."""
        response = await client.get("/api/search")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_search_respects_list_filter(
        self, client: AsyncClient, test_list: BookmarkList, test_user: User, test_db: AsyncSession
    ):
        """Search can filter results by list_id."""
        # Create two lists
        other_list = BookmarkList(name="Other List", user_id=test_user.id)
        test_db.add(other_list)
        await test_db.flush()

        # Video in test_list
        video1 = Video(
            list_id=test_list.id,
            youtube_id="list1video",
            title="Video 1",
            duration=600
        )
        test_db.add(video1)
        await test_db.flush()

        enrichment1 = VideoEnrichment(
            video_id=video1.id,
            status=EnrichmentStatus.completed.value,
            transcript_text="Machine learning tutorial"
        )
        test_db.add(enrichment1)

        # Video in other_list
        video2 = Video(
            list_id=other_list.id,
            youtube_id="list2video",
            title="Video 2",
            duration=600
        )
        test_db.add(video2)
        await test_db.flush()

        enrichment2 = VideoEnrichment(
            video_id=video2.id,
            status=EnrichmentStatus.completed.value,
            transcript_text="Machine learning advanced"
        )
        test_db.add(enrichment2)
        await test_db.commit()

        # Search with list filter
        response = await client.get(
            "/api/search",
            params={"q": "machine learning", "list_id": str(test_list.id)}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) == 1
        assert data["results"][0]["video_id"] == str(video1.id)

    @pytest.mark.asyncio
    async def test_search_pagination(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Search supports pagination with limit and offset."""
        # Create multiple videos
        for i in range(5):
            video = Video(
                list_id=test_list.id,
                youtube_id=f"page{i}",
                title=f"Tutorial Part {i}",
                duration=600
            )
            test_db.add(video)
            await test_db.flush()

            enrichment = VideoEnrichment(
                video_id=video.id,
                status=EnrichmentStatus.completed.value,
                transcript_text=f"Python tutorial episode {i}"
            )
            test_db.add(enrichment)

        await test_db.commit()

        # Get first page
        response = await client.get(
            "/api/search",
            params={"q": "Python tutorial", "limit": 2, "offset": 0}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) == 2
        assert data["total"] == 5
        assert data["limit"] == 2
        assert data["offset"] == 0

    @pytest.mark.asyncio
    async def test_search_returns_snippet(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Search returns text snippet with highlighted match."""
        video = Video(
            list_id=test_list.id,
            youtube_id="snippet123",
            title="Test Video",
            duration=600
        )
        test_db.add(video)
        await test_db.flush()

        enrichment = VideoEnrichment(
            video_id=video.id,
            status=EnrichmentStatus.completed.value,
            transcript_text="This is a long transcript about Python programming and data science."
        )
        test_db.add(enrichment)
        await test_db.commit()

        response = await client.get("/api/search", params={"q": "Python"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) == 1
        assert "snippet" in data["results"][0]
        # Snippet should contain the search term
        assert "Python" in data["results"][0]["snippet"]

    @pytest.mark.asyncio
    async def test_search_only_completed_enrichments(
        self, client: AsyncClient, test_list: BookmarkList, test_db: AsyncSession
    ):
        """Search only returns videos with completed enrichment."""
        # Video with completed enrichment
        video1 = Video(
            list_id=test_list.id,
            youtube_id="completed123",
            title="Completed Video",
            duration=600
        )
        test_db.add(video1)
        await test_db.flush()

        enrichment1 = VideoEnrichment(
            video_id=video1.id,
            status=EnrichmentStatus.completed.value,
            transcript_text="React hooks tutorial"
        )
        test_db.add(enrichment1)

        # Video with pending enrichment
        video2 = Video(
            list_id=test_list.id,
            youtube_id="pending123",
            title="Pending Video",
            duration=600
        )
        test_db.add(video2)
        await test_db.flush()

        enrichment2 = VideoEnrichment(
            video_id=video2.id,
            status=EnrichmentStatus.pending.value,
            transcript_text="React hooks advanced"
        )
        test_db.add(enrichment2)
        await test_db.commit()

        response = await client.get("/api/search", params={"q": "React hooks"})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Only completed enrichment should be searchable
        assert len(data["results"]) == 1
        assert data["results"][0]["video_id"] == str(video1.id)
