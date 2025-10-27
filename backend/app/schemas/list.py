from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    schema_id: Optional[UUID] = None


class ListUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class ListResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    schema_id: Optional[UUID]
    video_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
