from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    schema_id: UUID | None = None
    user_id: UUID | None = None  # Will be set from authenticated user


class ListUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    default_schema_id: UUID | None = None  # Workspace-wide schema for all videos


class ListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    user_id: UUID
    schema_id: UUID | None
    default_schema_id: UUID | None = None  # Workspace-wide schema for all videos
    video_count: int
    created_at: datetime
    updated_at: datetime
