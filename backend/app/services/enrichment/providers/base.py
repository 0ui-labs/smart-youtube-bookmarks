"""Base classes for caption providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class CaptionResult:
    """Result from a caption provider.

    Attributes:
        vtt: Caption content in WebVTT format
        language: ISO 639-1 language code (e.g., "en", "de")
        source: Source identifier (e.g., "youtube_manual", "youtube_auto", "groq_whisper")
    """
    vtt: str
    language: str
    source: str


class CaptionProvider(ABC):
    """Abstract base class for caption providers.

    Each provider implements a strategy for obtaining captions for a video.
    Providers are tried in order until one succeeds.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier. Subclasses must implement this."""
        ...

    @abstractmethod
    async def fetch(self, youtube_id: str, duration: int) -> Optional[CaptionResult]:
        """Fetch captions for a YouTube video.

        Args:
            youtube_id: YouTube video ID (e.g., "dQw4w9WgXcQ")
            duration: Video duration in seconds (used for chunking decisions)

        Returns:
            CaptionResult if captions were found, None otherwise
        """
        pass
