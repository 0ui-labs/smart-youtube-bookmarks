import pytest


@pytest.mark.asyncio
async def test_get_lists_empty(client):
    response = await client.get("/api/lists")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_list(client):
    response = await client.post(
        "/api/lists",
        json={"name": "Test List", "description": "A test"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test List"
    assert data["description"] == "A test"
    assert "id" in data
