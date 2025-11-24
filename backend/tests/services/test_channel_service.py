"""
Tests for Channel service.

TDD: These tests are written BEFORE the channel service exists.
"""
import pytest
from uuid import uuid4
from sqlalchemy import select


@pytest.mark.asyncio
async def test_get_or_create_channel_creates_new(test_db, test_user):
    """Test that get_or_create_channel creates a new channel when none exists."""
    from app.services.channel_service import get_or_create_channel
    from app.models.channel import Channel

    channel = await get_or_create_channel(
        db=test_db,
        user_id=test_user.id,
        youtube_channel_id="UCnewchannel123",
        channel_name="New Test Channel"
    )

    assert channel is not None
    assert channel.id is not None
    assert channel.user_id == test_user.id
    assert channel.youtube_channel_id == "UCnewchannel123"
    assert channel.name == "New Test Channel"
    assert channel.is_hidden is False

    # Verify it was actually persisted
    result = await test_db.execute(
        select(Channel).where(Channel.id == channel.id)
    )
    persisted = result.scalar_one()
    assert persisted.youtube_channel_id == "UCnewchannel123"


@pytest.mark.asyncio
async def test_get_or_create_channel_returns_existing(test_db, test_user):
    """Test that get_or_create_channel returns existing channel."""
    from app.services.channel_service import get_or_create_channel
    from app.models.channel import Channel

    # Create channel first
    existing = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCexisting456",
        name="Existing Channel"
    )
    test_db.add(existing)
    await test_db.commit()
    await test_db.refresh(existing)
    existing_id = existing.id

    # Now call get_or_create - should return existing
    channel = await get_or_create_channel(
        db=test_db,
        user_id=test_user.id,
        youtube_channel_id="UCexisting456",  # Same ID
        channel_name="Different Name"  # Name doesn't matter for lookup
    )

    assert channel.id == existing_id  # Same channel


@pytest.mark.asyncio
async def test_get_or_create_channel_updates_name_if_changed(test_db, test_user):
    """Test that get_or_create_channel updates the name if YouTube changed it."""
    from app.services.channel_service import get_or_create_channel
    from app.models.channel import Channel

    # Create channel with old name
    existing = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCnamechange789",
        name="Old Channel Name"
    )
    test_db.add(existing)
    await test_db.commit()
    await test_db.refresh(existing)

    # Call with new name
    channel = await get_or_create_channel(
        db=test_db,
        user_id=test_user.id,
        youtube_channel_id="UCnamechange789",
        channel_name="New Channel Name"  # YouTube changed the name
    )

    assert channel.name == "New Channel Name"  # Name should be updated


@pytest.mark.asyncio
async def test_get_or_create_channel_with_thumbnail(test_db, test_user):
    """Test that get_or_create_channel stores thumbnail URL."""
    from app.services.channel_service import get_or_create_channel

    channel = await get_or_create_channel(
        db=test_db,
        user_id=test_user.id,
        youtube_channel_id="UCwiththumb000",
        channel_name="Channel With Thumbnail",
        channel_thumbnail="https://example.com/avatar.jpg"
    )

    assert channel.thumbnail_url == "https://example.com/avatar.jpg"


@pytest.mark.asyncio
async def test_get_or_create_channel_different_users(test_db, user_factory):
    """Test that same YouTube channel creates separate Channel records for different users."""
    from app.services.channel_service import get_or_create_channel

    user1 = await user_factory("user1")
    user2 = await user_factory("user2")

    # Same YouTube channel ID for both users
    channel1 = await get_or_create_channel(
        db=test_db,
        user_id=user1.id,
        youtube_channel_id="UCshared999",
        channel_name="Shared Channel"
    )

    channel2 = await get_or_create_channel(
        db=test_db,
        user_id=user2.id,
        youtube_channel_id="UCshared999",  # Same YouTube channel
        channel_name="Shared Channel"
    )

    # Should be different Channel records
    assert channel1.id != channel2.id
    assert channel1.user_id == user1.id
    assert channel2.user_id == user2.id
