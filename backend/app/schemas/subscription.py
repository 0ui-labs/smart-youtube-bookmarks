"""
Pydantic schemas for subscription API endpoints.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DurationFilter(BaseModel):
    """Filter for video duration in seconds."""

    min_seconds: int | None = Field(
        None, ge=0, description="Minimum duration in seconds"
    )
    max_seconds: int | None = Field(
        None, ge=0, description="Maximum duration in seconds"
    )


class ViewsFilter(BaseModel):
    """Filter for minimum view count."""

    min_views: int | None = Field(None, ge=0, description="Minimum view count")


class CustomFieldFilter(BaseModel):
    """Filter based on custom field values."""

    field_id: UUID
    operator: Literal["eq", "ne", "gt", "gte", "lt", "lte", "contains"] = Field(
        description="Comparison operator"
    )
    value: str | int | float | bool


class SubscriptionFilters(BaseModel):
    """
    Combined filters for subscription matching.

    All specified filters must match (AND logic).
    """

    duration: DurationFilter | None = None
    views: ViewsFilter | None = None
    youtube_category: list[str] | None = Field(
        None, description="YouTube category IDs to match"
    )
    published_after: str | None = Field(
        None, description="Only match videos published after this date (ISO format)"
    )
    custom_fields: list[CustomFieldFilter] = Field(
        default_factory=list, description="Custom field value filters"
    )


class SubscriptionCreate(BaseModel):
    """Schema for creating a new subscription."""

    list_id: UUID = Field(description="Target list for imported videos")
    name: str = Field(
        ..., min_length=1, max_length=255, description="Subscription name"
    )
    channel_ids: list[str] | None = Field(
        None, description="YouTube channel IDs to monitor"
    )
    keywords: list[str] | None = Field(None, description="Keywords to search for")
    filters: SubscriptionFilters = Field(
        default_factory=SubscriptionFilters, description="Video matching filters"
    )
    poll_interval: Literal["daily", "twice_daily"] = Field(
        "daily", description="How often to poll for new videos"
    )


class SubscriptionUpdate(BaseModel):
    """Schema for updating an existing subscription."""

    name: str | None = Field(None, min_length=1, max_length=255)
    is_active: bool | None = None
    channel_ids: list[str] | None = None
    keywords: list[str] | None = None
    filters: SubscriptionFilters | None = None
    poll_interval: Literal["daily", "twice_daily"] | None = None
    list_id: UUID | None = Field(
        None, description="Move subscription to different list"
    )


class SubscriptionResponse(BaseModel):
    """Schema for subscription in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    list_id: UUID
    name: str
    is_active: bool
    channel_ids: list[str] | None
    keywords: list[str] | None
    filters: SubscriptionFilters
    poll_interval: str
    last_polled_at: datetime | None
    next_poll_at: datetime | None
    match_count: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class SubscriptionMatchResponse(BaseModel):
    """Schema for subscription match in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subscription_id: UUID
    video_id: UUID
    matched_at: datetime
    source: str | None


class SyncResponse(BaseModel):
    """Response from manual subscription sync."""

    new_videos: int = Field(description="Number of new videos imported")


class QuotaStatusResponse(BaseModel):
    """Response for YouTube API quota status."""

    used: int = Field(description="Units used today")
    remaining: int = Field(description="Units remaining today")
    limit: int = Field(description="Daily quota limit")
    percentage: float = Field(description="Percentage of quota used")
