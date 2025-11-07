"""
Pydantic schemas for Field Schema API endpoints.

Field schemas define collections of custom fields that can be assigned to tags.
This enables consistent evaluation across multiple videos (e.g., all videos in
a "Tutorial" tag can be evaluated using a "Video Quality" schema).
"""

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Direct import - CustomFieldResponse already exists (REF MCP Improvement #1)
from .custom_field import CustomFieldResponse


class SchemaFieldItem(BaseModel):
    """
    Represents a field within a schema during creation.

    Used in POST /schemas to define which custom fields belong to the schema
    and their display configuration.

    Example:
        {
            "field_id": "uuid-presentation",
            "display_order": 0,
            "show_on_card": true
        }
    """
    field_id: UUID = Field(
        ...,
        description="ID of the CustomField to include in this schema"
    )
    display_order: int = Field(
        ...,
        ge=0,
        description="Display order (0-based, lower numbers appear first)"
    )
    show_on_card: bool = Field(
        default=False,
        description="Whether this field should be visible on video cards (max 3 per schema)"
    )


class FieldSchemaCreate(BaseModel):
    """
    Schema for creating a new FieldSchema.

    Validates:
    - Name is required (1-255 chars)
    - Description is optional
    - Fields array with field_id, display_order, show_on_card
    - Max 3 fields can have show_on_card=true
    - No duplicate display_order values (REF MCP Improvement #3)
    - No duplicate field_id values (REF MCP Improvement #4)

    Example Request:
        {
            "name": "Video Quality",
            "description": "Standard video quality metrics",
            "fields": [
                {
                    "field_id": "uuid-presentation",
                    "display_order": 0,
                    "show_on_card": true
                },
                {
                    "field_id": "uuid-rating",
                    "display_order": 1,
                    "show_on_card": true
                }
            ]
        }
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Human-readable schema name (e.g., 'Video Quality')"
    )
    description: Optional[str] = Field(
        None,
        description="Optional explanation of what this schema evaluates"
    )
    fields: list[SchemaFieldItem] = Field(
        default_factory=list,
        description="List of custom fields to include in this schema"
    )

    @field_validator('fields')
    @classmethod
    def validate_show_on_card_limit(cls, fields: list[SchemaFieldItem]) -> list[SchemaFieldItem]:
        """
        Validate that at most 3 fields have show_on_card=true.

        REF MCP Improvement #2: Better error messages with field_ids.

        This constraint ensures the UI doesn't become cluttered with too many
        fields displayed on video cards. Users can still define more fields,
        but only 3 will be prominently displayed.

        Raises:
            ValueError: If more than 3 fields have show_on_card=true
        """
        show_on_card_fields = [f for f in fields if f.show_on_card]
        if len(show_on_card_fields) > 3:
            # Show first 5 field_ids (truncated) to help identify which fields need fixing
            field_ids_str = ", ".join(str(f.field_id)[:8] + "..." for f in show_on_card_fields[:5])
            raise ValueError(
                f"At most 3 fields can have show_on_card=true, but {len(show_on_card_fields)} fields are marked. "
                f"Please set show_on_card=false for {len(show_on_card_fields) - 3} of these fields: {field_ids_str}"
            )
        return fields

    @field_validator('fields')
    @classmethod
    def validate_no_duplicate_display_orders(cls, fields: list[SchemaFieldItem]) -> list[SchemaFieldItem]:
        """
        Validate that all display_order values are unique.

        REF MCP Improvement #3: Validate no duplicate display_order.

        Each field must have a unique display_order to ensure consistent
        rendering order in the UI. Duplicate orders create ambiguity about
        which field should appear first.

        Raises:
            ValueError: If duplicate display_order values are found
        """
        display_orders = [f.display_order for f in fields]
        if len(display_orders) != len(set(display_orders)):
            # Find which orders are duplicated
            duplicates = [order for order in display_orders if display_orders.count(order) > 1]
            raise ValueError(
                f"Duplicate display_order values found: {set(duplicates)}. "
                f"Each field must have a unique display_order."
            )
        return fields

    @field_validator('fields')
    @classmethod
    def validate_no_duplicate_field_ids(cls, fields: list[SchemaFieldItem]) -> list[SchemaFieldItem]:
        """
        Validate that all field_id values are unique.

        REF MCP Improvement #4: Validate no duplicate field_ids.

        Each field can only be added once to a schema. Duplicate field_ids
        would create confusion and violate the database unique constraint on
        (schema_id, field_id).

        Raises:
            ValueError: If duplicate field_id values are found
        """
        field_ids = [f.field_id for f in fields]
        if len(field_ids) != len(set(field_ids)):
            # Find which field_ids are duplicated
            duplicates = [fid for fid in field_ids if field_ids.count(fid) > 1]
            # Show truncated UUIDs for readability
            duplicates_str = ", ".join(str(fid)[:8] + "..." for fid in set(duplicates))
            raise ValueError(
                f"Duplicate field_id values found: {duplicates_str}. "
                f"Each field can only be added once to a schema."
            )
        return fields


class FieldSchemaUpdate(BaseModel):
    """
    Schema for updating an existing FieldSchema.

    Only allows updating name and description. Field associations are managed
    through separate endpoints (POST/PUT/DELETE /schemas/{id}/fields/{field_id}).

    All fields are optional to support partial updates.

    Example Request:
        {
            "name": "Updated Video Quality",
            "description": "Updated description"
        }
    """
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Updated schema name"
    )
    description: Optional[str] = Field(
        None,
        description="Updated schema description"
    )


class SchemaFieldResponse(BaseModel):
    """
    Represents a field within a schema in API responses.

    Includes full CustomField data to avoid N+1 queries. This enables the
    frontend to display all field details without making additional API calls.

    Example:
        {
            "field_id": "uuid",
            "field": {
                "id": "uuid",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {"options": ["bad", "good", "great"]},
                "created_at": "2025-11-05T10:00:00Z",
                "updated_at": "2025-11-05T10:00:00Z"
            },
            "display_order": 0,
            "show_on_card": true
        }
    """
    model_config = ConfigDict(from_attributes=True)

    field_id: UUID = Field(
        ...,
        description="ID of the CustomField"
    )
    field: CustomFieldResponse = Field(
        ...,
        description="Full CustomField definition with name, type, config"
    )
    display_order: int = Field(
        ...,
        description="Display order (0-based)"
    )
    show_on_card: bool = Field(
        ...,
        description="Whether this field is shown on video cards"
    )


class FieldSchemaResponse(BaseModel):
    """
    Schema for FieldSchema API responses.

    Includes full nested field data via SchemaFieldResponse. This rich response
    format eliminates the need for the frontend to make separate API calls to
    fetch CustomField details.

    The schema_fields list is ordered by display_order (handled by SQLAlchemy
    relationship ordering in the model).

    Example Response:
        {
            "id": "uuid",
            "list_id": "uuid",
            "name": "Video Quality",
            "description": "Standard quality metrics",
            "schema_fields": [
                {
                    "field_id": "uuid-1",
                    "field": {...CustomField...},
                    "display_order": 0,
                    "show_on_card": true
                },
                {
                    "field_id": "uuid-2",
                    "field": {...CustomField...},
                    "display_order": 1,
                    "show_on_card": false
                }
            ],
            "created_at": "2025-11-05T10:00:00Z",
            "updated_at": "2025-11-05T10:00:00Z"
        }
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    list_id: UUID
    name: str
    description: Optional[str]
    schema_fields: list[SchemaFieldResponse] = Field(
        default_factory=list,
        description="Ordered list of fields in this schema"
    )
    created_at: datetime
    updated_at: datetime
