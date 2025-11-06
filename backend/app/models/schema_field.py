from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, Boolean, text, PrimaryKeyConstraint
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

    Enables schemas to contain multiple fields with display ordering and visibility control.
    Uses composite primary key (schema_id, field_id) without separate id column.
    """
    __tablename__ = "schema_fields"

    # Composite primary key constraint (must match migration name)
    __table_args__ = (
        PrimaryKeyConstraint('schema_id', 'field_id', name='pk_schema_fields'),
    )

    # Foreign Keys (both are part of composite PK)
    schema_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_schemas.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False
        # Note: idx_schema_fields_schema_id exists in migration for FK lookups
    )
    field_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_fields.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False
        # Note: idx_schema_fields_field_id exists in migration for FK lookups
    )

    # Metadata fields
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text('0')  # SQL expression for CREATE TABLE (prevents type coercion issues)
    )
    show_on_card: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text('false')  # SQL expression for CREATE TABLE (prevents type coercion issues)
    )

    # Relationships
    schema: Mapped["FieldSchema"] = relationship(
        "FieldSchema",
        back_populates="schema_fields"
    )
    field: Mapped["CustomField"] = relationship(
        "CustomField",
        back_populates="schema_fields"
    )

    def __repr__(self) -> str:
        return f"<SchemaField(schema_id={self.schema_id}, field_id={self.field_id}, order={self.display_order})>"
