"""
Pydantic schemas for VideoFieldValue API requests/responses.

These schemas handle batch updates of custom field values for videos.
"""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Import existing schema from Task #71 (DRY principle)
from app.schemas.video import VideoFieldValueResponse


class FieldValueUpdate(BaseModel):
    """
    Single field value update in a batch request.

    The value type depends on the field's field_type:
    - rating: int | float (validated inline in endpoint)
    - select: str (validated against options list inline)
    - text: str (validated against optional max_length inline)
    - boolean: bool

    Validation happens at endpoint level (inline) to avoid Task #73 dependency.
    """

    field_id: UUID = Field(..., description="UUID of the custom field")
    value: int | str | bool | float | None = Field(
        ..., description="Field value (type must match field's field_type)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"field_id": "550e8400-e29b-41d4-a716-446655440000", "value": 5},
                {"field_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "value": "great"},
            ]
        }
    )


class BatchUpdateFieldValuesRequest(BaseModel):
    """
    Request schema for batch updating video field values.

    All fields are updated atomically - if any validation fails,
    no changes are persisted to the database.

    Example:
        {
            "field_values": [
                {"field_id": "uuid1", "value": 5},
                {"field_id": "uuid2", "value": "great"}
            ]
        }
    """

    field_values: list[FieldValueUpdate] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of field value updates (1-50 items)",
    )

    @field_validator("field_values")
    @classmethod
    def validate_unique_field_ids(
        cls, v: list[FieldValueUpdate]
    ) -> list[FieldValueUpdate]:
        """
        Ensure no duplicate field_id in request.

        Multiple updates to the same field in one request is ambiguous
        (which value to use?) and indicates a client bug.

        Args:
            v: List of field value updates

        Returns:
            Validated list (unchanged if valid)

        Raises:
            ValueError: If duplicate field_id found
        """
        seen: set = set()
        duplicates: set = set()
        for update in v:
            if update.field_id in seen:
                duplicates.add(update.field_id)
            else:
                seen.add(update.field_id)

        if duplicates:
            # Convert UUIDs to strings for error message
            duplicate_str = ", ".join(str(fid) for fid in duplicates)
            raise ValueError(
                f"Duplicate field_id in request: {duplicate_str}. "
                "Each field can only be updated once per request."
            )

        return v

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "field_values": [
                        {
                            "field_id": "550e8400-e29b-41d4-a716-446655440000",
                            "value": 5,
                        },
                        {
                            "field_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                            "value": "great",
                        },
                        {
                            "field_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                            "value": True,
                        },
                    ]
                }
            ]
        }
    )


class BatchUpdateFieldValuesResponse(BaseModel):
    """
    Response schema for batch field value updates.

    Returns all updated field values with full field metadata.
    Reuses VideoFieldValueResponse from Task #71 for consistency.
    """

    updated_count: int = Field(..., description="Number of fields updated")
    field_values: list[VideoFieldValueResponse] = Field(
        ..., description="Updated field values with field definitions"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "updated_count": 3,
                    "field_values": [
                        {
                            "field_id": "field-uuid",
                            "value": 5,
                            "schema_name": None,
                            "show_on_card": True,
                            "display_order": 0,
                            "field": {
                                "id": "field-uuid",
                                "name": "Overall Rating",
                                "field_type": "rating",
                                "config": {"max_rating": 5},
                                "list_id": "list-uuid",
                                "created_at": "2025-11-09T10:00:00Z",
                                "updated_at": "2025-11-09T10:00:00Z",
                            },
                        }
                    ],
                }
            ]
        }
    )
