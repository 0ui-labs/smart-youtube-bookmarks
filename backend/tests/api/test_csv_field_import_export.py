"""
Unit tests for CSV export/import with custom field values.

Tests cover:
- Export Tests (6+): Field columns, values, empty fields, boolean format, sorting, metadata
- Import Tests (8+): Field matching, validation, error handling, boolean parsing

Related to Task #147: CSV Import/Export for Custom Field Values
"""

import pytest
import csv
import io
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.video import Video
from app.models.custom_field import CustomField
from app.models.video_field_value import VideoFieldValue
from app.models.user import User


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
async def test_list_with_fields(test_db: AsyncSession, test_user: User):
    """Create test list with custom fields."""
    list_obj = BookmarkList(user_id=test_user.id, name="Test List")
    test_db.add(list_obj)
    await test_db.flush()

    # Create custom fields
    rating_field = CustomField(
        list_id=list_obj.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    select_field = CustomField(
        list_id=list_obj.id,
        name="Presentation",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    test_db.add(rating_field)
    test_db.add(select_field)

    await test_db.commit()
    await test_db.refresh(list_obj)
    await test_db.refresh(rating_field)
    await test_db.refresh(select_field)

    return {
        'list': list_obj,
        'rating_field': rating_field,
        'select_field': select_field
    }


# ============================================================================
# Export Tests (6+)
# ============================================================================

class TestCSVExportWithFields:
    """Tests for GET /api/lists/{list_id}/export/csv with custom fields."""

    @pytest.mark.asyncio
    async def test_export_includes_field_columns(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV export includes field columns in header."""
        list_obj = test_list_with_fields['list']

        # Create video with no field values
        video = Video(
            list_id=list_obj.id,
            youtube_id="dQw4w9WgXcQ",
            title="Test Video",
            processing_status="completed"
        )
        test_db.add(video)
        await test_db.commit()

        # Export CSV
        response = await client.get(f"/api/lists/{list_obj.id}/export/csv")
        assert response.status_code == 200

        # Parse CSV - skip comment lines
        csv_content = response.text
        lines = [line for line in csv_content.split('\n') if not line.startswith('#')]
        csv_text = '\n'.join(lines)
        reader = csv.DictReader(io.StringIO(csv_text))

        # Verify header includes field columns
        assert 'youtube_id' in reader.fieldnames
        assert 'field_Overall Rating' in reader.fieldnames
        assert 'field_Presentation' in reader.fieldnames

    @pytest.mark.asyncio
    async def test_export_field_values_populated(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV export includes actual field values."""
        list_obj = test_list_with_fields['list']
        rating_field = test_list_with_fields['rating_field']

        # Create video with field value
        video = Video(
            list_id=list_obj.id,
            youtube_id="dQw4w9WgXcQ",
            processing_status="completed"
        )
        test_db.add(video)
        await test_db.flush()

        # Set field value
        field_value = VideoFieldValue(
            video_id=video.id,
            field_id=rating_field.id,
            value_numeric=5
        )
        test_db.add(field_value)
        await test_db.commit()

        # Export CSV
        response = await client.get(f"/api/lists/{list_obj.id}/export/csv")
        assert response.status_code == 200

        # Parse CSV and verify value
        csv_content = response.text
        lines = [line for line in csv_content.split('\n') if not line.startswith('#')]
        csv_text = '\n'.join(lines)
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)

        assert len(rows) == 1
        # Float value exported as string (may be "5" or "5.0")
        assert rows[0]['field_Overall Rating'] in ['5', '5.0']

    @pytest.mark.asyncio
    async def test_export_empty_field_values(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV export shows empty string for unset fields."""
        list_obj = test_list_with_fields['list']

        # Create video with NO field values
        video = Video(
            list_id=list_obj.id,
            youtube_id="dQw4w9WgXcQ",
            processing_status="completed"
        )
        test_db.add(video)
        await test_db.commit()

        # Export CSV
        response = await client.get(f"/api/lists/{list_obj.id}/export/csv")
        assert response.status_code == 200

        # Verify empty fields are empty strings (not "NULL")
        lines = [line for line in response.text.split('\n') if not line.startswith('#')]
        csv_text = '\n'.join(lines)
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)

        assert len(rows) == 1
        assert rows[0]['field_Overall Rating'] == ''
        assert rows[0]['field_Presentation'] == ''

    @pytest.mark.asyncio
    async def test_export_boolean_field_format(
        self, client: AsyncClient, test_db: AsyncSession, test_user: User
    ):
        """Test CSV export formats boolean values as 'true'/'false'."""
        # Create list with boolean field
        list_obj = BookmarkList(user_id=test_user.id, name="Test List")
        test_db.add(list_obj)
        await test_db.flush()

        bool_field = CustomField(
            list_id=list_obj.id,
            name="Watched",
            field_type="boolean",
            config={}
        )
        test_db.add(bool_field)
        await test_db.flush()

        # Create video with boolean value = True
        video = Video(
            list_id=list_obj.id,
            youtube_id="dQw4w9WgXcQ",
            processing_status="completed"
        )
        test_db.add(video)
        await test_db.flush()

        field_value = VideoFieldValue(
            video_id=video.id,
            field_id=bool_field.id,
            value_boolean=True
        )
        test_db.add(field_value)
        await test_db.commit()

        # Export and verify
        response = await client.get(f"/api/lists/{list_obj.id}/export/csv")
        assert response.status_code == 200

        lines = [line for line in response.text.split('\n') if not line.startswith('#')]
        csv_text = '\n'.join(lines)
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)

        assert rows[0]['field_Watched'] == 'true'

    @pytest.mark.asyncio
    async def test_export_field_columns_alphabetically_sorted(
        self, client: AsyncClient, test_db: AsyncSession, test_user: User
    ):
        """Test field columns are sorted alphabetically for consistency."""
        list_obj = BookmarkList(user_id=test_user.id, name="Test List")
        test_db.add(list_obj)
        await test_db.flush()

        # Create fields in non-alphabetical order
        z_field = CustomField(list_id=list_obj.id, name="ZZZ Field", field_type="text", config={})
        a_field = CustomField(list_id=list_obj.id, name="AAA Field", field_type="text", config={})
        m_field = CustomField(list_id=list_obj.id, name="MMM Field", field_type="text", config={})

        test_db.add(z_field)
        test_db.add(a_field)
        test_db.add(m_field)
        await test_db.commit()

        # Export and verify column order
        response = await client.get(f"/api/lists/{list_obj.id}/export/csv")
        assert response.status_code == 200

        lines = [line for line in response.text.split('\n') if not line.startswith('#')]
        csv_text = '\n'.join(lines)
        reader = csv.DictReader(io.StringIO(csv_text))

        # Field columns should appear alphabetically
        field_columns = [col for col in reader.fieldnames if col.startswith('field_')]
        assert field_columns == ['field_AAA Field', 'field_MMM Field', 'field_ZZZ Field']

    @pytest.mark.asyncio
    async def test_export_metadata_comment(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV export includes metadata comment line."""
        list_obj = test_list_with_fields['list']

        # Export CSV
        response = await client.get(f"/api/lists/{list_obj.id}/export/csv")
        assert response.status_code == 200

        # Verify metadata comment exists
        csv_content = response.text
        assert csv_content.startswith('#')

        # Check that metadata includes field info
        first_line = csv_content.split('\n')[0]
        assert 'Custom Fields:' in first_line or 'Overall Rating' in first_line


# ============================================================================
# Import Tests (8+)
# ============================================================================

class TestCSVImportWithFields:
    """Tests for POST /api/lists/{list_id}/videos/bulk with field columns."""

    @pytest.mark.asyncio
    async def test_import_with_field_values(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV import parses and applies field values."""
        list_obj = test_list_with_fields['list']
        rating_field = test_list_with_fields['rating_field']

        # Create CSV with field column
        csv_content = """url,field_Overall Rating
https://youtube.com/watch?v=dQw4w9WgXcQ,5"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        # Import CSV
        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201
        data = response.json()
        assert data['created_count'] == 1

        # Verify field value was applied
        stmt = select(Video).where(Video.list_id == list_obj.id, Video.youtube_id == "dQw4w9WgXcQ")
        result = await test_db.execute(stmt)
        video = result.scalar_one()

        check_stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == video.id,
            VideoFieldValue.field_id == rating_field.id
        )
        result = await test_db.execute(check_stmt)
        field_value = result.scalar_one()

        assert field_value.value_numeric == 5

    @pytest.mark.asyncio
    async def test_import_case_insensitive_field_matching(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test field column matching is case-insensitive."""
        list_obj = test_list_with_fields['list']
        rating_field = test_list_with_fields['rating_field']

        # CSV with lowercase field name (note: spaces become part of field name)
        csv_content = """url,field_Overall Rating
https://youtube.com/watch?v=testCaseVid,5"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        # Should succeed (case-insensitive match)
        assert response.status_code == 201
        data = response.json()
        assert data['created_count'] == 1

        # Verify field value was actually set
        stmt = select(Video).where(Video.list_id == list_obj.id, Video.youtube_id == "testCaseVid")
        result = await test_db.execute(stmt)
        video = result.scalar_one()

        check_stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == video.id,
            VideoFieldValue.field_id == rating_field.id
        )
        result = await test_db.execute(check_stmt)
        field_value = result.scalar_one()
        assert field_value.value_numeric == 5

    @pytest.mark.asyncio
    async def test_import_unknown_field_column_ignored(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV import ignores unknown field columns (logs warning)."""
        list_obj = test_list_with_fields['list']

        # CSV with unknown field column
        csv_content = """url,field_NonExistent
https://youtube.com/watch?v=dQw4w9WgXcQ,somevalue"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        # Should still succeed (unknown column ignored)
        assert response.status_code == 201
        assert response.json()['created_count'] == 1

    @pytest.mark.asyncio
    async def test_import_invalid_rating_value(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV import handles invalid rating values (out of range)."""
        list_obj = test_list_with_fields['list']
        rating_field = test_list_with_fields['rating_field']

        # CSV with invalid rating (10 > max_rating 5)
        csv_content = """url,field_Overall Rating
https://youtube.com/watch?v=invalidRatV,10"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        # Video created, but field value error logged
        assert response.status_code == 201
        data = response.json()
        assert data['created_count'] == 1

        # Verify video was created
        stmt = select(Video).where(Video.list_id == list_obj.id, Video.youtube_id == "invalidRatV")
        result = await test_db.execute(stmt)
        video = result.scalar_one()

        # Verify field value was NOT set due to validation error
        check_stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == video.id,
            VideoFieldValue.field_id == rating_field.id
        )
        result = await test_db.execute(check_stmt)
        field_value = result.scalar_one_or_none()
        assert field_value is None  # Should not be set due to validation failure

    @pytest.mark.asyncio
    async def test_import_boolean_parsing(
        self, client: AsyncClient, test_db: AsyncSession, test_user: User
    ):
        """Test CSV import parses boolean values ('true'/'false'/'1'/'0')."""
        list_obj = BookmarkList(user_id=test_user.id, name="Test List")
        test_db.add(list_obj)
        await test_db.flush()

        bool_field = CustomField(
            list_id=list_obj.id,
            name="Watched",
            field_type="boolean",
            config={}
        )
        test_db.add(bool_field)
        await test_db.commit()

        # Test various boolean formats
        csv_content = """url,field_Watched
https://youtube.com/watch?v=boolVideo01,true
https://youtube.com/watch?v=boolVideo02,1
https://youtube.com/watch?v=boolVideo03,false
https://youtube.com/watch?v=boolVideo04,0"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201
        assert response.json()['created_count'] == 4

        # Verify values were parsed correctly
        stmt = select(VideoFieldValue).where(VideoFieldValue.field_id == bool_field.id)
        result = await test_db.execute(stmt)
        field_values = result.scalars().all()

        # Should have 4 field values (true, true, false, false)
        assert len(field_values) == 4
        bool_values = [fv.value_boolean for fv in field_values]
        assert bool_values.count(True) == 2  # boolVideo01 and boolVideo02
        assert bool_values.count(False) == 2  # boolVideo03 and boolVideo04

    @pytest.mark.asyncio
    async def test_import_empty_field_values_skipped(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV import skips empty field values (doesn't create VideoFieldValue)."""
        list_obj = test_list_with_fields['list']

        # CSV with empty field value
        csv_content = """url,field_Overall Rating
https://youtube.com/watch?v=emptyFieldV,"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201

        # Get the video that was just created
        stmt = select(Video).where(Video.list_id == list_obj.id, Video.youtube_id == "emptyFieldV")
        result = await test_db.execute(stmt)
        video = result.scalar_one()

        # Verify no VideoFieldValue created for this video
        stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == video.id,
            VideoFieldValue.field_id == test_list_with_fields['rating_field'].id
        )
        result = await test_db.execute(stmt)
        field_values = result.scalars().all()
        assert len(field_values) == 0

    @pytest.mark.asyncio
    async def test_import_select_validation(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV import validates select field values against options."""
        list_obj = test_list_with_fields['list']
        select_field = test_list_with_fields['select_field']

        # CSV with valid select option
        csv_content = """url,field_Presentation
https://youtube.com/watch?v=selectValid,great"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201
        assert response.json()['created_count'] == 1

        # Get the video that was just created
        stmt = select(Video).where(Video.list_id == list_obj.id, Video.youtube_id == "selectValid")
        result = await test_db.execute(stmt)
        video = result.scalar_one()

        # Verify field value was set
        stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == video.id,
            VideoFieldValue.field_id == select_field.id
        )
        result = await test_db.execute(stmt)
        field_value = result.scalar_one()
        assert field_value.value_text == "great"

    @pytest.mark.asyncio
    async def test_import_select_invalid_option(
        self, client: AsyncClient, test_db: AsyncSession, test_list_with_fields
    ):
        """Test CSV import handles invalid select option values."""
        list_obj = test_list_with_fields['list']

        # CSV with invalid select option
        csv_content = """url,field_Presentation
https://youtube.com/watch?v=selectInval,invalid_option"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        # Video created, but field value validation fails
        assert response.status_code == 201
        data = response.json()
        assert data['created_count'] == 1

        # Verify video exists
        stmt = select(Video).where(Video.list_id == list_obj.id, Video.youtube_id == "selectInval")
        result = await test_db.execute(stmt)
        video = result.scalar_one()

        # Verify field value was NOT set due to validation error
        select_field = test_list_with_fields['select_field']
        check_stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == video.id,
            VideoFieldValue.field_id == select_field.id
        )
        result = await test_db.execute(check_stmt)
        field_value = result.scalar_one_or_none()
        assert field_value is None

    @pytest.mark.asyncio
    async def test_import_text_field(
        self, client: AsyncClient, test_db: AsyncSession, test_user: User
    ):
        """Test CSV import handles text field values."""
        list_obj = BookmarkList(user_id=test_user.id, name="Test List")
        test_db.add(list_obj)
        await test_db.flush()

        text_field = CustomField(
            list_id=list_obj.id,
            name="Notes",
            field_type="text",
            config={"max_length": 100}
        )
        test_db.add(text_field)
        await test_db.commit()

        # CSV with text value
        csv_content = """url,field_Notes
https://youtube.com/watch?v=textFieldVi,This is a test note"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201
        assert response.json()['created_count'] == 1

        # Get the video that was just created
        stmt = select(Video).where(Video.list_id == list_obj.id, Video.youtube_id == "textFieldVi")
        result = await test_db.execute(stmt)
        video = result.scalar_one()

        # Verify field value was set
        stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == video.id,
            VideoFieldValue.field_id == text_field.id
        )
        result = await test_db.execute(stmt)
        field_value = result.scalar_one()
        assert field_value.value_text == "This is a test note"

    @pytest.mark.asyncio
    async def test_import_multiple_field_types(
        self, client: AsyncClient, test_db: AsyncSession, test_user: User
    ):
        """Test CSV import handles multiple field types in one row."""
        list_obj = BookmarkList(user_id=test_user.id, name="Test List")
        test_db.add(list_obj)
        await test_db.flush()

        rating_field = CustomField(
            list_id=list_obj.id,
            name="Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        select_field = CustomField(
            list_id=list_obj.id,
            name="Quality",
            field_type="select",
            config={"options": ["low", "medium", "high"]}
        )
        bool_field = CustomField(
            list_id=list_obj.id,
            name="Recommended",
            field_type="boolean",
            config={}
        )
        test_db.add_all([rating_field, select_field, bool_field])
        await test_db.commit()

        # CSV with multiple field types
        csv_content = """url,field_Rating,field_Quality,field_Recommended
https://youtube.com/watch?v=multiFieldV,5,high,true"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{list_obj.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201
        assert response.json()['created_count'] == 1

        # Get the video that was just created
        stmt = select(Video).where(Video.list_id == list_obj.id, Video.youtube_id == "multiFieldV")
        result = await test_db.execute(stmt)
        video = result.scalar_one()

        # Verify all field values were set for this video
        stmt = select(VideoFieldValue).where(VideoFieldValue.video_id == video.id)
        result = await test_db.execute(stmt)
        field_values = result.scalars().all()
        assert len(field_values) == 3
