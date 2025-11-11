# Task #73: Add Field Value Validation Logic

**Plan Task:** #73
**Wave/Phase:** Phase 1: MVP - Backend (Custom Fields System)
**Dependencies:** Task #59 (CustomField Model), Task #62 (VideoFieldValue Model), Task #64 (CustomField Pydantic Schemas - can be parallel)

---

## 🎯 Ziel

Implement type-specific validation logic for custom field values to ensure data integrity. Create reusable validation functions that check values against field type constraints (rating range, select options, text length, boolean type). These validators will be integrated into Task #72 (batch update endpoint) and future CRUD endpoints to prevent invalid data from being stored in the database.

**Expected Result:**
- Central validation module with type-specific validators
- Rating: validates 0 <= value <= max_rating
- Select: validates value in options list
- Boolean: validates value is bool type
- Text: validates optional max_length constraint
- Comprehensive error messages for validation failures
- 100% test coverage for all validation paths

---

## 📋 Acceptance Criteria

- [ ] Central validation module created at `backend/app/api/field_validation.py`
- [ ] `validate_field_value()` function handles all 4 field types
- [ ] Rating validation: checks range (0 to max_rating)
- [ ] Select validation: checks value in options list (case-sensitive)
- [ ] Boolean validation: checks value is bool type
- [ ] Text validation: checks optional max_length constraint
- [ ] None/null values handled gracefully (allowed for optional fields)
- [ ] Descriptive error messages include field type and constraint details
- [ ] Unit tests: 20+ tests covering all field types and edge cases
- [ ] Integration with Task #72: validation function imported and used
- [ ] Performance: validation < 1ms per field (no database queries)
- [ ] Code reviewed (Subagent Grade A)
- [ ] Documentation updated (inline docstrings, CLAUDE.md)

---

## 🛠️ Implementation Steps

### Step 1: Create Central Validation Module

**Files:** `backend/app/api/field_validation.py` (NEW FILE)

**Action:** Create reusable validation functions for all field types

**Code:**
```python
"""
Field value validation logic for custom fields system.

This module provides type-specific validation functions for custom field values.
All validation is done in-memory without database queries for performance.

Validation Rules (from Design Doc lines 305-320):
- rating: 0 <= value <= config['max_rating']
- select: value in config['options'] (case-sensitive)
- text: len(value) <= config.get('max_length', infinity) (optional)
- boolean: isinstance(value, bool)

Usage:
    from app.api.field_validation import validate_field_value

    # Raises ValueError if invalid
    validate_field_value(
        value=5,
        field_type='rating',
        config={'max_rating': 5}
    )
"""
from typing import Any


class FieldValidationError(ValueError):
    """
    Custom exception for field validation failures.

    Includes field type and constraint information for better error messages.
    Inherits from ValueError for backward compatibility with existing code.
    """
    def __init__(self, message: str, field_type: str, config: dict):
        self.field_type = field_type
        self.config = config
        super().__init__(message)


def validate_rating_value(value: Any, config: dict) -> None:
    """
    Validate rating field value.

    Rules:
    - Value must be numeric (int or float)
    - Value must be >= 0
    - Value must be <= config['max_rating']

    Args:
        value: Value to validate
        config: Field configuration (must contain 'max_rating' key)

    Raises:
        FieldValidationError: If validation fails

    Examples:
        >>> validate_rating_value(5, {'max_rating': 5})  # OK
        >>> validate_rating_value(3.5, {'max_rating': 5})  # OK (float)
        >>> validate_rating_value(6, {'max_rating': 5})  # Raises
        >>> validate_rating_value(-1, {'max_rating': 5})  # Raises
        >>> validate_rating_value('5', {'max_rating': 5})  # Raises (not numeric)
    """
    # Check type first
    if not isinstance(value, (int, float)):
        raise FieldValidationError(
            f"Rating value must be numeric, got {type(value).__name__}",
            field_type='rating',
            config=config
        )

    # Check max_rating exists in config
    if 'max_rating' not in config:
        raise FieldValidationError(
            "Rating field config missing 'max_rating' key",
            field_type='rating',
            config=config
        )

    max_rating = config['max_rating']

    # Validate max_rating is valid
    if not isinstance(max_rating, (int, float)) or max_rating <= 0:
        raise FieldValidationError(
            f"Invalid max_rating in config: {max_rating}. Must be positive number.",
            field_type='rating',
            config=config
        )

    # Check range
    if value < 0:
        raise FieldValidationError(
            f"Rating value must be >= 0, got {value}",
            field_type='rating',
            config=config
        )

    if value > max_rating:
        raise FieldValidationError(
            f"Rating value must be <= {max_rating}, got {value}",
            field_type='rating',
            config=config
        )


def validate_select_value(value: Any, config: dict) -> None:
    """
    Validate select field value.

    Rules:
    - Value must be string
    - Value must be in config['options'] list (case-sensitive)

    Args:
        value: Value to validate
        config: Field configuration (must contain 'options' key)

    Raises:
        FieldValidationError: If validation fails

    Examples:
        >>> validate_select_value('good', {'options': ['bad', 'good', 'great']})  # OK
        >>> validate_select_value('Good', {'options': ['bad', 'good', 'great']})  # Raises (case-sensitive)
        >>> validate_select_value('invalid', {'options': ['bad', 'good', 'great']})  # Raises
        >>> validate_select_value(123, {'options': ['bad', 'good', 'great']})  # Raises (not string)
    """
    # Check type first
    if not isinstance(value, str):
        raise FieldValidationError(
            f"Select value must be string, got {type(value).__name__}",
            field_type='select',
            config=config
        )

    # Check options exists in config
    if 'options' not in config:
        raise FieldValidationError(
            "Select field config missing 'options' key",
            field_type='select',
            config=config
        )

    options = config['options']

    # Validate options is a list
    if not isinstance(options, list):
        raise FieldValidationError(
            f"Select field 'options' must be a list, got {type(options).__name__}",
            field_type='select',
            config=config
        )

    # Validate options is non-empty
    if len(options) == 0:
        raise FieldValidationError(
            "Select field 'options' list cannot be empty",
            field_type='select',
            config=config
        )

    # Check value in options (case-sensitive)
    if value not in options:
        # Build helpful error message with available options
        options_str = ', '.join(f'"{opt}"' for opt in options)
        raise FieldValidationError(
            f"Select value '{value}' not in allowed options: [{options_str}]",
            field_type='select',
            config=config
        )


def validate_text_value(value: Any, config: dict) -> None:
    """
    Validate text field value.

    Rules:
    - Value must be string
    - If config['max_length'] specified, len(value) <= max_length

    Args:
        value: Value to validate
        config: Field configuration (optional 'max_length' key)

    Raises:
        FieldValidationError: If validation fails

    Examples:
        >>> validate_text_value('Hello', {'max_length': 10})  # OK
        >>> validate_text_value('Hello', {})  # OK (no max_length)
        >>> validate_text_value('Hello world!', {'max_length': 5})  # Raises (too long)
        >>> validate_text_value(123, {'max_length': 10})  # Raises (not string)
    """
    # Check type first
    if not isinstance(value, str):
        raise FieldValidationError(
            f"Text value must be string, got {type(value).__name__}",
            field_type='text',
            config=config
        )

    # Check max_length if specified
    max_length = config.get('max_length')
    if max_length is not None:
        # Validate max_length is valid
        if not isinstance(max_length, int) or max_length <= 0:
            raise FieldValidationError(
                f"Invalid max_length in config: {max_length}. Must be positive integer.",
                field_type='text',
                config=config
            )

        # Check length
        if len(value) > max_length:
            raise FieldValidationError(
                f"Text value exceeds max_length of {max_length} characters. "
                f"Current length: {len(value)}",
                field_type='text',
                config=config
            )


def validate_boolean_value(value: Any, config: dict) -> None:
    """
    Validate boolean field value.

    Rules:
    - Value must be bool type (True or False)
    - Note: Python's bool is strict - 1 and 0 are not valid booleans

    Args:
        value: Value to validate
        config: Field configuration (unused for boolean, but included for consistency)

    Raises:
        FieldValidationError: If validation fails

    Examples:
        >>> validate_boolean_value(True, {})  # OK
        >>> validate_boolean_value(False, {})  # OK
        >>> validate_boolean_value(1, {})  # Raises (int, not bool)
        >>> validate_boolean_value(0, {})  # Raises (int, not bool)
        >>> validate_boolean_value('true', {})  # Raises (string, not bool)
    """
    # Check type (strict bool check, not truthy/falsy)
    if not isinstance(value, bool):
        raise FieldValidationError(
            f"Boolean value must be bool type (True or False), got {type(value).__name__}",
            field_type='boolean',
            config=config
        )


def validate_field_value(value: Any, field_type: str, config: dict) -> None:
    """
    Validate field value against field type and configuration.

    This is the main entry point for field value validation. It dispatches
    to type-specific validators based on field_type.

    None/null values are allowed (represent unset optional fields).

    Args:
        value: Value to validate (can be Any type)
        field_type: One of 'rating', 'select', 'text', 'boolean'
        config: Field configuration dict (type-specific keys)

    Raises:
        FieldValidationError: If validation fails
        ValueError: If field_type is unknown

    Examples:
        >>> validate_field_value(5, 'rating', {'max_rating': 5})  # OK
        >>> validate_field_value('great', 'select', {'options': ['bad', 'good', 'great']})  # OK
        >>> validate_field_value(None, 'rating', {'max_rating': 5})  # OK (None allowed)
        >>> validate_field_value(10, 'rating', {'max_rating': 5})  # Raises
        >>> validate_field_value(5, 'unknown_type', {})  # Raises ValueError
    """
    # Allow None/null values (represent unset optional fields)
    if value is None:
        return

    # Dispatch to type-specific validator
    if field_type == 'rating':
        validate_rating_value(value, config)
    elif field_type == 'select':
        validate_select_value(value, config)
    elif field_type == 'text':
        validate_text_value(value, config)
    elif field_type == 'boolean':
        validate_boolean_value(value, config)
    else:
        # Unknown field type
        raise ValueError(
            f"Unknown field_type: '{field_type}'. "
            f"Must be one of: rating, select, text, boolean"
        )


def validate_field_values_batch(
    updates: list[dict[str, Any]],
    fields_by_id: dict[str, dict[str, Any]]
) -> list[dict[str, str]]:
    """
    Batch validate multiple field values.

    Helper function for endpoints that update multiple fields at once.
    Collects all validation errors instead of failing on first error.

    Args:
        updates: List of dicts with 'field_id' and 'value' keys
        fields_by_id: Dict mapping field_id (str) to field dict with 'field_type' and 'config'

    Returns:
        List of error dicts (empty if all valid). Each error dict contains:
        - field_id: UUID string
        - field_name: Field name (if available)
        - error: Error message

    Example:
        >>> updates = [
        ...     {'field_id': 'uuid1', 'value': 10},  # Invalid (max_rating 5)
        ...     {'field_id': 'uuid2', 'value': 'great'}  # Valid
        ... ]
        >>> fields = {
        ...     'uuid1': {'field_type': 'rating', 'config': {'max_rating': 5}, 'name': 'Overall Rating'},
        ...     'uuid2': {'field_type': 'select', 'config': {'options': ['bad', 'good', 'great']}, 'name': 'Quality'}
        ... }
        >>> validate_field_values_batch(updates, fields)
        [{'field_id': 'uuid1', 'field_name': 'Overall Rating', 'error': 'Rating value must be <= 5, got 10'}]
    """
    errors = []

    for update in updates:
        field_id = str(update['field_id'])  # Convert UUID to string
        value = update['value']

        if field_id not in fields_by_id:
            # This should be caught by endpoint validation, but handle defensively
            errors.append({
                'field_id': field_id,
                'field_name': '(unknown)',
                'error': f"Field {field_id} not found"
            })
            continue

        field = fields_by_id[field_id]
        field_type = field['field_type']
        config = field['config']
        field_name = field.get('name', '(unnamed)')

        try:
            validate_field_value(value, field_type, config)
        except FieldValidationError as e:
            errors.append({
                'field_id': field_id,
                'field_name': field_name,
                'error': str(e)
            })
        except ValueError as e:
            # Unknown field type
            errors.append({
                'field_id': field_id,
                'field_name': field_name,
                'error': str(e)
            })

    return errors
```

**Why This Design:**
- **Type-specific validators:** Clear separation, easy to test individually
- **FieldValidationError:** Custom exception with field context
- **Strict type checking:** `isinstance(value, bool)` not truthy/falsy
- **Defensive validation:** Checks config structure before using (prevents crashes)
- **Helpful error messages:** Includes actual value, expected constraint, available options
- **None handling:** Allows null values for optional fields
- **Batch helper:** Collects all errors for better UX (Task #72 integration)
- **No database queries:** All validation in-memory (< 1ms per field)

**REF MCP Evidence:**
- Existing codebase: `validate_youtube_url()` function uses similar pattern (videos.py)
- Python best practice: Raise ValueError for validation errors (or custom subclass)
- Design Doc lines 308-311: Exact validation rules specified

---

### Step 2: Add Comprehensive Unit Tests

**Files:** `backend/tests/api/test_field_validation.py` (NEW FILE)

**Action:** Test all validation paths

**Code:**
```python
"""
Unit tests for field value validation logic.
"""
import pytest
from app.api.field_validation import (
    validate_field_value,
    validate_rating_value,
    validate_select_value,
    validate_text_value,
    validate_boolean_value,
    validate_field_values_batch,
    FieldValidationError
)


class TestRatingValidation:
    """Tests for rating field validation."""

    def test_valid_rating_integer(self):
        """Test valid integer rating within range."""
        validate_rating_value(5, {'max_rating': 5})
        validate_rating_value(0, {'max_rating': 5})
        validate_rating_value(3, {'max_rating': 5})
        # Should not raise

    def test_valid_rating_float(self):
        """Test valid float rating (e.g., 3.5 stars)."""
        validate_rating_value(3.5, {'max_rating': 5})
        validate_rating_value(0.5, {'max_rating': 5})
        # Should not raise

    def test_invalid_rating_exceeds_max(self):
        """Test rating value exceeds max_rating."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_rating_value(6, {'max_rating': 5})

        assert "must be <= 5" in str(exc_info.value)
        assert "got 6" in str(exc_info.value)

    def test_invalid_rating_negative(self):
        """Test negative rating value."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_rating_value(-1, {'max_rating': 5})

        assert "must be >= 0" in str(exc_info.value)

    def test_invalid_rating_wrong_type_string(self):
        """Test rating value with wrong type (string)."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_rating_value('5', {'max_rating': 5})

        assert "must be numeric" in str(exc_info.value)
        assert "str" in str(exc_info.value)

    def test_invalid_rating_wrong_type_bool(self):
        """Test rating value with wrong type (bool)."""
        # Note: In Python, bool is subclass of int, so True == 1 and False == 0
        # But our validation should reject bool for clarity
        with pytest.raises(FieldValidationError):
            validate_rating_value(True, {'max_rating': 5})

    def test_invalid_rating_missing_max_rating_config(self):
        """Test rating validation with missing max_rating in config."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_rating_value(3, {})

        assert "missing 'max_rating'" in str(exc_info.value)

    def test_invalid_rating_invalid_max_rating_config(self):
        """Test rating validation with invalid max_rating value."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_rating_value(3, {'max_rating': -5})

        assert "Invalid max_rating" in str(exc_info.value)


class TestSelectValidation:
    """Tests for select field validation."""

    def test_valid_select_value(self):
        """Test valid select value in options list."""
        config = {'options': ['bad', 'good', 'great']}
        validate_select_value('good', config)
        validate_select_value('bad', config)
        validate_select_value('great', config)
        # Should not raise

    def test_invalid_select_value_not_in_options(self):
        """Test select value not in options list."""
        config = {'options': ['bad', 'good', 'great']}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_select_value('invalid', config)

        error_msg = str(exc_info.value)
        assert "'invalid'" in error_msg
        assert "not in allowed options" in error_msg
        assert '"bad"' in error_msg
        assert '"good"' in error_msg
        assert '"great"' in error_msg

    def test_invalid_select_case_sensitive(self):
        """Test select validation is case-sensitive."""
        config = {'options': ['bad', 'good', 'great']}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_select_value('Good', config)  # Capital G

        assert "'Good'" in str(exc_info.value)
        assert "not in allowed options" in str(exc_info.value)

    def test_invalid_select_wrong_type_integer(self):
        """Test select value with wrong type (integer)."""
        config = {'options': ['bad', 'good', 'great']}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_select_value(123, config)

        assert "must be string" in str(exc_info.value)
        assert "int" in str(exc_info.value)

    def test_invalid_select_missing_options_config(self):
        """Test select validation with missing options in config."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_select_value('good', {})

        assert "missing 'options'" in str(exc_info.value)

    def test_invalid_select_empty_options_list(self):
        """Test select validation with empty options list."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_select_value('anything', {'options': []})

        assert "cannot be empty" in str(exc_info.value)

    def test_invalid_select_options_not_list(self):
        """Test select validation with options as wrong type."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_select_value('good', {'options': 'not-a-list'})

        assert "'options' must be a list" in str(exc_info.value)


class TestTextValidation:
    """Tests for text field validation."""

    def test_valid_text_without_max_length(self):
        """Test valid text value with no max_length constraint."""
        validate_text_value('Hello world', {})
        validate_text_value('A' * 10000, {})  # Very long text
        # Should not raise

    def test_valid_text_within_max_length(self):
        """Test valid text value within max_length."""
        validate_text_value('Hello', {'max_length': 10})
        validate_text_value('Hello', {'max_length': 5})  # Exactly at limit
        # Should not raise

    def test_invalid_text_exceeds_max_length(self):
        """Test text value exceeds max_length."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_text_value('Hello world', {'max_length': 5})

        error_msg = str(exc_info.value)
        assert "exceeds max_length of 5" in error_msg
        assert "Current length: 11" in error_msg

    def test_invalid_text_wrong_type_integer(self):
        """Test text value with wrong type (integer)."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_text_value(123, {'max_length': 10})

        assert "must be string" in str(exc_info.value)
        assert "int" in str(exc_info.value)

    def test_invalid_text_invalid_max_length_config(self):
        """Test text validation with invalid max_length value."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_text_value('Hello', {'max_length': -10})

        assert "Invalid max_length" in str(exc_info.value)

    def test_valid_text_empty_string(self):
        """Test empty string is valid text."""
        validate_text_value('', {'max_length': 10})
        validate_text_value('', {})
        # Should not raise


class TestBooleanValidation:
    """Tests for boolean field validation."""

    def test_valid_boolean_true(self):
        """Test valid boolean True value."""
        validate_boolean_value(True, {})
        # Should not raise

    def test_valid_boolean_false(self):
        """Test valid boolean False value."""
        validate_boolean_value(False, {})
        # Should not raise

    def test_invalid_boolean_integer_1(self):
        """Test integer 1 is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_boolean_value(1, {})

        assert "must be bool type" in str(exc_info.value)
        assert "int" in str(exc_info.value)

    def test_invalid_boolean_integer_0(self):
        """Test integer 0 is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_boolean_value(0, {})

        assert "must be bool type" in str(exc_info.value)

    def test_invalid_boolean_string_true(self):
        """Test string 'true' is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_boolean_value('true', {})

        assert "must be bool type" in str(exc_info.value)
        assert "str" in str(exc_info.value)

    def test_invalid_boolean_string_false(self):
        """Test string 'false' is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_boolean_value('false', {})

        assert "must be bool type" in str(exc_info.value)


class TestMainValidateFunction:
    """Tests for main validate_field_value function."""

    def test_none_value_allowed_for_all_types(self):
        """Test None/null values are allowed (unset optional fields)."""
        validate_field_value(None, 'rating', {'max_rating': 5})
        validate_field_value(None, 'select', {'options': ['a', 'b']})
        validate_field_value(None, 'text', {'max_length': 10})
        validate_field_value(None, 'boolean', {})
        # Should not raise

    def test_unknown_field_type_raises_valueerror(self):
        """Test unknown field_type raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            validate_field_value(5, 'unknown_type', {})

        assert "Unknown field_type" in str(exc_info.value)
        assert "'unknown_type'" in str(exc_info.value)

    def test_dispatches_to_rating_validator(self):
        """Test dispatches to rating validator correctly."""
        with pytest.raises(FieldValidationError):
            validate_field_value(10, 'rating', {'max_rating': 5})

    def test_dispatches_to_select_validator(self):
        """Test dispatches to select validator correctly."""
        with pytest.raises(FieldValidationError):
            validate_field_value('invalid', 'select', {'options': ['a', 'b']})

    def test_dispatches_to_text_validator(self):
        """Test dispatches to text validator correctly."""
        with pytest.raises(FieldValidationError):
            validate_field_value('toolong', 'text', {'max_length': 3})

    def test_dispatches_to_boolean_validator(self):
        """Test dispatches to boolean validator correctly."""
        with pytest.raises(FieldValidationError):
            validate_field_value(1, 'boolean', {})


class TestBatchValidation:
    """Tests for batch validation helper."""

    def test_batch_all_valid_returns_empty_errors(self):
        """Test batch validation with all valid values returns empty error list."""
        updates = [
            {'field_id': 'uuid1', 'value': 5},
            {'field_id': 'uuid2', 'value': 'great'}
        ]
        fields = {
            'uuid1': {
                'field_type': 'rating',
                'config': {'max_rating': 5},
                'name': 'Overall Rating'
            },
            'uuid2': {
                'field_type': 'select',
                'config': {'options': ['bad', 'good', 'great']},
                'name': 'Quality'
            }
        }

        errors = validate_field_values_batch(updates, fields)
        assert errors == []

    def test_batch_collects_multiple_errors(self):
        """Test batch validation collects all errors (doesn't stop on first)."""
        updates = [
            {'field_id': 'uuid1', 'value': 10},  # Invalid (max_rating 5)
            {'field_id': 'uuid2', 'value': 'invalid'}  # Invalid (not in options)
        ]
        fields = {
            'uuid1': {
                'field_type': 'rating',
                'config': {'max_rating': 5},
                'name': 'Overall Rating'
            },
            'uuid2': {
                'field_type': 'select',
                'config': {'options': ['bad', 'good', 'great']},
                'name': 'Quality'
            }
        }

        errors = validate_field_values_batch(updates, fields)

        assert len(errors) == 2
        assert errors[0]['field_id'] == 'uuid1'
        assert errors[0]['field_name'] == 'Overall Rating'
        assert 'must be <= 5' in errors[0]['error']

        assert errors[1]['field_id'] == 'uuid2'
        assert errors[1]['field_name'] == 'Quality'
        assert 'not in allowed options' in errors[1]['error']

    def test_batch_handles_missing_field_gracefully(self):
        """Test batch validation handles missing field_id gracefully."""
        updates = [
            {'field_id': 'missing-uuid', 'value': 5}
        ]
        fields = {}

        errors = validate_field_values_batch(updates, fields)

        assert len(errors) == 1
        assert errors[0]['field_id'] == 'missing-uuid'
        assert 'not found' in errors[0]['error']
```

**Why These Tests:**
- **Per-type coverage:** Separate test classes for each field type
- **Happy path:** Valid values for all types
- **Error cases:** Out of range, wrong type, missing config
- **Edge cases:** None values, empty strings, case sensitivity
- **Batch helper:** Tests error collection (doesn't stop on first error)
- **Error messages:** Asserts error messages include helpful details

---

### Step 3: Integration with Task #72 Endpoint (Verification)

**Files:** `backend/app/api/videos.py` (Task #72 endpoint)

**Action:** Verify Task #72 imports and uses validation correctly

**Code:**
```python
# Verify this import exists in Task #72 endpoint
from app.api.field_validation import validate_field_value

# Verify this validation loop exists in Step 3 of Task #72
validation_errors = []
for update in request.field_values:
    field = fields[update.field_id]
    try:
        # Validate value matches field type and config
        validate_field_value(
            value=update.value,
            field_type=field.field_type,
            config=field.config
        )
    except ValueError as e:
        validation_errors.append({
            "field_id": str(update.field_id),
            "field_name": field.name,
            "error": str(e)
        })
```

**Why Verification:**
- Task #72 and #73 can be implemented in parallel
- This step confirms integration interface matches
- No code changes needed if Task #72 already correct

---

### Step 4: Add Performance Benchmark Test

**Files:** `backend/tests/api/test_field_validation.py`

**Action:** Add performance test to verify < 1ms target

**Code:**
```python
import time

class TestPerformance:
    """Performance tests for validation logic."""

    def test_validation_performance_rating(self):
        """Test rating validation completes in < 1ms."""
        config = {'max_rating': 5}
        iterations = 1000

        start = time.perf_counter()
        for _ in range(iterations):
            validate_rating_value(3, config)
        end = time.perf_counter()

        avg_time_ms = ((end - start) / iterations) * 1000
        assert avg_time_ms < 1.0, f"Avg validation time {avg_time_ms:.3f}ms exceeds 1ms target"

    def test_validation_performance_select(self):
        """Test select validation completes in < 1ms."""
        config = {'options': ['option' + str(i) for i in range(100)]}  # 100 options
        iterations = 1000

        start = time.perf_counter()
        for _ in range(iterations):
            validate_select_value('option50', config)
        end = time.perf_counter()

        avg_time_ms = ((end - start) / iterations) * 1000
        assert avg_time_ms < 1.0, f"Avg validation time {avg_time_ms:.3f}ms exceeds 1ms target"

    def test_validation_performance_batch(self):
        """Test batch validation of 50 fields completes in < 50ms."""
        # Simulate 50 field updates
        updates = [
            {'field_id': f'uuid{i}', 'value': i % 5}
            for i in range(50)
        ]
        fields = {
            f'uuid{i}': {
                'field_type': 'rating',
                'config': {'max_rating': 5},
                'name': f'Field {i}'
            }
            for i in range(50)
        }

        start = time.perf_counter()
        validate_field_values_batch(updates, fields)
        end = time.perf_counter()

        total_time_ms = (end - start) * 1000
        assert total_time_ms < 50.0, f"Batch validation {total_time_ms:.3f}ms exceeds 50ms target"
```

**Why Performance Tests:**
- **Acceptance criteria:** < 1ms per field validation
- **Realistic benchmark:** 1000 iterations for accurate measurement
- **Batch test:** 50 fields (max batch size from Task #72)
- **Fails early:** Alerts if validation becomes slow (e.g., accidental database query)

---

### Step 5: Update CLAUDE.md Documentation

**Files:** `CLAUDE.md`

**Action:** Document validation logic patterns

**Code:**
```markdown
### Custom Field Value Validation

**Validation Rules:**

All custom field values are validated before persisting to the database:

| Field Type | Validation Rules | Example |
|------------|------------------|---------|
| **rating** | `0 <= value <= config['max_rating']` | If max_rating=5, valid: 0-5 |
| **select** | `value in config['options']` (case-sensitive) | If options=['bad','good','great'], valid: 'good' |
| **text** | `len(value) <= config.get('max_length', ∞)` | If max_length=500, valid: strings ≤ 500 chars |
| **boolean** | `isinstance(value, bool)` (strict) | Valid: True, False (not 1, 0, 'true') |

**None/null values:** Allowed for all types (represent unset optional fields)

**Validation Module:**
- **Location:** `backend/app/api/field_validation.py`
- **Main function:** `validate_field_value(value, field_type, config)`
- **Performance:** < 1ms per field (no database queries)
- **Error type:** `FieldValidationError` (subclass of ValueError)

**Usage Example:**
```python
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
```

**Integration:**
- Task #72: Batch update endpoint uses validation
- Future CRUD endpoints: Should use same validation

**Testing:**
- 30+ unit tests covering all validation paths
- Performance tests verify < 1ms target
- Edge cases: wrong types, missing config, None values
```

**Why Document:**
- Validation rules documented for frontend reference
- Module location and usage patterns clear
- Performance characteristics documented
- Integration points listed

---

### Step 6: TypeScript Type Check and Commit

**Action:** Verify no breaking changes, commit validation logic

**Commands:**
```bash
# Backend: Python syntax check
cd backend
python -m py_compile app/api/field_validation.py

# Backend: Run tests
pytest tests/api/test_field_validation.py -v

# Frontend: Type check (verify no breaking changes)
cd frontend
npx tsc --noEmit

# Commit
git add -A
git commit -m "feat(validation): add field value validation logic

- Create central validation module (field_validation.py)
- Implement type-specific validators:
  - rating: 0 <= value <= max_rating
  - select: value in options (case-sensitive)
  - text: len(value) <= max_length (optional)
  - boolean: strict bool type check
- Add FieldValidationError custom exception
- Add batch validation helper (validate_field_values_batch)
- Create 30+ unit tests (100% coverage)
- Add performance tests (< 1ms per field, < 50ms for 50 fields)
- Update CLAUDE.md with validation rules documentation

Validation Rules (from Design Doc lines 308-311):
- None/null values allowed (optional fields)
- Strict type checking (no implicit conversions)
- Helpful error messages (includes constraint details)
- No database queries (all in-memory validation)

Performance:
- Single field: < 1ms (verified with 1000 iterations)
- Batch of 50: < 50ms (verified with benchmark test)
- Zero database queries (pure function validation)

Integration:
- Task #72: Batch update endpoint imports and uses validation
- Future CRUD endpoints: Can reuse same validators

Follows REF MCP best practices:
- Pydantic-style validation pattern (ValueError on error)
- Existing codebase pattern (validate_youtube_url similar)
- Design Doc validation rules (lines 308-311)
- Type-specific validation with config checking

Task #73 (Custom Fields System Phase 1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (30+ tests across 7 classes)

**TestRatingValidation (8 tests):**
1. Valid integer rating
2. Valid float rating
3. Invalid: exceeds max
4. Invalid: negative
5. Invalid: wrong type (string)
6. Invalid: wrong type (bool)
7. Invalid: missing max_rating config
8. Invalid: invalid max_rating config

**TestSelectValidation (7 tests):**
1. Valid select value
2. Invalid: not in options
3. Invalid: case-sensitive mismatch
4. Invalid: wrong type (integer)
5. Invalid: missing options config
6. Invalid: empty options list
7. Invalid: options not a list

**TestTextValidation (6 tests):**
1. Valid: no max_length
2. Valid: within max_length
3. Invalid: exceeds max_length
4. Invalid: wrong type
5. Invalid: invalid max_length config
6. Valid: empty string

**TestBooleanValidation (5 tests):**
1. Valid: True
2. Valid: False
3. Invalid: integer 1
4. Invalid: integer 0
5. Invalid: string 'true'/'false'

**TestMainValidateFunction (6 tests):**
1. None allowed for all types
2. Unknown field_type raises ValueError
3-6. Dispatches to correct validator

**TestBatchValidation (3 tests):**
1. All valid returns empty errors
2. Collects multiple errors
3. Handles missing field gracefully

**TestPerformance (3 tests):**
1. Rating validation < 1ms
2. Select validation < 1ms (100 options)
3. Batch 50 fields < 50ms

### Integration Test (via Task #72)

Task #72 integration test verifies validation is called correctly in endpoint.

### Manual Testing (6 scenarios)

1. **Valid rating:** 5 with max_rating=5 → OK
2. **Invalid rating:** 10 with max_rating=5 → FieldValidationError
3. **Valid select:** 'great' in ['bad', 'good', 'great'] → OK
4. **Invalid select:** 'invalid' not in options → FieldValidationError
5. **None value:** None for any type → OK (optional)
6. **Performance:** 1000 validations → measure avg time < 1ms

---

## 📚 Reference

### Related Docs

**Master Design:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 305-320 (Backend Validation Logic)
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 81-85 (Config Examples)

**Previous Tasks:**
- Task #59: CustomField model with field_type enum
- Task #62: VideoFieldValue model with typed columns
- Task #72: Batch update endpoint (integrates this validation)

**External Docs:**
- [Python Exceptions](https://docs.python.org/3/tutorial/errors.html#user-defined-exceptions)
- [Pytest](https://docs.pytest.org/)

### Related Code

**Similar Pattern:**
- `backend/app/schemas/video.py` (lines 19-58) - `validate_youtube_url()` function
- Follow same pattern: function that raises ValueError on invalid input

---

## 🎯 Design Decisions

### Decision 1: Separate Validators vs Single Function with Conditionals

**Alternatives:**
- A. Single `validate()` function with if/elif for each type
- B. Separate validator functions per type (chosen)
- C. Validator classes with inheritance

**Chosen:** B. Separate functions

**Rationale:**
- **Testability:** Each validator can be tested independently
- **Clarity:** Clear separation of concerns (one function = one job)
- **Maintainability:** Easy to add new validators without modifying existing
- **Pattern:** Existing codebase uses function-based validators

**REF MCP Evidence:** Python best practices recommend small, focused functions.

---

### Decision 2: Strict Boolean vs Truthy/Falsy

**Alternatives:**
- A. Accept truthy/falsy values (1, 0, 'true', 'false', etc.)
- B. Strict bool type check (chosen)

**Chosen:** B. Strict bool type

**Rationale:**
- **Type safety:** Prevents accidental integer/string → bool conversion
- **Database schema:** VideoFieldValue.value_boolean column is BOOLEAN type
- **Clarity:** True/False unambiguous, 1/0 confusing in UI
- **Python convention:** `isinstance(value, bool)` is recommended pattern

**Trade-offs:**
- Pro: No ambiguity (True means True, not 1)
- Pro: Matches database type
- Con: Frontend must send explicit bool, not 1/0

**Implementation Note:** Python's `bool` is subclass of `int`, so need `isinstance(value, bool)` check BEFORE `isinstance(value, int)`.

---

### Decision 3: Case-Sensitive Select Options

**Alternatives:**
- A. Case-insensitive matching (convert to lowercase before checking)
- B. Case-sensitive matching (chosen)

**Chosen:** B. Case-sensitive

**Rationale:**
- **Design Doc:** No mention of case-insensitive matching
- **User expectation:** Options displayed as-is in UI, should match exactly
- **Simplicity:** No need for normalization logic
- **Consistent:** Tags use case-insensitive (special requirement), fields don't need it

**Trade-offs:**
- Pro: Simpler implementation
- Pro: Preserves exact option values
- Con: 'Good' vs 'good' are different (user must match case)

**Future:** Can add case-insensitive option as config flag if needed.

---

### Decision 4: FieldValidationError vs ValueError

**Alternatives:**
- A. Raise ValueError directly
- B. Custom FieldValidationError (subclass of ValueError) (chosen)
- C. Custom exception hierarchy (FieldValidationError, RatingError, SelectError, etc.)

**Chosen:** B. Custom exception (subclass of ValueError)

**Rationale:**
- **Context:** Can include field_type and config in exception
- **Backward compatibility:** Still catches as ValueError
- **Helpful errors:** Frontend can access structured error data
- **Pattern:** Existing code uses custom exceptions (HTTPException)

**Trade-offs:**
- Pro: More context in exception
- Pro: Can catch specifically if needed
- Con: Slight complexity vs raw ValueError

---

### Decision 5: None/Null Values Allowed

**Alternatives:**
- A. None values raise validation error
- B. None values allowed (represent unset optional fields) (chosen)

**Chosen:** B. None allowed

**Rationale:**
- **Database schema:** Columns are nullable (value_text, value_numeric, value_boolean all nullable)
- **Use case:** Users may want to clear field value (set to null)
- **Frontend UX:** Empty state should be valid
- **RESTful design:** DELETE equivalent to setting null

**Implementation:** Early return in `validate_field_value()` if value is None.

---

## 🚨 Risk Mitigation

### Risk 1: Performance Regression (Database Query in Validator)

**Risk:** Accidentally adding database query to validator breaks < 1ms target

**Mitigation:**
- Performance tests fail if avg time > 1ms (alerts immediately)
- Code review checks for no `await` or `db.execute()` calls
- All validation is pure function (no side effects)

---

### Risk 2: Config Structure Changes

**Risk:** CustomField.config structure changes, breaks validators

**Mitigation:**
- Defensive validation: Check config keys exist before using
- Helpful error messages: "missing 'max_rating' key" (not just crash)
- Config validation in Pydantic schemas (Task #64) prevents invalid configs

---

### Risk 3: Type Coercion Surprises

**Risk:** Python's type coercion (e.g., bool subclass of int) causes unexpected behavior

**Mitigation:**
- Explicit type checks with `isinstance()`
- Test coverage for edge cases (bool as int, string as number)
- Strict validation (no implicit conversions)

---

## ⏱️ Estimated Time

**Total: 2-2.5 hours**

- Step 1: Create validation module (60 min)
- Step 2: Create unit tests (45 min)
- Step 3: Verify Task #72 integration (5 min)
- Step 4: Add performance tests (15 min)
- Step 5-6: Docs + commit (15 min)

**Subagent-Driven Development:** Optional (validation logic is straightforward, can be done directly)

**Note:** Task #73 and Task #72 can be implemented in parallel (loose coupling via interface).

---

## 📝 Notes

### REF MCP Validation Results (2025-11-07)

**Consulted Documentation:**
- ✅ Design Doc lines 308-311 (exact validation rules)
- ✅ Existing codebase validate_youtube_url pattern (videos.py)
- ✅ Python best practices for custom exceptions
- ✅ Pytest performance testing patterns

**Key Findings:**
1. **Validation rules explicitly specified** in Design Doc (no ambiguity)
2. **Existing pattern:** `validate_youtube_url()` function raises ValueError
3. **Strict bool check:** Python `isinstance(value, bool)` recommended over truthy/falsy
4. **Performance target:** < 1ms per field (no database queries)

**No Hallucinations Detected:** All validation rules match Design Doc specification.

---

### Integration Points

**Task #72 (Batch Update Endpoint):**
```python
from app.api.field_validation import validate_field_value

# In endpoint Step 3
for update in request.field_values:
    field = fields[update.field_id]
    try:
        validate_field_value(update.value, field.field_type, field.config)
    except ValueError as e:
        validation_errors.append({...})
```

**Future CRUD Endpoints (Tasks #66-69):**
- Custom fields create/update: Validate config structure
- Field values create/update: Use `validate_field_value()`
- Schemas create/update: Validate max 3 fields have show_on_card=true

---

### Validation Rules Summary (Quick Reference)

| Type | Rule | Example Valid | Example Invalid |
|------|------|---------------|-----------------|
| **rating** | `0 <= value <= max_rating` | 5 (max=5) | 6 (max=5) |
| **select** | `value in options` | 'great' | 'invalid' |
| **text** | `len(value) <= max_length` | 'Hello' (max=10) | 'Hello world!' (max=5) |
| **boolean** | `isinstance(value, bool)` | True, False | 1, 0, 'true' |
| **None** | Always allowed | None | N/A |

---

### Related Tasks

**Depends On:**
- Task #59: CustomField model (complete)
- Task #62: VideoFieldValue model (complete)

**Integrates With:**
- Task #72: Batch update endpoint (imports validation)

**Enables:**
- All future CRUD endpoints (Tasks #66-69) can reuse validators

**Blocks:**
- None (Task #72 can use stub until this complete)

---

**Plan Created:** 2025-11-07
**REF MCP Validated:** 2025-11-07 (Design Doc, existing codebase patterns, Python docs)
**Subagent Research:** Completed (4 parallel subagents dispatched)
**Ready for Implementation:** ✅
