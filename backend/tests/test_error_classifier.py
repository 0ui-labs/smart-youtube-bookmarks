"""
Tests for error classifier service.

TDD RED phase - Tests written BEFORE implementation.
"""

from app.services.error_classifier import classify_error


class TestErrorClassifier:
    """Tests for classify_error function."""

    def test_rate_limit_error_is_retryable(self):
        """Rate limit errors should be retryable with user message."""
        error = Exception("429 Too Many Requests")
        result = classify_error(error)

        assert result.is_retryable is True
        assert result.user_message is not None
        assert (
            "später" in result.user_message.lower()
            or "rate" in result.user_message.lower()
        )

    def test_network_timeout_is_retryable(self):
        """Network timeouts should be retryable."""
        error = TimeoutError("Connection timed out")
        result = classify_error(error)

        assert result.is_retryable is True
        assert result.user_message is not None

    def test_video_not_found_is_not_retryable(self):
        """Video not found errors should not be retryable."""
        error = Exception("Video unavailable")
        result = classify_error(error)

        assert result.is_retryable is False
        assert (
            "nicht gefunden" in result.user_message.lower()
            or "unavailable" in result.user_message.lower()
        )

    def test_private_video_is_not_retryable(self):
        """Private video errors should not be retryable."""
        error = Exception("This video is private")
        result = classify_error(error)

        assert result.is_retryable is False
        assert result.user_message is not None

    def test_age_restricted_video(self):
        """Age-restricted videos should have appropriate message."""
        error = Exception("Sign in to confirm your age")
        result = classify_error(error)

        assert result.is_retryable is False
        assert (
            "alter" in result.user_message.lower()
            or "age" in result.user_message.lower()
        )

    def test_no_captions_available(self):
        """No captions error should have user-friendly message."""
        error = Exception("No captions available for this video")
        result = classify_error(error)

        assert result.is_retryable is False
        assert (
            "untertitel" in result.user_message.lower()
            or "caption" in result.user_message.lower()
        )

    def test_unknown_error_has_generic_message(self):
        """Unknown errors should have generic user message."""
        error = Exception("Some random internal error xyz123")
        result = classify_error(error)

        # Should have a generic message, not expose internal details
        assert result.user_message is not None
        assert "xyz123" not in result.user_message  # Don't leak internal details
        assert len(result.user_message) > 0

    def test_classification_includes_original_error(self):
        """Classification should include reference to original error."""
        original_error = ValueError("Original error message")
        result = classify_error(original_error)

        assert result.original_error is original_error

    def test_connection_error_is_retryable(self):
        """Connection errors should be retryable."""
        error = ConnectionError("Failed to connect")
        result = classify_error(error)

        assert result.is_retryable is True

    def test_api_quota_exceeded(self):
        """API quota exceeded should be retryable later."""
        error = Exception("quota exceeded")
        result = classify_error(error)

        assert result.is_retryable is True
        assert result.user_message is not None
