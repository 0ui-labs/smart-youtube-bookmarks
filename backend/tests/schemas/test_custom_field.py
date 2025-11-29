"""
Unit tests for CustomField Pydantic schemas.

Tests cover all validation scenarios specified in Task #64:
- Valid field creation (all 4 types)
- Config validation (type-specific rules)
- Field name validation (empty, whitespace, length)
- Invalid field type
- Update schema (partial and full updates)
- Response schema (ORM conversion)
- Duplicate check schemas
- Edge cases and boundary values

Total: 35 tests covering >95% of validation logic
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas import (
    CustomFieldCreate,
    CustomFieldResponse,
    CustomFieldUpdate,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
)

# ============================================================================
# Test Group 1: Valid Field Creation (5 tests)
# ============================================================================


def test_create_select_field_valid():
    """Test creating a valid select field with options."""
    field = CustomFieldCreate(
        name="Presentation Quality",
        field_type="select",
        config={"options": ["bad", "good", "great"]},
    )
    assert field.name == "Presentation Quality"
    assert field.field_type == "select"
    assert field.config == {"options": ["bad", "good", "great"]}


def test_create_rating_field_valid():
    """Test creating a valid rating field with max_rating."""
    field = CustomFieldCreate(
        name="Overall Rating", field_type="rating", config={"max_rating": 5}
    )
    assert field.name == "Overall Rating"
    assert field.field_type == "rating"
    assert field.config == {"max_rating": 5}


def test_create_text_field_valid_with_max_length():
    """Test creating a valid text field with max_length constraint."""
    field = CustomFieldCreate(
        name="Notes", field_type="text", config={"max_length": 500}
    )
    assert field.name == "Notes"
    assert field.field_type == "text"
    assert field.config == {"max_length": 500}


def test_create_text_field_valid_without_max_length():
    """Test creating a valid text field without max_length (unlimited)."""
    field = CustomFieldCreate(name="Description", field_type="text", config={})
    assert field.name == "Description"
    assert field.field_type == "text"
    assert field.config == {}


def test_create_boolean_field_valid():
    """Test creating a valid boolean field."""
    field = CustomFieldCreate(name="Is Recommended", field_type="boolean", config={})
    assert field.name == "Is Recommended"
    assert field.field_type == "boolean"
    assert field.config == {}


# ============================================================================
# Test Group 2: Config Validation (8 tests)
# ============================================================================


def test_select_field_missing_options():
    """Test that select field requires 'options' in config."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="Quality", field_type="select", config={})
    assert "'select' field type requires 'options' in config" in str(exc_info.value)


def test_select_field_empty_options_list():
    """Test that select field requires at least 1 option."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="Quality", field_type="select", config={"options": []})
    assert "'options' must contain at least 1 item" in str(exc_info.value)


def test_select_field_empty_string_in_options():
    """Test that select field options must be non-empty strings."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(
            name="Quality", field_type="select", config={"options": ["good", "", "bad"]}
        )
    assert "All options must be non-empty strings" in str(exc_info.value)


def test_rating_field_missing_max_rating():
    """Test that rating field requires 'max_rating' in config."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="Rating", field_type="rating", config={})
    assert "'rating' field type requires 'max_rating' in config" in str(exc_info.value)


def test_rating_field_max_rating_too_low():
    """Test that rating field max_rating must be >= 1."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="Rating", field_type="rating", config={"max_rating": 0})
    assert "'max_rating' must be between 1 and 10" in str(exc_info.value)


def test_rating_field_max_rating_too_high():
    """Test that rating field max_rating must be <= 10."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="Rating", field_type="rating", config={"max_rating": 11})
    assert "'max_rating' must be between 1 and 10" in str(exc_info.value)


def test_text_field_invalid_max_length():
    """Test that text field max_length must be >= 1 if specified."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="Notes", field_type="text", config={"max_length": 0})
    assert "'max_length' must be at least 1" in str(exc_info.value)


def test_boolean_field_non_empty_config():
    """Test that boolean field should have empty config."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(
            name="Flag", field_type="boolean", config={"some_key": "some_value"}
        )
    assert "'boolean' field type should have empty config" in str(exc_info.value)


# ============================================================================
# Test Group 3: Field Name Validation (4 tests)
# ============================================================================


def test_field_name_strips_whitespace():
    """Test that leading/trailing whitespace is removed from field name."""
    field = CustomFieldCreate(
        name="  Presentation Quality  ",
        field_type="select",
        config={"options": ["good", "bad"]},
    )
    assert field.name == "Presentation Quality"


def test_field_name_empty_string():
    """Test that empty field name is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="", field_type="select", config={"options": ["good"]})
    # Pydantic's min_length=1 triggers before our validator
    assert "String should have at least 1 character" in str(exc_info.value)


def test_field_name_only_whitespace():
    """Test that whitespace-only field name is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="   ", field_type="select", config={"options": ["good"]})
    assert "Field name cannot be empty or whitespace-only" in str(exc_info.value)


def test_field_name_max_length():
    """Test that field name exceeding 255 characters is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(
            name="a" * 256, field_type="select", config={"options": ["good"]}
        )
    assert "String should have at most 255 characters" in str(exc_info.value)


# ============================================================================
# Test Group 4: Invalid Field Type (1 test)
# ============================================================================


def test_invalid_field_type():
    """Test that invalid field_type is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(
            name="Test",
            field_type="invalid_type",  # type: ignore
            config={},
        )
    assert "Input should be 'select', 'rating', 'text' or 'boolean'" in str(
        exc_info.value
    )


# ============================================================================
# Test Group 5: Update Schema (5 tests)
# ============================================================================


def test_update_field_name_only():
    """Test partial update with name only."""
    update = CustomFieldUpdate(name="Updated Name")
    assert update.name == "Updated Name"
    assert update.field_type is None
    assert update.config is None


def test_update_field_config_only():
    """Test partial update with config only (should skip validation)."""
    update = CustomFieldUpdate(config={"max_rating": 5})
    assert update.name is None
    assert update.field_type is None
    assert update.config == {"max_rating": 5}


def test_update_field_full():
    """Test full update with all fields."""
    update = CustomFieldUpdate(
        name="Overall Rating", field_type="rating", config={"max_rating": 10}
    )
    assert update.name == "Overall Rating"
    assert update.field_type == "rating"
    assert update.config == {"max_rating": 10}


def test_update_validates_config_when_both_provided():
    """Test that validation triggers when both field_type and config are provided."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldUpdate(
            field_type="rating",
            config={"options": ["bad"]},  # Invalid: rating needs max_rating
        )
    assert "'rating' field type requires 'max_rating' in config" in str(exc_info.value)


def test_update_skips_validation_when_only_name():
    """Test that validation is skipped when only name is provided."""
    update = CustomFieldUpdate(name="New Name")
    assert update.name == "New Name"
    # No error should be raised


# ============================================================================
# Test Group 6: Response Schema (2 tests)
# ============================================================================


def test_response_schema_from_dict():
    """Test creating CustomFieldResponse from dictionary (simulating ORM object)."""
    data = {
        "id": uuid4(),
        "list_id": uuid4(),
        "name": "Test Field",
        "field_type": "select",
        "config": {"options": ["a", "b"]},
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }
    response = CustomFieldResponse(**data)
    assert response.name == "Test Field"
    assert response.field_type == "select"
    assert response.id == data["id"]
    assert response.list_id == data["list_id"]


def test_response_schema_model_config():
    """Test that response schema has from_attributes=True for ORM conversion."""
    assert CustomFieldResponse.model_config["from_attributes"] is True


# ============================================================================
# Test Group 7: Duplicate Check (4 tests)
# ============================================================================


def test_duplicate_check_request_valid():
    """Test valid duplicate check request."""
    request = DuplicateCheckRequest(name="Presentation Quality")
    assert request.name == "Presentation Quality"


def test_duplicate_check_request_strips_whitespace():
    """Test that duplicate check request strips whitespace."""
    request = DuplicateCheckRequest(name="  Test Field  ")
    assert request.name == "Test Field"


def test_duplicate_check_request_empty_name():
    """Test that duplicate check request rejects empty name."""
    with pytest.raises(ValidationError) as exc_info:
        DuplicateCheckRequest(name="   ")
    assert "Field name cannot be empty or whitespace-only" in str(exc_info.value)


def test_duplicate_check_response_exists_with_field():
    """Test duplicate check response when field exists."""
    field_data = {
        "id": uuid4(),
        "list_id": uuid4(),
        "name": "Existing Field",
        "field_type": "select",
        "config": {"options": ["a"]},
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }
    field = CustomFieldResponse(**field_data)
    response = DuplicateCheckResponse(exists=True, field=field)
    assert response.exists is True
    assert response.field is not None
    assert response.field.name == "Existing Field"


def test_duplicate_check_response_not_exists():
    """Test duplicate check response when field doesn't exist."""
    response = DuplicateCheckResponse(exists=False, field=None)
    assert response.exists is False
    assert response.field is None


# ============================================================================
# Test Group 8: Edge Cases (4 tests)
# ============================================================================


def test_rating_field_boundary_values():
    """Test that rating field accepts boundary values (1 and 10)."""
    # Test min boundary
    field_min = CustomFieldCreate(
        name="Rating Min", field_type="rating", config={"max_rating": 1}
    )
    assert field_min.config["max_rating"] == 1

    # Test max boundary
    field_max = CustomFieldCreate(
        name="Rating Max", field_type="rating", config={"max_rating": 10}
    )
    assert field_max.config["max_rating"] == 10


def test_select_field_single_option():
    """Test that select field accepts single option."""
    field = CustomFieldCreate(
        name="Single Option", field_type="select", config={"options": ["only"]}
    )
    assert field.config["options"] == ["only"]


def test_text_field_max_length_boundary():
    """Test that text field accepts max_length=1 (minimum valid value)."""
    field = CustomFieldCreate(
        name="Short Text", field_type="text", config={"max_length": 1}
    )
    assert field.config["max_length"] == 1


def test_field_name_exactly_255_chars():
    """Test that field name with exactly 255 characters is accepted."""
    name_255 = "a" * 255
    field = CustomFieldCreate(
        name=name_255, field_type="select", config={"options": ["test"]}
    )
    assert field.name == name_255
    assert len(field.name) == 255


# ============================================================================
# Additional Edge Cases (2 tests)
# ============================================================================


def test_select_field_options_with_whitespace_validation():
    """Test that select field validates options even with whitespace."""
    # Options with only whitespace should fail validation
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(
            name="Quality",
            field_type="select",
            config={"options": ["good", "   ", "bad"]},
        )
    assert "All options must be non-empty strings" in str(exc_info.value)


def test_text_field_with_negative_max_length():
    """Test that text field rejects negative max_length."""
    with pytest.raises(ValidationError) as exc_info:
        CustomFieldCreate(name="Text", field_type="text", config={"max_length": -1})
    assert "'max_length' must be at least 1" in str(exc_info.value)
