from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional

from app.schemas.custom_field import CustomFieldResponse


class SchemaFieldCreate(BaseModel):
    """Request body for adding field to schema."""
    field_id: UUID
    display_order: Optional[int] = None  # Auto-calculated if not provided
    show_on_card: bool = False


class SchemaFieldUpdate(BaseModel):
    """Request body for updating schema field association."""
    display_order: Optional[int] = None
    show_on_card: Optional[bool] = None


class SchemaFieldResponse(BaseModel):
    """
    Response model for schema field association.

    Includes full CustomField details via nested relationship.
    """
    schema_id: UUID
    field_id: UUID
    display_order: int
    show_on_card: bool
    field: CustomFieldResponse  # Nested CustomField details

    model_config = {
        "from_attributes": True
    }
