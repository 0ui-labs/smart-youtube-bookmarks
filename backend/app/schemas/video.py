"""
Pydantic schemas for Video API endpoints.

Includes enhanced URL validation with security checks.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID
from urllib.parse import urlparse
import re

from pydantic import BaseModel, Field, AfterValidator

# Import for circular dependency resolution (TYPE_CHECKING)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .tag import TagResponse


def validate_youtube_url(url: str) -> str:
    """
    Validate YouTube URL with comprehensive security checks.

    Validates:
    1. ASCII-only characters (prevents Unicode bypass attacks)
    2. HTTPS protocol only (security requirement)
    3. Domain whitelist (prevents open redirect)
    4. YouTube video ID format (11 characters [a-zA-Z0-9_-])

    Raises:
        ValueError: If URL fails any validation check

    Returns:
        str: The validated URL
    """
    # 1. ASCII only (prevents Unicode bypass)
    if not url.isascii():
        raise ValueError('URL must contain only ASCII characters')

    # 2. Parse and validate protocol
    parsed = urlparse(url)
    if parsed.scheme != 'https':
        raise ValueError('URL must use HTTPS protocol')

    # 3. Domain whitelist (prevents open redirect)
    allowed_domains = {'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'}
    if parsed.netloc not in allowed_domains:
        raise ValueError(f'Domain must be one of: {", ".join(allowed_domains)}')

    # 4. Extract YouTube ID with regex
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'm\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return url

    raise ValueError('Invalid YouTube URL format - could not extract video ID')


class VideoAdd(BaseModel):
    """Schema for adding a video to a list."""
    url: Annotated[
        str,
        AfterValidator(validate_youtube_url),
        Field(min_length=1, description="YouTube video URL (HTTPS only)")
    ]


class VideoResponse(BaseModel):
    """
    Schema for video response.

    Includes YouTube metadata fields populated immediately via API fetch.
    Fields may be None if metadata fetch fails or video is not found.
    """
    id: UUID
    list_id: UUID
    youtube_id: str

    # YouTube Metadata (fetched from YouTube Data API v3)
    title: str | None = None
    channel: str | None = None
    thumbnail_url: str | None = None
    duration: int | None = None  # Duration in seconds
    published_at: datetime | None = None

    # Tags (many-to-many relationship)
    tags: list["TagResponse"] = Field(default_factory=list)

    processing_status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class BulkUploadFailure(BaseModel):
    """Details about a failed video upload in bulk operation."""
    row: int
    url: str
    error: str


class BulkUploadResponse(BaseModel):
    """Response schema for bulk video upload."""
    created_count: int
    failed_count: int
    failures: list[BulkUploadFailure] = Field(default_factory=list)


# Resolve forward references after all schemas are defined
def rebuild_schemas():
    """Rebuild schemas to resolve forward references (TagResponse)."""
    from .tag import TagResponse  # noqa: F401
    VideoResponse.model_rebuild()


# Call rebuild when module is imported
rebuild_schemas()
