import pytest
from uuid import uuid4


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


@pytest.mark.asyncio
async def test_start_processing_no_pending_videos(client):
    # Create list without videos
    list_response = await client.post(
        "/api/lists",
        json={"name": "Empty List"}
    )
    list_id = list_response.json()["id"]

    # Try to start processing
    response = await client.post(f"/api/lists/{list_id}/process")
    assert response.status_code == 400
    assert response.json()["detail"] == "No pending videos to process"


@pytest.mark.asyncio
async def test_get_job_status(client):
    # Create list with video and start processing
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    job_response = await client.post(f"/api/lists/{list_id}/process")
    job_id = job_response.json()["job_id"]

    # Get job status
    response = await client.get(f"/api/jobs/{job_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job_id
    assert data["status"] == "running"


@pytest.mark.asyncio
async def test_get_job_status_not_found(client):
    # Try to get status for non-existent job
    fake_job_id = str(uuid4())
    response = await client.get(f"/api/jobs/{fake_job_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


@pytest.mark.asyncio
async def test_pause_job(client):
    # Create list with video and start processing
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    job_response = await client.post(f"/api/lists/{list_id}/process")
    job_id = job_response.json()["job_id"]

    # Pause the job
    response = await client.post(f"/api/jobs/{job_id}/pause")
    assert response.status_code == 204

    # Verify job is paused
    status_response = await client.get(f"/api/jobs/{job_id}")
    assert status_response.json()["status"] == "paused"


@pytest.mark.asyncio
async def test_pause_job_not_found(client):
    # Try to pause non-existent job
    fake_job_id = str(uuid4())
    response = await client.post(f"/api/jobs/{fake_job_id}/pause")
    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


@pytest.mark.asyncio
async def test_pause_already_paused_job(client):
    # Create list with video and start processing
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    job_response = await client.post(f"/api/lists/{list_id}/process")
    job_id = job_response.json()["job_id"]

    # Pause the job first time
    await client.post(f"/api/jobs/{job_id}/pause")

    # Try to pause again
    response = await client.post(f"/api/jobs/{job_id}/pause")
    assert response.status_code == 400
    assert "Cannot pause job with status 'paused'" in response.json()["detail"]


@pytest.mark.asyncio
async def test_pause_completed_job(client, test_db):
    from app.models import ProcessingJob

    # Create list with video and start processing
    list_response = await client.post(
        "/api/lists",
        json={"name": "Test List"}
    )
    list_id = list_response.json()["id"]

    await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    job_response = await client.post(f"/api/lists/{list_id}/process")
    job_id = job_response.json()["job_id"]

    # Manually mark job as completed
    from sqlalchemy import select
    result = await test_db.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_id)
    )
    job = result.scalar_one()
    job.status = "completed"
    await test_db.commit()

    # Try to pause completed job
    response = await client.post(f"/api/jobs/{job_id}/pause")
    assert response.status_code == 400
    assert "Cannot pause job with status 'completed'" in response.json()["detail"]
