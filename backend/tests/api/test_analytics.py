"""
Tests for analytics API endpoint.

Tests cover:
- Most-used fields calculation
- Unused schemas detection
- Field coverage percentage
- Schema effectiveness metrics
- Edge cases (empty lists, no data)
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.models.tag import Tag, video_tags
from app.models.user import User
from uuid import uuid4


@pytest.mark.asyncio
async def test_get_analytics_success(client: AsyncClient, test_db: AsyncSession):
    """Test analytics endpoint returns all metrics."""
    # Create user
    user = User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(user)

    # Create list
    test_list = BookmarkList(id=uuid4(), name="Test List", user_id=user.id)
    test_db.add(test_list)

    # Create field
    field = CustomField(
        id=uuid4(),
        list_id=test_list.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(field)

    # Create video
    video = Video(
        id=uuid4(),
        list_id=test_list.id,
        youtube_id="abc12345678",
        title="Test Video"
    )
    test_db.add(video)

    # Create field value
    field_value = VideoFieldValue(
        id=uuid4(),
        video_id=video.id,
        field_id=field.id,
        value_numeric=5
    )
    test_db.add(field_value)

    await test_db.commit()

    # Call endpoint
    response = await client.get(f"/api/lists/{test_list.id}/analytics")

    assert response.status_code == 200
    data = response.json()

    # Verify structure
    assert "most_used_fields" in data
    assert "unused_schemas" in data
    assert "field_coverage" in data
    assert "schema_effectiveness" in data


@pytest.mark.asyncio
async def test_most_used_fields_calculation(client: AsyncClient, test_db: AsyncSession):
    """Test most-used fields sorted by usage count."""
    # Create user
    user = User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(user)

    test_list = BookmarkList(id=uuid4(), name="Test List", user_id=user.id)
    test_db.add(test_list)

    # Create 3 fields
    field1 = CustomField(id=uuid4(), list_id=test_list.id, name="Field 1", field_type="rating", config={})
    field2 = CustomField(id=uuid4(), list_id=test_list.id, name="Field 2", field_type="rating", config={})
    field3 = CustomField(id=uuid4(), list_id=test_list.id, name="Field 3", field_type="rating", config={})
    test_db.add_all([field1, field2, field3])

    # Create 5 videos
    videos = [Video(id=uuid4(), list_id=test_list.id, youtube_id=f"vid{i}", title=f"Video {i}") for i in range(5)]
    test_db.add_all(videos)

    # Field 1: 5 values (100%)
    # Field 2: 3 values (60%)
    # Field 3: 1 value (20%)
    for video in videos:
        test_db.add(VideoFieldValue(id=uuid4(), video_id=video.id, field_id=field1.id, value_numeric=5))

    for i in range(3):
        test_db.add(VideoFieldValue(id=uuid4(), video_id=videos[i].id, field_id=field2.id, value_numeric=3))

    test_db.add(VideoFieldValue(id=uuid4(), video_id=videos[0].id, field_id=field3.id, value_numeric=1))

    await test_db.commit()

    response = await client.get(f"/api/lists/{test_list.id}/analytics")
    assert response.status_code == 200

    most_used = response.json()["most_used_fields"]

    # Should be sorted by usage count descending
    assert len(most_used) == 3
    assert most_used[0]["field_name"] == "Field 1"
    assert most_used[0]["usage_count"] == 5
    assert most_used[0]["usage_percentage"] == 100.0

    assert most_used[1]["field_name"] == "Field 2"
    assert most_used[1]["usage_count"] == 3
    assert most_used[1]["usage_percentage"] == 60.0

    assert most_used[2]["field_name"] == "Field 3"
    assert most_used[2]["usage_count"] == 1
    assert most_used[2]["usage_percentage"] == 20.0


@pytest.mark.asyncio
async def test_unused_schemas_no_tags(client: AsyncClient, test_db: AsyncSession):
    """Test unused schemas detection - schema with no tags."""
    # Create user
    user = User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(user)

    test_list = BookmarkList(id=uuid4(), name="Test List", user_id=user.id)
    test_db.add(test_list)

    # Create schema with no tags
    schema = FieldSchema(
        id=uuid4(),
        list_id=test_list.id,
        name="Unused Schema",
        description="No tags assigned"
    )
    test_db.add(schema)

    # Add field to schema
    field = CustomField(id=uuid4(), list_id=test_list.id, name="Test Field", field_type="rating", config={})
    test_db.add(field)

    schema_field = SchemaField(
        schema_id=schema.id,
        field_id=field.id,
        display_order=0,
        show_on_card=True
    )
    test_db.add(schema_field)

    await test_db.commit()

    response = await client.get(f"/api/lists/{test_list.id}/analytics")
    assert response.status_code == 200

    unused = response.json()["unused_schemas"]

    assert len(unused) == 1
    assert unused[0]["schema_name"] == "Unused Schema"
    assert unused[0]["tag_count"] == 0
    assert unused[0]["reason"] == "no_tags"


@pytest.mark.asyncio
async def test_unused_schemas_no_values(client: AsyncClient, test_db: AsyncSession):
    """Test unused schemas detection - schema with tags but no values."""
    # Create user
    user = User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(user)

    test_list = BookmarkList(id=uuid4(), name="Test List", user_id=user.id)
    test_db.add(test_list)

    # Create schema
    schema = FieldSchema(id=uuid4(), list_id=test_list.id, name="Schema With Tag", description=None)
    test_db.add(schema)

    # Add field to schema
    field = CustomField(id=uuid4(), list_id=test_list.id, name="Test Field", field_type="rating", config={})
    test_db.add(field)

    schema_field = SchemaField(schema_id=schema.id, field_id=field.id, display_order=0, show_on_card=True)
    test_db.add(schema_field)

    # Create tag bound to schema (but no videos with this tag)
    tag = Tag(id=uuid4(), name="Test Tag", user_id=user.id, schema_id=schema.id)
    test_db.add(tag)

    await test_db.commit()

    response = await client.get(f"/api/lists/{test_list.id}/analytics")
    assert response.status_code == 200

    unused = response.json()["unused_schemas"]

    assert len(unused) == 1
    assert unused[0]["schema_name"] == "Schema With Tag"
    assert unused[0]["tag_count"] == 1
    assert unused[0]["reason"] == "no_values"


@pytest.mark.asyncio
async def test_field_coverage_sorted_ascending(client: AsyncClient, test_db: AsyncSession):
    """Test field coverage sorted by coverage % ascending (problems first)."""
    # Create user
    user = User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(user)

    test_list = BookmarkList(id=uuid4(), name="Test List", user_id=user.id)
    test_db.add(test_list)

    # Create 2 fields
    low_coverage_field = CustomField(id=uuid4(), list_id=test_list.id, name="Low Coverage", field_type="text", config={})
    high_coverage_field = CustomField(id=uuid4(), list_id=test_list.id, name="High Coverage", field_type="text", config={})
    test_db.add_all([low_coverage_field, high_coverage_field])

    # Create 10 videos
    videos = [Video(id=uuid4(), list_id=test_list.id, youtube_id=f"v{i}", title=f"Video {i}") for i in range(10)]
    test_db.add_all(videos)

    # Low coverage: 1/10 = 10%
    test_db.add(VideoFieldValue(id=uuid4(), video_id=videos[0].id, field_id=low_coverage_field.id, value_text="test"))

    # High coverage: 9/10 = 90%
    for i in range(9):
        test_db.add(VideoFieldValue(id=uuid4(), video_id=videos[i].id, field_id=high_coverage_field.id, value_text="test"))

    await test_db.commit()

    response = await client.get(f"/api/lists/{test_list.id}/analytics")
    assert response.status_code == 200

    coverage = response.json()["field_coverage"]

    # Should be sorted ascending (lowest first)
    assert len(coverage) == 2
    assert coverage[0]["field_name"] == "Low Coverage"
    assert coverage[0]["coverage_percentage"] == 10.0

    assert coverage[1]["field_name"] == "High Coverage"
    assert coverage[1]["coverage_percentage"] == 90.0


@pytest.mark.asyncio
async def test_schema_effectiveness_calculation(client: AsyncClient, test_db: AsyncSession):
    """Test schema effectiveness completion percentage."""
    # Create user
    user = User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(user)

    test_list = BookmarkList(id=uuid4(), name="Test List", user_id=user.id)
    test_db.add(test_list)

    # Create schema with 4 fields
    schema = FieldSchema(id=uuid4(), list_id=test_list.id, name="Test Schema", description=None)
    test_db.add(schema)

    fields = [
        CustomField(id=uuid4(), list_id=test_list.id, name=f"Field {i}", field_type="rating", config={})
        for i in range(4)
    ]
    test_db.add_all(fields)

    for i, field in enumerate(fields):
        test_db.add(SchemaField(schema_id=schema.id, field_id=field.id, display_order=i, show_on_card=False))

    # Create tag bound to schema
    tag = Tag(id=uuid4(), name="Test Tag", user_id=user.id, schema_id=schema.id)
    test_db.add(tag)

    # Create 2 videos with tag
    video1 = Video(id=uuid4(), list_id=test_list.id, youtube_id="v1", title="Video 1")
    video2 = Video(id=uuid4(), list_id=test_list.id, youtube_id="v2", title="Video 2")
    test_db.add_all([video1, video2])

    await test_db.flush()

    # Assign tag to videos
    await test_db.execute(
        video_tags.insert().values([
            {"id": uuid4(), "video_id": video1.id, "tag_id": tag.id},
            {"id": uuid4(), "video_id": video2.id, "tag_id": tag.id}
        ])
    )

    # Video 1: 4/4 fields filled (100%)
    # Video 2: 2/4 fields filled (50%)
    # Average: 3/4 = 75%
    for field in fields:
        test_db.add(VideoFieldValue(id=uuid4(), video_id=video1.id, field_id=field.id, value_numeric=5))

    for i in range(2):
        test_db.add(VideoFieldValue(id=uuid4(), video_id=video2.id, field_id=fields[i].id, value_numeric=4))

    await test_db.commit()

    response = await client.get(f"/api/lists/{test_list.id}/analytics")
    assert response.status_code == 200

    effectiveness = response.json()["schema_effectiveness"]

    assert len(effectiveness) == 1
    assert effectiveness[0]["schema_name"] == "Test Schema"
    assert effectiveness[0]["field_count"] == 4
    assert effectiveness[0]["avg_fields_filled"] == 3.0
    # 3.0/4 * 100 = 75.0
    assert effectiveness[0]["completion_percentage"] == 75.0
    assert effectiveness[0]["video_count"] == 2


@pytest.mark.asyncio
async def test_analytics_empty_list(client: AsyncClient, test_db: AsyncSession):
    """Test analytics with no videos/fields."""
    # Create user
    user = User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True
    )
    test_db.add(user)

    test_list = BookmarkList(id=uuid4(), name="Empty List", user_id=user.id)
    test_db.add(test_list)
    await test_db.commit()

    response = await client.get(f"/api/lists/{test_list.id}/analytics")
    assert response.status_code == 200

    data = response.json()
    assert data["most_used_fields"] == []
    assert data["unused_schemas"] == []
    assert data["field_coverage"] == []
    assert data["schema_effectiveness"] == []


@pytest.mark.asyncio
async def test_analytics_list_not_found(client: AsyncClient):
    """Test analytics endpoint with invalid list_id."""
    fake_id = uuid4()
    response = await client.get(f"/api/lists/{fake_id}/analytics")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
