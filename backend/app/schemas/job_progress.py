from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional

class ProgressData(BaseModel):
    """Schema for progress_data JSONB field"""
    job_id: UUID
    status: str = Field(..., pattern="^(pending|processing|completed|failed)$")
    progress: int = Field(..., ge=0, le=100)
    current_video: int = Field(..., ge=0)
    total_videos: int = Field(..., gt=0)
    message: str
    video_id: Optional[UUID] = None
    error: Optional[str] = None

class JobProgressEventCreate(BaseModel):
    """Schema for creating a progress event"""
    job_id: UUID
    progress_data: ProgressData

class JobProgressEventRead(BaseModel):
    """Schema for reading a progress event"""
    id: UUID
    job_id: UUID
    created_at: datetime
    progress_data: dict  # JSONB returns as dict

    class Config:
        from_attributes = True
