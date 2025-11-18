import pytest
import numpy as np
from uuid import uuid4

from app.services.duplicate_detection import (
    DuplicateDetector,
    SimilarityType,
    SimilarityResult
)
from app.models.custom_field import CustomField


class TestLevenshteinDetection:
    """Tests for Levenshtein distance calculation and matching."""

    @pytest.fixture
    def detector(self):
        """Detector without AI (Levenshtein-only)."""
        return DuplicateDetector(gemini_client=None, redis_client=None)

    @pytest.fixture
    def sample_fields(self):
        """Sample custom fields for testing."""
        return [
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Presentation Quality",
                field_type="select",
                config={"options": ["bad", "good", "great"]}
            ),
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Presentation",
                field_type="select",
                config={"options": ["bad", "good", "great"]}
            ),
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Overall Rating",
                field_type="rating",
                config={"max_rating": 5}
            ),
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Video Length",
                field_type="text",
                config={}
            )
        ]

    @pytest.mark.asyncio
    async def test_exact_match_case_insensitive(self, detector, sample_fields):
        """Exact match should return score 1.0."""
        results = await detector.find_similar_fields(
            "presentation quality",  # lowercase
            sample_fields,
            include_semantic=False
        )

        assert len(results) == 1
        assert results[0].score == 1.0
        assert results[0].similarity_type == SimilarityType.EXACT
        assert "Presentation Quality" in results[0].explanation

    @pytest.mark.asyncio
    async def test_one_char_typo(self, detector, sample_fields):
        """Single character typo should be detected."""
        results = await detector.find_similar_fields(
            "Presentaton",  # missing 'i'
            sample_fields,
            include_semantic=False
        )

        assert len(results) >= 1
        assert results[0].similarity_type == SimilarityType.LEVENSHTEIN
        assert results[0].score >= 0.80
        assert results[0].score < 1.0
        assert "1 character difference" in results[0].explanation

    @pytest.mark.asyncio
    async def test_two_char_typo(self, detector, sample_fields):
        """Two character typo should be detected."""
        results = await detector.find_similar_fields(
            "Presntttion",  # 2 character differences
            sample_fields,
            include_semantic=False
        )

        assert len(results) >= 1
        assert results[0].similarity_type == SimilarityType.LEVENSHTEIN
        assert results[0].score >= 0.80
        assert "2 character differences" in results[0].explanation

    @pytest.mark.asyncio
    async def test_three_char_typo_edge_case(self, detector, sample_fields):
        """Three character typo is at threshold (distance = 3)."""
        results = await detector.find_similar_fields(
            "Presntttio",  # 3 character differences
            sample_fields,
            include_semantic=False
        )

        # Should still suggest (distance <= 3)
        assert len(results) >= 1
        assert results[0].similarity_type == SimilarityType.LEVENSHTEIN

    @pytest.mark.asyncio
    async def test_four_char_typo_no_match(self, detector, sample_fields):
        """Four character typo should not match (distance > 3)."""
        results = await detector.find_similar_fields(
            "Presntto",  # 4 character differences (distance > 3)
            sample_fields,
            include_semantic=False
        )

        # Should NOT suggest (distance > 3)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_completely_different_no_match(self, detector, sample_fields):
        """Completely different name should not match."""
        results = await detector.find_similar_fields(
            "Audio Quality",
            sample_fields,
            include_semantic=False
        )

        # No high-score matches expected
        assert all(r.score < 0.80 for r in results)

    @pytest.mark.asyncio
    async def test_multiple_matches_sorted_by_score(self, detector):
        """Multiple fuzzy matches should be sorted by score (highest first)."""
        fields = [
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Ratng",  # closer typo (distance 1)
                field_type="rating",
                config={"max_rating": 5}
            ),
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Rtng",  # further typo (distance 2)
                field_type="rating",
                config={"max_rating": 5}
            ),
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Other Field",  # no match
                field_type="rating",
                config={"max_rating": 5}
            )
        ]

        results = await detector.find_similar_fields(
            "Rating",
            fields,
            include_semantic=False
        )

        # Should return 2 fuzzy matches sorted by proximity
        assert len(results) == 2
        assert results[0].similarity_type == SimilarityType.LEVENSHTEIN
        assert results[1].similarity_type == SimilarityType.LEVENSHTEIN
        assert results[0].score > results[1].score  # "Ratng" > "Rtng"

    @pytest.mark.asyncio
    async def test_special_characters_and_spaces(self, detector):
        """Special characters and spaces should be handled."""
        fields = [
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Test Field (v2)",
                field_type="text",
                config={}
            )
        ]

        results = await detector.find_similar_fields(
            "Test Field (v3)",  # different version
            fields,
            include_semantic=False
        )

        assert len(results) >= 1
        assert results[0].similarity_type == SimilarityType.LEVENSHTEIN

    @pytest.mark.asyncio
    async def test_unicode_characters(self, detector):
        """Unicode characters should be handled correctly."""
        fields = [
            CustomField(
                id=uuid4(),
                list_id=uuid4(),
                name="Qualität",  # German
                field_type="text",
                config={}
            )
        ]

        results = await detector.find_similar_fields(
            "Qualitat",  # Missing umlaut
            fields,
            include_semantic=False
        )

        assert len(results) >= 1

    def test_calculate_levenshtein_rapidfuzz(self, detector):
        """Test Levenshtein calculation with rapidfuzz."""
        distance, ratio = detector._calculate_levenshtein("test", "tst")

        assert distance == 1  # One deletion
        assert ratio > 0.5  # Relatively similar

    def test_calculate_levenshtein_identical(self, detector):
        """Identical strings should have distance 0, ratio 1.0."""
        distance, ratio = detector._calculate_levenshtein("test", "test")

        assert distance == 0
        assert ratio == 1.0

    def test_calculate_levenshtein_empty(self, detector):
        """Empty strings should work."""
        distance, ratio = detector._calculate_levenshtein("", "")

        assert distance == 0
        assert ratio == 1.0

    def test_calculate_levenshtein_one_empty(self, detector):
        """One empty string should have distance = length."""
        distance, ratio = detector._calculate_levenshtein("test", "")

        assert distance == 4
        assert ratio == 0.0


class TestSimilarityScoring:
    """Tests for similarity score calculation and mapping."""

    @pytest.fixture
    def detector(self):
        return DuplicateDetector(gemini_client=None, redis_client=None)

    def test_exact_match_score(self, detector):
        """Exact match should always be 1.0."""
        assert detector.EXACT_SCORE == 1.0

    def test_levenshtein_score_range(self, detector):
        """Levenshtein scores should be in 0.80-0.99 range."""
        assert detector.LEVENSHTEIN_SCORE_MIN == 0.80
        assert detector.LEVENSHTEIN_SCORE_MAX == 0.99

    def test_semantic_score_range(self, detector):
        """Semantic scores should be in 0.60-0.79 range."""
        assert detector.SEMANTIC_SCORE_MIN == 0.60
        assert detector.SEMANTIC_SCORE_MAX == 0.79

    def test_score_ranges_no_overlap(self, detector):
        """Score ranges should not overlap."""
        assert detector.SEMANTIC_SCORE_MAX < detector.LEVENSHTEIN_SCORE_MIN
        assert detector.LEVENSHTEIN_SCORE_MAX < detector.EXACT_SCORE

    @pytest.mark.asyncio
    async def test_similarity_result_to_dict(self, detector):
        """SimilarityResult should convert to dict correctly."""
        field = CustomField(
            id=uuid4(),
            list_id=uuid4(),
            name="Test Field",
            field_type="text",
            config={}
        )

        result = SimilarityResult(
            field=field,
            score=0.95,
            similarity_type=SimilarityType.LEVENSHTEIN,
            explanation="Test explanation"
        )

        result_dict = result.to_dict()

        assert result_dict["score"] == 0.95
        assert result_dict["similarity_type"] == "levenshtein"
        assert result_dict["explanation"] == "Test explanation"
        assert result_dict["field"]["name"] == "Test Field"


class TestCosineSimilarity:
    """Tests for cosine similarity calculation."""

    @pytest.fixture
    def detector(self):
        return DuplicateDetector(gemini_client=None, redis_client=None)

    def test_identical_vectors(self, detector):
        """Identical vectors should have similarity 1.0."""
        vec = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        similarity = detector._cosine_similarity(vec, vec)

        assert abs(similarity - 1.0) < 0.001  # Close to 1.0

    def test_opposite_vectors(self, detector):
        """Opposite vectors should have similarity close to 0.0."""
        vec1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        vec2 = np.array([-1.0, 0.0, 0.0], dtype=np.float32)
        similarity = detector._cosine_similarity(vec1, vec2)

        # Cosine of 180° = -1, but we clip to 0-1, so should be 0
        assert similarity >= 0.0
        assert similarity <= 0.1

    def test_orthogonal_vectors(self, detector):
        """Orthogonal vectors should have similarity ~0.5."""
        vec1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        vec2 = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        similarity = detector._cosine_similarity(vec1, vec2)

        # Cosine of 90° = 0, normalized to 0-1 scale
        assert similarity >= 0.0
        assert similarity <= 0.5

    def test_high_dimensional_vectors(self, detector):
        """Should work with high-dimensional vectors (embeddings)."""
        vec1 = np.random.rand(768).astype(np.float32)  # Gemini embedding size
        vec2 = vec1 + np.random.rand(768).astype(np.float32) * 0.1  # Similar
        similarity = detector._cosine_similarity(vec1, vec2)

        assert 0.0 <= similarity <= 1.0
        assert similarity > 0.5  # Should be relatively similar
