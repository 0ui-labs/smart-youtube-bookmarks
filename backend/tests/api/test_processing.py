import pytest


@pytest.mark.asyncio
async def test_start_processing_job(client):
    # Create list with video
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    # Start processing
    response = await client.post(f"/api/lists/{list_id}/process")
    assert response.status_code == 201
    data = response.json()
    assert "job_id" in data
    assert data["total_videos"] == 1
