from typing import Optional, TYPE_CHECKING
from uuid import UUID as PyUUID

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .schema_field import SchemaField


class FieldSchema(BaseModel):
    """
    Represents a field schema that groups custom fields together.

    A field schema defines which custom fields should be used for rating/evaluating
    videos, and can be associated with tags to automatically apply those fields.

    NOTE: This is a placeholder for Task #60. Full implementation coming soon.
    """
    __tablename__ = "field_schemas"

    list_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships (placeholder)
    list: Mapped["BookmarkList"] = relationship("BookmarkList")
    schema_fields: Mapped[list["SchemaField"]] = relationship(
        "SchemaField",
        back_populates="schema",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<FieldSchema(id={self.id}, name={self.name!r})>"
