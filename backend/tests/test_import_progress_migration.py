"""
Test for import_progress migration.

Verifies that the import_progress and import_stage columns exist in videos table.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_import_progress_columns_exist(test_db: AsyncSession):
    """Test that import_progress and import_stage columns exist in videos table."""
    # Use raw SQL to check column existence
    result = await test_db.execute(
        text("""
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'videos'
        AND column_name IN ('import_progress', 'import_stage')
        ORDER BY column_name
    """)
    )
    columns = {
        row[0]: {"data_type": row[1], "default": row[2]} for row in result.fetchall()
    }

    # Verify import_progress column
    assert "import_progress" in columns, "import_progress column should exist"
    assert columns["import_progress"]["data_type"] == "integer"

    # Verify import_stage column
    assert "import_stage" in columns, "import_stage column should exist"
    assert columns["import_stage"]["data_type"] == "character varying"


@pytest.mark.asyncio
async def test_import_progress_default_values(test_db: AsyncSession, test_list):
    """Test that new videos get default import values."""
    from app.models.video import Video

    # Create video without explicit import values
    video = Video(list_id=test_list.id, youtube_id="test123abc")
    test_db.add(video)
    await test_db.flush()

    # Verify defaults
    assert video.import_progress == 0, "Default import_progress should be 0"
    assert video.import_stage == "created", "Default import_stage should be 'created'"
