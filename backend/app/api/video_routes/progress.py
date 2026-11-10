"""Video progress endpoints."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.video import Video
from app.schemas.video import (
    UpdateWatchProgressRequest,
    UpdateWatchProgressResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.patch("/videos/{video_id}/progress", response_model=UpdateWatchProgressResponse)
async def update_watch_progress(
    video_id: UUID,
    request: UpdateWatchProgressRequest,
    db: AsyncSession = Depends(get_db),
) -> UpdateWatchProgressResponse:
    """
    Update watch progress for a video (video player integration).

    Saves the current playback position so users can resume watching later.
    Called periodically (debounced) by the video player and on pause.

    Args:
        video_id: UUID of the video
        request: UpdateWatchProgressRequest with position in seconds
        db: Database session

    Returns:
        UpdateWatchProgressResponse with video_id, watch_position, updated_at

    Raises:
        HTTPException 404: Video not found
    """
    # Fetch video
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id {video_id} not found",
        )

    # Update watch position
    video.watch_position = request.position
    video.watch_position_updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(video)

    return UpdateWatchProgressResponse(
        video_id=video.id,
        watch_position=video.watch_position,
        updated_at=video.watch_position_updated_at,
    )
