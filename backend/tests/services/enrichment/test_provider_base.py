"""Tests for caption provider base class."""
import pytest
from abc import ABC

from app.services.enrichment.providers.base import (
    CaptionProvider,
    CaptionResult,
)


class TestCaptionResult:
    """Tests for CaptionResult dataclass."""

    def test_caption_result_creation(self):
        """CaptionResult can be created with required fields."""
        result = CaptionResult(
            vtt="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello",
            language="en",
            source="youtube_manual"
        )

        assert result.vtt.startswith("WEBVTT")
        assert result.language == "en"
        assert result.source == "youtube_manual"

    def test_caption_result_sources(self):
        """CaptionResult accepts different source types."""
        sources = ["youtube_manual", "youtube_auto", "groq_whisper"]

        for source in sources:
            result = CaptionResult(vtt="WEBVTT\n", language="en", source=source)
            assert result.source == source

    def test_caption_result_languages(self):
        """CaptionResult accepts different language codes."""
        languages = ["en", "de", "fr", "es", "ja"]

        for lang in languages:
            result = CaptionResult(vtt="WEBVTT\n", language=lang, source="test")
            assert result.language == lang


class TestCaptionProvider:
    """Tests for CaptionProvider abstract base class."""

    def test_caption_provider_is_abstract(self):
        """CaptionProvider is an abstract base class."""
        assert issubclass(CaptionProvider, ABC)

    def test_caption_provider_has_name_attribute(self):
        """CaptionProvider requires name class attribute."""
        # Create a concrete implementation to test
        class ConcreteProvider(CaptionProvider):
            name = "test_provider"

            async def fetch(self, youtube_id: str, duration: int):
                return None

        provider = ConcreteProvider()
        assert provider.name == "test_provider"

    def test_caption_provider_fetch_is_abstract(self):
        """CaptionProvider.fetch is abstract method."""
        # Cannot instantiate without implementing fetch
        class IncompleteProvider(CaptionProvider):
            name = "incomplete"

        with pytest.raises(TypeError):
            IncompleteProvider()

    def test_concrete_provider_can_be_instantiated(self):
        """Concrete provider with fetch implemented can be created."""
        class WorkingProvider(CaptionProvider):
            name = "working"

            async def fetch(self, youtube_id: str, duration: int):
                return CaptionResult(
                    vtt="WEBVTT\n",
                    language="en",
                    source=self.name
                )

        provider = WorkingProvider()
        assert provider.name == "working"

    @pytest.mark.asyncio
    async def test_concrete_provider_fetch_signature(self):
        """Provider fetch method has correct signature."""
        class TestProvider(CaptionProvider):
            name = "test"

            async def fetch(self, youtube_id: str, duration: int):
                # Verify we receive the expected parameters
                assert isinstance(youtube_id, str)
                assert isinstance(duration, int)
                return CaptionResult(
                    vtt="WEBVTT\n",
                    language="en",
                    source="test"
                )

        provider = TestProvider()
        result = await provider.fetch("dQw4w9WgXcQ", 212)

        assert result is not None
        assert isinstance(result, CaptionResult)

    @pytest.mark.asyncio
    async def test_provider_can_return_none(self):
        """Provider can return None when no captions available."""
        class NoResultProvider(CaptionProvider):
            name = "no_result"

            async def fetch(self, youtube_id: str, duration: int):
                return None

        provider = NoResultProvider()
        result = await provider.fetch("nonexistent", 100)

        assert result is None
