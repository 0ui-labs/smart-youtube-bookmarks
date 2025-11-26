"""YouTube caption provider using yt-dlp."""
import asyncio
import tempfile
import os
from typing import Optional, Tuple, Dict, Any, List

from .base import CaptionProvider, CaptionResult
from ..exceptions import CaptionExtractionError


# Language preference order
LANGUAGE_PRIORITY = ["en", "de"]


class YoutubeCaptionProvider(CaptionProvider):
    """Provider for extracting captions from YouTube using yt-dlp.

    Uses yt-dlp for both extraction AND download to benefit from its
    built-in rate limiting and retry logic. This avoids YouTube 429 errors.

    Prefers manual captions over auto-generated, and English over other languages.
    """

    @property
    def name(self) -> str:
        return "youtube"

    async def fetch(self, youtube_id: str, duration: int) -> Optional[CaptionResult]:
        """Fetch captions from YouTube using yt-dlp.

        yt-dlp handles both metadata extraction and caption download,
        with built-in rate limiting to avoid 429 errors.

        Args:
            youtube_id: YouTube video ID
            duration: Video duration in seconds (unused, for interface compatibility)

        Returns:
            CaptionResult if captions found, None otherwise

        Raises:
            CaptionExtractionError: If extraction fails
        """
        try:
            result = await self._fetch_with_ytdlp(youtube_id)
            return result
        except Exception as e:
            raise CaptionExtractionError(f"Failed to fetch captions: {e}") from e

    async def _fetch_with_ytdlp(self, youtube_id: str) -> Optional[CaptionResult]:
        """Fetch captions using yt-dlp's built-in subtitle download.

        Args:
            youtube_id: YouTube video ID

        Returns:
            CaptionResult if captions found, None otherwise
        """
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._fetch_sync(youtube_id)
        )

    def _fetch_sync(self, youtube_id: str) -> Optional[CaptionResult]:
        """Synchronous yt-dlp fetch (runs in thread pool)."""
        import yt_dlp

        url = f"https://www.youtube.com/watch?v={youtube_id}"

        # Create temp directory for subtitle files
        with tempfile.TemporaryDirectory() as tmpdir:
            output_template = os.path.join(tmpdir, "%(id)s")

            # First, extract info to find available subtitles
            info_opts = {
                "skip_download": True,
                "quiet": True,
                "no_warnings": True,
            }

            with yt_dlp.YoutubeDL(info_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            subtitles = info.get("subtitles", {})
            auto_captions = info.get("automatic_captions", {})

            # Determine which language to download
            selection = self._select_best_caption_language(subtitles, auto_captions)
            if selection is None:
                return None

            language, is_auto = selection

            # Download subtitles with yt-dlp (uses its rate limiting)
            download_opts = {
                "skip_download": True,
                "writesubtitles": not is_auto,
                "writeautomaticsub": is_auto,
                "subtitleslangs": [language],
                "subtitlesformat": "vtt",
                "outtmpl": output_template,
                "quiet": True,
                "no_warnings": True,
                # Rate limiting options
                "sleep_interval_subtitles": 1,  # 1 second between subtitle requests
            }

            with yt_dlp.YoutubeDL(download_opts) as ydl:
                ydl.download([url])

            # Find and read the downloaded VTT file
            vtt_content = self._read_vtt_file(tmpdir, youtube_id, language)
            if vtt_content is None:
                return None

            source = "youtube_auto" if is_auto else "youtube_manual"

            return CaptionResult(
                vtt=vtt_content,
                language=language,
                source=source
            )

    def _read_vtt_file(self, tmpdir: str, youtube_id: str, language: str) -> Optional[str]:
        """Read VTT file from temp directory.

        Args:
            tmpdir: Temporary directory path
            youtube_id: YouTube video ID
            language: Language code

        Returns:
            VTT content or None if file not found
        """
        # Scan directory for any VTT file created by yt-dlp
        for filename in os.listdir(tmpdir):
            if filename.endswith(".vtt"):
                filepath = os.path.join(tmpdir, filename)
                with open(filepath, "r", encoding="utf-8") as f:
                    return f.read()

        return None

    def _select_best_caption_language(
        self,
        subtitles: Dict[str, List[Dict[str, Any]]],
        auto_captions: Dict[str, List[Dict[str, Any]]]
    ) -> Optional[Tuple[str, bool]]:
        """Select the best caption language to download.

        Preference order:
        1. Manual captions in preferred language (en > de > first available)
        2. Auto captions in preferred language

        Args:
            subtitles: Manual subtitle tracks
            auto_captions: Auto-generated caption tracks

        Returns:
            Tuple of (language, is_auto) or None if no captions
        """
        # Try manual captions first
        lang = self._find_language_in_priority(subtitles)
        if lang:
            return (lang, False)

        # Fall back to auto captions
        lang = self._find_language_in_priority(auto_captions)
        if lang:
            return (lang, True)

        return None

    def _find_language_in_priority(
        self,
        captions: Dict[str, List[Dict[str, Any]]]
    ) -> Optional[str]:
        """Find caption language by priority.

        Args:
            captions: Caption tracks by language

        Returns:
            Language code or None
        """
        if not captions:
            return None

        # Try preferred languages first
        for lang in LANGUAGE_PRIORITY:
            if lang in captions:
                return lang

        # Fall back to first available
        for lang in captions.keys():
            return lang

        return None
