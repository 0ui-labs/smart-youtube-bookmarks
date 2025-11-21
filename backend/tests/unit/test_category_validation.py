"""
Unit tests for category validation.

TDD RED Phase: These tests are written BEFORE the implementation.

Category Rule: A video can only have ONE tag with is_video_type=True (category).
Labels (is_video_type=False) can be assigned without limit.
"""
import pytest
from uuid import uuid4
from unittest.mock import MagicMock

from app.services.category_validation import (
    validate_category_assignment,
    CategoryValidationError,
)


class TestValidateCategoryAssignment:
    """Tests for validate_category_assignment function."""

    @pytest.fixture
    def mock_video_no_category(self):
        """Video with no category (only labels or no tags)."""
        video = MagicMock()
        video.id = uuid4()
        video.tags = []
        return video

    @pytest.fixture
    def mock_video_with_category(self):
        """Video with existing category."""
        existing_category = MagicMock()
        existing_category.id = uuid4()
        existing_category.name = "Existing Category"
        existing_category.is_video_type = True

        label = MagicMock()
        label.id = uuid4()
        label.name = "Some Label"
        label.is_video_type = False

        video = MagicMock()
        video.id = uuid4()
        video.tags = [existing_category, label]
        return video, existing_category

    @pytest.fixture
    def mock_category_tag(self):
        """A category tag (is_video_type=True)."""
        tag = MagicMock()
        tag.id = uuid4()
        tag.name = "New Category"
        tag.is_video_type = True
        return tag

    @pytest.fixture
    def mock_label_tag(self):
        """A label tag (is_video_type=False)."""
        tag = MagicMock()
        tag.id = uuid4()
        tag.name = "New Label"
        tag.is_video_type = False
        return tag

    def test_allows_category_when_video_has_none(
        self, mock_video_no_category, mock_category_tag
    ):
        """
        Test that assigning a category is allowed when video has no category.

        Given: Video has no tags
        When: Assigning a category tag
        Then: No error raised
        """
        # Should not raise
        validate_category_assignment(mock_video_no_category, [mock_category_tag])

    def test_allows_label_when_video_has_category(
        self, mock_video_with_category, mock_label_tag
    ):
        """
        Test that assigning labels is always allowed.

        Given: Video already has a category
        When: Assigning a label tag
        Then: No error raised
        """
        video, _ = mock_video_with_category
        # Should not raise
        validate_category_assignment(video, [mock_label_tag])

    def test_rejects_category_when_video_already_has_one(
        self, mock_video_with_category, mock_category_tag
    ):
        """
        Test that assigning a second category is rejected.

        Given: Video already has a category
        When: Assigning another category tag
        Then: CategoryValidationError raised with existing category info
        """
        video, existing_category = mock_video_with_category

        with pytest.raises(CategoryValidationError) as exc_info:
            validate_category_assignment(video, [mock_category_tag])

        error = exc_info.value
        assert error.existing_category_id == existing_category.id
        assert error.existing_category_name == "Existing Category"
        assert error.new_category_name == "New Category"

    def test_allows_same_category_reassignment(
        self, mock_video_with_category
    ):
        """
        Test that re-assigning the same category is idempotent.

        Given: Video has category "A"
        When: Assigning category "A" again
        Then: No error raised (idempotent)
        """
        video, existing_category = mock_video_with_category
        # Should not raise when re-assigning same category
        validate_category_assignment(video, [existing_category])

    def test_allows_multiple_labels(
        self, mock_video_no_category
    ):
        """
        Test that multiple labels can be assigned at once.

        Given: Video has no tags
        When: Assigning multiple label tags
        Then: No error raised
        """
        labels = []
        for i in range(5):
            label = MagicMock()
            label.id = uuid4()
            label.name = f"Label {i}"
            label.is_video_type = False
            labels.append(label)

        # Should not raise
        validate_category_assignment(mock_video_no_category, labels)

    def test_rejects_multiple_categories_in_single_request(
        self, mock_video_no_category
    ):
        """
        Test that assigning multiple categories at once is rejected.

        Given: Video has no tags
        When: Assigning two category tags in one request
        Then: Error raised (can't assign multiple categories)
        """
        category1 = MagicMock()
        category1.id = uuid4()
        category1.name = "Category 1"
        category1.is_video_type = True

        category2 = MagicMock()
        category2.id = uuid4()
        category2.name = "Category 2"
        category2.is_video_type = True

        with pytest.raises(CategoryValidationError) as exc_info:
            validate_category_assignment(mock_video_no_category, [category1, category2])

        error = exc_info.value
        assert "multiple categories" in str(error).lower() or error.new_category_name is not None
