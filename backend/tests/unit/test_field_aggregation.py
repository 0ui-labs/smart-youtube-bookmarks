"""
Unit tests for field aggregation service.

TDD RED Phase: These tests are written BEFORE the implementation.
They should fail until the field aggregation service is implemented.
"""
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.field_aggregation import get_available_fields


class TestGetAvailableFields:
    """Tests for get_available_fields function."""

    @pytest.fixture
    def mock_db(self):
        """Mock async database session."""
        return AsyncMock()

    @pytest.fixture
    def mock_list_id(self):
        return uuid4()

    @pytest.fixture
    def mock_video(self, mock_list_id):
        """Mock Video object."""
        video = MagicMock()
        video.id = uuid4()
        video.list_id = mock_list_id
        video.tags = []
        return video

    @pytest.fixture
    def mock_workspace_fields(self):
        """Create mock workspace (default schema) fields."""
        field1 = MagicMock()
        field1.id = uuid4()
        field1.name = "Rating"
        field1.field_type = "rating"

        field2 = MagicMock()
        field2.id = uuid4()
        field2.name = "Notes"
        field2.field_type = "text"

        return [field1, field2]

    @pytest.fixture
    def mock_category_fields(self):
        """Create mock category-specific fields."""
        field1 = MagicMock()
        field1.id = uuid4()
        field1.name = "Calories"
        field1.field_type = "number"

        field2 = MagicMock()
        field2.id = uuid4()
        field2.name = "Cooking Time"
        field2.field_type = "text"

        return [field1, field2]

    @pytest.fixture
    def mock_list_with_default_schema(self, mock_list_id, mock_workspace_fields):
        """Mock BookmarkList with default_schema."""
        # Create schema fields (join table entries)
        schema_fields = []
        for field in mock_workspace_fields:
            sf = MagicMock()
            sf.field_id = field.id
            sf.field = field
            schema_fields.append(sf)

        default_schema = MagicMock()
        default_schema.id = uuid4()
        default_schema.schema_fields = schema_fields

        bookmark_list = MagicMock()
        bookmark_list.id = mock_list_id
        bookmark_list.default_schema_id = default_schema.id
        bookmark_list.default_schema = default_schema

        return bookmark_list

    @pytest.fixture
    def mock_category_with_schema(self, mock_category_fields):
        """Mock Tag (category) with schema."""
        schema_fields = []
        for field in mock_category_fields:
            sf = MagicMock()
            sf.field_id = field.id
            sf.field = field
            schema_fields.append(sf)

        schema = MagicMock()
        schema.id = uuid4()
        schema.schema_fields = schema_fields

        category = MagicMock()
        category.id = uuid4()
        category.name = "Keto Recipes"
        category.is_video_type = True
        category.schema_id = schema.id
        category.schema = schema

        return category

    @pytest.mark.asyncio
    async def test_aggregates_workspace_fields_only(
        self, mock_db, mock_video, mock_list_with_default_schema, mock_workspace_fields
    ):
        """
        Test that workspace fields are returned when video has no category.

        Given: A video in a list with default_schema but no category assigned
        When: get_available_fields is called
        Then: Returns only workspace (default schema) fields
        """
        # Setup: Video has no tags (no category)
        mock_video.tags = []

        # Mock db.get to return different values based on call
        # First call: BookmarkList, Second call: FieldSchema
        mock_db.get = AsyncMock(side_effect=[
            mock_list_with_default_schema,  # First call returns list
            mock_list_with_default_schema.default_schema,  # Second call returns schema
        ])

        fields = await get_available_fields(mock_video, mock_db)

        # Assert workspace fields are returned
        assert len(fields) == 2
        field_names = {f.name for f in fields}
        assert "Rating" in field_names
        assert "Notes" in field_names

    @pytest.mark.asyncio
    async def test_aggregates_workspace_and_category_fields(
        self,
        mock_db,
        mock_video,
        mock_list_with_default_schema,
        mock_category_with_schema,
        mock_workspace_fields,
        mock_category_fields,
    ):
        """
        Test that both workspace and category fields are returned.

        Given: A video with category and workspace both have schemas
        When: get_available_fields is called
        Then: Returns combined fields from both schemas
        """
        # Setup: Video has a category tag
        mock_video.tags = [mock_category_with_schema]

        # Mock db.get: First BookmarkList, then FieldSchema
        mock_db.get = AsyncMock(side_effect=[
            mock_list_with_default_schema,
            mock_list_with_default_schema.default_schema,
        ])

        fields = await get_available_fields(mock_video, mock_db)

        # Assert combined fields (2 workspace + 2 category = 4)
        assert len(fields) == 4
        field_names = {f.name for f in fields}
        assert "Rating" in field_names  # workspace
        assert "Notes" in field_names  # workspace
        assert "Calories" in field_names  # category
        assert "Cooking Time" in field_names  # category

    @pytest.mark.asyncio
    async def test_deduplicates_shared_fields(
        self, mock_db, mock_video, mock_list_id
    ):
        """
        Test that shared fields are deduplicated.

        Given: Workspace and category both have the same field (e.g., "Rating")
        When: get_available_fields is called
        Then: Returns unique fields (no duplicates)
        """
        # Create shared field
        shared_field_id = uuid4()
        shared_field = MagicMock()
        shared_field.id = shared_field_id
        shared_field.name = "Rating"
        shared_field.field_type = "rating"

        # Create workspace schema with shared field
        ws_sf = MagicMock()
        ws_sf.field_id = shared_field_id
        ws_sf.field = shared_field

        ws_schema = MagicMock()
        ws_schema.id = uuid4()
        ws_schema.schema_fields = [ws_sf]

        bookmark_list = MagicMock()
        bookmark_list.id = mock_list_id
        bookmark_list.default_schema_id = ws_schema.id
        bookmark_list.default_schema = ws_schema

        # Create category schema with same shared field
        cat_sf = MagicMock()
        cat_sf.field_id = shared_field_id
        cat_sf.field = shared_field

        cat_schema = MagicMock()
        cat_schema.id = uuid4()
        cat_schema.schema_fields = [cat_sf]

        category = MagicMock()
        category.id = uuid4()
        category.name = "Test Category"
        category.is_video_type = True
        category.schema_id = cat_schema.id
        category.schema = cat_schema

        mock_video.tags = [category]

        # Mock db.get: First BookmarkList, then FieldSchema
        mock_db.get = AsyncMock(side_effect=[
            bookmark_list,
            ws_schema,
        ])

        fields = await get_available_fields(mock_video, mock_db)

        # Assert only 1 field (deduplicated)
        assert len(fields) == 1
        assert fields[0].name == "Rating"

    @pytest.mark.asyncio
    async def test_handles_no_schemas(self, mock_db, mock_video, mock_list_id):
        """
        Test graceful handling when no schemas are defined.

        Given: Video has no category and list has no default_schema
        When: get_available_fields is called
        Then: Returns empty list
        """
        # Setup: List with no default schema
        bookmark_list = MagicMock()
        bookmark_list.id = mock_list_id
        bookmark_list.default_schema_id = None
        bookmark_list.default_schema = None

        mock_video.tags = []

        # Only one call since there's no default_schema to load
        mock_db.get = AsyncMock(return_value=bookmark_list)

        fields = await get_available_fields(mock_video, mock_db)

        # Assert empty list returned
        assert fields == []
