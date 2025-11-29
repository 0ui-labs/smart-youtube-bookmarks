"""Service for validating category assignments to videos."""

from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from app.models.tag import Tag
    from app.models.video import Video


class CategoryValidationError(Exception):
    """Raised when category assignment violates business rules."""

    def __init__(
        self,
        message: str,
        existing_category_id: UUID | None = None,
        existing_category_name: str | None = None,
        new_category_name: str | None = None,
    ):
        super().__init__(message)
        self.existing_category_id = existing_category_id
        self.existing_category_name = existing_category_name
        self.new_category_name = new_category_name


def validate_category_assignment(
    video: "Video",
    tags_to_assign: list["Tag"],
) -> None:
    """
    Validate that category assignment follows business rules.

    Rules:
    - A video can have at most ONE category (tag with is_video_type=True)
    - Labels (is_video_type=False) can be assigned without limit
    - Re-assigning the same category is idempotent (allowed)

    Args:
        video: The video to assign tags to (should have tags loaded)
        tags_to_assign: List of Tag objects to assign

    Raises:
        CategoryValidationError: If assignment would violate rules
    """
    # Get existing category (if any)
    existing_category = next((t for t in video.tags if t.is_video_type), None)
    existing_category_id = existing_category.id if existing_category else None

    # Get categories from tags being assigned
    new_categories = [t for t in tags_to_assign if t.is_video_type]

    # Rule 1: Can't assign multiple categories in a single request
    if len(new_categories) > 1:
        raise CategoryValidationError(
            message=f"Cannot assign multiple categories at once. "
            f"Tried to assign: {', '.join(c.name for c in new_categories)}",
            new_category_name=new_categories[0].name,
        )

    # Rule 2: If video already has category, can't assign different category
    if new_categories and existing_category:
        new_category = new_categories[0]

        # Allow re-assigning same category (idempotent)
        if new_category.id == existing_category_id:
            return

        raise CategoryValidationError(
            message=f"Video already has category '{existing_category.name}'. "
            f"Cannot assign '{new_category.name}'. "
            f"Remove existing category first or use replace endpoint.",
            existing_category_id=existing_category.id,
            existing_category_name=existing_category.name,
            new_category_name=new_category.name,
        )

    # All other cases are valid:
    # - Assigning category when video has none
    # - Assigning labels (any number)
