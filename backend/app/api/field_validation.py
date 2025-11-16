"""
Field value validation logic for custom fields system.

This module provides type-specific validation functions for custom field values.
Extracted from Task #72 inline validation (videos.py:1294-1360).

All validation is done in-memory without database queries for performance.

Validation Rules:
- rating: 0 <= value <= config['max_rating']
- select: value in config['options'] (case-sensitive)
- text: len(value) <= config.get('max_length', infinity) (optional)
- boolean: isinstance(value, bool) (strict)

Usage:
    from app.api.field_validation import validate_field_value

    try:
        validate_field_value(
            value=5,
            field_type='rating',
            config={'max_rating': 5}
        )
    except FieldValidationError as e:
        # Handle validation error
        print(f"Validation failed: {e}")
"""
from typing import Any


class FieldValidationError(ValueError):
    """
    Custom exception for field validation failures.

    Simple ValueError subclass for better exception handling.
    Raised when field value doesn't match type constraints.

    Examples:
        >>> raise FieldValidationError("Rating must be between 0 and 5")
    """
    pass


def validate_field_value(
    value: Any,
    field_type: str,
    config: dict,
    field_name: str = "(unnamed)"
) -> None:
    """
    Validate field value against field type and configuration.

    This function contains the EXACT validation logic from Task #72 endpoint
    (videos.py lines 1294-1360), extracted for reusability.

    Args:
        value: Value to validate (can be any type)
        field_type: One of 'rating', 'select', 'text', 'boolean'
        config: Field configuration dict (type-specific keys)
        field_name: Field name for error messages (default: "(unnamed)")

    Raises:
        FieldValidationError: If validation fails (with descriptive message)
        ValueError: If field_type is unknown

    Performance:
        < 1ms per field (no database queries, pure in-memory validation)

    Examples:
        >>> validate_field_value(5, 'rating', {'max_rating': 5}, 'Overall Rating')
        >>> # OK - no exception

        >>> validate_field_value(10, 'rating', {'max_rating': 5}, 'Overall Rating')
        >>> # Raises: FieldValidationError("Rating must be between 0 and 5")

        >>> validate_field_value('great', 'select', {'options': ['bad', 'good', 'great']}, 'Quality')
        >>> # OK - no exception

        >>> validate_field_value('invalid', 'select', {'options': ['bad', 'good', 'great']}, 'Quality')
        >>> # Raises: FieldValidationError("Invalid option 'invalid'. Valid options: ['bad', 'good', 'great']")
    """
    # Validation logic extracted from Task #72 (videos.py:1294-1360)

    if field_type == 'rating':
        # Type check - reject booleans first (bool is subclass of int in Python)
        if isinstance(value, bool):
            raise FieldValidationError(
                f"Rating value must be numeric, got {type(value).__name__}"
            )
        if not isinstance(value, (int, float)):
            raise FieldValidationError(
                f"Rating value must be numeric, got {type(value).__name__}"
            )

        # Range check
        max_rating = config.get('max_rating', 5)
        if value < 0 or value > max_rating:
            raise FieldValidationError(
                f"Rating must be between 0 and {max_rating}"
            )

    elif field_type == 'select':
        # Type check
        if not isinstance(value, str):
            raise FieldValidationError(
                f"Select value must be string, got {type(value).__name__}"
            )

        # Options check
        options = config.get('options', [])
        if value not in options:
            raise FieldValidationError(
                f"Invalid option '{value}'. Valid options: {options}"
            )

    elif field_type == 'boolean':
        # Strict bool type check (not truthy/falsy)
        if not isinstance(value, bool):
            raise FieldValidationError(
                f"Boolean value must be true/false, got {type(value).__name__}"
            )

    elif field_type == 'text':
        # Type check
        if not isinstance(value, str):
            raise FieldValidationError(
                f"Text value must be string, got {type(value).__name__}"
            )

        # Length check (optional)
        max_len = config.get('max_length')
        if max_len is not None and len(value) > max_len:
            raise FieldValidationError(
                f"Text exceeds max length {max_len} ({len(value)} chars)"
            )

    else:
        # Unknown field type
        raise ValueError(
            f"Unknown field_type: '{field_type}'. "
            f"Must be one of: rating, select, text, boolean"
        )
