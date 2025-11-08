from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

from app.schemas.field_schema import FieldSchemaResponse


class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tag name")
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', description="Hex color code")


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    schema_id: UUID | None = None  # REF MCP: Simplified from Field(default=None)


class TagResponse(TagBase):
    id: UUID
    user_id: UUID
    schema_id: UUID | None = None  # Add schema_id to response
    schema: FieldSchemaResponse | None = None  # Add nested schema object
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
