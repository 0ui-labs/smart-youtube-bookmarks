"""Pydantic schemas for Video Enrichment API endpoints."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class EnrichmentStatus(str, Enum):
    """Status of video enrichment processing."""

    pending = "pending"
    processing = "processing"
    completed = "completed"
    partial = "partial"
    failed = "failed"


class ChapterSchema(BaseModel):
    """Schema for a video chapter."""

    title: str = Field(..., description="Chapter title")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")


class EnrichmentResponse(BaseModel):
    """Response schema for video enrichment data."""

    id: UUID = Field(..., description="Enrichment record ID")
    video_id: UUID = Field(..., description="Associated video ID")
    status: EnrichmentStatus = Field(..., description="Enrichment processing status")

    # Captions
    captions_vtt: str | None = Field(None, description="Captions in VTT format")
    captions_language: str | None = Field(None, description="Caption language code")
    captions_source: str | None = Field(
        None, description="Caption source (youtube_manual, youtube_auto, groq_whisper)"
    )

    # Transcript
    transcript_text: str | None = Field(
        None, description="Plain text transcript for search"
    )

    # Chapters
    chapters: list[ChapterSchema] | None = Field(None, description="Video chapters")
    chapters_vtt: str | None = Field(None, description="Chapters in VTT format")
    chapters_source: str | None = Field(
        None, description="Chapter source (youtube, description)"
    )

    # Thumbnails
    thumbnails_vtt_url: str | None = Field(
        None, description="Thumbnails sprite sheet VTT URL"
    )

    # Processing state
    error_message: str | None = Field(None, description="Error message if failed")
    retry_count: int = Field(0, description="Number of retry attempts")
    progress_message: str | None = Field(None, description="Current processing step")

    # Timestamps
    created_at: datetime | None = Field(None, description="Record creation time")
    updated_at: datetime | None = Field(None, description="Last update time")
    processed_at: datetime | None = Field(None, description="Completion time")

    model_config = {"from_attributes": True}


class EnrichmentRetryResponse(BaseModel):
    """Response schema for enrichment retry request."""

    message: str = Field(..., description="Status message")
    enrichment: EnrichmentResponse = Field(..., description="Updated enrichment data")
