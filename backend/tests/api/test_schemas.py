"""
Unit tests for Field Schema API endpoints.

Tests cover:
- GET /api/lists/{list_id}/schemas (list all)
- POST /api/lists/{list_id}/schemas (create)
- PUT /api/lists/{list_id}/schemas/{schema_id} (update)
- DELETE /api/lists/{list_id}/schemas/{schema_id} (delete)
"""

import pytest
from httpx import AsyncClient
from uuid import uuid4

from app.models.list import BookmarkList
from app.models.user import User
from app.models.field_schema import FieldSchema
from app.models.custom_field import CustomField
from app.models.schema_field import SchemaField
from app.models.tag import Tag


@pytest.mark.asyncio
class TestListSchemas:
    """Tests for GET /api/lists/{list_id}/schemas"""

    async def test_list_schemas_empty(
        self,
        async_client: AsyncClient,
        db_session,
        test_user: User,
        test_list: BookmarkList
    ):
        """Should return empty list when no schemas exist."""
        response = await async_client.get(f"/api/lists/{test_list.id}/schemas")

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_schemas_with_data(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should return all schemas with nested fields."""
        # Create custom field
        field = CustomField(
            list_id=test_list.id,
            name="Presentation",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        db_session.add(field)

        # Create schema
        schema = FieldSchema(
            list_id=test_list.id,
            name="Video Quality",
            description="Standard metrics"
        )
        db_session.add(schema)
        await db_session.flush()

        # Create schema-field association
        schema_field = SchemaField(
            schema_id=schema.id,
            field_id=field.id,
            display_order=0,
            show_on_card=True
        )
        db_session.add(schema_field)
        await db_session.commit()

        response = await async_client.get(f"/api/lists/{test_list.id}/schemas")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Video Quality"
        assert data[0]["description"] == "Standard metrics"
        assert len(data[0]["schema_fields"]) == 1
        assert data[0]["schema_fields"][0]["field"]["name"] == "Presentation"

    async def test_list_schemas_list_not_found(
        self,
        async_client: AsyncClient
    ):
        """Should return 404 if list doesn't exist."""
        fake_list_id = uuid4()
        response = await async_client.get(f"/api/lists/{fake_list_id}/schemas")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
class TestCreateSchema:
    """Tests for POST /api/lists/{list_id}/schemas"""

    async def test_create_schema_minimal(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should create schema with name and description only."""
        data = {
            "name": "Video Quality",
            "description": "Standard quality metrics"
        }

        response = await async_client.post(
            f"/api/lists/{test_list.id}/schemas",
            json=data
        )

        assert response.status_code == 201
        result = response.json()
        assert result["name"] == "Video Quality"
        assert result["description"] == "Standard quality metrics"
        assert result["list_id"] == str(test_list.id)
        assert result["schema_fields"] == []
        assert "id" in result
        assert "created_at" in result

    async def test_create_schema_with_fields(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should create schema with initial fields."""
        # Create custom fields
        field1 = CustomField(
            list_id=test_list.id,
            name="Presentation",
            field_type="select",
            config={"options": ["bad", "good"]}
        )
        field2 = CustomField(
            list_id=test_list.id,
            name="Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        db_session.add_all([field1, field2])
        await db_session.commit()

        data = {
            "name": "Video Quality",
            "description": "Quality metrics",
            "fields": [
                {
                    "field_id": str(field1.id),
                    "display_order": 0,
                    "show_on_card": True
                },
                {
                    "field_id": str(field2.id),
                    "display_order": 1,
                    "show_on_card": False
                }
            ]
        }

        response = await async_client.post(
            f"/api/lists/{test_list.id}/schemas",
            json=data
        )

        assert response.status_code == 201
        result = response.json()
        assert len(result["schema_fields"]) == 2
        assert result["schema_fields"][0]["field"]["name"] == "Presentation"
        assert result["schema_fields"][0]["display_order"] == 0
        assert result["schema_fields"][1]["field"]["name"] == "Rating"
        assert result["schema_fields"][1]["show_on_card"] is False

    async def test_create_schema_invalid_field_ids(
        self,
        async_client: AsyncClient,
        test_list: BookmarkList
    ):
        """Should return 400 if field_ids don't exist."""
        data = {
            "name": "Video Quality",
            "fields": [
                {
                    "field_id": str(uuid4()),
                    "display_order": 0,
                    "show_on_card": True
                }
            ]
        }

        response = await async_client.post(
            f"/api/lists/{test_list.id}/schemas",
            json=data
        )

        assert response.status_code == 400
        assert "Invalid field_ids" in response.json()["detail"]

    async def test_create_schema_list_not_found(
        self,
        async_client: AsyncClient
    ):
        """Should return 404 if list doesn't exist."""
        fake_list_id = uuid4()
        data = {"name": "Test Schema"}

        response = await async_client.post(
            f"/api/lists/{fake_list_id}/schemas",
            json=data
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestUpdateSchema:
    """Tests for PUT /api/lists/{list_id}/schemas/{schema_id}"""

    async def test_update_schema_name(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should update schema name."""
        schema = FieldSchema(
            list_id=test_list.id,
            name="Original Name",
            description="Original description"
        )
        db_session.add(schema)
        await db_session.commit()

        data = {"name": "Updated Name"}

        response = await async_client.put(
            f"/api/lists/{test_list.id}/schemas/{schema.id}",
            json=data
        )

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "Updated Name"
        assert result["description"] == "Original description"

    async def test_update_schema_description(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should update schema description."""
        schema = FieldSchema(
            list_id=test_list.id,
            name="Schema Name",
            description="Original"
        )
        db_session.add(schema)
        await db_session.commit()

        data = {"description": "Updated description"}

        response = await async_client.put(
            f"/api/lists/{test_list.id}/schemas/{schema.id}",
            json=data
        )

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "Schema Name"
        assert result["description"] == "Updated description"

    async def test_update_schema_not_found(
        self,
        async_client: AsyncClient,
        test_list: BookmarkList
    ):
        """Should return 404 if schema doesn't exist."""
        fake_schema_id = uuid4()
        data = {"name": "Updated"}

        response = await async_client.put(
            f"/api/lists/{test_list.id}/schemas/{fake_schema_id}",
            json=data
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestDeleteSchema:
    """Tests for DELETE /api/lists/{list_id}/schemas/{schema_id}"""

    async def test_delete_schema_success(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should delete schema when not used by tags."""
        schema = FieldSchema(
            list_id=test_list.id,
            name="Test Schema"
        )
        db_session.add(schema)
        await db_session.commit()

        response = await async_client.delete(
            f"/api/lists/{test_list.id}/schemas/{schema.id}"
        )

        assert response.status_code == 204

    async def test_delete_schema_with_tags(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList,
        test_user: User
    ):
        """Should return 409 if schema is used by tags."""
        schema = FieldSchema(
            list_id=test_list.id,
            name="Test Schema"
        )
        db_session.add(schema)
        await db_session.flush()

        # Create tag using schema
        tag = Tag(
            user_id=test_user.id,
            name="Test Tag",
            schema_id=schema.id
        )
        db_session.add(tag)
        await db_session.commit()

        response = await async_client.delete(
            f"/api/lists/{test_list.id}/schemas/{schema.id}"
        )

        assert response.status_code == 409
        assert "used by 1 tag" in response.json()["detail"]

    async def test_delete_schema_not_found(
        self,
        async_client: AsyncClient,
        test_list: BookmarkList
    ):
        """Should return 404 if schema doesn't exist."""
        fake_schema_id = uuid4()

        response = await async_client.delete(
            f"/api/lists/{test_list.id}/schemas/{fake_schema_id}"
        )

        assert response.status_code == 404
