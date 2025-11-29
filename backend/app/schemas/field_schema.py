"""
Pydantic schemas for Field Schema API endpoints.

Field schemas are collections of custom fields that can be bound to tags,
enabling reusable evaluation templates (e.g., "Video Quality" schema containing
presentation, rating, and content fields).

Schema-field associations are managed via the SchemaField join table, which
tracks display_order and show_on_card settings for each field in a schema.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# ============================================================================
# Nested Schema for SchemaField (Join Table Data)
# ============================================================================


class FieldInSchemaResponse(BaseModel):
    """
    Full custom field details for display in schema response.

    Includes all CustomField attributes for rich display in frontend.
    Matches CustomFieldResponse structure from Task #64.
    """

    id: UUID
    list_id: UUID
    name: str
    field_type: str  # 'select' | 'rating' | 'text' | 'boolean'
    config: dict  # Type-specific configuration
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SchemaFieldResponse(BaseModel):
    """
    Combined schema field data with full custom field details.

    This is the main nested object in FieldSchemaResponse, combining
    join table metadata (display_order, show_on_card) with full field data.
    """

    field_id: UUID
    schema_id: UUID
    display_order: int
    show_on_card: bool
    field: FieldInSchemaResponse  # Full nested field details

    model_config = {"from_attributes": True}


# ============================================================================
# Schema Field Input (for POST /schemas with initial fields)
# ============================================================================


class SchemaFieldInput(BaseModel):
    """
    Input schema for adding a field to a schema during creation.

    Used in FieldSchemaCreate.fields array to specify initial fields
    when creating a schema.

    Example:
        {
            "field_id": "123e4567-e89b-12d3-a456-426614174000",
            "display_order": 0,
            "show_on_card": true
        }
    """

    field_id: UUID = Field(..., description="ID of existing custom field to add")
    display_order: int = Field(..., ge=0, description="Display order (0-indexed)")
    show_on_card: bool = Field(True, description="Show field on video cards")


# ============================================================================
# Main FieldSchema Schemas
# ============================================================================


class FieldSchemaBase(BaseModel):
    """
    Base schema for field schema with shared attributes.

    Contains common fields used in create and response operations.
    """

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Schema name (e.g., 'Video Quality', 'Tutorial Metrics')",
    )
    description: str | None = Field(
        None,
        max_length=1000,
        description="Optional explanation of what this schema evaluates",
    )


class FieldSchemaCreate(FieldSchemaBase):
    """
    Schema for creating a new field schema.

    Used in: POST /api/lists/{list_id}/schemas

    Optionally accepts an array of fields to add to the schema during creation.
    If provided, all field_ids must exist in the same list as the schema.

    Validates:
    - Max 3 fields can have show_on_card=true
    - No duplicate display_order values
    - No duplicate field_id values

    Example (minimal):
        {
            "name": "Video Quality",
            "description": "Standard quality metrics"
        }

    Example (with fields):
        {
            "name": "Video Quality",
            "description": "Standard quality metrics",
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

    fields: list[SchemaFieldInput] | None = Field(
        None, description="Optional array of fields to add to schema during creation"
    )

    @field_validator("fields")
    @classmethod
    def validate_show_on_card_limit(
        cls, fields: list[SchemaFieldInput] | None
    ) -> list[SchemaFieldInput] | None:
        """
        Validate that at most 3 fields have show_on_card=true.

        This constraint ensures the UI doesn't become cluttered with too many
        fields displayed on video cards. Users can still define more fields,
        but only 3 will be prominently displayed.

        Raises:
            ValueError: If more than 3 fields have show_on_card=true
        """
        if fields is None:
            return fields

        show_on_card_fields = [f for f in fields if f.show_on_card]
        if len(show_on_card_fields) > 3:
            # Show first 5 field_ids (truncated) to help identify which fields need fixing
            field_ids_str = ", ".join(
                str(f.field_id)[:8] + "..." for f in show_on_card_fields[:5]
            )
            raise ValueError(
                f"At most 3 fields can have show_on_card=true, but {len(show_on_card_fields)} fields are marked. "
                f"Please set show_on_card=false for {len(show_on_card_fields) - 3} of these fields: {field_ids_str}"
            )
        return fields

    @field_validator("fields")
    @classmethod
    def validate_no_duplicate_display_orders(
        cls, fields: list[SchemaFieldInput] | None
    ) -> list[SchemaFieldInput] | None:
        """
        Validate that all display_order values are unique.

        Each field must have a unique display_order to ensure consistent
        rendering order in the UI. Duplicate orders create ambiguity about
        which field should appear first.

        Raises:
            ValueError: If duplicate display_order values are found
        """
        if fields is None:
            return fields

        display_orders = [f.display_order for f in fields]
        if len(display_orders) != len(set(display_orders)):
            # Find which orders are duplicated
            duplicates = [
                order for order in display_orders if display_orders.count(order) > 1
            ]
            raise ValueError(
                f"Duplicate display_order values found: {set(duplicates)}. "
                f"Each field must have a unique display_order."
            )
        return fields

    @field_validator("fields")
    @classmethod
    def validate_no_duplicate_field_ids(
        cls, fields: list[SchemaFieldInput] | None
    ) -> list[SchemaFieldInput] | None:
        """
        Validate that all field_id values are unique.

        Each field can only be added once to a schema. Duplicate field_ids
        would create confusion and violate the database unique constraint on
        (schema_id, field_id).

        Raises:
            ValueError: If duplicate field_id values are found
        """
        if fields is None:
            return fields

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
    Schema for updating field schema metadata.

    Used in: PUT /api/lists/{list_id}/schemas/{schema_id}

    Only updates name and/or description. Field management (adding/removing
    fields from schema) is handled by separate endpoints in Task #69.

    All fields are optional to support partial updates.

    Example (update name only):
        {"name": "Updated Video Quality"}

    Example (update both):
        {
            "name": "Tutorial Evaluation",
            "description": "Comprehensive tutorial assessment criteria"
        }
    """

    name: str | None = Field(
        None, min_length=1, max_length=255, description="Schema name"
    )
    description: str | None = Field(
        None, max_length=1000, description="Schema description"
    )


class FieldSchemaResponse(FieldSchemaBase):
    """
    Schema for field schema response from API.

    Includes all database fields plus eager-loaded schema_fields relationship.
    The schema_fields array contains full CustomField details for each field,
    enabling rich display in the frontend without additional queries.

    Used in:
    - GET /api/lists/{list_id}/schemas (list)
    - POST /api/lists/{list_id}/schemas (single)
    - PUT /api/lists/{list_id}/schemas/{schema_id} (single)
    - GET /api/lists/{list_id}/schemas/{schema_id} (single)

    Example:
        {
            "id": "schema-uuid",
            "list_id": "list-uuid",
            "name": "Video Quality",
            "description": "Standard quality metrics",
            "schema_fields": [
                {
                    "field_id": "field-uuid-1",
                    "schema_id": "schema-uuid",
                    "display_order": 0,
                    "show_on_card": true,
                    "field": {
                        "id": "field-uuid-1",
                        "list_id": "list-uuid",
                        "name": "Presentation Quality",
                        "field_type": "select",
                        "config": {"options": ["bad", "good", "great"]},
                        "created_at": "2025-11-06T10:00:00Z",
                        "updated_at": "2025-11-06T10:00:00Z"
                    }
                },
                {
                    "field_id": "field-uuid-2",
                    "schema_id": "schema-uuid",
                    "display_order": 1,
                    "show_on_card": true,
                    "field": {
                        "id": "field-uuid-2",
                        "name": "Overall Rating",
                        "field_type": "rating",
                        "config": {"max_rating": 5},
                        ...
                    }
                }
            ],
            "created_at": "2025-11-06T09:00:00Z",
            "updated_at": "2025-11-06T09:00:00Z"
        }
    """

    id: UUID = Field(..., description="Unique schema identifier")
    list_id: UUID = Field(..., description="Parent list identifier")
    schema_fields: list[SchemaFieldResponse] = Field(
        default=[], description="Fields in this schema (ordered by display_order)"
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}

    @field_validator("schema_fields", mode="before")
    @classmethod
    def convert_none_to_empty_list(cls, value):
        """
        Convert None or single object to list for schema_fields.

        SQLAlchemy sometimes returns None for empty relationships with
        selectinload(), or a single object instead of a list when uselist
        is incorrectly inferred due to composite primary keys in the join table.
        This validator ensures we always get a list.
        """
        if value is None:
            return []
        # If it's already a list, return as-is
        if isinstance(value, (list, tuple)):
            return value
        # If we got a single SchemaField object instead of a list, wrap it
        if hasattr(value, "schema_id") and hasattr(value, "field_id"):
            return [value]
        return value


# ============================================================================
# Batch Update Schemas (Task #126)
# ============================================================================


class SchemaFieldUpdateItem(BaseModel):
    """
    Single field update for batch operations.

    Used in SchemaFieldBatchUpdateRequest to update display_order and
    show_on_card for multiple fields in a single API call.

    Example:
        {
            "field_id": "123e4567-e89b-12d3-a456-426614174000",
            "display_order": 0,
            "show_on_card": true
        }
    """

    field_id: UUID = Field(..., description="ID of field to update")
    display_order: int = Field(..., ge=0, description="Display order (0-indexed)")
    show_on_card: bool = Field(..., description="Show field on video cards")


class SchemaFieldBatchUpdateRequest(BaseModel):
    """
    Request schema for batch updating schema_fields.

    Used in: PUT /api/schemas/{schema_id}/fields/batch

    Enables updating display_order and show_on_card for multiple fields
    in a single atomic operation. Useful for drag-and-drop reordering
    in the frontend.

    Validates:
    - Max 3 fields can have show_on_card=true
    - display_order values must be unique
    - Batch size: 1-50 items

    Example:
        {
            "fields": [
                {"field_id": "uuid-1", "display_order": 0, "show_on_card": true},
                {"field_id": "uuid-2", "display_order": 1, "show_on_card": true},
                {"field_id": "uuid-3", "display_order": 2, "show_on_card": false}
            ]
        }
    """

    fields: list[SchemaFieldUpdateItem] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of fields to update (1-50 items)",
    )

    @field_validator("fields")
    @classmethod
    def validate_show_on_card_limit(
        cls, fields: list[SchemaFieldUpdateItem]
    ) -> list[SchemaFieldUpdateItem]:
        """
        Validate that at most 3 fields have show_on_card=true.

        Raises:
            ValueError: If more than 3 fields have show_on_card=true
        """
        show_on_card_count = sum(1 for item in fields if item.show_on_card)
        if show_on_card_count > 3:
            raise ValueError(
                f"At most 3 fields can have show_on_card=true, but {show_on_card_count} fields are marked. "
                f"Please set show_on_card=false for {show_on_card_count - 3} fields."
            )
        return fields

    @field_validator("fields")
    @classmethod
    def validate_unique_display_orders(
        cls, fields: list[SchemaFieldUpdateItem]
    ) -> list[SchemaFieldUpdateItem]:
        """
        Validate that all display_order values are unique.

        Raises:
            ValueError: If duplicate display_order values are found
        """
        display_orders = [item.display_order for item in fields]
        if len(display_orders) != len(set(display_orders)):
            duplicates = [
                order for order in display_orders if display_orders.count(order) > 1
            ]
            raise ValueError(
                f"Duplicate display_order values found: {set(duplicates)}. "
                f"Each field must have a unique display_order."
            )
        return fields


class SchemaFieldBatchUpdateResponse(BaseModel):
    """
    Response schema for batch update operation.

    Returns count of updated fields and complete updated schema_fields list
    with nested field data for immediate UI refresh.

    Example:
        {
            "updated_count": 3,
            "fields": [
                {
                    "field_id": "uuid-1",
                    "schema_id": "schema-uuid",
                    "display_order": 0,
                    "show_on_card": true,
                    "field": { "id": "uuid-1", "name": "Rating", ... }
                },
                ...
            ]
        }
    """

    updated_count: int = Field(..., description="Number of fields updated")
    fields: list[SchemaFieldResponse] = Field(
        ..., description="Complete updated schema_fields list with nested field data"
    )
