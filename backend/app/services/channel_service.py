"""
Channel service for managing YouTube channels.

Provides helper functions for channel operations, particularly
for auto-creating channels when videos are added.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.channel import Channel


async def get_or_create_channel(
    db: AsyncSession,
    user_id: UUID,
    youtube_channel_id: str,
    channel_name: str,
    channel_thumbnail: str | None = None,
    channel_description: str | None = None,
) -> Channel:
    """
    Find existing channel or create new one.

    If a channel with the given youtube_channel_id exists for the user,
    returns it (updating the name/thumbnail/description if changed on YouTube).
    Otherwise creates a new channel.

    Args:
        db: Database session
        user_id: User who owns this channel
        youtube_channel_id: YouTube's channel ID (e.g., UCX6OQ3DkcsbYNE6H8uQQuVA)
        channel_name: Channel display name from YouTube
        channel_thumbnail: Optional channel avatar URL
        channel_description: Optional channel description from YouTube

    Returns:
        Channel instance (existing or newly created)
    """
    # Try to find existing channel for this user
    result = await db.execute(
        select(Channel).where(
            Channel.user_id == user_id, Channel.youtube_channel_id == youtube_channel_id
        )
    )
    channel = result.scalar_one_or_none()

    if channel:
        # Update name if changed on YouTube
        if channel.name != channel_name:
            channel.name = channel_name
        # Update thumbnail if provided and different
        if channel_thumbnail and channel.thumbnail_url != channel_thumbnail:
            channel.thumbnail_url = channel_thumbnail
        # Update description if provided and different
        if (
            channel_description is not None
            and channel.description != channel_description
        ):
            channel.description = channel_description
        await db.flush()
        return channel

    # Create new channel
    channel = Channel(
        user_id=user_id,
        youtube_channel_id=youtube_channel_id,
        name=channel_name,
        thumbnail_url=channel_thumbnail,
        description=channel_description,
    )
    db.add(channel)
    await db.flush()  # Get ID
    return channel
