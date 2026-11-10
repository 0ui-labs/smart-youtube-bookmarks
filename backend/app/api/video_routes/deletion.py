"""Video deletion endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.channel import Channel
from app.models.video import Video

logger = logging.getLogger(__name__)
router = APIRouter()


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(video_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    """
    Delete a video from a bookmark list.

    Also auto-deletes the channel if this was the last video in that channel
    (YouTube Channels feature - Step 6.7).

    Args:
        video_id: UUID of the video to delete
        db: Database session

    Raises:
        HTTPException 404: Video not found
    """

    # Get video
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id {video_id} not found",
        )

    # Store channel_id before deletion for cleanup check
    channel_id = video.channel_id

    # Delete video
    await db.delete(video)
    await db.commit()  # CRITICAL FIX: Commit to persist deletion

    # YouTube Channels feature - Step 6.7: Auto-delete empty channels
    # If video had a channel, check if it was the last video
    if channel_id:
        # Count remaining videos for this channel
        count_result = await db.execute(
            select(func.count(Video.id)).where(Video.channel_id == channel_id)
        )
        remaining_count = count_result.scalar() or 0

        if remaining_count == 0:
            # Delete the empty channel
            channel_result = await db.execute(
                select(Channel).where(Channel.id == channel_id)
            )
            channel = channel_result.scalar_one_or_none()
            if channel:
                await db.delete(channel)
                await db.commit()
                logger.info(f"Auto-deleted empty channel {channel_id}")

    return None
