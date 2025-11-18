"""
Gemini API client for structured data extraction.

This module provides a client for Google Gemini API to extract structured
data from video transcripts using Pydantic schemas for type safety and validation.
"""

import asyncio
import random
import logging
from typing import Dict, Any, Optional, TypeVar, Type
from pydantic import BaseModel

try:
    from google import genai
    from google.genai import types
except ImportError as e:
    raise ImportError(
        "google-genai package is required. Install with: pip install google-genai[aiohttp]"
    ) from e


logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class GeminiClient:
    """
    Client for Google Gemini API with structured output support.

    This client provides methods for extracting structured data from text
    using Pydantic schemas, with built-in retry logic and error handling.

    Example:
        >>> from pydantic import BaseModel, Field
        >>> from typing import List
        >>>
        >>> class VideoMetadata(BaseModel):
        ...     categories: List[str] = Field(description="Video categories")
        ...     difficulty: str = Field(description="Difficulty level")
        >>>
        >>> client = GeminiClient(api_key="your-api-key")
        >>> result = await client.extract_structured_data(
        ...     transcript="Python tutorial for beginners...",
        ...     schema_model=VideoMetadata
        ... )
        >>> print(result.categories)  # ['Tutorial', 'Python']
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.0-flash-exp",
        max_retries: int = 5,
        base_delay: float = 1.0,
    ):
        """
        Initialize Gemini API client.

        Args:
            api_key: Google Gemini API key
            model: Model name to use (default: gemini-2.0-flash-exp)
            max_retries: Maximum retry attempts for failed requests
            base_delay: Base delay in seconds for exponential backoff

        Raises:
            ValueError: If api_key is empty or None
        """
        if not api_key or not api_key.strip():
            raise ValueError("API key is required for Gemini client")

        self.api_key = api_key.strip()
        self.model = model
        self.max_retries = max_retries
        self.base_delay = base_delay

        # Initialize genai client
        self.client = genai.Client(api_key=self.api_key)

    async def extract_structured_data(
        self,
        transcript: str,
        schema_model: Type[T],
        temperature: float = 0.2,
    ) -> T:
        """
        Extract structured data from transcript using Gemini API.

        This method uses Gemini's structured output feature to extract data
        according to the provided Pydantic schema. The response is automatically
        validated and parsed into the schema model.

        Args:
            transcript: Video transcript text to extract data from
            schema_model: Pydantic model class defining the extraction schema
            temperature: Sampling temperature (0.0-1.0). Lower = more consistent.

        Returns:
            Parsed Pydantic model instance with extracted data

        Raises:
            ValueError: If transcript is empty or whitespace-only
            Exception: If extraction fails after all retry attempts

        Example:
            >>> class VideoData(BaseModel):
            ...     topic: str
            ...     difficulty: str
            >>>
            >>> result = await client.extract_structured_data(
            ...     transcript="Advanced Python decorators...",
            ...     schema_model=VideoData
            ... )
            >>> assert result.difficulty == "Advanced"
        """
        # Validate transcript
        if not transcript or not transcript.strip():
            raise ValueError("Transcript cannot be empty")

        # Build extraction prompt
        prompt = self._build_extraction_prompt(transcript, schema_model)

        # Extract with retry logic
        for attempt in range(self.max_retries):
            try:
                aclient = self.client.aio
                response = await aclient.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=schema_model,
                        temperature=temperature,
                    ),
                )

                # Get parsed result
                parsed_result = response.parsed

                # Explicitly close the client to release connections
                await aclient.aclose()

                # Return parsed data as Pydantic model
                return parsed_result

            except Exception as e:
                logger.warning(
                    f"Extraction attempt {attempt + 1}/{self.max_retries} failed: {e}"
                )

                if attempt == self.max_retries - 1:
                    # Last attempt failed - re-raise
                    raise

                # Exponential backoff with jitter
                delay = min(
                    (2**attempt) * self.base_delay + random.uniform(0, 1), 60
                )
                await asyncio.sleep(delay)

        # Unreachable: loop exits via return (success) or raise (final failure)

    async def count_tokens(self, text: str) -> int:
        """
        Count tokens in text using Gemini's token counting API.

        This method provides accurate token counts for the configured model,
        useful for cost estimation and prompt optimization.

        Args:
            text: Text to count tokens for

        Returns:
            Number of tokens in the text

        Example:
            >>> token_count = await client.count_tokens("Hello, world!")
            >>> assert token_count > 0
        """
        aclient = self.client.aio
        result = await aclient.models.count_tokens(
            model=self.model,
            contents=text,
        )
        return result.total_tokens

    def _build_extraction_prompt(
        self, transcript: str, schema_model: Type[BaseModel]
    ) -> str:
        """
        Build optimized extraction prompt for Gemini API.

        Creates a concise prompt that instructs Gemini to extract structured
        data from the transcript according to the schema. The prompt is
        optimized to minimize token usage while maintaining extraction quality.

        Args:
            transcript: Source transcript text
            schema_model: Pydantic model defining extraction schema

        Returns:
            Formatted prompt string
        """
        # Build schema description from Pydantic model
        schema_desc = self._get_schema_description(schema_model)

        # Truncate very long transcripts (keep first ~10K tokens ≈ 40K chars)
        max_chars = 40000
        if len(transcript) > max_chars:
            transcript = transcript[:max_chars] + "\n[...truncated]"

        return f"""Extract structured information from this YouTube video transcript.

**Schema:**
{schema_desc}

**Instructions:**
- Extract data matching each field in the schema
- Be accurate and factual - only use information clearly stated in the transcript
- If information is unclear or missing, use null or "Unknown"
- Use consistent terminology

**Transcript:**
{transcript}
"""

    def _get_schema_description(self, schema_model: Type[BaseModel]) -> str:
        """
        Get human-readable schema description from Pydantic model.

        Extracts field names, types, and descriptions from the Pydantic model
        to create a readable schema specification for the prompt.

        Args:
            schema_model: Pydantic model class

        Returns:
            Formatted schema description string
        """
        lines = []
        for field_name, field_info in schema_model.model_fields.items():
            # Get field description if available
            description = field_info.description or "No description"
            lines.append(f"- {field_name}: {description}")

        return "\n".join(lines)
