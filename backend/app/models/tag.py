from typing import Optional, TYPE_CHECKING
from uuid import UUID as PyUUID
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Table, Column, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from .base import BaseModel

if TYPE_CHECKING:
    from .user import User
    from .video import Video
    from .field_schema import FieldSchema

# Junction table for many-to-many relationship
video_tags = Table(
    'video_tags',
    BaseModel.metadata,
    Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column('video_id', UUID(as_uuid=True), ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id', ondelete='CASCADE'), nullable=False),
    Column('created_at', DateTime(timezone=True), server_default=func.now()),
    # Unique constraint to prevent duplicate video-tag assignments
    UniqueConstraint('video_id', 'tag_id', name='uq_video_tags_video_tag')
)


class Tag(BaseModel):
    """
    Represents a tag that can be assigned to videos.

    Tags enable flexible organization and filtering of videos beyond
    the list-based structure. Each user can create their own tags
    with optional color coding and optional custom field schemas.

    Custom Fields Integration:
        Tags can optionally be bound to a FieldSchema via schema_id.
        When a tag has a schema, all videos with that tag inherit the
        schema's custom fields for evaluation (e.g., rating, quality metrics).

    Examples:
        >>> # Tag without schema (simple organization)
        >>> tag = Tag(name="Favorites", color="#FF0000", user_id=user_uuid)

        >>> # Tag with schema (enables custom fields)
        >>> tag = Tag(
        ...     name="Tutorials",
        ...     color="#0000FF",
        ...     user_id=user_uuid,
        ...     schema_id=video_quality_schema_uuid
        ... )
        >>> # All videos tagged "Tutorials" will have the schema's fields
    """
    __tablename__ = 'tags'

    # Core Columns
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(
        String(7),
        nullable=True,
        comment="Hex color code (e.g., '#FF0000')"
    )
    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False
    )

    # Custom Fields Integration
    schema_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_schemas.id", ondelete="SET NULL"),
        nullable=True,
        index=True,  # Performance: lookups for "tags using this schema"
        comment="Optional schema binding for custom field evaluation"
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="tags")
    videos: Mapped[list["Video"]] = relationship(
        "Video",
        secondary=video_tags,
        back_populates="tags"
    )
    schema: Mapped[Optional["FieldSchema"]] = relationship(
        "FieldSchema",
        back_populates="tags"
        # No cascade - schema is optional, deleting tag doesn't affect schema
        # No passive_deletes - ON DELETE SET NULL handled by default behavior
    )

    def __repr__(self) -> str:
        return f"<Tag(id={self.id}, name={self.name!r}, schema_id={self.schema_id})>"
