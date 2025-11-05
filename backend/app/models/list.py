from typing import Optional
from uuid import UUID as PyUUID
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from .base import BaseModel


class BookmarkList(BaseModel):
    """
    Represents a collection of bookmarked YouTube videos.

    A bookmark list can optionally be associated with a schema to define
    what data should be extracted from the videos it contains.
    """
    __tablename__ = "bookmarks_lists"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    schema_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemas.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="lists")
    schema: Mapped[Optional["Schema"]] = relationship("Schema", back_populates="lists", lazy="joined")
    videos: Mapped[list["Video"]] = relationship(
        "Video",
        back_populates="list",
        cascade="all, delete-orphan"
    )
    jobs: Mapped[list["ProcessingJob"]] = relationship(
        "ProcessingJob",
        back_populates="list",
        cascade="all, delete-orphan"
    )
    custom_fields: Mapped[list["CustomField"]] = relationship(
        "CustomField",
        back_populates="list",
        cascade="all, delete-orphan",  # Deleting list deletes all custom fields
        passive_deletes=True  # Trust DB CASCADE (REF MCP)
    )

    def __repr__(self) -> str:
        return f"<BookmarkList(id={self.id}, name={self.name!r})>"
