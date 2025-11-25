"""
Tests for video watch progress endpoint (PATCH /api/videos/{id}/progress).

Tests the video player integration feature that saves playback position.
"""

import pytest
from uuid import uuid4


@pytest.mark.asyncio
async def test_update_watch_progress_success(client, test_video):
    """Test successful watch progress update."""
    response = await client.patch(
        f"/api/videos/{test_video.id}/progress",
        json={"position": 120}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["video_id"] == str(test_video.id)
    assert data["watch_position"] == 120
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_update_watch_progress_zero_position(client, test_video):
    """Test watch progress update with position 0 (start of video)."""
    response = await client.patch(
        f"/api/videos/{test_video.id}/progress",
        json={"position": 0}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["watch_position"] == 0


@pytest.mark.asyncio
async def test_update_watch_progress_large_position(client, test_video):
    """Test watch progress update with large position (long video)."""
    # 3 hours in seconds
    position = 3 * 60 * 60

    response = await client.patch(
        f"/api/videos/{test_video.id}/progress",
        json={"position": position}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["watch_position"] == position


@pytest.mark.asyncio
async def test_update_watch_progress_video_not_found(client):
    """Test watch progress update for non-existent video returns 404."""
    fake_id = uuid4()

    response = await client.patch(
        f"/api/videos/{fake_id}/progress",
        json={"position": 120}
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_watch_progress_negative_position_rejected(client, test_video):
    """Test that negative position is rejected with 422."""
    response = await client.patch(
        f"/api/videos/{test_video.id}/progress",
        json={"position": -1}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_watch_progress_missing_position(client, test_video):
    """Test that missing position field returns 422."""
    response = await client.patch(
        f"/api/videos/{test_video.id}/progress",
        json={}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_watch_progress_overwrites_previous(client, test_video):
    """Test that new progress overwrites previous position."""
    # Set initial position
    await client.patch(
        f"/api/videos/{test_video.id}/progress",
        json={"position": 100}
    )

    # Update to new position
    response = await client.patch(
        f"/api/videos/{test_video.id}/progress",
        json={"position": 200}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["watch_position"] == 200


@pytest.mark.asyncio
async def test_watch_position_in_video_response(client, test_video):
    """Test that watch_position appears in video detail response."""
    # Set watch position
    await client.patch(
        f"/api/videos/{test_video.id}/progress",
        json={"position": 150}
    )

    # Fetch video detail
    response = await client.get(f"/api/videos/{test_video.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["watch_position"] == 150
    assert "watch_position_updated_at" in data
