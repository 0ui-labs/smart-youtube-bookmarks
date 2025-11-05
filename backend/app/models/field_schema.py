from typing import Optional, TYPE_CHECKING
from uuid import UUID as PyUUID

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel

if TYPE_CHECKING:
    from .list import BookmarkList
    from .schema_field import SchemaField
    from .tag import Tag


class FieldSchema(BaseModel):
    """
    Represents a reusable schema that groups custom fields together.

    A field schema defines a template of evaluation criteria (custom fields)
    that can be applied to videos by binding the schema to tags. Schemas
    enable users to create standardized rating systems that can be reused
    across multiple tags.

    Examples:
        >>> # Create a video quality schema
        >>> schema = FieldSchema(
        ...     list_id=list_uuid,
        ...     name="Video Quality",
        ...     description="Standard quality metrics for all videos"
        ... )
        >>> # Add fields to the schema via SchemaField join table
        >>> # (handled in Task #61 - SchemaField model)

        >>> # Bind schema to a tag
        >>> tag = Tag(name="Tutorials", schema_id=schema.id)
        >>> # All videos with this tag will show the schema's fields

    Relationships:
        - One FieldSchema can be used by many Tags (one-to-many)
        - One FieldSchema contains many CustomFields (many-to-many via SchemaField)
        - FieldSchema belongs to one BookmarkList (many-to-one)

    Database Constraints:
        - Foreign Key: list_id → bookmarks_lists.id (ON DELETE CASCADE)
        - Index: list_id (for efficient lookups by list)
        - No UNIQUE constraint on name (schemas can have duplicate names)

    Cascade Behavior:
        - ON DELETE CASCADE from bookmarks_lists (schema deleted when list deleted)
        - ON DELETE CASCADE to schema_fields join table (join entries removed)
        - ON DELETE SET NULL from tags (tags.schema_id set to NULL, tag survives)
        - Uses passive_deletes=True for performance (trusts DB CASCADE)

    Schema Binding to Tags:
        When a tag has a schema (tag.schema_id is not NULL), all videos with
        that tag inherit the schema's custom fields. If a video has multiple
        tags with different schemas, the fields are unioned (see Multi-Tag
        Field Union Logic in design doc).

    Note:
        Tags with schema_id=NULL are valid and common - not all tags need
        custom fields. The relationship is optional to maintain flexibility.
    """
    __tablename__ = "field_schemas"

    # Columns
    list_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True  # Performance: frequent lookups by list_id
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable schema name (e.g., 'Video Quality', 'Tutorial Metrics')"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Optional explanation of what this schema evaluates"
    )

    # Relationships
    list: Mapped["BookmarkList"] = relationship(
        "BookmarkList",
        back_populates="field_schemas"
    )

    schema_fields: Mapped[list["SchemaField"]] = relationship(
        "SchemaField",
        back_populates="schema",
        cascade="all, delete-orphan",  # Deleting schema removes from join table
        passive_deletes=True  # Trust DB CASCADE for performance (REF MCP 2025-11-05)
    )

    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        back_populates="schema",
        # No cascade! Tags exist independently of schemas (schema is optional)
        # When FieldSchema deleted: Tag.schema_id → NULL (ON DELETE SET NULL)
        # No passive_deletes - ON DELETE SET NULL requires ORM to track affected tags
        # for in-memory state consistency (default passive_deletes=False is correct)
    )

    def __repr__(self) -> str:
        return f"<FieldSchema(id={self.id}, name={self.name!r}, list_id={self.list_id})>"
