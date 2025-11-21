"""
Unit tests for field value backup service.

TDD RED Phase: These tests are written BEFORE the implementation.
They should fail until the backup service is implemented.
"""
import pytest
import json
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.field_value_backup import (
    backup_field_values,
    restore_field_values,
    list_backups,
    BackupInfo,
    BACKUP_DIR,
)


class TestBackupFieldValues:
    """Tests for backup_field_values function."""

    @pytest.fixture
    def tmp_backup_dir(self, tmp_path):
        """Temporarily override BACKUP_DIR to use tmp_path."""
        backup_dir = tmp_path / "backups" / "field_values"
        backup_dir.mkdir(parents=True)
        return backup_dir

    @pytest.fixture
    def mock_db(self):
        """Mock async database session."""
        return AsyncMock()

    @pytest.fixture
    def mock_video_id(self):
        return uuid4()

    @pytest.fixture
    def mock_category_id(self):
        return uuid4()

    @pytest.fixture
    def mock_category(self, mock_category_id):
        """Mock Tag (category) with schema and fields."""
        category = MagicMock()
        category.id = mock_category_id
        category.name = "Test Category"
        category.is_video_type = True

        # Mock schema with fields
        field1_id = uuid4()
        field2_id = uuid4()

        schema_field1 = MagicMock()
        schema_field1.field_id = field1_id
        schema_field1.field = MagicMock()
        schema_field1.field.id = field1_id
        schema_field1.field.name = "Rating"
        schema_field1.field.field_type = "rating"

        schema_field2 = MagicMock()
        schema_field2.field_id = field2_id
        schema_field2.field = MagicMock()
        schema_field2.field.id = field2_id
        schema_field2.field.name = "Notes"
        schema_field2.field.field_type = "text"

        category.schema = MagicMock()
        category.schema.id = uuid4()
        category.schema.schema_fields = [schema_field1, schema_field2]

        return category, [field1_id, field2_id]

    @pytest.fixture
    def mock_field_values(self, mock_video_id, mock_category):
        """Mock VideoFieldValue objects."""
        _, field_ids = mock_category

        value1 = MagicMock()
        value1.id = uuid4()
        value1.video_id = mock_video_id
        value1.field_id = field_ids[0]
        value1.value_numeric = 4.5
        value1.value_text = None
        value1.value_boolean = None
        value1.field = MagicMock()
        value1.field.name = "Rating"
        value1.field.field_type = "rating"

        value2 = MagicMock()
        value2.id = uuid4()
        value2.video_id = mock_video_id
        value2.field_id = field_ids[1]
        value2.value_numeric = None
        value2.value_text = "Great tutorial!"
        value2.value_boolean = None
        value2.field = MagicMock()
        value2.field.name = "Notes"
        value2.field.field_type = "text"

        return [value1, value2]

    @pytest.mark.asyncio
    async def test_backup_creates_file(
        self, tmp_backup_dir, mock_db, mock_video_id, mock_category, mock_field_values
    ):
        """
        Test that backup_field_values creates a JSON file with correct structure.

        Given: A video with field values for a category
        When: backup_field_values is called
        Then: A JSON backup file is created with video_id, category_id, timestamp, and values
        """
        category, _ = mock_category

        # Mock db.get to return category
        mock_db.get = AsyncMock(return_value=category)

        # Mock db.execute to return field values
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_field_values
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.services.field_value_backup.BACKUP_DIR", tmp_backup_dir
        ):
            backup_path = await backup_field_values(
                video_id=mock_video_id,
                category_id=category.id,
                db=mock_db,
            )

        # Assert file was created
        assert backup_path is not None
        assert backup_path.exists()
        assert backup_path.suffix == ".json"

        # Assert file content structure
        content = json.loads(backup_path.read_text())
        assert "video_id" in content
        assert "category_id" in content
        assert "category_name" in content
        assert "timestamp" in content
        assert "values" in content
        assert content["video_id"] == str(mock_video_id)
        assert content["category_id"] == str(category.id)
        assert content["category_name"] == "Test Category"
        assert len(content["values"]) == 2

    @pytest.mark.asyncio
    async def test_backup_handles_empty_values(
        self, tmp_backup_dir, mock_db, mock_video_id, mock_category
    ):
        """
        Test that backup returns None when there are no field values.

        Given: A video with no field values for a category
        When: backup_field_values is called
        Then: Returns None (no backup created)
        """
        category, _ = mock_category

        # Mock db.get to return category
        mock_db.get = AsyncMock(return_value=category)

        # Mock db.execute to return empty list
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.services.field_value_backup.BACKUP_DIR", tmp_backup_dir
        ):
            backup_path = await backup_field_values(
                video_id=mock_video_id,
                category_id=category.id,
                db=mock_db,
            )

        # Assert no backup was created
        assert backup_path is None


class TestRestoreFieldValues:
    """Tests for restore_field_values function."""

    @pytest.fixture
    def tmp_backup_dir(self, tmp_path):
        """Temporarily override BACKUP_DIR to use tmp_path."""
        backup_dir = tmp_path / "backups" / "field_values"
        backup_dir.mkdir(parents=True)
        return backup_dir

    @pytest.fixture
    def mock_db(self):
        """Mock async database session."""
        db = AsyncMock()
        db.add = MagicMock()
        db.commit = AsyncMock()
        return db

    @pytest.fixture
    def sample_backup_file(self, tmp_backup_dir):
        """Create a sample backup file for testing restore."""
        video_id = uuid4()
        category_id = uuid4()
        field1_id = uuid4()
        field2_id = uuid4()

        backup_data = {
            "video_id": str(video_id),
            "category_id": str(category_id),
            "category_name": "Test Category",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "values": [
                {
                    "field_id": str(field1_id),
                    "field_name": "Rating",
                    "field_type": "rating",
                    "value_numeric": 4.5,
                    "value_text": None,
                    "value_boolean": None,
                },
                {
                    "field_id": str(field2_id),
                    "field_name": "Notes",
                    "field_type": "text",
                    "value_numeric": None,
                    "value_text": "Great tutorial!",
                    "value_boolean": None,
                },
            ],
        }

        # Create backup file
        video_dir = tmp_backup_dir / str(video_id)
        video_dir.mkdir(parents=True)
        backup_path = video_dir / f"{category_id}.json"
        backup_path.write_text(json.dumps(backup_data, indent=2))

        return backup_path, video_id, category_id, backup_data

    @pytest.mark.asyncio
    async def test_restore_recreates_values(
        self, tmp_backup_dir, mock_db, sample_backup_file
    ):
        """
        Test that restore_field_values recreates VideoFieldValue objects.

        Given: A valid backup file exists
        When: restore_field_values is called
        Then: VideoFieldValue objects are created in DB and count is returned
        """
        backup_path, video_id, category_id, backup_data = sample_backup_file

        with patch(
            "app.services.field_value_backup.BACKUP_DIR", tmp_backup_dir
        ):
            restored_count = await restore_field_values(
                video_id=video_id,
                category_id=category_id,
                db=mock_db,
            )

        # Assert correct number of values restored
        assert restored_count == 2

        # Assert db.add was called for each value
        assert mock_db.add.call_count == 2

    @pytest.mark.asyncio
    async def test_restore_handles_corrupted_file(
        self, tmp_backup_dir, mock_db
    ):
        """
        Test that restore handles corrupted backup files gracefully.

        Given: A corrupted backup file (invalid JSON)
        When: restore_field_values is called
        Then: Returns 0 and logs error (no crash)
        """
        video_id = uuid4()
        category_id = uuid4()

        # Create corrupted backup file
        video_dir = tmp_backup_dir / str(video_id)
        video_dir.mkdir(parents=True)
        backup_path = video_dir / f"{category_id}.json"
        backup_path.write_text("{ invalid json content }")

        with patch(
            "app.services.field_value_backup.BACKUP_DIR", tmp_backup_dir
        ):
            restored_count = await restore_field_values(
                video_id=video_id,
                category_id=category_id,
                db=mock_db,
            )

        # Assert graceful handling (returns 0, no crash)
        assert restored_count == 0


class TestListBackups:
    """Tests for list_backups function."""

    @pytest.fixture
    def tmp_backup_dir(self, tmp_path):
        """Temporarily override BACKUP_DIR to use tmp_path."""
        backup_dir = tmp_path / "backups" / "field_values"
        backup_dir.mkdir(parents=True)
        return backup_dir

    def test_list_backups_returns_all(self, tmp_backup_dir):
        """
        Test that list_backups returns all backups for a video.

        Given: Multiple backup files exist for a video
        When: list_backups is called
        Then: Returns list of BackupInfo for all backups
        """
        video_id = uuid4()
        category1_id = uuid4()
        category2_id = uuid4()

        # Create video backup directory
        video_dir = tmp_backup_dir / str(video_id)
        video_dir.mkdir(parents=True)

        # Create two backup files
        backup1_data = {
            "video_id": str(video_id),
            "category_id": str(category1_id),
            "category_name": "Category 1",
            "timestamp": "2025-01-15T10:00:00+00:00",
            "values": [{"field_id": str(uuid4()), "value_numeric": 4.0}],
        }
        backup2_data = {
            "video_id": str(video_id),
            "category_id": str(category2_id),
            "category_name": "Category 2",
            "timestamp": "2025-01-15T11:00:00+00:00",
            "values": [{"field_id": str(uuid4()), "value_text": "test"}],
        }

        (video_dir / f"{category1_id}.json").write_text(json.dumps(backup1_data))
        (video_dir / f"{category2_id}.json").write_text(json.dumps(backup2_data))

        with patch(
            "app.services.field_value_backup.BACKUP_DIR", tmp_backup_dir
        ):
            backups = list_backups(video_id)

        # Assert both backups are returned
        assert len(backups) == 2
        assert all(isinstance(b, BackupInfo) for b in backups)

        # Assert backup info is correct
        category_ids = {b.category_id for b in backups}
        assert category1_id in category_ids
        assert category2_id in category_ids

    def test_list_backups_returns_empty_for_no_backups(self, tmp_backup_dir):
        """
        Test that list_backups returns empty list when no backups exist.

        Given: No backup directory exists for video
        When: list_backups is called
        Then: Returns empty list
        """
        video_id = uuid4()  # No backups for this video

        with patch(
            "app.services.field_value_backup.BACKUP_DIR", tmp_backup_dir
        ):
            backups = list_backups(video_id)

        assert backups == []
