from typing import TYPE_CHECKING, Optional
from uuid import UUID as PyUUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .field_schema import FieldSchema
    from .job import ProcessingJob
    from .schema import Schema
    from .user import User
    from .video import Video


class BookmarkList(BaseModel):
    """
    Represents a collection of bookmarked YouTube videos.

    A bookmark list can optionally be associated with a schema to define
    what data should be extracted from the videos it contains.
    """

    __tablename__ = "bookmarks_lists"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    schema_id: Mapped[PyUUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schemas.id", ondelete="SET NULL"), nullable=True
    )

    # Workspace-wide default schema (fields for ALL videos in this list)
    default_schema_id: Mapped[PyUUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "field_schemas.id",
            ondelete="SET NULL",
            use_alter=True,  # Break circular dependency: bookmarks_lists ↔ field_schemas
            name="fk_bookmarks_lists_default_schema",  # Required when use_alter=True
        ),
        nullable=True,
        index=True,
        comment="Workspace-wide schema (fields for all videos)",
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="lists")
    schema: Mapped[Optional["Schema"]] = relationship(
        "Schema", back_populates="lists", lazy="joined"
    )
    videos: Mapped[list["Video"]] = relationship(
        "Video", back_populates="list", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["ProcessingJob"]] = relationship(
        "ProcessingJob", back_populates="list", cascade="all, delete-orphan"
    )
    custom_fields: Mapped[list["CustomField"]] = relationship(
        "CustomField",
        back_populates="list",
        cascade="all, delete-orphan",  # Deleting list deletes all custom fields
        passive_deletes=True,  # Trust DB CASCADE (REF MCP)
    )
    field_schemas: Mapped[list["FieldSchema"]] = relationship(
        "FieldSchema",
        back_populates="list",
        cascade="all, delete-orphan",  # Deleting list removes all schemas
        passive_deletes=True,  # Trust DB CASCADE for performance
        foreign_keys="[FieldSchema.list_id]",  # Explicit FK for disambiguation
    )
    default_schema: Mapped[Optional["FieldSchema"]] = relationship(
        "FieldSchema",
        foreign_keys=[default_schema_id],
        lazy="raise",  # Prevent MissingGreenlet - force explicit selectinload
    )

    def __repr__(self) -> str:
        return f"<BookmarkList(id={self.id}, name={self.name!r})>"
