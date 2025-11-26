"""Pydantic schemas for Video Enrichment API endpoints."""
from datetime import datetime
from enum import Enum
from typing import Optional, List
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
    captions_vtt: Optional[str] = Field(None, description="Captions in VTT format")
    captions_language: Optional[str] = Field(None, description="Caption language code")
    captions_source: Optional[str] = Field(None, description="Caption source (youtube_manual, youtube_auto, groq_whisper)")

    # Transcript
    transcript_text: Optional[str] = Field(None, description="Plain text transcript for search")

    # Chapters
    chapters: Optional[List[ChapterSchema]] = Field(None, description="Video chapters")
    chapters_vtt: Optional[str] = Field(None, description="Chapters in VTT format")
    chapters_source: Optional[str] = Field(None, description="Chapter source (youtube, description)")

    # Thumbnails
    thumbnails_vtt_url: Optional[str] = Field(None, description="Thumbnails sprite sheet VTT URL")

    # Processing state
    error_message: Optional[str] = Field(None, description="Error message if failed")
    retry_count: int = Field(0, description="Number of retry attempts")
    progress_message: Optional[str] = Field(None, description="Current processing step")

    # Timestamps
    created_at: Optional[datetime] = Field(None, description="Record creation time")
    updated_at: Optional[datetime] = Field(None, description="Last update time")
    processed_at: Optional[datetime] = Field(None, description="Completion time")

    model_config = {"from_attributes": True}


class EnrichmentRetryResponse(BaseModel):
    """Response schema for enrichment retry request."""
    message: str = Field(..., description="Status message")
    enrichment: EnrichmentResponse = Field(..., description="Updated enrichment data")
