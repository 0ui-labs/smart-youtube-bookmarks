from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, Boolean, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from uuid import UUID as PyUUID

from .base import Base  # ← Use Base, not BaseModel (REF MCP 2025-11-05)

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .field_schema import FieldSchema


class SchemaField(Base):
    """
    Join table for many-to-many relationship between FieldSchema and CustomField.

    Uses composite primary key (schema_id, field_id) without separate id column.
    This is the standard pattern for join tables and matches the migration schema.

    NOTE: This is a placeholder for Task #61. Full implementation coming soon.
    """
    __tablename__ = "schema_fields"

    # Composite primary key (defined in migration)
    schema_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_schemas.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False
    )
    field_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_fields.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text('0')  # ← Match migration (REF MCP 2025-11-05)
    )
    show_on_card: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text('false')  # ← Match migration (REF MCP 2025-11-05)
    )

    # Relationships (placeholder)
    schema: Mapped["FieldSchema"] = relationship("FieldSchema", back_populates="schema_fields")
    field: Mapped["CustomField"] = relationship("CustomField", back_populates="schema_fields")

    def __repr__(self) -> str:
        return f"<SchemaField(schema_id={self.schema_id}, field_id={self.field_id})>"
