from uuid import UUID

from pydantic import BaseModel


class AssignTagsRequest(BaseModel):
    tag_ids: list[UUID]


class BulkAssignTagsRequest(BaseModel):
    video_ids: list[UUID]
    tag_ids: list[UUID]


class SetCategoryRequest(BaseModel):
    """Request to set/change a video's category."""

    category_id: UUID | None = None


class SetCategoryResponse(BaseModel):
    """Response from setting a video's category."""

    backup_created: bool
    backup_available: bool
    restored_count: int = 0
