"""
Duplicate detection service for custom fields.

This module provides intelligent duplicate detection using:
1. Exact matching (case-insensitive)
2. Levenshtein distance (typo detection)
3. Semantic similarity (AI embeddings via Gemini)

Example:
    >>> detector = DuplicateDetector(gemini_client, redis_client)
    >>> suggestions = await detector.find_similar_fields(
    ...     "Presentaton",
    ...     existing_fields=[field1, field2, field3]
    ... )
    >>> print(suggestions[0].score)  # 0.92 (high similarity)
"""

import asyncio
import logging
from typing import List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

try:
    from rapidfuzz import fuzz
    from rapidfuzz.distance import Levenshtein
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    import difflib
    RAPIDFUZZ_AVAILABLE = False

import httpx
import numpy as np
from redis.asyncio import Redis

from app.clients.gemini import GeminiClient
from app.models.custom_field import CustomField


logger = logging.getLogger(__name__)


class SimilarityType(str, Enum):
    """Type of similarity match detected."""
    EXACT = "exact"              # 100% - case-insensitive exact match
    LEVENSHTEIN = "levenshtein"  # 80-99% - typo/edit distance
    SEMANTIC = "semantic"        # 60-79% - meaning similarity via AI
    NO_MATCH = "no_match"        # <60% - not similar


@dataclass
class SimilarityResult:
    """Result of similarity comparison with explanation."""
    field: CustomField
    score: float  # 0.0-1.0
    similarity_type: SimilarityType
    explanation: str

    def to_dict(self) -> dict:
        """Convert to API response format."""
        return {
            "field": {
                "id": str(self.field.id),
                "name": self.field.name,
                "field_type": self.field.field_type,
                "config": self.field.config
            },
            "score": round(self.score, 2),
            "similarity_type": self.similarity_type.value,
            "explanation": self.explanation
        }


class DuplicateDetector:
    """
    Service for detecting duplicate custom fields using multiple strategies.

    Strategies (in order of precedence):
    1. Exact match: Case-insensitive string comparison (100% score)
    2. Levenshtein: Edit distance < 3 for typo detection (80-99% score)
    3. Semantic: AI embeddings cosine similarity > 0.75 (60-79% score)
    """

    # Thresholds for similarity detection
    LEVENSHTEIN_MAX_DISTANCE = 3  # Max edit distance for typo suggestions
    SEMANTIC_MIN_SIMILARITY = 0.75  # Min cosine similarity for semantic matches

    # Score ranges (for mapping to 0-1 scale)
    EXACT_SCORE = 1.0
    LEVENSHTEIN_SCORE_MIN = 0.80
    LEVENSHTEIN_SCORE_MAX = 0.99
    SEMANTIC_SCORE_MIN = 0.60
    SEMANTIC_SCORE_MAX = 0.79

    # Redis cache settings
    EMBEDDING_CACHE_TTL = 86400  # 24 hours
    EMBEDDING_CACHE_PREFIX = "field_embedding:"

    def __init__(
        self,
        gemini_client: Optional[GeminiClient] = None,
        redis_client: Optional[Redis] = None
    ):
        """
        Initialize duplicate detector.

        Args:
            gemini_client: Gemini API client for embeddings (optional)
            redis_client: Redis client for embedding cache (optional)
        """
        self.gemini_client = gemini_client
        self.redis_client = redis_client
        self.ai_available = gemini_client is not None

        if not self.ai_available:
            logger.warning(
                "Gemini client not available - semantic similarity disabled. "
                "Only exact match and Levenshtein will be used."
            )

    async def find_similar_fields(
        self,
        field_name: str,
        existing_fields: List[CustomField],
        include_semantic: bool = True
    ) -> List[SimilarityResult]:
        """
        Find fields similar to the given name using multiple strategies.

        Args:
            field_name: Name to check for duplicates
            existing_fields: List of existing fields to compare against
            include_semantic: Whether to use AI semantic similarity (slower)

        Returns:
            List of SimilarityResult sorted by score (highest first)

        Example:
            >>> results = await detector.find_similar_fields(
            ...     "Presentaton",
            ...     [field1, field2]
            ... )
            >>> print(results[0].explanation)
            "Very similar name (1 character difference)"
        """
        # Input validation
        if not field_name or not field_name.strip():
            logger.warning("Empty field_name provided to find_similar_fields")
            return []

        if not existing_fields:
            return []

        results: List[SimilarityResult] = []

        # Strategy 1: Exact match (case-insensitive)
        for field in existing_fields:
            if field.name.lower() == field_name.lower():
                results.append(SimilarityResult(
                    field=field,
                    score=self.EXACT_SCORE,
                    similarity_type=SimilarityType.EXACT,
                    explanation=f"Exact match (case-insensitive): '{field.name}'"
                ))

        # If exact match found, return immediately (no need for fuzzy matching)
        if results:
            return results

        # Strategy 2: Levenshtein distance (typos)
        levenshtein_results = self._find_levenshtein_matches(
            field_name,
            existing_fields
        )
        results.extend(levenshtein_results)

        # Strategy 3: Semantic similarity (AI embeddings)
        if include_semantic and self.ai_available:
            try:
                semantic_results = await self._find_semantic_matches(
                    field_name,
                    existing_fields
                )
                results.extend(semantic_results)
            except Exception as e:
                logger.warning(f"Semantic similarity failed: {e}. Using Levenshtein only.")

        # Sort by score (highest first) and return
        results.sort(key=lambda r: r.score, reverse=True)
        return results

    def _find_levenshtein_matches(
        self,
        field_name: str,
        existing_fields: List[CustomField]
    ) -> List[SimilarityResult]:
        """
        Find fields with low Levenshtein distance (typo detection).

        Uses rapidfuzz if available (40% faster), otherwise falls back to difflib.
        """
        results: List[SimilarityResult] = []

        for field in existing_fields:
            distance, ratio = self._calculate_levenshtein(
                field_name.lower(),
                field.name.lower()
            )

            # Only suggest if distance is small enough
            if distance <= self.LEVENSHTEIN_MAX_DISTANCE:
                # Map ratio (0-1) to score range (0.80-0.99)
                # Higher ratio = higher score
                score = self.LEVENSHTEIN_SCORE_MIN + (
                    ratio * (self.LEVENSHTEIN_SCORE_MAX - self.LEVENSHTEIN_SCORE_MIN)
                )

                # Generate human-readable explanation
                if distance == 1:
                    explanation = f"Very similar name (1 character difference): '{field.name}'"
                else:
                    explanation = f"Similar name ({distance} character differences): '{field.name}'"

                results.append(SimilarityResult(
                    field=field,
                    score=score,
                    similarity_type=SimilarityType.LEVENSHTEIN,
                    explanation=explanation
                ))

        return results

    def _calculate_levenshtein(
        self,
        str1: str,
        str2: str
    ) -> Tuple[int, float]:
        """
        Calculate Levenshtein distance and similarity ratio.

        Returns:
            Tuple of (distance: int, ratio: float)
            - distance: Number of edits needed (insertions, deletions, substitutions)
            - ratio: Similarity ratio 0.0-1.0 (1.0 = identical)
        """
        if RAPIDFUZZ_AVAILABLE:
            # Use rapidfuzz (faster)
            distance = Levenshtein.distance(str1, str2)
            ratio = fuzz.ratio(str1, str2) / 100.0  # Convert 0-100 to 0-1
        else:
            # Fallback to difflib (standard library)
            ratio = difflib.SequenceMatcher(None, str1, str2).ratio()
            # Approximate distance from ratio
            max_len = max(len(str1), len(str2))
            distance = int(max_len * (1 - ratio))

        return distance, ratio

    async def _find_semantic_matches(
        self,
        field_name: str,
        existing_fields: List[CustomField]
    ) -> List[SimilarityResult]:
        """
        Find semantically similar fields using AI embeddings.

        Uses Gemini embeddings API to detect meaning similarity:
        - "Video Rating" vs "Overall Score" (same concept)
        - "Presentation Style" vs "Speaking Quality" (related)
        """
        results: List[SimilarityResult] = []

        if not self.gemini_client:
            return results

        # Get embedding for input field name
        query_embedding = await self._get_embedding(field_name)

        # Compare with embeddings of existing fields
        for field in existing_fields:
            field_embedding = await self._get_embedding(field.name)

            # Calculate cosine similarity
            similarity = self._cosine_similarity(query_embedding, field_embedding)

            # Only suggest if similarity is high enough
            if similarity >= self.SEMANTIC_MIN_SIMILARITY:
                # Map similarity (0.75-1.0) to score range (0.60-0.79)
                # Normalize to 0-1 first, then map to range
                normalized = (similarity - self.SEMANTIC_MIN_SIMILARITY) / (1.0 - self.SEMANTIC_MIN_SIMILARITY)
                score = self.SEMANTIC_SCORE_MIN + (
                    normalized * (self.SEMANTIC_SCORE_MAX - self.SEMANTIC_SCORE_MIN)
                )

                # Generate explanation
                explanation = f"Semantically similar concept: '{field.name}' (AI detected {int(similarity*100)}% meaning similarity)"

                results.append(SimilarityResult(
                    field=field,
                    score=score,
                    similarity_type=SimilarityType.SEMANTIC,
                    explanation=explanation
                ))

        return results

    async def _get_embedding(self, text: str) -> np.ndarray:
        """
        Get embedding vector for text with Redis caching.

        Uses gemini-embedding-001 model via Gemini API.
        Cache TTL: 24 hours (embeddings don't change)
        """
        # Check cache first
        cache_key = f"{self.EMBEDDING_CACHE_PREFIX}{text.lower()}"

        if self.redis_client:
            try:
                cached = await self.redis_client.get(cache_key)
                if cached:
                    # Deserialize from bytes
                    return np.frombuffer(cached, dtype=np.float32)
            except Exception as e:
                logger.warning(f"Redis cache read failed: {e}")

        # Cache miss - call Gemini API
        embedding = await self._call_gemini_embedding_api(text)

        # Store in cache
        if self.redis_client:
            try:
                # Serialize to bytes
                embedding_bytes = embedding.astype(np.float32).tobytes()
                await self.redis_client.setex(
                    cache_key,
                    self.EMBEDDING_CACHE_TTL,
                    embedding_bytes
                )
            except Exception as e:
                logger.warning(f"Redis cache write failed: {e}")

        return embedding

    async def _call_gemini_embedding_api(self, text: str) -> np.ndarray:
        """
        Call Gemini embeddings API directly using REST.

        Uses gemini-embedding-001 model (768 dimensions).
        Cost: $0.15 per million tokens (very cheap for field names).

        CORRECTED API IMPLEMENTATION:
        - Uses v1beta endpoint (not v1)
        - Uses x-goog-api-key header auth (not query param)
        - Includes task_type and output_dimensionality
        - Response is data["embeddings"][0]["values"] (plural + array index)
        """
        # CORRECTED: Use v1beta endpoint with gemini-embedding-001
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"

        # CORRECTED: Use header auth with x-goog-api-key
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.gemini_client.api_key
        }

        # CORRECTED: Include task_type and output_dimensionality
        payload = {
            "model": "models/gemini-embedding-001",
            "content": {
                "parts": [{"text": text}]
            },
            "task_type": "SEMANTIC_SIMILARITY",
            "output_dimensionality": 768
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
                timeout=5.0
            )
            response.raise_for_status()

            data = response.json()
            # CORRECTED: Response is embeddings (plural) with array index
            embedding = data["embeddings"][0]["values"]

            return np.array(embedding, dtype=np.float32)

    def _cosine_similarity(
        self,
        vec1: np.ndarray,
        vec2: np.ndarray
    ) -> float:
        """
        Calculate cosine similarity between two vectors.

        Returns:
            Similarity score 0.0-1.0 (1.0 = identical direction)
        """
        # Normalize vectors
        vec1_norm = vec1 / np.linalg.norm(vec1)
        vec2_norm = vec2 / np.linalg.norm(vec2)

        # Dot product of normalized vectors = cosine similarity
        similarity = np.dot(vec1_norm, vec2_norm)

        # Clip to 0-1 range (should already be in range, but ensure it)
        return float(np.clip(similarity, 0.0, 1.0))
