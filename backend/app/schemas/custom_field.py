"""
Pydantic schemas for Custom Field API endpoints.

Custom fields allow users to define reusable evaluation criteria for videos
(e.g., "Presentation Quality", "Overall Rating"). Fields are list-scoped and
support four types: select, rating, text, boolean.

Config validation uses discriminated unions to ensure type-specific constraints
are enforced (e.g., rating fields must have max_rating between 1-10).
"""

from typing import Literal, Annotated, Any, Dict, List
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


# Field type definitions (using Literal for better Pydantic integration)
FieldType = Literal['select', 'rating', 'text', 'boolean']


# Type-specific config schemas
class SelectConfig(BaseModel):
    """
    Configuration for 'select' field type.

    Select fields provide a dropdown with predefined options.
    Example: {"options": ["bad", "good", "great"]}
    """
    options: list[str] = Field(
        ...,
        min_length=1,
        description="List of selectable options (minimum 1 required)"
    )

    @field_validator('options')
    @classmethod
    def validate_and_strip_options(cls, options: list[str]) -> list[str]:
        """Strip whitespace and validate all options are non-empty strings."""
        stripped = [opt.strip() for opt in options]
        if not all(stripped):
            raise ValueError("All options must be non-empty strings")
        return stripped  # Return stripped version for consistency


class RatingConfig(BaseModel):
    """
    Configuration for 'rating' field type.

    Rating fields provide numeric scales (e.g., 1-5 stars).
    Example: {"max_rating": 5}
    """
    max_rating: int = Field(
        ...,
        ge=1,
        le=10,
        description="Maximum rating value (1-10)"
    )


class TextConfig(BaseModel):
    """
    Configuration for 'text' field type.

    Text fields allow free-form text input with optional length limits.
    Example: {"max_length": 500} or {}
    """
    max_length: int | None = Field(
        None,
        ge=1,
        description="Optional maximum text length (must be ≥1 if specified)"
    )


class BooleanConfig(BaseModel):
    """
    Configuration for 'boolean' field type.

    Boolean fields provide yes/no checkboxes. No config needed.
    Example: {}
    """
    pass  # No configuration needed for boolean fields


# Union type for all possible configs
FieldConfig = SelectConfig | RatingConfig | TextConfig | BooleanConfig | Dict[str, Any]


# Shared validation helper function (DRY principle)
def _validate_config_for_type(field_type: str, config: Dict[str, Any]) -> None:
    """
    Validate that config structure matches the field_type.

    This shared function implements the core validation logic for config/field_type
    combinations, ensuring DRY principle and consistent validation across
    CustomFieldBase and CustomFieldUpdate schemas.

    Args:
        field_type: The field type ('select', 'rating', 'text', 'boolean')
        config: The configuration dictionary to validate

    Raises:
        ValueError: If config doesn't match field_type requirements

    Examples:
        >>> _validate_config_for_type('select', {'options': ['a', 'b']})  # OK
        >>> _validate_config_for_type('select', {})  # Raises ValueError
        >>> _validate_config_for_type('rating', {'max_rating': 5})  # OK
        >>> _validate_config_for_type('rating', {'max_rating': 20})  # Raises ValueError
    """
    if field_type == 'select':
        # Validate SelectConfig
        if 'options' not in config:
            raise ValueError("'select' field type requires 'options' in config")

        options = config.get('options')
        if not isinstance(options, list):
            raise ValueError("'options' must be a list")
        if len(options) < 1:
            raise ValueError("'options' must contain at least 1 item")
        if not all(isinstance(opt, str) and opt.strip() for opt in options):
            raise ValueError("All options must be non-empty strings")

    elif field_type == 'rating':
        # Validate RatingConfig
        if 'max_rating' not in config:
            raise ValueError("'rating' field type requires 'max_rating' in config")

        max_rating = config.get('max_rating')
        if not isinstance(max_rating, int):
            raise ValueError("'max_rating' must be an integer")
        if max_rating < 1 or max_rating > 10:
            raise ValueError("'max_rating' must be between 1 and 10")

    elif field_type == 'text':
        # Validate TextConfig (max_length is optional)
        if 'max_length' in config:
            max_length = config.get('max_length')
            if not isinstance(max_length, int):
                raise ValueError("'max_length' must be an integer")
            if max_length < 1:
                raise ValueError("'max_length' must be at least 1")

    elif field_type == 'boolean':
        # Boolean fields should have empty config or only empty dict
        if config and config != {}:
            raise ValueError("'boolean' field type should have empty config")


class CustomFieldBase(BaseModel):
    """
    Base schema for custom field with shared validation logic.

    Validates that field name, type, and config are consistent and meet
    business requirements (e.g., rating config must have max_rating 1-10).
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Field name (1-255 characters)"
    )
    field_type: FieldType = Field(
        ...,
        description="Field type: 'select', 'rating', 'text', or 'boolean'"
    )
    config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Type-specific configuration (JSON object)"
    )

    @field_validator('name')
    @classmethod
    def strip_name(cls, name: str) -> str:
        """Strip leading/trailing whitespace from field name."""
        stripped = name.strip()
        if not stripped:
            raise ValueError("Field name cannot be empty or whitespace-only")
        return stripped

    @model_validator(mode='after')
    def validate_config_matches_type(self) -> 'CustomFieldBase':
        """
        Validate that config structure matches the field_type.

        Uses shared validation function to ensure:
        - 'select' fields have 'options' list
        - 'rating' fields have 'max_rating' int (1-10)
        - 'text' fields have optional 'max_length' int (≥1)
        - 'boolean' fields have empty config or no config

        Raises:
            ValueError: If config doesn't match field_type requirements
        """
        _validate_config_for_type(self.field_type, self.config)
        return self


class CustomFieldCreate(CustomFieldBase):
    """
    Schema for creating a new custom field.

    Inherits all validation from CustomFieldBase. Used in:
    - POST /api/lists/{list_id}/custom-fields

    Example:
        {
            "name": "Presentation Quality",
            "field_type": "select",
            "config": {
                "options": ["bad", "all over the place", "confusing", "great"]
            }
        }
    """
    pass  # All validation inherited from CustomFieldBase


class CustomFieldUpdate(BaseModel):
    """
    Schema for updating an existing custom field.

    All fields are optional to support partial updates. When provided,
    fields are validated using the same rules as CustomFieldCreate.

    Used in:
    - PUT /api/custom-fields/{field_id}

    Example (partial update):
        {"name": "Updated Field Name"}

    Example (full update):
        {
            "name": "Overall Rating",
            "field_type": "rating",
            "config": {"max_rating": 10}
        }

    Note: Changing field_type on existing fields with values should be
    handled carefully by the API layer (may require confirmation).
    """
    name: str | None = Field(
        None,
        min_length=1,
        max_length=255,
        description="Field name (1-255 characters)"
    )
    field_type: FieldType | None = Field(
        None,
        description="Field type: 'select', 'rating', 'text', or 'boolean'"
    )
    config: Dict[str, Any] | None = Field(
        None,
        description="Type-specific configuration (JSON object)"
    )

    @field_validator('name')
    @classmethod
    def strip_name(cls, name: str | None) -> str | None:
        """Strip leading/trailing whitespace if name is provided."""
        if name is None:
            return None
        stripped = name.strip()
        if not stripped:
            raise ValueError("Field name cannot be empty or whitespace-only")
        return stripped

    @model_validator(mode='after')
    def validate_config_matches_type(self) -> 'CustomFieldUpdate':
        """
        Validate config matches field_type if both are provided.

        Only validates when both field_type and config are present.
        Partial updates (only name, or only config) skip validation.
        """
        # Skip validation if either field is None
        if self.field_type is None or self.config is None:
            return self

        # Use shared validation function
        _validate_config_for_type(self.field_type, self.config)
        return self


class CustomFieldResponse(CustomFieldBase):
    """
    Schema for custom field response from API.

    Includes all fields from the database model (ORM attributes).
    Used in:
    - GET /api/lists/{list_id}/custom-fields (list)
    - POST /api/lists/{list_id}/custom-fields (single)
    - PUT /api/custom-fields/{field_id} (single)
    - GET /api/custom-fields/{field_id} (single)

    Example:
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "list_id": "987fcdeb-51a2-43d1-9012-345678901234",
            "name": "Presentation Quality",
            "field_type": "select",
            "config": {
                "options": ["bad", "good", "great"]
            },
            "created_at": "2025-11-06T10:30:00Z",
            "updated_at": "2025-11-06T10:30:00Z"
        }
    """
    id: UUID = Field(..., description="Unique field identifier")
    list_id: UUID = Field(..., description="Parent list identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    # Pydantic v2 configuration for ORM mode
    model_config = {
        "from_attributes": True  # Enable ORM object conversion
    }


class DuplicateCheckRequest(BaseModel):
    """
    Request schema for checking if a field name already exists.

    Used in:
    - POST /api/lists/{list_id}/custom-fields/check-duplicate

    Performs case-insensitive comparison (e.g., "Overall Rating" matches
    "overall rating", "OVERALL RATING", etc.).

    Example:
        {"name": "presentation quality"}

    Response will indicate if a field with this name (case-insensitive)
    already exists in the list.
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Field name to check for duplicates"
    )

    @field_validator('name')
    @classmethod
    def strip_name(cls, name: str) -> str:
        """
        Strip whitespace from field name.

        Note: Case-insensitive comparison is handled by the API layer
        using SQL LOWER() for proper database-level comparison.
        This validator only strips whitespace and preserves the original case.
        """
        stripped = name.strip()
        if not stripped:
            raise ValueError("Field name cannot be empty or whitespace-only")
        return stripped  # Keep original case, API will handle LOWER() in query


class DuplicateCheckResponse(BaseModel):
    """
    Response schema for duplicate field name check.

    Indicates whether a field with the given name (case-insensitive)
    already exists in the list. If exists=True, the existing field
    details are included for reference.

    Example (field exists):
        {
            "exists": true,
            "field": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {"options": ["bad", "good", "great"]},
                ...
            }
        }

    Example (field does not exist):
        {
            "exists": false,
            "field": null
        }
    """
    exists: bool = Field(
        ...,
        description="True if a field with this name already exists"
    )
    field: CustomFieldResponse | None = Field(
        None,
        description="Existing field details (if exists=true)"
    )


class SmartSuggestion(BaseModel):
    """
    A single similarity suggestion from smart duplicate detection.

    Includes the similar field, similarity score, and explanation
    for why it was suggested.
    """
    field: CustomFieldResponse = Field(
        ...,
        description="The similar existing field"
    )
    score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Similarity score (0.0-1.0, higher = more similar)"
    )
    similarity_type: Literal["exact", "levenshtein", "semantic"] = Field(
        ...,
        description="Type of similarity detected"
    )
    explanation: str = Field(
        ...,
        description="Human-readable explanation of why this field was suggested"
    )


class SmartDuplicateCheckResponse(BaseModel):
    """
    Response for smart duplicate checking with AI-powered suggestions.

    Returns ranked list of similar fields with scores and explanations.

    Example (typo detected):
        {
            "exists": true,
            "suggestions": [
                {
                    "field": {...},
                    "score": 0.95,
                    "similarity_type": "levenshtein",
                    "explanation": "Very similar name (1 character difference): 'Presentation Quality'"
                }
            ],
            "mode": "smart"
        }

    Example (semantic similarity):
        {
            "exists": true,
            "suggestions": [
                {
                    "field": {...},
                    "score": 0.72,
                    "similarity_type": "semantic",
                    "explanation": "Semantically similar concept: 'Overall Rating' (AI detected 88% meaning similarity)"
                }
            ],
            "mode": "smart"
        }
    """
    exists: bool = Field(
        ...,
        description="True if any similar fields found (score >= 0.60)"
    )
    suggestions: List[SmartSuggestion] = Field(
        default_factory=list,
        description="List of similar fields ranked by score (highest first)"
    )
    mode: Literal["basic", "smart"] = Field(
        default="basic",
        description="Detection mode used"
    )
