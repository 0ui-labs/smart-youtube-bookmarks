"""Tests for enrichment exception classes."""

import pytest

from app.services.enrichment.exceptions import (
    CaptionExtractionError,
    EnrichmentError,
    PermanentError,
    RateLimitError,
    TemporaryError,
    TranscriptionError,
    VideoNotFoundError,
)


class TestExceptionHierarchy:
    """Tests for exception inheritance hierarchy."""

    def test_enrichment_error_is_base_exception(self):
        """EnrichmentError inherits from Exception."""
        assert issubclass(EnrichmentError, Exception)

    def test_temporary_error_inherits_from_enrichment_error(self):
        """TemporaryError inherits from EnrichmentError."""
        assert issubclass(TemporaryError, EnrichmentError)

    def test_permanent_error_inherits_from_enrichment_error(self):
        """PermanentError inherits from EnrichmentError."""
        assert issubclass(PermanentError, EnrichmentError)

    def test_rate_limit_error_inherits_from_temporary_error(self):
        """RateLimitError inherits from TemporaryError (should be retried)."""
        assert issubclass(RateLimitError, TemporaryError)

    def test_video_not_found_error_inherits_from_permanent_error(self):
        """VideoNotFoundError inherits from PermanentError (should not be retried)."""
        assert issubclass(VideoNotFoundError, PermanentError)

    def test_transcription_error_inherits_from_temporary_error(self):
        """TranscriptionError inherits from TemporaryError (API failures can be retried)."""
        assert issubclass(TranscriptionError, TemporaryError)

    def test_caption_extraction_error_inherits_from_temporary_error(self):
        """CaptionExtractionError inherits from TemporaryError (network issues can be retried)."""
        assert issubclass(CaptionExtractionError, TemporaryError)


class TestExceptionMessages:
    """Tests for exception message handling."""

    def test_enrichment_error_with_message(self):
        """EnrichmentError stores message correctly."""
        error = EnrichmentError("Test error message")
        assert str(error) == "Test error message"

    def test_temporary_error_with_message(self):
        """TemporaryError stores message correctly."""
        error = TemporaryError("Temporary failure")
        assert str(error) == "Temporary failure"

    def test_permanent_error_with_message(self):
        """PermanentError stores message correctly."""
        error = PermanentError("Permanent failure")
        assert str(error) == "Permanent failure"

    def test_rate_limit_error_with_retry_after(self):
        """RateLimitError can store retry_after hint."""
        error = RateLimitError("Rate limited", retry_after=60)
        assert error.retry_after == 60
        assert "Rate limited" in str(error)

    def test_rate_limit_error_without_retry_after(self):
        """RateLimitError works without retry_after."""
        error = RateLimitError("Rate limited")
        assert error.retry_after is None

    def test_video_not_found_error_with_youtube_id(self):
        """VideoNotFoundError can store youtube_id."""
        error = VideoNotFoundError("Video not found", youtube_id="dQw4w9WgXcQ")
        assert error.youtube_id == "dQw4w9WgXcQ"
        assert "Video not found" in str(error)

    def test_video_not_found_error_without_youtube_id(self):
        """VideoNotFoundError works without youtube_id."""
        error = VideoNotFoundError("Video not found")
        assert error.youtube_id is None


class TestExceptionCatching:
    """Tests for catching exceptions at different hierarchy levels."""

    def test_catch_temporary_error_catches_rate_limit(self):
        """Catching TemporaryError catches RateLimitError."""
        with pytest.raises(TemporaryError):
            raise RateLimitError("Rate limited")

    def test_catch_temporary_error_catches_transcription_error(self):
        """Catching TemporaryError catches TranscriptionError."""
        with pytest.raises(TemporaryError):
            raise TranscriptionError("Transcription failed")

    def test_catch_permanent_error_catches_video_not_found(self):
        """Catching PermanentError catches VideoNotFoundError."""
        with pytest.raises(PermanentError):
            raise VideoNotFoundError("Video not found")

    def test_catch_enrichment_error_catches_all(self):
        """Catching EnrichmentError catches all enrichment exceptions."""
        with pytest.raises(EnrichmentError):
            raise RateLimitError("Rate limited")

        with pytest.raises(EnrichmentError):
            raise VideoNotFoundError("Not found")

        with pytest.raises(EnrichmentError):
            raise TranscriptionError("Failed")
