"""
Unit tests for video field values batch update endpoint.

Tests PUT /api/videos/{video_id}/fields endpoint with:
- Happy path: create, update, mixed upsert
- Validation errors: invalid field_id, invalid values
- Atomicity: all-or-nothing transaction
- Edge cases: empty request, duplicates, batch size
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_field import CustomField
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue


class TestBatchUpdateVideoFieldValues:
    """Tests for PUT /api/videos/{video_id}/fields endpoint."""

    @pytest.fixture
    async def test_list_for_fields(
        self, test_db: AsyncSession, test_user
    ) -> "BookmarkList":
        """Create a test list for field value tests."""
        from app.models.list import BookmarkList

        bookmark_list = BookmarkList(
            name="Test List for Fields",
            description="Test list for field value tests",
            user_id=test_user.id,
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        await test_db.refresh(bookmark_list)
        return bookmark_list

    @pytest.fixture
    async def test_video_for_fields(
        self, test_db: AsyncSession, test_list_for_fields
    ) -> Video:
        """Create a test video for field value tests."""
        video = Video(
            list_id=test_list_for_fields.id,
            youtube_id="test_video_fields",
            title="Test Video for Fields",
        )
        test_db.add(video)
        await test_db.commit()
        await test_db.refresh(video)
        return video

    @pytest.fixture
    async def test_fields(
        self, test_db: AsyncSession, test_list_for_fields
    ) -> dict[str, CustomField]:
        """Create test custom fields (rating, select, text, boolean)."""
        list_id = test_list_for_fields.id
        fields = {}

        # Rating field
        rating_field = CustomField(
            list_id=list_id,
            name="Overall Rating",
            field_type="rating",
            config={"max_rating": 5},
        )
        test_db.add(rating_field)

        # Select field
        select_field = CustomField(
            list_id=list_id,
            name="Quality",
            field_type="select",
            config={"options": ["bad", "good", "great"]},
        )
        test_db.add(select_field)

        # Text field
        text_field = CustomField(
            list_id=list_id, name="Notes", field_type="text", config={"max_length": 500}
        )
        test_db.add(text_field)

        # Boolean field
        boolean_field = CustomField(
            list_id=list_id, name="Watched", field_type="boolean", config={}
        )
        test_db.add(boolean_field)

        await test_db.commit()
        await test_db.refresh(rating_field)
        await test_db.refresh(select_field)
        await test_db.refresh(text_field)
        await test_db.refresh(boolean_field)

        return {
            "rating": rating_field,
            "select": select_field,
            "text": text_field,
            "boolean": boolean_field,
        }

    @pytest.mark.asyncio
    async def test_create_new_field_values(
        self, client: AsyncClient, test_video_for_fields: Video, test_fields: dict
    ):
        """Test creating new field values (INSERT behavior)."""
        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields["rating"].id), "value": 5},
                    {"field_id": str(test_fields["select"].id), "value": "great"},
                ]
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["updated_count"] == 2
        assert len(data["field_values"]) == 2

        # Verify rating field
        rating_fv = next(
            fv
            for fv in data["field_values"]
            if fv["field_id"] == str(test_fields["rating"].id)
        )
        assert rating_fv["value"] == 5
        assert rating_fv["field"]["field_type"] == "rating"

        # Verify select field
        select_fv = next(
            fv
            for fv in data["field_values"]
            if fv["field_id"] == str(test_fields["select"].id)
        )
        assert select_fv["value"] == "great"
        assert select_fv["field"]["field_type"] == "select"

    @pytest.mark.asyncio
    async def test_update_existing_field_values(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        test_video_for_fields: Video,
        test_fields: dict,
    ):
        """Test updating existing field values (UPDATE behavior)."""
        # Create initial values
        initial_value = VideoFieldValue(
            video_id=test_video_for_fields.id,
            field_id=test_fields["rating"].id,
            value_numeric=3,
        )
        test_db.add(initial_value)
        await test_db.commit()

        # Update value from 3 to 5
        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields["rating"].id), "value": 5}
                ]
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["updated_count"] == 1
        assert data["field_values"][0]["value"] == 5  # Updated from 3 to 5

    @pytest.mark.asyncio
    async def test_mixed_create_and_update(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        test_video_for_fields: Video,
        test_fields: dict,
    ):
        """Test upsert: some values exist, some don't (mixed INSERT/UPDATE)."""
        # Create initial value for rating field only
        initial_value = VideoFieldValue(
            video_id=test_video_for_fields.id,
            field_id=test_fields["rating"].id,
            value_numeric=3,
        )
        test_db.add(initial_value)
        await test_db.commit()

        # Update rating (exists) + create select (doesn't exist)
        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields["rating"].id), "value": 5},  # UPDATE
                    {
                        "field_id": str(test_fields["select"].id),
                        "value": "great",
                    },  # INSERT
                ]
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["updated_count"] == 2

    @pytest.mark.asyncio
    async def test_error_video_not_found(self, client: AsyncClient, test_fields: dict):
        """Test 404 error when video doesn't exist."""
        fake_video_id = uuid4()

        response = await client.put(
            f"/api/videos/{fake_video_id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields["rating"].id), "value": 5}
                ]
            },
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_error_invalid_field_id(
        self, client: AsyncClient, test_video_for_fields: Video
    ):
        """Test 400 error when field_id doesn't exist."""
        fake_field_id = uuid4()

        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={"field_values": [{"field_id": str(fake_field_id), "value": 5}]},
        )

        assert response.status_code == 400
        assert "invalid field_id" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_error_duplicate_field_ids(
        self, client: AsyncClient, test_video_for_fields: Video, test_fields: dict
    ):
        """Test 422 error when request has duplicate field_ids."""
        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields["rating"].id), "value": 3},
                    {
                        "field_id": str(test_fields["rating"].id),
                        "value": 5,
                    },  # Duplicate!
                ]
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_error_validation_failure_rating_out_of_range(
        self, client: AsyncClient, test_video_for_fields: Video, test_fields: dict
    ):
        """Test 422 error when rating value exceeds max_rating."""
        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields["rating"].id), "value": 10}  # Max is 5
                ]
            },
        )

        assert response.status_code == 422
        data = response.json()
        assert "validation failed" in data["detail"]["message"].lower()

    @pytest.mark.asyncio
    async def test_error_validation_failure_invalid_select_option(
        self, client: AsyncClient, test_video_for_fields: Video, test_fields: dict
    ):
        """Test 422 error when select value not in options list."""
        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields["select"].id), "value": "invalid"}
                ]
            },
        )

        assert response.status_code == 422
        data = response.json()
        assert "validation failed" in data["detail"]["message"].lower()

    @pytest.mark.asyncio
    async def test_atomicity_all_or_nothing(
        self,
        client: AsyncClient,
        test_db: AsyncSession,
        test_video_for_fields: Video,
        test_fields: dict,
    ):
        """Test transaction atomicity: if one value fails validation, none are updated."""
        # Create initial value
        initial_value = VideoFieldValue(
            video_id=test_video_for_fields.id,
            field_id=test_fields["rating"].id,
            value_numeric=3,
        )
        test_db.add(initial_value)
        await test_db.commit()

        # Try to update with one valid + one invalid value
        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields["rating"].id), "value": 5},  # Valid
                    {
                        "field_id": str(test_fields["select"].id),
                        "value": "invalid",
                    },  # Invalid
                ]
            },
        )

        assert response.status_code == 422

        # Verify original value unchanged (atomicity)
        check_stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == test_video_for_fields.id,
            VideoFieldValue.field_id == test_fields["rating"].id,
        )
        result = await test_db.execute(check_stmt)
        unchanged = result.scalar_one()

        assert unchanged.value_numeric == 3  # Still 3, not 5

    @pytest.mark.asyncio
    async def test_batch_size_limit(
        self, client: AsyncClient, test_video_for_fields: Video
    ):
        """Test 422 error when batch exceeds max size (50 fields)."""
        # Generate 51 fake field updates
        fake_updates = [{"field_id": str(uuid4()), "value": i} for i in range(51)]

        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields",
            json={"field_values": fake_updates},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_request_rejected(
        self, client: AsyncClient, test_video_for_fields: Video
    ):
        """Test 422 error when field_values list is empty."""
        response = await client.put(
            f"/api/videos/{test_video_for_fields.id}/fields", json={"field_values": []}
        )

        assert response.status_code == 422
