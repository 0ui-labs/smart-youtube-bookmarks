import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch
import numpy as np
from httpx import AsyncClient

from app.models.custom_field import CustomField
from app.models.list import BookmarkList
from app.core.config import settings


@pytest.mark.asyncio
class TestSmartDuplicateDetectionIntegration:
    """Integration tests for smart duplicate detection endpoint."""

    async def test_basic_mode_backward_compatible(
        self,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Basic mode should work as before (backward compatible)."""
        # Create field
        field = CustomField(
            list_id=test_list.id,
            name="Presentation Quality",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        test_db.add(field)
        await test_db.commit()

        # Check with basic mode (default)
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields/check-duplicate",
            json={"name": "presentation quality"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should match old response format
        assert "exists" in data
        assert "field" in data
        assert data["exists"] is True
        assert data["field"]["name"] == "Presentation Quality"

    @pytest.mark.skipif(
        not settings.gemini_api_key,
        reason="Gemini API key not configured"
    )
    async def test_smart_mode_typo_detection(
        self,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should detect typos."""
        # Create field (use simple name without extra words for Levenshtein to work)
        field = CustomField(
            list_id=test_list.id,
            name="Presentation",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        test_db.add(field)
        await test_db.commit()

        # Check with smart mode + typo
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields/check-duplicate?mode=smart",
            json={"name": "Presentaton"}  # Missing 'i'
        )

        assert response.status_code == 200
        data = response.json()

        # Should suggest existing field
        assert data["exists"] is True
        assert data["mode"] == "smart"
        assert len(data["suggestions"]) >= 1

        suggestion = data["suggestions"][0]
        assert suggestion["field"]["name"] == "Presentation"
        assert suggestion["similarity_type"] == "levenshtein"
        assert suggestion["score"] >= 0.80
        assert "character difference" in suggestion["explanation"]

    @pytest.mark.skipif(
        not settings.gemini_api_key,
        reason="Gemini API key not configured"
    )
    @patch('app.services.duplicate_detection.DuplicateDetector._call_gemini_embedding_api')
    async def test_smart_mode_semantic_similarity(
        self,
        mock_embedding,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should detect semantic similarity."""
        # Mock embeddings for "Video Rating" and "Overall Score"
        # Make them similar (cosine similarity ~0.85)
        embedding_video_rating = np.random.rand(768).astype(np.float32)
        embedding_overall_score = embedding_video_rating + np.random.rand(768).astype(np.float32) * 0.2

        # Normalize
        embedding_video_rating /= np.linalg.norm(embedding_video_rating)
        embedding_overall_score /= np.linalg.norm(embedding_overall_score)

        # Mock returns appropriate embedding based on input
        async def mock_embedding_func(text):
            if "video rating" in text.lower():
                return embedding_video_rating
            elif "overall score" in text.lower():
                return embedding_overall_score
            else:
                return np.random.rand(768).astype(np.float32)

        mock_embedding.side_effect = mock_embedding_func

        # Create field "Video Rating"
        field = CustomField(
            list_id=test_list.id,
            name="Video Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        test_db.add(field)
        await test_db.commit()

        # Check "Overall Score" (semantically similar)
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields/check-duplicate?mode=smart",
            json={"name": "Overall Score"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should suggest via semantic similarity
        assert data["exists"] is True
        assert len(data["suggestions"]) >= 1

        # Find semantic suggestion
        semantic_suggestions = [
            s for s in data["suggestions"]
            if s["similarity_type"] == "semantic"
        ]

        assert len(semantic_suggestions) >= 1
        suggestion = semantic_suggestions[0]
        assert suggestion["field"]["name"] == "Video Rating"
        assert 0.60 <= suggestion["score"] <= 0.79
        assert "semantically similar" in suggestion["explanation"].lower()

    @pytest.mark.skipif(
        not settings.gemini_api_key,
        reason="Gemini API key not configured"
    )
    async def test_smart_mode_multiple_suggestions_ranked(
        self,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should return multiple suggestions ranked by score."""
        # Create fields
        fields = [
            CustomField(
                list_id=test_list.id,
                name="Rating",
                field_type="rating",
                config={"max_rating": 5}
            ),
            CustomField(
                list_id=test_list.id,
                name="Ratng",  # Closer typo
                field_type="rating",
                config={"max_rating": 5}
            ),
            CustomField(
                list_id=test_list.id,
                name="Audio Quality",  # Different
                field_type="select",
                config={"options": ["bad", "good"]}
            )
        ]
        for field in fields:
            test_db.add(field)
        await test_db.commit()

        # Check with query that matches first two
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields/check-duplicate?mode=smart",
            json={"name": "Rating"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should have 2 suggestions (exact + typo), not Audio Quality
        assert data["exists"] is True
        assert len(data["suggestions"]) == 2

        # Should be ranked by score
        assert data["suggestions"][0]["score"] >= data["suggestions"][1]["score"]
        assert data["suggestions"][0]["field"]["name"] == "Rating"  # Exact match first

    @pytest.mark.skipif(
        not settings.gemini_api_key,
        reason="Gemini API key not configured"
    )
    async def test_smart_mode_no_suggestions_below_threshold(
        self,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should not suggest if all scores < 0.60."""
        # Create completely different field
        field = CustomField(
            list_id=test_list.id,
            name="Video Length",
            field_type="text",
            config={}
        )
        test_db.add(field)
        await test_db.commit()

        # Check with very different name
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields/check-duplicate?mode=smart",
            json={"name": "Audio Quality"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should not suggest (too different)
        assert data["exists"] is False
        assert data["suggestions"] == []

    async def test_smart_mode_fallback_without_gemini(
        self,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should work without Gemini (Levenshtein only)."""
        # Temporarily disable Gemini by setting API key to None
        with patch('app.core.config.settings.gemini_api_key', None):
            # Create field
            field = CustomField(
                list_id=test_list.id,
                name="Rating",
                field_type="select",
                config={"options": ["bad", "good", "great"]}
            )
            test_db.add(field)
            await test_db.commit()

            # Check with typo (distance = 1, within threshold of 3)
            response = await client.post(
                f"/api/lists/{test_list.id}/custom-fields/check-duplicate?mode=smart",
                json={"name": "Ratng"}
            )

            assert response.status_code == 200
            data = response.json()

            # Should still detect via Levenshtein
            assert data["exists"] is True
            assert data["suggestions"][0]["similarity_type"] == "levenshtein"

    @pytest.mark.skipif(
        not settings.gemini_api_key,
        reason="Gemini API key not configured"
    )
    async def test_smart_mode_response_time_under_500ms(
        self,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should respond in < 500ms."""
        import time

        # Create 10 fields
        for i in range(10):
            field = CustomField(
                list_id=test_list.id,
                name=f"Test Field {i}",
                field_type="text",
                config={}
            )
            test_db.add(field)
        await test_db.commit()

        # Measure response time
        start = time.time()
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields/check-duplicate?mode=smart",
            json={"name": "Test Field X"}
        )
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 0.5  # 500ms
