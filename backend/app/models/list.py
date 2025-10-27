from typing import Optional
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
    schema_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("schemas.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    schema: Mapped[Optional["Schema"]] = relationship("Schema", lazy="joined")
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

    def __repr__(self) -> str:
        return f"<BookmarkList(id={self.id}, name={self.name!r})>"
