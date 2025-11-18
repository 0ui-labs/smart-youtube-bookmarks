import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_tag(client: AsyncClient, test_user):
    """Test creating a new tag."""
    response = await client.post(
        "/api/tags",
        json={"name": "Python", "color": "#3B82F6"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Python"
    assert data["color"] == "#3B82F6"
    assert "id" in data
    assert "user_id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_duplicate_tag(client: AsyncClient, test_user):
    """Test creating a duplicate tag fails."""
    # Create first tag
    await client.post("/api/tags", json={"name": "Python"})

    # Try to create duplicate
    response = await client.post("/api/tags", json={"name": "Python"})

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_tags(client: AsyncClient, test_user):
    """Test listing all tags."""
    # Create two tags
    await client.post("/api/tags", json={"name": "Python"})
    await client.post("/api/tags", json={"name": "Tutorial"})

    # List tags
    response = await client.get("/api/tags")

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert any(t["name"] == "Python" for t in data)
    assert any(t["name"] == "Tutorial" for t in data)


@pytest.mark.asyncio
async def test_get_tag(client: AsyncClient, test_user):
    """Test getting a specific tag by ID."""
    # Create tag with unique name
    create_response = await client.post("/api/tags", json={"name": "GetTagTest"})
    tag_id = create_response.json()["id"]

    # Get tag
    response = await client.get(f"/api/tags/{tag_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == tag_id
    assert data["name"] == "GetTagTest"


@pytest.mark.asyncio
async def test_get_tag_not_found(client: AsyncClient, test_user):
    """Test getting a non-existent tag returns 404."""
    import uuid
    fake_id = str(uuid.uuid4())

    response = await client.get(f"/api/tags/{fake_id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_tag(client: AsyncClient, test_user):
    """Test updating a tag."""
    # Create tag
    create_response = await client.post("/api/tags", json={"name": "OldName"})
    tag_id = create_response.json()["id"]

    # Update tag
    response = await client.put(
        f"/api/tags/{tag_id}",
        json={"name": "NewName", "color": "#FF5733"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "NewName"
    assert data["color"] == "#FF5733"


@pytest.mark.asyncio
async def test_update_tag_duplicate_name(client: AsyncClient, test_user):
    """Test updating tag to duplicate name fails."""
    # Create two tags
    await client.post("/api/tags", json={"name": "ExistingTag"})
    create_response = await client.post("/api/tags", json={"name": "TagToRename"})
    tag_id = create_response.json()["id"]

    # Try to rename second tag to match first tag
    response = await client.put(
        f"/api/tags/{tag_id}",
        json={"name": "ExistingTag"}
    )

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_tag_updates_timestamp(client: AsyncClient, test_user):
    """Test that updating a tag automatically updates the updated_at timestamp."""
    import asyncio
    from datetime import datetime

    # Create tag
    create_response = await client.post("/api/tags", json={"name": "TimestampTest"})
    tag_id = create_response.json()["id"]
    original_updated_at = create_response.json()["updated_at"]

    # Wait a moment to ensure timestamps differ
    await asyncio.sleep(0.1)

    # Update tag
    update_response = await client.put(
        f"/api/tags/{tag_id}",
        json={"name": "TimestampTestUpdated"}
    )

    assert update_response.status_code == 200
    new_updated_at = update_response.json()["updated_at"]

    # Verify updated_at changed
    assert new_updated_at != original_updated_at
    assert new_updated_at > original_updated_at


@pytest.mark.asyncio
async def test_delete_tag(client: AsyncClient, test_user):
    """Test deleting a tag."""
    # Create tag
    create_response = await client.post("/api/tags", json={"name": "ToDelete"})
    tag_id = create_response.json()["id"]

    # Delete tag
    response = await client.delete(f"/api/tags/{tag_id}")

    assert response.status_code == 204

    # Verify deleted
    get_response = await client.get(f"/api/tags/{tag_id}")
    assert get_response.status_code == 404


# ============================================================================
# Schema Integration Tests (Task #70)
# ============================================================================

@pytest.mark.asyncio
async def test_create_tag_with_schema(client: AsyncClient, test_db, test_user, test_schema):
    """
    REGRESSION TEST for Bug #002: Test creating a tag WITH schema_id preserves schema_id.

    This test catches the bug where new_tag.schema = None cleared the schema_id FK.
    The bug occurred because:
    1. Tag created with schema_id ✓
    2. Committed to DB ✓
    3. new_tag.schema = None called ✗ (triggered FK sync to NULL)

    This test ensures schema_id is NOT NULL after creation.
    """
    from app.models.tag import Tag

    # Create tag WITH schema_id during creation (not via update)
    response = await client.post(
        "/api/tags",
        params={"user_id": str(test_user.id)},
        json={
            "name": "TagWithSchema",
            "color": "#FF5733",
            "schema_id": str(test_schema.id)
        }
    )

    # Verify API response
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "TagWithSchema"
    assert data["schema_id"] == str(test_schema.id), "schema_id must be preserved in API response!"

    # CRITICAL: Verify in database (not just response)
    # This catches cases where response looks correct but DB is corrupted
    tag_id = data["id"]
    from sqlalchemy import select
    stmt = select(Tag).where(Tag.id == tag_id)
    result = await test_db.execute(stmt)
    tag_in_db = result.scalar_one()

    assert tag_in_db.schema_id is not None, "BUG: schema_id was cleared in database!"
    assert str(tag_in_db.schema_id) == str(test_schema.id), "schema_id mismatch between response and DB"


@pytest.mark.asyncio
async def test_update_tag_bind_schema(client: AsyncClient, test_db, test_user, test_list, test_schema):
    """Test binding a schema to a tag."""
    # Create tag via API
    create_response = await client.post(
        "/api/tags",
        params={"user_id": str(test_user.id)},
        json={"name": "TestBindSchema", "color": "#FF0000"}
    )
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]

    # Bind schema
    response = await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"schema_id": str(test_schema.id)}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["schema_id"] == str(test_schema.id)

    # Note: TagResponse no longer includes nested 'schema' object (Bug #002 fix)
    # Frontend should use schema_id and fetch schema separately if needed


@pytest.mark.asyncio
async def test_update_tag_change_schema(client: AsyncClient, test_db, test_user, test_list, test_schema):
    """Test changing from schema A to schema B."""
    from app.models.field_schema import FieldSchema

    # Create second schema (use test_schema as schema_a)
    schema_b = FieldSchema(list_id=test_list.id, name="Schema B")
    test_db.add(schema_b)
    await test_db.commit()
    await test_db.refresh(schema_b)

    # Create tag via API
    create_response = await client.post(
        "/api/tags",
        params={"user_id": str(test_user.id)},
        json={"name": "TestChangeSchema"}
    )
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]

    # Bind to test_schema first
    bind_response = await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"schema_id": str(test_schema.id)}
    )
    assert bind_response.status_code == 200

    # Change to schema B
    response = await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"schema_id": str(schema_b.id)}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["schema_id"] == str(schema_b.id)
    # Note: TagResponse no longer includes nested 'schema' object (Bug #002 fix)


@pytest.mark.asyncio
async def test_update_tag_unbind_schema(client: AsyncClient, test_db, test_user, test_schema):
    """Test unbinding schema with null."""
    # Create tag via API
    create_response = await client.post(
        "/api/tags",
        params={"user_id": str(test_user.id)},
        json={"name": "TestUnbindSchema"}
    )
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]

    # Bind schema first
    await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"schema_id": str(test_schema.id)}
    )

    # Unbind schema
    response = await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"schema_id": None}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["schema_id"] is None
    # Note: TagResponse no longer includes 'schema' field (Bug #002 fix)


@pytest.mark.asyncio
async def test_update_tag_invalid_schema_id(client: AsyncClient, test_db, test_user):
    """Test binding non-existent schema returns 404."""
    from uuid import uuid4

    # Create tag via API
    create_response = await client.post(
        "/api/tags",
        params={"user_id": str(test_user.id)},
        json={"name": "TestInvalidSchema"}
    )
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]

    fake_schema_id = uuid4()
    response = await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"schema_id": str(fake_schema_id)}
    )

    assert response.status_code == 404
    assert "nicht gefunden" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_tag_schema_from_different_list(client: AsyncClient, test_db, test_user):
    """Test binding schema from another user's list returns 404."""
    from app.models.user import User
    from app.models.list import BookmarkList
    from app.models.field_schema import FieldSchema
    from uuid import uuid4

    # Create another user with separate list
    other_user = User(
        id=uuid4(),
        email=f"other-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(other_user)
    await test_db.commit()
    await test_db.refresh(other_user)

    other_list = BookmarkList(name="Other List", user_id=other_user.id)
    test_db.add(other_list)
    await test_db.commit()
    await test_db.refresh(other_list)

    other_schema = FieldSchema(list_id=other_list.id, name="Other Schema")
    test_db.add(other_schema)
    await test_db.commit()
    await test_db.refresh(other_schema)

    # Create tag via API
    create_response = await client.post(
        "/api/tags",
        params={"user_id": str(test_user.id)},
        json={"name": "TestDifferentList"}
    )
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]

    # Try to bind schema from other user's list
    response = await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"schema_id": str(other_schema.id)}
    )

    assert response.status_code == 404
    assert "nicht gefunden oder gehört zu anderer liste" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_tag_name_only_preserves_schema(client: AsyncClient, test_db, test_user, test_schema):
    """Test updating only name doesn't change schema_id."""
    # Create tag via API
    create_response = await client.post(
        "/api/tags",
        params={"user_id": str(test_user.id)},
        json={"name": "TestPreserveSchema"}
    )
    assert create_response.status_code == 201
    tag_id = create_response.json()["id"]

    # Bind schema
    bind_response = await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"schema_id": str(test_schema.id)}
    )
    assert bind_response.status_code == 200
    assert bind_response.json()["schema_id"] == str(test_schema.id)

    # Update only name
    response = await client.put(
        f"/api/tags/{tag_id}",
        params={"user_id": str(test_user.id)},
        json={"name": "NewNamePreserve"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "NewNamePreserve"
    assert data["schema_id"] == str(test_schema.id)  # Schema unchanged
    # Note: TagResponse no longer includes nested 'schema' object (Bug #002 fix)
