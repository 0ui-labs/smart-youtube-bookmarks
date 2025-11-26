"""Tests for YouTube caption provider."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.enrichment.providers.youtube_captions import YoutubeCaptionProvider
from app.services.enrichment.providers.base import CaptionResult, CaptionProvider
from app.services.enrichment.exceptions import CaptionExtractionError


class TestYoutubeCaptionProvider:
    """Tests for YoutubeCaptionProvider."""

    def test_provider_inherits_from_base(self):
        """YoutubeCaptionProvider inherits from CaptionProvider."""
        assert issubclass(YoutubeCaptionProvider, CaptionProvider)

    def test_provider_name(self):
        """Provider has correct name."""
        provider = YoutubeCaptionProvider()
        assert provider.name == "youtube"

    @pytest.mark.asyncio
    async def test_fetch_with_manual_captions(self):
        """Fetch returns manual captions when available."""
        provider = YoutubeCaptionProvider()

        mock_vtt_content = """WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world"""

        mock_result = CaptionResult(
            vtt=mock_vtt_content,
            language="en",
            source="youtube_manual"
        )

        with patch.object(provider, '_fetch_with_ytdlp', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_result

            result = await provider.fetch("dQw4w9WgXcQ", 212)

        assert result is not None
        assert isinstance(result, CaptionResult)
        assert result.source == "youtube_manual"
        assert result.language == "en"
        assert "Hello world" in result.vtt

    @pytest.mark.asyncio
    async def test_fetch_with_auto_captions_fallback(self):
        """Fetch returns auto captions when manual not available."""
        provider = YoutubeCaptionProvider()

        mock_vtt_content = """WEBVTT

00:00:00.000 --> 00:00:05.000
Auto generated"""

        mock_result = CaptionResult(
            vtt=mock_vtt_content,
            language="en",
            source="youtube_auto"
        )

        with patch.object(provider, '_fetch_with_ytdlp', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_result

            result = await provider.fetch("dQw4w9WgXcQ", 212)

        assert result is not None
        assert result.source == "youtube_auto"
        assert result.language == "en"

    @pytest.mark.asyncio
    async def test_fetch_returns_none_when_no_captions(self):
        """Fetch returns None when no captions available."""
        provider = YoutubeCaptionProvider()

        with patch.object(provider, '_fetch_with_ytdlp', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = None

            result = await provider.fetch("dQw4w9WgXcQ", 212)

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_prefers_english(self):
        """Fetch prefers English captions over other languages."""
        provider = YoutubeCaptionProvider()

        mock_result = CaptionResult(
            vtt="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest",
            language="en",
            source="youtube_manual"
        )

        with patch.object(provider, '_fetch_with_ytdlp', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_result

            result = await provider.fetch("dQw4w9WgXcQ", 212)

        assert result.language == "en"

    @pytest.mark.asyncio
    async def test_fetch_uses_german_as_second_preference(self):
        """Fetch uses German if English not available."""
        provider = YoutubeCaptionProvider()

        mock_result = CaptionResult(
            vtt="WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest",
            language="de",
            source="youtube_manual"
        )

        with patch.object(provider, '_fetch_with_ytdlp', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_result

            result = await provider.fetch("dQw4w9WgXcQ", 212)

        assert result.language == "de"

    @pytest.mark.asyncio
    async def test_fetch_handles_extraction_error(self):
        """Fetch raises CaptionExtractionError on yt-dlp failure."""
        provider = YoutubeCaptionProvider()

        with patch.object(provider, '_fetch_with_ytdlp', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = Exception("yt-dlp failed")

            with pytest.raises(CaptionExtractionError):
                await provider.fetch("invalid_id", 100)

    @pytest.mark.asyncio
    async def test_fetch_handles_download_error(self):
        """Fetch raises CaptionExtractionError on VTT download failure."""
        provider = YoutubeCaptionProvider()

        with patch.object(provider, '_fetch_with_ytdlp', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = Exception("Download failed")

            with pytest.raises(CaptionExtractionError):
                await provider.fetch("dQw4w9WgXcQ", 212)


class TestYoutubeCaptionProviderLanguageSelection:
    """Tests for language preference logic."""

    def test_select_best_caption_language_prefers_manual_over_auto(self):
        """Manual captions are preferred over auto-generated."""
        provider = YoutubeCaptionProvider()

        subtitles = {"en": [{"ext": "vtt", "url": "url1"}]}
        auto_captions = {"en": [{"ext": "vtt", "url": "url2"}]}

        result = provider._select_best_caption_language(subtitles, auto_captions)

        assert result is not None
        lang, is_auto = result
        assert lang == "en"
        assert is_auto is False

    def test_select_best_caption_language_returns_auto_when_no_manual(self):
        """Auto captions returned when no manual available."""
        provider = YoutubeCaptionProvider()

        subtitles = {}
        auto_captions = {"en": [{"ext": "vtt", "url": "url"}]}

        result = provider._select_best_caption_language(subtitles, auto_captions)

        assert result is not None
        _, is_auto = result
        assert is_auto is True

    def test_select_best_caption_language_returns_none_when_empty(self):
        """Returns None when no captions available."""
        provider = YoutubeCaptionProvider()

        result = provider._select_best_caption_language({}, {})

        assert result is None

    def test_select_best_caption_language_priority(self):
        """Language priority is en > de > first available."""
        provider = YoutubeCaptionProvider()

        # Only French available
        result = provider._select_best_caption_language(
            {"fr": [{"ext": "vtt", "url": "url"}]},
            {}
        )
        assert result[0] == "fr"

        # German available (preferred over French)
        result = provider._select_best_caption_language(
            {"fr": [{"ext": "vtt", "url": "url"}], "de": [{"ext": "vtt", "url": "url"}]},
            {}
        )
        assert result[0] == "de"

        # English available (preferred over all)
        result = provider._select_best_caption_language(
            {"fr": [{"ext": "vtt", "url": "url"}], "de": [{"ext": "vtt", "url": "url"}], "en": [{"ext": "vtt", "url": "url"}]},
            {}
        )
        assert result[0] == "en"


class TestYoutubeCaptionProviderFetchSync:
    """Tests for synchronous fetch logic."""

    def test_read_vtt_file_finds_vtt(self, tmp_path):
        """_read_vtt_file finds and reads VTT files."""
        provider = YoutubeCaptionProvider()

        # Create a test VTT file
        vtt_content = "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest"
        vtt_file = tmp_path / "test_id.en.vtt"
        vtt_file.write_text(vtt_content)

        result = provider._read_vtt_file(str(tmp_path), "test_id", "en")

        assert result == vtt_content

    def test_read_vtt_file_returns_none_when_not_found(self, tmp_path):
        """_read_vtt_file returns None when no VTT file exists."""
        provider = YoutubeCaptionProvider()

        result = provider._read_vtt_file(str(tmp_path), "test_id", "en")

        assert result is None

    def test_find_language_in_priority_returns_english_first(self):
        """_find_language_in_priority returns English when available."""
        provider = YoutubeCaptionProvider()

        captions = {
            "de": [{"ext": "vtt"}],
            "en": [{"ext": "vtt"}],
            "fr": [{"ext": "vtt"}],
        }

        result = provider._find_language_in_priority(captions)

        assert result == "en"

    def test_find_language_in_priority_returns_german_second(self):
        """_find_language_in_priority returns German when English not available."""
        provider = YoutubeCaptionProvider()

        captions = {
            "de": [{"ext": "vtt"}],
            "fr": [{"ext": "vtt"}],
        }

        result = provider._find_language_in_priority(captions)

        assert result == "de"

    def test_find_language_in_priority_returns_first_available(self):
        """_find_language_in_priority returns first available when no preferred."""
        provider = YoutubeCaptionProvider()

        captions = {
            "fr": [{"ext": "vtt"}],
            "es": [{"ext": "vtt"}],
        }

        result = provider._find_language_in_priority(captions)

        # Should return one of the available languages
        assert result in ["fr", "es"]

    def test_find_language_in_priority_returns_none_when_empty(self):
        """_find_language_in_priority returns None for empty dict."""
        provider = YoutubeCaptionProvider()

        result = provider._find_language_in_priority({})

        assert result is None
