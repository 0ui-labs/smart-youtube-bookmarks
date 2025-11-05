from typing import Optional, Dict, Any
from uuid import UUID as PyUUID

from sqlalchemy import String, Text, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .base import BaseModel


class CustomField(BaseModel):
    """
    Represents a reusable custom field definition for video rating/evaluation.

    Custom fields allow users to define evaluation criteria that can be applied
    to videos through field schemas. Fields are list-scoped and globally reusable
    within that list.

    Field Types:
        - 'select': Dropdown with predefined options
          Example config: {"options": ["bad", "good", "great"]}

        - 'rating': Numeric rating scale (e.g., 1-5 stars)
          Example config: {"max_rating": 5}

        - 'text': Free-form text input
          Example config: {"max_length": 500}  # optional

        - 'boolean': Yes/No checkbox
          Example config: {}  # no config needed

    Examples:
        >>> # Create a rating field
        >>> field = CustomField(
        ...     list_id=list_uuid,
        ...     name="Overall Quality",
        ...     field_type="rating",
        ...     config={"max_rating": 5}
        ... )

        >>> # Create a select field
        >>> field = CustomField(
        ...     list_id=list_uuid,
        ...     name="Presentation Style",
        ...     field_type="select",
        ...     config={"options": ["bad", "confusing", "great"]}
        ... )

    Database Constraints:
        - Unique: (list_id, name) - Field names must be unique per list
        - Check: field_type IN ('select', 'rating', 'text', 'boolean')

    Cascade Behavior:
        - ON DELETE CASCADE from bookmarks_lists (field deleted when list deleted)
        - ON DELETE CASCADE to video_field_values (values deleted when field deleted)
        - Uses passive_deletes=True for performance (trusts DB CASCADE)
    """
    __tablename__ = "custom_fields"

    # Columns
    list_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True  # Performance: frequent lookups by list_id
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="One of: 'select', 'rating', 'text', 'boolean'"
    )
    config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict  # Python-side default for ORM objects
        # Note: server_default='{}' already set in migration
    )

    # Relationships
    list: Mapped["BookmarkList"] = relationship(
        "BookmarkList",
        back_populates="custom_fields"
    )

    schema_fields: Mapped[list["SchemaField"]] = relationship(
        "SchemaField",
        back_populates="field",
        cascade="all, delete-orphan",  # Deleting field removes from all schemas
        passive_deletes=True  # Trust DB CASCADE (REF MCP 2025-11-05: also optimal for join tables)
    )

    video_field_values: Mapped[list["VideoFieldValue"]] = relationship(
        "VideoFieldValue",
        back_populates="field",
        cascade="all, delete",  # Deleting field deletes all video values
        passive_deletes=True  # Trust DB CASCADE for performance (REF MCP)
    )

    def __repr__(self) -> str:
        return f"<CustomField(id={self.id}, name={self.name!r}, type={self.field_type!r})>"
