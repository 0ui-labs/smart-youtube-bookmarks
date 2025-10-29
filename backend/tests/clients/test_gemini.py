"""
Tests for Gemini API client.

This module tests the GeminiClient service for structured data extraction
from video transcripts using Google Gemini API with Pydantic schemas.
"""

import pytest
from typing import List, Optional
from pydantic import BaseModel, Field


class TestGeminiClientBasicExtraction:
    """Test basic structured data extraction functionality."""

    @pytest.mark.asyncio
    async def test_extract_structured_data_with_simple_schema(self, gemini_client):
        """
        Test extracting structured data from transcript using a simple schema.

        This test demonstrates the desired API:
        - Accept transcript text and Pydantic schema
        - Return parsed Pydantic object with extracted data
        - Handle basic field types (string, list)
        """
        # Define schema for extraction
        class VideoMetadata(BaseModel):
            """Schema for video metadata extraction."""

            categories: List[str] = Field(description="Video topic categories")
            difficulty_level: str = Field(
                description="Difficulty: Beginner, Intermediate, or Advanced"
            )
            summary: Optional[str] = Field(
                description="Brief 2-3 sentence summary", default=None
            )

        # Sample transcript
        transcript = """
        Welcome to this Python tutorial for absolute beginners!
        In this video, we'll cover the basics of Python programming,
        including variables, data types, and control flow.
        This tutorial is designed for people with no prior programming experience.
        """

        # Extract data
        result = await gemini_client.extract_structured_data(
            transcript=transcript, schema_model=VideoMetadata
        )

        # Verify result is correct type
        assert isinstance(result, VideoMetadata)

        # Verify extracted data makes sense
        assert "Python" in str(result.categories) or "Tutorial" in str(
            result.categories
        )
        assert result.difficulty_level in ["Beginner", "Intermediate", "Advanced"]
        # Removed brittle assertion checking exact difficulty - LLM output can vary
        assert result.summary is not None
        assert len(result.summary) > 0


class TestGeminiClientErrorHandling:
    """Test error handling and edge cases."""

    @pytest.mark.asyncio
    async def test_requires_api_key(self):
        """
        Test that GeminiClient requires API key.

        Should raise ValueError if initialized without API key.
        """
        from app.clients.gemini import GeminiClient

        with pytest.raises(ValueError, match="API key is required"):
            GeminiClient(api_key="")

    @pytest.mark.asyncio
    async def test_handles_empty_transcript(self, gemini_client):
        """
        Test handling of empty transcript.

        Should raise ValueError for empty/whitespace-only transcripts.
        """
        from pydantic import BaseModel

        class SimpleSchema(BaseModel):
            topic: str

        with pytest.raises(ValueError, match="Transcript cannot be empty"):
            await gemini_client.extract_structured_data(
                transcript="", schema_model=SimpleSchema
            )

        with pytest.raises(ValueError, match="Transcript cannot be empty"):
            await gemini_client.extract_structured_data(
                transcript="   \n  ", schema_model=SimpleSchema
            )


class TestGeminiClientTokenManagement:
    """Test token counting and optimization features."""

    @pytest.mark.asyncio
    async def test_count_tokens(self, gemini_client):
        """
        Test token counting functionality.

        Should return approximate token count for given text.
        """
        text = "This is a test transcript for token counting."

        token_count = await gemini_client.count_tokens(text)

        # Rough estimate: ~10-15 tokens for this text
        assert isinstance(token_count, int)
        assert token_count > 0
        assert token_count < 100  # Sanity check


# Fixtures


@pytest.fixture
async def gemini_client():
    """
    Fixture providing a GeminiClient instance for testing.

    Uses test API key from environment or mock for unit tests.
    """
    from app.clients.gemini import GeminiClient
    from app.core.config import settings

    # Use real API key if available, otherwise skip tests that need it
    api_key = settings.gemini_api_key

    if not api_key:
        pytest.skip("GEMINI_API_KEY not configured - skipping integration tests")

    client = GeminiClient(api_key=api_key)

    yield client

    # Cleanup (if needed)
