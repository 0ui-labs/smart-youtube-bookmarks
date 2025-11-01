from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Table, Column, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from .base import BaseModel

# Junction table for many-to-many relationship
video_tags = Table(
    'video_tags',
    BaseModel.metadata,
    Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column('video_id', UUID(as_uuid=True), ForeignKey('videos.id', ondelete='CASCADE')),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id', ondelete='CASCADE')),
    Column('created_at', DateTime(timezone=True), server_default=func.now()),
    # Unique constraint to prevent duplicate video-tag assignments
    UniqueConstraint('video_id', 'tag_id', name='uq_video_tags_video_tag')
)


class Tag(BaseModel):
    """
    Represents a tag that can be assigned to videos.

    Tags enable flexible organization and filtering of videos beyond
    the list-based structure. Each user can create their own tags
    with optional color coding.
    """
    __tablename__ = 'tags'

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # Hex color
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="tags")
    videos: Mapped[list["Video"]] = relationship(
        "Video",
        secondary=video_tags,
        back_populates="tags"
    )

    def __repr__(self) -> str:
        return f"<Tag(id={self.id}, name={self.name!r})>"
