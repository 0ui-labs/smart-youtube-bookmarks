"""Pydantic schemas for Channel API."""
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime


class ChannelBase(BaseModel):
    """Base schema for Channel."""
    name: str = Field(..., min_length=1, max_length=255, description="Channel display name")
    youtube_channel_id: str = Field(..., min_length=1, max_length=50, description="YouTube channel ID")
    thumbnail_url: str | None = Field(None, max_length=500, description="Channel avatar URL")
    description: str | None = Field(None, description="Channel description from YouTube")
    is_hidden: bool = Field(False, description="Hidden channels don't appear in sidebar")


class ChannelUpdate(BaseModel):
    """Schema for updating a channel (only is_hidden can be changed by user)."""
    is_hidden: bool | None = None


class ChannelResponse(BaseModel):
    """Schema for channel response with video count."""
    id: UUID
    user_id: UUID
    youtube_channel_id: str
    name: str
    thumbnail_url: str | None = None
    description: str | None = None
    is_hidden: bool = False
    video_count: int = Field(0, description="Number of videos in this channel")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
