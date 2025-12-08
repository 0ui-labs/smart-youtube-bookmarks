from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# REMOVED: FieldSchemaResponse import - no longer needed since we don't include nested schema


class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tag name")
    color: str | None = Field(
        None, pattern=r"^#[0-9A-Fa-f]{6}$", description="Hex color code"
    )


class TagCreate(TagBase):
    schema_id: UUID | None = None  # BUG FIX: Allow schema binding during creation
    is_video_type: bool = (
        True  # True = category (one per video), False = label (multiple)
    )


class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    schema_id: UUID | None = None  # REF MCP: Simplified from Field(default=None)
    is_video_type: bool | None = None  # Optional: change category/label type


class TagResponse(TagBase):
    id: UUID
    user_id: UUID
    schema_id: UUID | None = None  # Schema FK (use this instead of nested object)
    is_video_type: bool = True  # Default True for legacy tags without this field
    # REMOVED: schema: FieldSchemaResponse | None - Causes lazy-loading issues
    # Frontend only needs schema_id - if full schema needed, fetch via GET /api/schemas/{id}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
