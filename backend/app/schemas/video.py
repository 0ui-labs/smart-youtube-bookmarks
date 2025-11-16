"""
Pydantic schemas for Video API endpoints.

Includes enhanced URL validation with security checks.
"""

from datetime import datetime
from typing import Annotated, Optional, Literal
from uuid import UUID
from urllib.parse import urlparse
import re
from enum import Enum

from pydantic import BaseModel, Field, AfterValidator, ConfigDict, model_validator

# Import for circular dependency resolution (TYPE_CHECKING)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .tag import TagResponse

# Import existing CustomFieldResponse from Task #64 (REF #5: DRY principle)
from .custom_field import CustomFieldResponse


class FieldFilterOperator(str, Enum):
    """Filter operators for different field types."""
    # Numeric (rating)
    EQ = "eq"          # Equal to
    GT = "gt"          # Greater than
    GTE = "gte"        # Greater than or equal
    LT = "lt"          # Less than
    LTE = "lte"        # Less than or equal
    BETWEEN = "between"  # Between min and max

    # Text/Select
    CONTAINS = "contains"  # Text contains (case-insensitive)
    EXACT = "exact"        # Exact match (case-sensitive)
    IN = "in"              # One of (for select options)

    # Boolean
    IS = "is"  # True or False


class FieldFilter(BaseModel):
    """Single field filter specification."""
    field_id: UUID = Field(..., description="UUID of custom field to filter by")
    operator: FieldFilterOperator = Field(..., description="Filter operator")
    value: Optional[str | int | bool] = Field(None, description="Filter value")
    value_min: Optional[int] = Field(None, description="Min value for BETWEEN")
    value_max: Optional[int] = Field(None, description="Max value for BETWEEN")

    @model_validator(mode='after')
    def validate_operator_values(self) -> 'FieldFilter':
        """Validate that required values are present and have correct types for each operator."""
        # BETWEEN operator validation
        if self.operator == FieldFilterOperator.BETWEEN:
            if self.value_min is None or self.value_max is None:
                raise ValueError("BETWEEN operator requires both value_min and value_max")
            # Type check: must be int, not bool (bool is subclass of int in Python)
            if isinstance(self.value_min, bool) or isinstance(self.value_max, bool):
                raise ValueError("BETWEEN operator requires integer values, not boolean")
            if not isinstance(self.value_min, int) or not isinstance(self.value_max, int):
                raise ValueError("BETWEEN operator requires integer values for value_min and value_max")
            if self.value_min > self.value_max:
                raise ValueError("value_min must be <= value_max")

        # Numeric comparison operators (for rating fields)
        elif self.operator in (FieldFilterOperator.GT, FieldFilterOperator.GTE,
                               FieldFilterOperator.LT, FieldFilterOperator.LTE):
            if self.value is None:
                raise ValueError(f"{self.operator.value} operator requires 'value' field")
            # Type check: must be int, not bool
            if isinstance(self.value, bool):
                raise ValueError(f"{self.operator.value} operator requires integer value, not boolean")
            if not isinstance(self.value, int):
                raise ValueError(f"{self.operator.value} operator requires integer value")

        # Text operators (for text fields)
        elif self.operator in (FieldFilterOperator.CONTAINS, FieldFilterOperator.EXACT,
                               FieldFilterOperator.IN):
            if self.value is None:
                raise ValueError(f"{self.operator.value} operator requires 'value' field")
            if not isinstance(self.value, str):
                raise ValueError(f"{self.operator.value} operator requires string value")

        # Boolean operator (for boolean fields)
        elif self.operator == FieldFilterOperator.IS:
            if self.value is None:
                raise ValueError(f"{self.operator.value} operator requires 'value' field")
            if not isinstance(self.value, bool):
                raise ValueError(f"{self.operator.value} operator requires boolean value")

        return self

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"field_id": "550e8400-e29b-41d4-a716-446655440000", "operator": "gte", "value": 4},
                {"field_id": "550e8400-e29b-41d4-a716-446655440000", "operator": "contains", "value": "tutorial"},
                {"field_id": "550e8400-e29b-41d4-a716-446655440000", "operator": "in", "value": "great,good"},
                {"field_id": "550e8400-e29b-41d4-a716-446655440000", "operator": "is", "value": True},
                {"field_id": "550e8400-e29b-41d4-a716-446655440000", "operator": "between", "value_min": 3, "value_max": 5},
            ]
        }
    )


class VideoFilterRequest(BaseModel):
    """Request body for POST /videos/filter endpoint."""
    tags: Optional[list[str]] = Field(None, description="Tag names for OR filtering")
    field_filters: Optional[list[FieldFilter]] = Field(None, description="Field filters (AND logic)")
    sort_by: Optional[str] = Field(None, description="Sort column: 'title', 'duration', 'created_at', 'channel', or 'field:<field_id>'")
    sort_order: Optional[Literal["asc", "desc"]] = Field("asc", description="Sort direction")

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "tags": ["Python", "Tutorial"],
                    "field_filters": [
                        {"field_id": "550e8400-e29b-41d4-a716-446655440000", "operator": "gte", "value": 4}
                    ],
                    "sort_by": "title",
                    "sort_order": "asc"
                }
            ]
        }
    )


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


class VideoFieldValueResponse(BaseModel):
    """
    Response model for a video's custom field value.

    Includes the field definition, current value, and schema context
    for frontend grouping and conflict resolution display.

    REF MCP Improvement #3: value uses float (not int) for PostgreSQL NUMERIC compatibility.
    REF MCP Improvement #5: Reuses existing CustomFieldResponse from Task #64.
    """
    id: UUID  # VideoFieldValue primary key
    video_id: UUID  # Foreign key to video
    field_id: UUID
    field_name: str  # Convenience field (from field.name)
    field: CustomFieldResponse  # Nested field definition (from Task #64)
    value: str | float | bool | None = None  # REF #3: float not int
    schema_name: str | None = None  # For multi-tag conflict resolution
    show_on_card: bool = False  # From schema_fields.show_on_card
    display_order: int = 0  # From schema_fields.display_order
    updated_at: datetime  # Last update timestamp

    model_config = ConfigDict(from_attributes=True)


class AvailableFieldResponse(BaseModel):
    """
    Metadata for an available field (without value).

    Used in detail endpoint to show which fields CAN be filled.
    """
    field_id: UUID
    field_name: str
    field_type: str  # 'rating', 'select', 'text', 'boolean'
    schema_name: str | None  # None if no conflict, else "Schema: Field"
    display_order: int
    show_on_card: bool

    # Optional: For UI hints
    config: dict = Field(default_factory=dict)  # e.g., {'max_rating': 5} or {'options': ['bad', 'good']}

    model_config = ConfigDict(from_attributes=True)


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

    # Field values (custom fields from tag schemas)
    field_values: list[VideoFieldValueResponse] = Field(default_factory=list)

    # NEW field for detail endpoint (Option D - Intelligente Lösung)
    available_fields: list[AvailableFieldResponse] | None = None  # Optional: only set in detail endpoint

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
