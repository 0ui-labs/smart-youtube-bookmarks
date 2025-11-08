"""
Pydantic schemas for Field Schema API endpoints.

Field schemas are collections of custom fields that can be bound to tags,
enabling reusable evaluation templates (e.g., "Video Quality" schema containing
presentation, rating, and content fields).

Schema-field associations are managed via the SchemaField join table, which
tracks display_order and show_on_card settings for each field in a schema.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


# ============================================================================
# Nested Schema for SchemaField (Join Table Data)
# ============================================================================

class SchemaFieldInResponse(BaseModel):
    """
    Nested schema for schema_fields relationship in FieldSchemaResponse.

    Represents a single field within a schema, including metadata from the
    SchemaField join table (display_order, show_on_card) and full field details
    from the CustomField model.

    Example:
        {
            "field_id": "123e4567-e89b-12d3-a456-426614174000",
            "display_order": 0,
            "show_on_card": true,
            "field": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {"options": ["bad", "good", "great"]},
                ...
            }
        }
    """
    field_id: UUID = Field(..., description="ID of the custom field")
    display_order: int = Field(..., description="Display order within schema (0-indexed)")
    show_on_card: bool = Field(..., description="Whether to show field on video card")

    # Nested CustomField details (populated via eager loading)
    # Note: This will be populated by SQLAlchemy relationship loading
    # We'll access it via schemafield.field in the ORM model

    model_config = {
        "from_attributes": True
    }


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

    model_config = {
        "from_attributes": True
    }


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

    model_config = {
        "from_attributes": True
    }


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
        description="Schema name (e.g., 'Video Quality', 'Tutorial Metrics')"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional explanation of what this schema evaluates"
    )


class FieldSchemaCreate(FieldSchemaBase):
    """
    Schema for creating a new field schema.

    Used in: POST /api/lists/{list_id}/schemas

    Optionally accepts an array of fields to add to the schema during creation.
    If provided, all field_ids must exist in the same list as the schema.

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
    fields: Optional[list[SchemaFieldInput]] = Field(
        None,
        description="Optional array of fields to add to schema during creation"
    )


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
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Schema name"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Schema description"
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
        default_factory=list,
        description="Fields in this schema (ordered by display_order)"
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {
        "from_attributes": True
    }
