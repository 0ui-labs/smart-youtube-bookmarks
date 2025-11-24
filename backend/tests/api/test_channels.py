"""Tests for Channels API endpoints."""
import pytest
from sqlalchemy import select


@pytest.mark.asyncio
async def test_get_channels_empty(client, test_user):
    """Test GET /api/channels returns empty list when no channels exist."""
    response = await client.get(
        "/api/channels",
        params={"user_id": str(test_user.id)}
    )
    assert response.status_code == 200
    data = response.json()
    assert data == []


@pytest.mark.asyncio
async def test_get_channels_with_data(client, test_db, test_user):
    """Test GET /api/channels returns channels with video counts."""
    from app.models.channel import Channel
    from app.models.list import BookmarkList
    from app.models.video import Video

    # Create a channel
    channel = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCtest123",
        name="Test Channel"
    )
    test_db.add(channel)
    await test_db.commit()
    await test_db.refresh(channel)

    # Create a list and videos for this channel
    bookmark_list = BookmarkList(
        user_id=test_user.id,
        name="Test List"
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    video1 = Video(
        list_id=bookmark_list.id,
        youtube_id="vid1",
        channel_id=channel.id
    )
    video2 = Video(
        list_id=bookmark_list.id,
        youtube_id="vid2",
        channel_id=channel.id
    )
    test_db.add_all([video1, video2])
    await test_db.commit()

    response = await client.get(
        "/api/channels",
        params={"user_id": str(test_user.id)}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test Channel"
    assert data[0]["youtube_channel_id"] == "UCtest123"
    assert data[0]["video_count"] == 2


@pytest.mark.asyncio
async def test_get_channels_excludes_hidden(client, test_db, test_user):
    """Test GET /api/channels excludes hidden channels by default."""
    from app.models.channel import Channel

    # Create visible and hidden channels
    visible = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCvisible",
        name="Visible Channel",
        is_hidden=False
    )
    hidden = Channel(
        user_id=test_user.id,
        youtube_channel_id="UChidden",
        name="Hidden Channel",
        is_hidden=True
    )
    test_db.add_all([visible, hidden])
    await test_db.commit()

    # Default: exclude hidden
    response = await client.get(
        "/api/channels",
        params={"user_id": str(test_user.id)}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Visible Channel"

    # Include hidden
    response = await client.get(
        "/api/channels",
        params={"user_id": str(test_user.id), "include_hidden": "true"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_patch_channel_hide(client, test_db, test_user):
    """Test PATCH /api/channels/{id} to hide a channel."""
    from app.models.channel import Channel

    channel = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCtohide",
        name="Channel to Hide",
        is_hidden=False
    )
    test_db.add(channel)
    await test_db.commit()
    await test_db.refresh(channel)

    response = await client.patch(
        f"/api/channels/{channel.id}",
        params={"user_id": str(test_user.id)},
        json={"is_hidden": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_hidden"] is True

    # Verify in DB
    await test_db.refresh(channel)
    assert channel.is_hidden is True


@pytest.mark.asyncio
async def test_patch_channel_not_found(client, test_user):
    """Test PATCH /api/channels/{id} returns 404 for non-existent channel."""
    from uuid import uuid4

    response = await client.patch(
        f"/api/channels/{uuid4()}",
        params={"user_id": str(test_user.id)},
        json={"is_hidden": True}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_channel(client, test_db, test_user):
    """Test DELETE /api/channels/{id} deletes channel and nullifies video.channel_id."""
    from app.models.channel import Channel
    from app.models.list import BookmarkList
    from app.models.video import Video

    # Create channel with videos
    channel = Channel(
        user_id=test_user.id,
        youtube_channel_id="UCtodelete",
        name="Channel to Delete"
    )
    test_db.add(channel)
    await test_db.commit()
    await test_db.refresh(channel)
    channel_id = channel.id

    bookmark_list = BookmarkList(
        user_id=test_user.id,
        name="Test List"
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)

    video = Video(
        list_id=bookmark_list.id,
        youtube_id="vid_delete",
        channel_id=channel.id
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)

    # Delete channel
    response = await client.delete(
        f"/api/channels/{channel_id}",
        params={"user_id": str(test_user.id)}
    )
    assert response.status_code == 204

    # Verify channel deleted
    result = await test_db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    assert result.scalar_one_or_none() is None

    # Verify video.channel_id is null (SET NULL on delete)
    await test_db.refresh(video)
    assert video.channel_id is None
