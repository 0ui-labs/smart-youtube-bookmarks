"""
Error Classifier Service.

Classifies exceptions into user-friendly messages and determines
if errors are retryable. This ensures users never see technical
error messages like stack traces or internal codes.

Usage:
    from app.services.error_classifier import classify_error

    try:
        await fetch_video_data(video_id)
    except Exception as e:
        result = classify_error(e)
        if result.is_retryable:
            # Schedule retry
        else:
            # Show user_message to user
"""

import re
from dataclasses import dataclass


@dataclass
class ErrorClassification:
    """Result of error classification."""

    user_message: str
    is_retryable: bool
    original_error: Exception


# Error patterns and their classifications
# Format: (pattern, user_message, is_retryable)
ERROR_PATTERNS = [
    # Rate limiting / Quota errors (retryable)
    (
        r"429|too many requests|rate.?limit",
        "Zu viele Anfragen. Bitte später erneut versuchen.",
        True,
    ),
    (
        r"quota.?exceeded|quota.?limit",
        "API-Kontingent erschöpft. Bitte später erneut versuchen.",
        True,
    ),
    # Network errors (retryable)
    (
        r"timeout|timed?.?out",
        "Zeitüberschreitung bei der Verbindung. Wird erneut versucht.",
        True,
    ),
    (
        r"connection.?(error|refused|reset)|network",
        "Verbindungsfehler. Wird erneut versucht.",
        True,
    ),
    # Video unavailable errors (not retryable)
    (
        r"video.?(unavailable|not.?found|removed|deleted)",
        "Video nicht gefunden oder nicht mehr verfügbar.",
        False,
    ),
    (
        r"private.?video|this video is private",
        "Dieses Video ist privat und kann nicht importiert werden.",
        False,
    ),
    (
        r"age.?restrict|sign.?in.?to.?confirm.?your.?age",
        "Dieses Video hat eine Altersbeschränkung.",
        False,
    ),
    # Caption errors (not retryable)
    (
        r"no.?captions?.?(available)?|captions?.?not.?(available|found)",
        "Keine Untertitel für dieses Video verfügbar.",
        False,
    ),
    (
        r"subtitles?.?disabled|captions?.?disabled",
        "Untertitel sind für dieses Video deaktiviert.",
        False,
    ),
    # Geographic restrictions (not retryable)
    (
        r"geo.?restrict|not.?available.?in.?your.?country",
        "Dieses Video ist in deiner Region nicht verfügbar.",
        False,
    ),
    # Copyright/DMCA (not retryable)
    (
        r"copyright|dmca|blocked",
        "Dieses Video wurde aus urheberrechtlichen Gründen blockiert.",
        False,
    ),
]

# Default message for unclassified errors
DEFAULT_USER_MESSAGE = "Ein Fehler ist aufgetreten. Bitte versuche es später erneut."


def classify_error(error: Exception) -> ErrorClassification:
    """
    Classify an exception into a user-friendly result.

    Args:
        error: The exception to classify

    Returns:
        ErrorClassification with user_message, is_retryable, and original_error
    """
    error_str = str(error).lower()

    # Check for specific exception types first
    if isinstance(error, (TimeoutError, ConnectionError)):
        return ErrorClassification(
            user_message="Verbindungsfehler. Wird erneut versucht.",
            is_retryable=True,
            original_error=error,
        )

    # Check against patterns
    for pattern, user_message, is_retryable in ERROR_PATTERNS:
        if re.search(pattern, error_str, re.IGNORECASE):
            return ErrorClassification(
                user_message=user_message,
                is_retryable=is_retryable,
                original_error=error,
            )

    # Default: unknown error, not retryable, generic message
    return ErrorClassification(
        user_message=DEFAULT_USER_MESSAGE,
        is_retryable=False,
        original_error=error,
    )
