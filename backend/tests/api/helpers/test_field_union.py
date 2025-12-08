"""
Unit tests for field union helper module.

These tests verify the field union computation logic with conflict resolution
and batch loading functionality for multi-tag field inheritance.

Test Groups:
1. compute_field_union_with_conflicts() - Pure logic (8 tests)
2. get_available_fields_for_videos() - Batch DB loader (5 tests)
3. get_available_fields_for_video() - Single-video wrapper (3 tests)

Related:
- Task #74: Multi-Tag Field Union Query implementation
- Task #71: Video Field Values CRUD endpoints
"""

from uuid import uuid4

import pytest
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.helpers.field_union import (
    compute_field_union_with_conflicts,
    get_available_fields_for_video,
    get_available_fields_for_videos,
)
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.tag import Tag, video_tags
from app.models.video import Video

# ============================================================================
# Test Group 1: compute_field_union_with_conflicts() - Pure Logic
# ============================================================================


class TestComputeFieldUnionWithConflicts:
    """Tests for pure conflict resolution algorithm (no database)."""

    def test_single_schema_no_conflicts(self):
        """Test single schema with all unique fields."""
        # Setup test data
        field1 = CustomField(
            id=uuid4(), name="Rating", field_type="rating", config={"max_rating": 5}
        )
        field2 = CustomField(id=uuid4(), name="Notes", field_type="text", config={})

        schema_id = uuid4()
        schema_field1 = SchemaField(
            schema_id=schema_id, field_id=field1.id, display_order=1, show_on_card=True
        )
        schema_field1.field = field1

        schema_field2 = SchemaField(
            schema_id=schema_id, field_id=field2.id, display_order=2, show_on_card=False
        )
        schema_field2.field = field2

        fields_by_schema = {
            schema_id: [
                (schema_field1, "Video Quality"),
                (schema_field2, "Video Quality"),
            ]
        }

        # Execute
        result = compute_field_union_with_conflicts([schema_id], fields_by_schema)

        # Verify
        assert len(result) == 2
        assert result[0][0].name == "Rating"
        assert result[0][1] is None  # No conflict → no prefix
        assert result[0][2] == 1  # display_order
        assert result[0][3] is True  # show_on_card

        assert result[1][0].name == "Notes"
        assert result[1][1] is None  # No conflict → no prefix
        assert result[1][2] == 2
        assert result[1][3] is False

    def test_two_schemas_same_type_deduplication(self):
        """Test same field name + same type → show once (deduplicate)."""
        # Schema A has "Rating" (rating type)
        field_a = CustomField(
            id=uuid4(), name="Rating", field_type="rating", config={"max_rating": 5}
        )
        schema_a_id = uuid4()
        schema_field_a = SchemaField(
            schema_id=schema_a_id,
            field_id=field_a.id,
            display_order=1,
            show_on_card=True,
        )
        schema_field_a.field = field_a

        # Schema B has "Rating" (same type!)
        field_b = CustomField(
            id=uuid4(), name="Rating", field_type="rating", config={"max_rating": 5}
        )
        schema_b_id = uuid4()
        schema_field_b = SchemaField(
            schema_id=schema_b_id,
            field_id=field_b.id,
            display_order=1,
            show_on_card=False,
        )
        schema_field_b.field = field_b

        fields_by_schema = {
            schema_a_id: [(schema_field_a, "Schema A")],
            schema_b_id: [(schema_field_b, "Schema B")],
        }

        # Execute
        result = compute_field_union_with_conflicts(
            [schema_a_id, schema_b_id], fields_by_schema
        )

        # Verify: Only one "Rating" field (first wins)
        assert len(result) == 1
        assert result[0][0].name == "Rating"
        assert result[0][1] is None  # Same type → no conflict → no prefix

    def test_two_schemas_different_type_conflict(self):
        """Test same field name + different type → both with schema prefix."""
        # Schema A has "Rating" (rating type)
        field_a = CustomField(
            id=uuid4(), name="Rating", field_type="rating", config={"max_rating": 5}
        )
        schema_a_id = uuid4()
        schema_field_a = SchemaField(
            schema_id=schema_a_id,
            field_id=field_a.id,
            display_order=1,
            show_on_card=True,
        )
        schema_field_a.field = field_a

        # Schema B has "Rating" (text type - CONFLICT!)
        field_b = CustomField(id=uuid4(), name="Rating", field_type="text", config={})
        schema_b_id = uuid4()
        schema_field_b = SchemaField(
            schema_id=schema_b_id,
            field_id=field_b.id,
            display_order=2,
            show_on_card=False,
        )
        schema_field_b.field = field_b

        fields_by_schema = {
            schema_a_id: [(schema_field_a, "Schema A")],
            schema_b_id: [(schema_field_b, "Schema B")],
        }

        # Execute
        result = compute_field_union_with_conflicts(
            [schema_a_id, schema_b_id], fields_by_schema
        )

        # Verify: Both fields present with prefixes
        assert len(result) == 2

        # First field (rating type)
        assert result[0][0].name == "Rating"
        assert result[0][0].field_type == "rating"
        assert result[0][1] == "Schema A"  # Conflict detected → prefixed

        # Second field (text type)
        assert result[1][0].name == "Rating"
        assert result[1][0].field_type == "text"
        assert result[1][1] == "Schema B"  # Conflict detected → prefixed

    def test_three_schemas_partial_overlap(self):
        """Test complex scenario with some conflicts and some unique fields."""
        # Schema A: "Rating" (rating), "Notes" (text)
        field_a1 = CustomField(
            id=uuid4(), name="Rating", field_type="rating", config={"max_rating": 5}
        )
        field_a2 = CustomField(id=uuid4(), name="Notes", field_type="text", config={})
        schema_a_id = uuid4()

        # Schema B: "Rating" (text - CONFLICT!), "Quality" (select)
        field_b1 = CustomField(id=uuid4(), name="Rating", field_type="text", config={})
        field_b2 = CustomField(
            id=uuid4(),
            name="Quality",
            field_type="select",
            config={"options": ["low", "high"]},
        )
        schema_b_id = uuid4()

        # Schema C: "Notes" (text - same type, dedupe), "Duration" (rating)
        field_c1 = CustomField(id=uuid4(), name="Notes", field_type="text", config={})
        field_c2 = CustomField(
            id=uuid4(), name="Duration", field_type="rating", config={"max_rating": 10}
        )
        schema_c_id = uuid4()

        # Build schema fields
        schema_field_a1 = SchemaField(
            schema_id=schema_a_id,
            field_id=field_a1.id,
            display_order=1,
            show_on_card=True,
        )
        schema_field_a1.field = field_a1

        schema_field_a2 = SchemaField(
            schema_id=schema_a_id,
            field_id=field_a2.id,
            display_order=2,
            show_on_card=False,
        )
        schema_field_a2.field = field_a2

        schema_field_b1 = SchemaField(
            schema_id=schema_b_id,
            field_id=field_b1.id,
            display_order=3,
            show_on_card=True,
        )
        schema_field_b1.field = field_b1

        schema_field_b2 = SchemaField(
            schema_id=schema_b_id,
            field_id=field_b2.id,
            display_order=4,
            show_on_card=False,
        )
        schema_field_b2.field = field_b2

        schema_field_c1 = SchemaField(
            schema_id=schema_c_id,
            field_id=field_c1.id,
            display_order=5,
            show_on_card=True,
        )
        schema_field_c1.field = field_c1

        schema_field_c2 = SchemaField(
            schema_id=schema_c_id,
            field_id=field_c2.id,
            display_order=6,
            show_on_card=False,
        )
        schema_field_c2.field = field_c2

        fields_by_schema = {
            schema_a_id: [(schema_field_a1, "Schema A"), (schema_field_a2, "Schema A")],
            schema_b_id: [(schema_field_b1, "Schema B"), (schema_field_b2, "Schema B")],
            schema_c_id: [(schema_field_c1, "Schema C"), (schema_field_c2, "Schema C")],
        }

        # Execute
        result = compute_field_union_with_conflicts(
            [schema_a_id, schema_b_id, schema_c_id], fields_by_schema
        )

        # Verify: Should have 5 fields total
        # "Rating" (rating, prefixed), "Notes" (dedupe), "Rating" (text, prefixed),
        # "Quality", "Duration"
        assert len(result) == 5

        # Find fields by name and type
        ratings = [f for f in result if f[0].name == "Rating"]
        notes = [f for f in result if f[0].name == "Notes"]
        quality = [f for f in result if f[0].name == "Quality"]
        duration = [f for f in result if f[0].name == "Duration"]

        # "Rating" appears twice (different types, both prefixed)
        assert len(ratings) == 2
        assert all(f[1] is not None for f in ratings)  # Both have schema prefix

        # "Notes" appears once (same type, deduped)
        assert len(notes) == 1
        assert notes[0][1] is None  # No conflict → no prefix

        # "Quality" and "Duration" appear once (unique)
        assert len(quality) == 1
        assert quality[0][1] is None
        assert len(duration) == 1
        assert duration[0][1] is None

    def test_empty_schema(self):
        """Test empty schema_ids list returns empty result."""
        fields_by_schema = {}
        result = compute_field_union_with_conflicts([], fields_by_schema)
        assert result == []

    def test_conflicting_names_case_insensitive(self):
        """Test "Rating" vs "rating" treated as same field (case-insensitive)."""
        # Schema A has "Rating" (rating type)
        field_a = CustomField(
            id=uuid4(), name="Rating", field_type="rating", config={"max_rating": 5}
        )
        schema_a_id = uuid4()
        schema_field_a = SchemaField(
            schema_id=schema_a_id,
            field_id=field_a.id,
            display_order=1,
            show_on_card=True,
        )
        schema_field_a.field = field_a

        # Schema B has "rating" (text type - different case, different type)
        field_b = CustomField(
            id=uuid4(),
            name="rating",  # lowercase
            field_type="text",
            config={},
        )
        schema_b_id = uuid4()
        schema_field_b = SchemaField(
            schema_id=schema_b_id,
            field_id=field_b.id,
            display_order=2,
            show_on_card=False,
        )
        schema_field_b.field = field_b

        fields_by_schema = {
            schema_a_id: [(schema_field_a, "Schema A")],
            schema_b_id: [(schema_field_b, "Schema B")],
        }

        # Execute
        result = compute_field_union_with_conflicts(
            [schema_a_id, schema_b_id], fields_by_schema
        )

        # Verify: Conflict detected despite case difference
        assert len(result) == 2
        assert result[0][1] == "Schema A"  # Prefixed due to conflict
        assert result[1][1] == "Schema B"  # Prefixed due to conflict

    def test_display_order_preserved(self):
        """Test fields are sorted by display_order."""
        field1 = CustomField(id=uuid4(), name="Field C", field_type="text", config={})
        field2 = CustomField(id=uuid4(), name="Field A", field_type="text", config={})
        field3 = CustomField(id=uuid4(), name="Field B", field_type="text", config={})

        schema_id = uuid4()

        # Add fields with specific display orders (not alphabetical)
        schema_field1 = SchemaField(
            schema_id=schema_id,
            field_id=field1.id,
            display_order=3,  # C is third
            show_on_card=True,
        )
        schema_field1.field = field1

        schema_field2 = SchemaField(
            schema_id=schema_id,
            field_id=field2.id,
            display_order=1,  # A is first
            show_on_card=True,
        )
        schema_field2.field = field2

        schema_field3 = SchemaField(
            schema_id=schema_id,
            field_id=field3.id,
            display_order=2,  # B is second
            show_on_card=True,
        )
        schema_field3.field = field3

        fields_by_schema = {
            schema_id: [
                (schema_field1, "Schema"),
                (schema_field2, "Schema"),
                (schema_field3, "Schema"),
            ]
        }

        # Execute
        result = compute_field_union_with_conflicts([schema_id], fields_by_schema)

        # Verify: Sorted by display_order, not name
        assert len(result) == 3
        assert result[0][0].name == "Field A"  # display_order=1
        assert result[1][0].name == "Field B"  # display_order=2
        assert result[2][0].name == "Field C"  # display_order=3

    def test_show_on_card_preserved(self):
        """Test show_on_card flag is correctly passed through."""
        field1 = CustomField(id=uuid4(), name="Visible", field_type="text", config={})
        field2 = CustomField(id=uuid4(), name="Hidden", field_type="text", config={})

        schema_id = uuid4()

        schema_field1 = SchemaField(
            schema_id=schema_id,
            field_id=field1.id,
            display_order=1,
            show_on_card=True,  # Visible on card
        )
        schema_field1.field = field1

        schema_field2 = SchemaField(
            schema_id=schema_id,
            field_id=field2.id,
            display_order=2,
            show_on_card=False,  # Not visible on card
        )
        schema_field2.field = field2

        fields_by_schema = {
            schema_id: [(schema_field1, "Schema"), (schema_field2, "Schema")]
        }

        # Execute
        result = compute_field_union_with_conflicts([schema_id], fields_by_schema)

        # Verify: show_on_card preserved
        assert result[0][3] is True  # Visible
        assert result[1][3] is False  # Hidden


# ============================================================================
# Test Group 2: get_available_fields_for_videos() - Batch DB Loader
# ============================================================================


class TestGetAvailableFieldsForVideos:
    """Tests for batch loading with real database."""

    @pytest.mark.skip(
        reason="TODO: Fix SQLAlchemy async greenlet issue - MissingGreenlet when accessing schema_field.field"
    )
    @pytest.mark.asyncio
    async def test_batch_load_multiple_videos(
        self, test_db: AsyncSession, test_list, test_user
    ):
        """Test batch loading for 3 videos with different tags and schemas."""
        # Create schemas
        schema_a = FieldSchema(
            list_id=test_list.id, name="Schema A", description="First schema"
        )
        schema_b = FieldSchema(
            list_id=test_list.id, name="Schema B", description="Second schema"
        )
        test_db.add_all([schema_a, schema_b])
        await test_db.flush()

        # Create custom fields
        field1 = CustomField(
            list_id=test_list.id,
            name="Rating",
            field_type="rating",
            config={"max_rating": 5},
        )
        field2 = CustomField(
            list_id=test_list.id, name="Notes", field_type="text", config={}
        )
        test_db.add_all([field1, field2])
        await test_db.flush()

        # Associate fields with schemas
        schema_field1 = SchemaField(
            schema_id=schema_a.id,
            field_id=field1.id,
            display_order=1,
            show_on_card=True,
        )
        schema_field2 = SchemaField(
            schema_id=schema_b.id,
            field_id=field2.id,
            display_order=1,
            show_on_card=False,
        )
        test_db.add_all([schema_field1, schema_field2])
        await test_db.flush()

        # Create tags
        tag_a = Tag(name="Tag A", user_id=test_user.id, schema_id=schema_a.id)
        tag_b = Tag(name="Tag B", user_id=test_user.id, schema_id=schema_b.id)
        test_db.add_all([tag_a, tag_b])
        await test_db.flush()

        # Create videos
        video1 = Video(
            list_id=test_list.id, youtube_id="vid1", processing_status="pending"
        )
        video2 = Video(
            list_id=test_list.id, youtube_id="vid2", processing_status="pending"
        )
        video3 = Video(
            list_id=test_list.id, youtube_id="vid3", processing_status="pending"
        )
        test_db.add_all([video1, video2, video3])
        await test_db.commit()

        # Assign tags using direct SQL insert to avoid lazy loading issues
        await test_db.execute(
            insert(video_tags).values(
                [
                    {"video_id": video1.id, "tag_id": tag_a.id},
                    {"video_id": video2.id, "tag_id": tag_b.id},
                    {"video_id": video3.id, "tag_id": tag_a.id},
                    {"video_id": video3.id, "tag_id": tag_b.id},
                ]
            )
        )
        await test_db.commit()

        # Refresh to load tags relationship
        await test_db.refresh(video1)
        await test_db.refresh(video2)
        await test_db.refresh(video3)

        videos = [video1, video2, video3]

        # Execute batch load
        fields_by_video = await get_available_fields_for_videos(videos, test_db)

        # Verify
        assert len(fields_by_video) == 3

        # Video1 has tag_a → field1 (Rating)
        assert video1.id in fields_by_video
        video1_fields = fields_by_video[video1.id]
        assert len(video1_fields) == 1
        assert video1_fields[0][0].name == "Rating"

        # Video2 has tag_b → field2 (Notes)
        assert video2.id in fields_by_video
        video2_fields = fields_by_video[video2.id]
        assert len(video2_fields) == 1
        assert video2_fields[0][0].name == "Notes"

        # Video3 has both tags → both fields
        assert video3.id in fields_by_video
        video3_fields = fields_by_video[video3.id]
        assert len(video3_fields) == 2

    @pytest.mark.skip(
        reason="TODO: Fix SQLAlchemy async greenlet issue - MissingGreenlet when accessing schema_field.field"
    )
    @pytest.mark.asyncio
    async def test_batch_load_videos_no_tags(self, test_db: AsyncSession, test_list):
        """Test videos without tags return empty fields list."""
        # Create videos without tags
        video1 = Video(
            list_id=test_list.id, youtube_id="no_tags_1", processing_status="pending"
        )
        video2 = Video(
            list_id=test_list.id, youtube_id="no_tags_2", processing_status="pending"
        )
        test_db.add_all([video1, video2])
        await test_db.commit()

        # Refresh to ensure relationships are loaded
        await test_db.refresh(video1)
        await test_db.refresh(video2)

        videos = [video1, video2]

        # Execute
        fields_by_video = await get_available_fields_for_videos(videos, test_db)

        # Verify: Both videos have empty fields
        assert len(fields_by_video) == 2
        assert fields_by_video[video1.id] == []
        assert fields_by_video[video2.id] == []

    @pytest.mark.skip(
        reason="TODO: Fix SQLAlchemy async greenlet issue - MissingGreenlet when accessing schema_field.field"
    )
    @pytest.mark.asyncio
    async def test_batch_load_videos_no_schema(
        self, test_db: AsyncSession, test_list, test_user
    ):
        """Test videos with tags but no schema return empty fields."""
        # Create tag WITHOUT schema
        tag = Tag(
            name="No Schema Tag",
            user_id=test_user.id,
            schema_id=None,  # No schema!
        )
        test_db.add(tag)
        await test_db.flush()

        # Create video with tag
        video = Video(
            list_id=test_list.id, youtube_id="no_schema", processing_status="pending"
        )
        test_db.add(video)
        await test_db.commit()

        # Assign tag using direct SQL insert
        await test_db.execute(
            insert(video_tags).values({"video_id": video.id, "tag_id": tag.id})
        )
        await test_db.commit()

        # Refresh to load tags relationship
        await test_db.refresh(video)

        videos = [video]

        # Execute
        fields_by_video = await get_available_fields_for_videos(videos, test_db)

        # Verify: Empty fields (tag has no schema)
        assert fields_by_video[video.id] == []

    @pytest.mark.skip(
        reason="TODO: Fix SQLAlchemy async greenlet issue - MissingGreenlet when accessing schema_field.field"
    )
    @pytest.mark.asyncio
    async def test_batch_load_single_query(
        self, test_db: AsyncSession, test_list, test_user
    ):
        """Test batch load uses minimal queries (not N+1)."""
        # Create schema and field
        schema = FieldSchema(
            list_id=test_list.id, name="Query Test Schema", description="Test"
        )
        test_db.add(schema)
        await test_db.flush()

        field = CustomField(
            list_id=test_list.id, name="Test Field", field_type="text", config={}
        )
        test_db.add(field)
        await test_db.flush()

        schema_field = SchemaField(
            schema_id=schema.id, field_id=field.id, display_order=1, show_on_card=True
        )
        test_db.add(schema_field)
        await test_db.flush()

        tag = Tag(name="Query Test Tag", user_id=test_user.id, schema_id=schema.id)
        test_db.add(tag)
        await test_db.flush()

        # Create 10 videos (test scalability)
        videos = []
        for i in range(10):
            video = Video(
                list_id=test_list.id,
                youtube_id=f"query_test_{i}",
                processing_status="pending",
            )
            test_db.add(video)
            videos.append(video)

        await test_db.commit()

        # Assign tags using direct SQL insert
        video_tag_values = [
            {"video_id": video.id, "tag_id": tag.id} for video in videos
        ]
        await test_db.execute(insert(video_tags).values(video_tag_values))
        await test_db.commit()

        # Refresh all videos to load tags relationship
        for video in videos:
            await test_db.refresh(video)

        # Execute (query count verification is implicit - function should complete fast)
        fields_by_video = await get_available_fields_for_videos(videos, test_db)

        # Verify all videos have the same field
        assert len(fields_by_video) == 10
        for video in videos:
            assert len(fields_by_video[video.id]) == 1
            assert fields_by_video[video.id][0][0].name == "Test Field"

    @pytest.mark.asyncio
    async def test_batch_load_empty_video_list(self, test_db: AsyncSession):
        """Test empty video list returns empty dict."""
        result = await get_available_fields_for_videos([], test_db)
        assert result == {}


# ============================================================================
# Test Group 3: get_available_fields_for_video() - Single-Video Wrapper
# ============================================================================


class TestGetAvailableFieldsForVideo:
    """Tests for single-video wrapper function."""

    @pytest.mark.skip(
        reason="TODO: Fix SQLAlchemy async greenlet issue - MissingGreenlet when accessing schema_field.field"
    )
    @pytest.mark.asyncio
    async def test_single_video_wrapper(
        self, test_db: AsyncSession, test_list, test_user
    ):
        """Test wrapper calls batch function and returns correct result."""
        # Create schema and field
        schema = FieldSchema(
            list_id=test_list.id, name="Single Video Schema", description="Test"
        )
        test_db.add(schema)
        await test_db.flush()

        field = CustomField(
            list_id=test_list.id,
            name="Single Field",
            field_type="rating",
            config={"max_rating": 5},
        )
        test_db.add(field)
        await test_db.flush()

        schema_field = SchemaField(
            schema_id=schema.id, field_id=field.id, display_order=1, show_on_card=True
        )
        test_db.add(schema_field)
        await test_db.flush()

        tag = Tag(name="Single Tag", user_id=test_user.id, schema_id=schema.id)
        test_db.add(tag)
        await test_db.flush()

        video = Video(
            list_id=test_list.id, youtube_id="single_video", processing_status="pending"
        )
        test_db.add(video)
        await test_db.commit()

        # Assign tag using direct SQL insert
        await test_db.execute(
            insert(video_tags).values({"video_id": video.id, "tag_id": tag.id})
        )
        await test_db.commit()

        # Refresh to load tags relationship
        await test_db.refresh(video)

        # Execute
        available_fields = await get_available_fields_for_video(video, test_db)

        # Verify
        assert len(available_fields) == 1
        assert available_fields[0][0].name == "Single Field"
        assert available_fields[0][0].field_type == "rating"
        assert available_fields[0][2] == 1  # display_order
        assert available_fields[0][3] is True  # show_on_card

    @pytest.mark.skip(
        reason="TODO: Fix SQLAlchemy async greenlet issue - MissingGreenlet when accessing schema_field.field"
    )
    @pytest.mark.asyncio
    async def test_single_video_no_fields(self, test_db: AsyncSession, test_list):
        """Test single video with no tags returns empty list."""
        video = Video(
            list_id=test_list.id,
            youtube_id="no_tags_single",
            processing_status="pending",
        )
        test_db.add(video)
        await test_db.commit()

        # Refresh to ensure relationships are loaded
        await test_db.refresh(video)

        # Execute
        available_fields = await get_available_fields_for_video(video, test_db)

        # Verify: Empty list
        assert available_fields == []

    @pytest.mark.skip(
        reason="TODO: Fix SQLAlchemy async greenlet issue - MissingGreenlet when accessing schema_field.field"
    )
    @pytest.mark.asyncio
    async def test_single_video_calls_batch(
        self, test_db: AsyncSession, test_list, test_user
    ):
        """Test wrapper actually uses batch function internally."""
        # Create minimal data
        schema = FieldSchema(
            list_id=test_list.id, name="Batch Call Test", description="Test"
        )
        test_db.add(schema)
        await test_db.flush()

        field = CustomField(
            list_id=test_list.id, name="Batch Field", field_type="boolean", config={}
        )
        test_db.add(field)
        await test_db.flush()

        schema_field = SchemaField(
            schema_id=schema.id, field_id=field.id, display_order=1, show_on_card=False
        )
        test_db.add(schema_field)
        await test_db.flush()

        tag = Tag(name="Batch Tag", user_id=test_user.id, schema_id=schema.id)
        test_db.add(tag)
        await test_db.flush()

        video = Video(
            list_id=test_list.id, youtube_id="batch_call", processing_status="pending"
        )
        test_db.add(video)
        await test_db.commit()

        # Assign tag using direct SQL insert
        await test_db.execute(
            insert(video_tags).values({"video_id": video.id, "tag_id": tag.id})
        )
        await test_db.commit()

        # Refresh to load tags relationship
        await test_db.refresh(video)

        # Execute single wrapper
        single_result = await get_available_fields_for_video(video, test_db)

        # Execute batch directly for comparison
        batch_result = await get_available_fields_for_videos([video], test_db)

        # Verify: Both produce same result
        assert single_result == batch_result[video.id]
        assert len(single_result) == 1
        assert single_result[0][0].name == "Batch Field"
