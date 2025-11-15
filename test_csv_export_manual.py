"""
Manual test to verify CSV export with custom field values.
This test creates a list with custom fields, adds videos with field values,
and exports to CSV to verify the implementation.

Run with: python test_csv_export_manual.py
"""
import asyncio
import csv
import io
from uuid import UUID
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Import app models and config
import sys
sys.path.insert(0, '/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend')

from app.core.config import settings
from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue


async def test_csv_export_with_fields():
    """Test CSV export includes custom field columns with correct values."""

    # Create async engine
    engine = create_async_engine(settings.database_url, echo=False)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_factory() as db:
        # Step 1: Create test list
        test_list = BookmarkList(
            user_id=UUID('00000000-0000-0000-0000-000000000001'),
            name="CSV Export Test List"
        )
        db.add(test_list)
        await db.flush()
        list_id = test_list.id

        # Step 2: Create custom fields
        rating_field = CustomField(
            list_id=list_id,
            name="Overall Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        select_field = CustomField(
            list_id=list_id,
            name="Presentation",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        boolean_field = CustomField(
            list_id=list_id,
            name="Watched",
            field_type="boolean",
            config={}
        )
        text_field = CustomField(
            list_id=list_id,
            name="Notes",
            field_type="text",
            config={}
        )

        db.add_all([rating_field, select_field, boolean_field, text_field])
        await db.flush()

        # Step 3: Create videos with field values
        video1 = Video(
            list_id=list_id,
            youtube_id="dQw4w9WgXcQ",
            title="Test Video 1",
            processing_status="completed"
        )
        video2 = Video(
            list_id=list_id,
            youtube_id="jNQXAC9IVRw",
            title="Test Video 2",
            processing_status="completed"
        )
        video3 = Video(
            list_id=list_id,
            youtube_id="VIDEO_ID_3",
            title="Test Video 3 (no field values)",
            processing_status="completed"
        )

        db.add_all([video1, video2, video3])
        await db.flush()

        # Step 4: Add field values for video1
        fv1_rating = VideoFieldValue(
            video_id=video1.id,
            field_id=rating_field.id,
            value_numeric=5
        )
        fv1_select = VideoFieldValue(
            video_id=video1.id,
            field_id=select_field.id,
            value_text="great"
        )
        fv1_boolean = VideoFieldValue(
            video_id=video1.id,
            field_id=boolean_field.id,
            value_boolean=True
        )
        fv1_text = VideoFieldValue(
            video_id=video1.id,
            field_id=text_field.id,
            value_text="Excellent content"
        )

        # Step 5: Add partial field values for video2
        fv2_rating = VideoFieldValue(
            video_id=video2.id,
            field_id=rating_field.id,
            value_numeric=3
        )
        fv2_select = VideoFieldValue(
            video_id=video2.id,
            field_id=select_field.id,
            value_text="good"
        )

        db.add_all([fv1_rating, fv1_select, fv1_boolean, fv1_text, fv2_rating, fv2_select])
        await db.commit()

        print(f"✓ Created test list: {list_id}")
        print(f"✓ Created 4 custom fields: Overall Rating, Presentation, Watched, Notes")
        print(f"✓ Created 3 videos (2 with field values, 1 without)")

    # Step 6: Make HTTP request to export endpoint
    async with AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.get(f"/api/lists/{list_id}/export/csv")

        if response.status_code != 200:
            print(f"✗ Export failed with status {response.status_code}")
            print(f"  Response: {response.text}")
            return False

        print(f"✓ CSV export successful (status 200)")

        # Step 7: Parse and validate CSV
        csv_content = response.text
        print("\n=== CSV Content ===")
        print(csv_content)
        print("===================\n")

        lines = csv_content.strip().splitlines()

        # Check for metadata comment
        if lines[0].startswith("#"):
            print(f"✓ Metadata comment line present: {lines[0]}")
            header_line_idx = 1
        else:
            print("! No metadata comment line (acceptable)")
            header_line_idx = 0

        # Parse CSV
        csv_file = io.StringIO(csv_content)
        reader = csv.DictReader(csv_file)

        # Validate header
        expected_columns = [
            'youtube_id', 'status', 'created_at',
            'field_Notes',  # Alphabetically first
            'field_Overall Rating',
            'field_Presentation',
            'field_Watched'
        ]

        print(f"✓ Header columns: {reader.fieldnames}")

        # Check field columns present
        field_columns = [col for col in reader.fieldnames if col.startswith('field_')]
        if len(field_columns) == 4:
            print(f"✓ All 4 field columns present: {field_columns}")
        else:
            print(f"✗ Expected 4 field columns, got {len(field_columns)}: {field_columns}")
            return False

        # Check alphabetical order
        if field_columns == sorted(field_columns):
            print(f"✓ Field columns alphabetically sorted")
        else:
            print(f"✗ Field columns not sorted: {field_columns} vs {sorted(field_columns)}")

        # Validate rows
        rows = list(reader)
        if len(rows) != 3:
            print(f"✗ Expected 3 rows, got {len(rows)}")
            return False

        print(f"✓ Got 3 video rows")

        # Validate video1 values
        video1_row = next(r for r in rows if r['youtube_id'] == 'dQw4w9WgXcQ')
        checks = [
            (video1_row['field_Overall Rating'] == '5', "Video1 rating = 5"),
            (video1_row['field_Presentation'] == 'great', "Video1 presentation = 'great'"),
            (video1_row['field_Watched'] == 'true', "Video1 watched = 'true'"),
            (video1_row['field_Notes'] == 'Excellent content', "Video1 notes = 'Excellent content'"),
        ]

        # Validate video2 values (partial)
        video2_row = next(r for r in rows if r['youtube_id'] == 'jNQXAC9IVRw')
        checks.extend([
            (video2_row['field_Overall Rating'] == '3', "Video2 rating = 3"),
            (video2_row['field_Presentation'] == 'good', "Video2 presentation = 'good'"),
            (video2_row['field_Watched'] == '', "Video2 watched = '' (empty)"),
            (video2_row['field_Notes'] == '', "Video2 notes = '' (empty)"),
        ])

        # Validate video3 values (all empty)
        video3_row = next(r for r in rows if r['youtube_id'] == 'VIDEO_ID_3')
        checks.extend([
            (video3_row['field_Overall Rating'] == '', "Video3 rating = '' (empty)"),
            (video3_row['field_Presentation'] == '', "Video3 presentation = '' (empty)"),
            (video3_row['field_Watched'] == '', "Video3 watched = '' (empty)"),
            (video3_row['field_Notes'] == '', "Video3 notes = '' (empty)"),
        ])

        # Run all checks
        all_passed = True
        for passed, description in checks:
            if passed:
                print(f"✓ {description}")
            else:
                print(f"✗ {description}")
                all_passed = False

        if all_passed:
            print("\n✓✓✓ All validation checks passed! ✓✓✓")
            return True
        else:
            print("\n✗✗✗ Some validation checks failed ✗✗✗")
            return False

    # Cleanup
    async with async_session_factory() as db:
        await db.execute(
            select(BookmarkList).where(BookmarkList.id == list_id)
        )
        await db.commit()


if __name__ == "__main__":
    result = asyncio.run(test_csv_export_with_fields())
    sys.exit(0 if result else 1)
