"""Channels API endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.channel import Channel
from app.models.video import Video
from app.schemas.channel import ChannelResponse, ChannelUpdate
from app.services.access_service import authenticated_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/channels", tags=["channels"])


@router.get("", response_model=list[ChannelResponse])
async def get_channels(
    db: AsyncSession = Depends(get_db),
    include_hidden: bool = Query(False, description="Include hidden channels"),
) -> list[ChannelResponse]:
    """
    Get all channels for user with video counts.

    Channels are automatically created when videos are added.
    By default, hidden channels are excluded.
    """
    user = authenticated_user(db)

    # Query channels with video count
    query = (
        select(Channel, func.count(Video.id).label("video_count"))
        .outerjoin(Video, Video.channel_id == Channel.id)
        .where(Channel.user_id == user.id)
        .group_by(Channel.id)
        .order_by(Channel.name)
    )

    if not include_hidden:
        query = query.where(Channel.is_hidden == False)

    result = await db.execute(query)
    rows = result.all()

    # Convert to response objects
    channels = []
    for channel, video_count in rows:
        channels.append(
            ChannelResponse(
                id=channel.id,
                user_id=channel.user_id,
                youtube_channel_id=channel.youtube_channel_id,
                name=channel.name,
                thumbnail_url=channel.thumbnail_url,
                description=channel.description,
                is_hidden=channel.is_hidden,
                video_count=video_count,
                created_at=channel.created_at,
                updated_at=channel.updated_at,
            )
        )

    return channels


@router.patch("/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: UUID,
    update: ChannelUpdate,
    db: AsyncSession = Depends(get_db),
) -> ChannelResponse:
    """
    Update a channel (hide/unhide).

    Only is_hidden can be changed by the user.
    """
    user = authenticated_user(db)

    # Get channel
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id, Channel.user_id == user.id)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Channel {channel_id} not found",
        )

    # Update fields
    if update.is_hidden is not None:
        channel.is_hidden = update.is_hidden

    await db.commit()
    await db.refresh(channel)

    # Get video count
    count_result = await db.execute(
        select(func.count(Video.id)).where(Video.channel_id == channel.id)
    )
    video_count = count_result.scalar() or 0

    return ChannelResponse(
        id=channel.id,
        user_id=channel.user_id,
        youtube_channel_id=channel.youtube_channel_id,
        name=channel.name,
        thumbnail_url=channel.thumbnail_url,
        description=channel.description,
        is_hidden=channel.is_hidden,
        video_count=video_count,
        created_at=channel.created_at,
        updated_at=channel.updated_at,
    )


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a channel.

    Videos linked to this channel will have channel_id set to NULL
    (via FK ON DELETE SET NULL).
    """
    user = authenticated_user(db)

    # Get channel
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id, Channel.user_id == user.id)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Channel {channel_id} not found",
        )

    await db.delete(channel)
    await db.commit()
