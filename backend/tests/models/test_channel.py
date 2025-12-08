"""
Tests for Channel model.

TDD: These tests are written BEFORE the Channel model exists.
"""

from uuid import uuid4

import pytest
from sqlalchemy import select


@pytest.mark.asyncio
async def test_channel_model_has_required_fields():
    """Test that Channel model has all required fields defined."""
    from app.models.channel import Channel

    # Verify tablename
    assert Channel.__tablename__ == "channels"

    # Verify required columns exist
    assert hasattr(Channel, "id")
    assert hasattr(Channel, "user_id")
    assert hasattr(Channel, "youtube_channel_id")
    assert hasattr(Channel, "name")
    assert hasattr(Channel, "thumbnail_url")
    assert hasattr(Channel, "is_hidden")
    assert hasattr(Channel, "created_at")
    assert hasattr(Channel, "updated_at")


@pytest.mark.asyncio
async def test_channel_model_has_relationships():
    """Test that Channel model has user and videos relationships."""
    from app.models.channel import Channel

    assert hasattr(Channel, "user")
    assert hasattr(Channel, "videos")


@pytest.mark.asyncio
async def test_create_channel(test_db, test_user):
    """Test creating a channel in the database."""
    from app.models.channel import Channel

    channel = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCX6OQ3DkcsbYNE6H8uQQuVA",
        name="Test Channel",
        thumbnail_url="https://example.com/avatar.jpg",
        is_hidden=False,
    )

    test_db.add(channel)
    await test_db.commit()
    await test_db.refresh(channel)

    assert channel.id is not None
    assert channel.user_id == test_user.id
    assert channel.youtube_channel_id == "UCX6OQ3DkcsbYNE6H8uQQuVA"
    assert channel.name == "Test Channel"
    assert channel.thumbnail_url == "https://example.com/avatar.jpg"
    assert channel.is_hidden is False
    assert channel.created_at is not None
    assert channel.updated_at is not None


@pytest.mark.asyncio
async def test_channel_user_youtube_unique_constraint(test_db, test_user):
    """Test that (user_id, youtube_channel_id) combination is unique."""
    from sqlalchemy.exc import IntegrityError

    from app.models.channel import Channel

    channel1 = Channel(
        user_id=test_user.id, youtube_channel_id="UCtest123", name="Channel 1"
    )
    test_db.add(channel1)
    await test_db.commit()

    # Try to create another channel with same youtube_channel_id for same user
    channel2 = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCtest123",  # Same as channel1
        name="Channel 2",
    )
    test_db.add(channel2)

    with pytest.raises(IntegrityError):
        await test_db.flush()  # Use flush instead of commit for integrity check

    # Rollback to clean up failed transaction
    await test_db.rollback()


@pytest.mark.asyncio
async def test_channel_is_hidden_defaults_to_false(test_db, test_user):
    """Test that is_hidden defaults to False."""
    from app.models.channel import Channel

    channel = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCdefault123",
        name="Default Hidden Channel",
        # is_hidden not specified
    )

    test_db.add(channel)
    await test_db.commit()
    await test_db.refresh(channel)

    assert channel.is_hidden is False


@pytest.mark.asyncio
async def test_channel_cascade_delete_with_user(test_db, user_factory):
    """Test that channels are deleted when user is deleted."""
    from app.models.channel import Channel

    user = await user_factory("cascade-test")

    channel = Channel(
        user_id=user.id, youtube_channel_id="UCcascade123", name="Cascade Test Channel"
    )
    test_db.add(channel)
    await test_db.commit()
    channel_id = channel.id

    # Delete user
    await test_db.delete(user)
    await test_db.commit()

    # Channel should be deleted
    result = await test_db.execute(select(Channel).where(Channel.id == channel_id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_channel_repr():
    """Test Channel __repr__ method."""
    from app.models.channel import Channel

    channel = Channel(youtube_channel_id="UCtest", name="Test Channel")
    channel.id = uuid4()

    repr_str = repr(channel)
    assert "Channel" in repr_str
    assert "Test Channel" in repr_str
