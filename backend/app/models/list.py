from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from .base import BaseModel


class BookmarkList(BaseModel):
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
