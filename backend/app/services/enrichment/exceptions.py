"""Exception classes for video enrichment service.

Exception hierarchy:
    EnrichmentError (base)
    ├── TemporaryError (retriable)
    │   ├── RateLimitError
    │   ├── TranscriptionError
    │   └── CaptionExtractionError
    └── PermanentError (not retriable)
        └── VideoNotFoundError
"""


class EnrichmentError(Exception):
    """Base exception for all enrichment errors."""

    pass


class TemporaryError(EnrichmentError):
    """Temporary error that can be retried."""

    pass


class PermanentError(EnrichmentError):
    """Permanent error that should not be retried."""

    pass


class RateLimitError(TemporaryError):
    """Rate limit exceeded error with optional retry_after hint."""

    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class VideoNotFoundError(PermanentError):
    """Video not found or unavailable."""

    def __init__(self, message: str, youtube_id: str | None = None):
        super().__init__(message)
        self.youtube_id = youtube_id


class TranscriptionError(TemporaryError):
    """Error during audio transcription (Groq API)."""

    pass


class CaptionExtractionError(TemporaryError):
    """Error extracting captions from YouTube."""

    pass
