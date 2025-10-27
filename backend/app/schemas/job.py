from uuid import UUID
from pydantic import BaseModel, ConfigDict


class JobResponse(BaseModel):
    job_id: UUID
    total_videos: int
    estimated_duration_seconds: int


class JobStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    list_id: UUID
    total_videos: int
    processed_count: int
    failed_count: int
    status: str
