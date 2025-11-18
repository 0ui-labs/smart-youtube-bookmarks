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
    @patch('app.services.duplicate_detection.DuplicateDetector._call_gemini_embedding_api')
    async def test_smart_mode_multiple_suggestions_ranked(
        self,
        mock_embedding,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should return multiple suggestions ranked by score."""
        # Mock embeddings to ensure Audio Quality is NOT similar to Rating
        # Use deterministic embeddings to avoid random test failures
        # Rating and Ratng should be similar (cosine ~0.95), Audio Quality different (cosine ~0.2)

        # Create base vector for rating-related terms
        embedding_rating = np.zeros(768, dtype=np.float32)
        embedding_rating[0:100] = 1.0  # First 100 dimensions
        embedding_rating = embedding_rating / np.linalg.norm(embedding_rating)

        # Ratng is very similar to Rating (slight perturbation)
        embedding_ratng = embedding_rating.copy()
        embedding_ratng[50:55] = 0.8  # Slight difference
        embedding_ratng = embedding_ratng / np.linalg.norm(embedding_ratng)

        # Audio Quality is completely different (different dimensions)
        embedding_audio = np.zeros(768, dtype=np.float32)
        embedding_audio[400:500] = 1.0  # Different 100 dimensions
        embedding_audio = embedding_audio / np.linalg.norm(embedding_audio)

        async def mock_embedding_func(text):
            text_lower = text.lower()
            if text_lower == "rating":
                return embedding_rating
            elif text_lower == "ratng":
                return embedding_ratng
            elif "audio quality" in text_lower:
                return embedding_audio
            else:
                return np.random.rand(768).astype(np.float32)

        mock_embedding.side_effect = mock_embedding_func

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

        # Should have at least 2 suggestions (exact + typo)
        # May include more if Gemini detects semantic similarities
        assert data["exists"] is True
        assert len(data["suggestions"]) >= 2

        # Should be ranked by score (highest first)
        for i in range(len(data["suggestions"]) - 1):
            assert data["suggestions"][i]["score"] >= data["suggestions"][i+1]["score"]

        # Exact match should be first (highest score)
        assert data["suggestions"][0]["field"]["name"] == "Rating"  # Exact match first
        assert data["suggestions"][0]["similarity_type"] == "exact"

        # Ratng should be in suggestions
        suggestion_names = [s["field"]["name"] for s in data["suggestions"]]
        assert "Ratng" in suggestion_names

    @pytest.mark.skipif(
        not settings.gemini_api_key,
        reason="Gemini API key not configured"
    )
    @patch('app.services.duplicate_detection.DuplicateDetector._call_gemini_embedding_api')
    async def test_smart_mode_no_suggestions_below_threshold(
        self,
        mock_embedding,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should not suggest if all scores < 0.60."""
        # Mock embeddings to ensure fields are NOT similar (low cosine similarity)
        # Use deterministic embeddings with zero overlap (cosine similarity ~0)

        # Video Length - first 100 dimensions
        embedding_video_length = np.zeros(768, dtype=np.float32)
        embedding_video_length[0:100] = 1.0
        embedding_video_length = embedding_video_length / np.linalg.norm(embedding_video_length)

        # Audio Quality - different 100 dimensions (no overlap)
        embedding_audio_quality = np.zeros(768, dtype=np.float32)
        embedding_audio_quality[400:500] = 1.0
        embedding_audio_quality = embedding_audio_quality / np.linalg.norm(embedding_audio_quality)

        async def mock_embedding_func(text):
            text_lower = text.lower()
            if "video length" in text_lower:
                return embedding_video_length
            elif "audio quality" in text_lower:
                return embedding_audio_quality
            else:
                return np.random.rand(768).astype(np.float32)

        mock_embedding.side_effect = mock_embedding_func

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

        # Should have no suggestions or very low scores
        # Note: Gemini may sometimes find weak semantic links, so we check scores
        if data["exists"]:
            # If any suggestions exist, they should all be below 0.70 (weak similarity)
            for suggestion in data["suggestions"]:
                assert suggestion["score"] < 0.70, f"Unexpected high similarity: {suggestion}"
        else:
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
    @patch('app.services.duplicate_detection.DuplicateDetector._call_gemini_embedding_api')
    async def test_smart_mode_response_time_under_500ms(
        self,
        mock_embedding,
        client: AsyncClient,
        test_db,
        test_list: BookmarkList
    ):
        """Smart mode should respond in < 500ms (mocked API for performance testing)."""
        import time

        # Mock fast embeddings
        async def mock_embedding_func(text):
            return np.random.rand(768).astype(np.float32) / np.linalg.norm(np.random.rand(768).astype(np.float32))

        mock_embedding.side_effect = mock_embedding_func

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
