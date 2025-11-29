"""
Unit tests for FieldSchema Pydantic schemas.

Tests cover all validation scenarios specified in Task #65:
- Valid creation tests (empty fields, single field, max show_on_card fields)
- Validator tests (show_on_card_limit, duplicate display_order, duplicate field_ids)
- Partial update tests (name only, description only, both fields)
- Response schema tests (nested CustomFieldResponse, empty/multiple fields)
- Edge cases (empty name, whitespace-only name, large fields list)

Total: 20 tests covering comprehensive validation logic
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.custom_field import CustomFieldResponse
from app.schemas.field_schema import (
    FieldSchemaCreate,
    FieldSchemaResponse,
    FieldSchemaUpdate,
    SchemaFieldInput,
    SchemaFieldResponse,
)

# ============================================================================
# Test Group 1: Valid Creation Tests (4 tests)
# ============================================================================


def test_create_schema_with_empty_fields_list():
    """Test creating a valid FieldSchema with no fields."""
    schema = FieldSchemaCreate(
        name="Video Quality", description="Standard video quality metrics", fields=[]
    )
    assert schema.name == "Video Quality"
    assert schema.description == "Standard video quality metrics"
    assert schema.fields == []


def test_create_schema_with_single_field():
    """Test creating a valid FieldSchema with 1 field."""
    field_id = uuid4()
    schema = FieldSchemaCreate(
        name="Simple Schema",
        description="A schema with one field",
        fields=[
            SchemaFieldInput(field_id=field_id, display_order=0, show_on_card=True)
        ],
    )
    assert schema.name == "Simple Schema"
    assert len(schema.fields) == 1
    assert schema.fields[0].field_id == field_id
    assert schema.fields[0].display_order == 0
    assert schema.fields[0].show_on_card is True


def test_create_schema_with_exactly_three_show_on_card():
    """Test creating a valid FieldSchema with exactly 3 show_on_card=true fields."""
    field1_id = uuid4()
    field2_id = uuid4()
    field3_id = uuid4()
    field4_id = uuid4()

    schema = FieldSchemaCreate(
        name="Full Schema",
        description="Schema with 3 visible fields",
        fields=[
            SchemaFieldInput(field_id=field1_id, display_order=0, show_on_card=True),
            SchemaFieldInput(field_id=field2_id, display_order=1, show_on_card=True),
            SchemaFieldInput(field_id=field3_id, display_order=2, show_on_card=True),
            SchemaFieldInput(field_id=field4_id, display_order=3, show_on_card=False),
        ],
    )
    assert len(schema.fields) == 4
    show_on_card_count = sum(1 for f in schema.fields if f.show_on_card)
    assert show_on_card_count == 3


def test_schema_field_item_with_all_fields():
    """Test creating a valid SchemaFieldInput with all fields."""
    field_id = uuid4()
    item = SchemaFieldInput(field_id=field_id, display_order=5, show_on_card=False)
    assert item.field_id == field_id
    assert item.display_order == 5
    assert item.show_on_card is False


# ============================================================================
# Test Group 2: Validator Tests (8 tests)
# ============================================================================


def test_show_on_card_limit_exceeded():
    """Test that more than 3 show_on_card=true fields raises ValidationError."""
    field1_id = uuid4()
    field2_id = uuid4()
    field3_id = uuid4()
    field4_id = uuid4()

    with pytest.raises(ValidationError) as exc_info:
        FieldSchemaCreate(
            name="Invalid Schema",
            fields=[
                SchemaFieldInput(
                    field_id=field1_id, display_order=0, show_on_card=True
                ),
                SchemaFieldInput(
                    field_id=field2_id, display_order=1, show_on_card=True
                ),
                SchemaFieldInput(
                    field_id=field3_id, display_order=2, show_on_card=True
                ),
                SchemaFieldInput(
                    field_id=field4_id, display_order=3, show_on_card=True
                ),
            ],
        )

    error_message = str(exc_info.value)
    assert "At most 3 fields can have show_on_card=true" in error_message
    assert "but 4 fields are marked" in error_message
    # Check that field_ids are mentioned (truncated UUIDs)
    assert "..." in error_message  # Truncated UUID format


def test_show_on_card_limit_exactly_three():
    """Test that exactly 3 show_on_card=true fields passes validation."""
    field1_id = uuid4()
    field2_id = uuid4()
    field3_id = uuid4()

    schema = FieldSchemaCreate(
        name="Valid Schema",
        fields=[
            SchemaFieldInput(field_id=field1_id, display_order=0, show_on_card=True),
            SchemaFieldInput(field_id=field2_id, display_order=1, show_on_card=True),
            SchemaFieldInput(field_id=field3_id, display_order=2, show_on_card=True),
        ],
    )
    assert len([f for f in schema.fields if f.show_on_card]) == 3


def test_duplicate_display_order():
    """Test that duplicate display_order values raise ValidationError."""
    field1_id = uuid4()
    field2_id = uuid4()

    with pytest.raises(ValidationError) as exc_info:
        FieldSchemaCreate(
            name="Invalid Schema",
            fields=[
                SchemaFieldInput(
                    field_id=field1_id, display_order=0, show_on_card=False
                ),
                SchemaFieldInput(
                    field_id=field2_id, display_order=0, show_on_card=False
                ),
            ],
        )

    error_message = str(exc_info.value)
    assert "Duplicate display_order values found" in error_message
    assert "{0}" in error_message  # Duplicate value is 0
    assert "Each field must have a unique display_order" in error_message


def test_duplicate_field_ids():
    """Test that duplicate field_id values raise ValidationError."""
    field_id = uuid4()

    with pytest.raises(ValidationError) as exc_info:
        FieldSchemaCreate(
            name="Invalid Schema",
            fields=[
                SchemaFieldInput(
                    field_id=field_id, display_order=0, show_on_card=False
                ),
                SchemaFieldInput(
                    field_id=field_id, display_order=1, show_on_card=False
                ),
            ],
        )

    error_message = str(exc_info.value)
    assert "Duplicate field_id values found" in error_message
    # Check for truncated UUID format
    assert "..." in error_message
    assert "Each field can only be added once to a schema" in error_message


def test_negative_display_order():
    """Test that negative display_order raises ValidationError."""
    field_id = uuid4()

    with pytest.raises(ValidationError) as exc_info:
        SchemaFieldInput(field_id=field_id, display_order=-1, show_on_card=False)

    error_message = str(exc_info.value)
    assert "greater than or equal to 0" in error_message


def test_multiple_validators_pass_with_valid_data():
    """Test that all validators pass with valid, diverse data."""
    field1_id = uuid4()
    field2_id = uuid4()
    field3_id = uuid4()
    field4_id = uuid4()

    schema = FieldSchemaCreate(
        name="Complex Valid Schema",
        description="Tests all validators",
        fields=[
            SchemaFieldInput(field_id=field1_id, display_order=0, show_on_card=True),
            SchemaFieldInput(field_id=field2_id, display_order=1, show_on_card=True),
            SchemaFieldInput(field_id=field3_id, display_order=5, show_on_card=False),
            SchemaFieldInput(field_id=field4_id, display_order=10, show_on_card=False),
        ],
    )
    assert len(schema.fields) == 4
    assert len([f for f in schema.fields if f.show_on_card]) == 2


def test_duplicate_display_order_with_three_fields():
    """Test that duplicate display_order is detected with 3 duplicate values."""
    field1_id = uuid4()
    field2_id = uuid4()
    field3_id = uuid4()

    with pytest.raises(ValidationError) as exc_info:
        FieldSchemaCreate(
            name="Invalid Schema",
            fields=[
                SchemaFieldInput(
                    field_id=field1_id, display_order=1, show_on_card=False
                ),
                SchemaFieldInput(
                    field_id=field2_id, display_order=1, show_on_card=False
                ),
                SchemaFieldInput(
                    field_id=field3_id, display_order=1, show_on_card=False
                ),
            ],
        )

    error_message = str(exc_info.value)
    assert "Duplicate display_order values found" in error_message
    assert "{1}" in error_message


def test_validator_order_show_on_card_before_duplicates():
    """Test that validators run in order (show_on_card limit is checked first)."""
    field_id = uuid4()

    # This should fail on show_on_card limit first, not duplicate field_ids
    with pytest.raises(ValidationError) as exc_info:
        FieldSchemaCreate(
            name="Invalid Schema",
            fields=[
                SchemaFieldInput(field_id=field_id, display_order=0, show_on_card=True),
                SchemaFieldInput(field_id=field_id, display_order=1, show_on_card=True),
                SchemaFieldInput(field_id=field_id, display_order=2, show_on_card=True),
                SchemaFieldInput(field_id=field_id, display_order=3, show_on_card=True),
            ],
        )

    # show_on_card validator should trigger first
    error_message = str(exc_info.value)
    assert "At most 3 fields can have show_on_card=true" in error_message


# ============================================================================
# Test Group 3: Partial Update Tests (3 tests)
# ============================================================================


def test_update_with_name_only():
    """Test partial update with name only using exclude_unset."""
    update = FieldSchemaUpdate(name="Updated Schema Name")
    data = update.model_dump(exclude_unset=True)

    assert "name" in data
    assert "description" not in data
    assert data["name"] == "Updated Schema Name"


def test_update_with_description_only():
    """Test partial update with description only using exclude_unset."""
    update = FieldSchemaUpdate(description="Updated description")
    data = update.model_dump(exclude_unset=True)

    assert "description" in data
    assert "name" not in data
    assert data["description"] == "Updated description"


def test_update_with_both_fields():
    """Test partial update with both name and description using exclude_unset."""
    update = FieldSchemaUpdate(name="New Name", description="New Description")
    data = update.model_dump(exclude_unset=True)

    assert "name" in data
    assert "description" in data
    assert data["name"] == "New Name"
    assert data["description"] == "New Description"


# ============================================================================
# Test Group 4: Response Schema Tests (3 tests)
# ============================================================================


def test_schema_field_response_with_nested_custom_field():
    """Test SchemaFieldResponse serializes with nested CustomFieldResponse."""
    field_id = uuid4()
    schema_id = uuid4()
    custom_field = CustomFieldResponse(
        id=field_id,
        list_id=uuid4(),
        name="Presentation Quality",
        field_type="select",
        config={"options": ["bad", "good", "great"]},
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    schema_field = SchemaFieldResponse(
        field_id=field_id,
        schema_id=schema_id,
        field=custom_field,
        display_order=0,
        show_on_card=True,
    )

    assert schema_field.field_id == field_id
    assert schema_field.field.name == "Presentation Quality"
    assert schema_field.display_order == 0
    assert schema_field.show_on_card is True


def test_field_schema_response_with_empty_schema_fields():
    """Test FieldSchemaResponse with empty schema_fields list."""
    schema_id = uuid4()
    list_id = uuid4()

    response = FieldSchemaResponse(
        id=schema_id,
        list_id=list_id,
        name="Empty Schema",
        description="A schema with no fields",
        schema_fields=[],
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    assert response.id == schema_id
    assert response.name == "Empty Schema"
    assert response.schema_fields == []


def test_field_schema_response_with_multiple_nested_fields():
    """Test FieldSchemaResponse with multiple nested SchemaFieldResponse objects."""
    schema_id = uuid4()
    list_id = uuid4()
    field1_id = uuid4()
    field2_id = uuid4()

    custom_field1 = CustomFieldResponse(
        id=field1_id,
        list_id=list_id,
        name="Field 1",
        field_type="rating",
        config={"max_rating": 5},
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    custom_field2 = CustomFieldResponse(
        id=field2_id,
        list_id=list_id,
        name="Field 2",
        field_type="boolean",
        config={},
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    schema_field1 = SchemaFieldResponse(
        field_id=field1_id,
        schema_id=schema_id,
        field=custom_field1,
        display_order=0,
        show_on_card=True,
    )

    schema_field2 = SchemaFieldResponse(
        field_id=field2_id,
        schema_id=schema_id,
        field=custom_field2,
        display_order=1,
        show_on_card=False,
    )

    response = FieldSchemaResponse(
        id=schema_id,
        list_id=list_id,
        name="Multi-Field Schema",
        description="Schema with multiple fields",
        schema_fields=[schema_field1, schema_field2],
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    assert len(response.schema_fields) == 2
    assert response.schema_fields[0].field.name == "Field 1"
    assert response.schema_fields[1].field.name == "Field 2"
    assert response.schema_fields[0].display_order == 0
    assert response.schema_fields[1].display_order == 1


# ============================================================================
# Test Group 5: Edge Cases (2 tests)
# ============================================================================


def test_empty_name_string():
    """Test that empty name string raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        FieldSchemaCreate(name="", fields=[])

    error_message = str(exc_info.value)
    assert "String should have at least 1 character" in error_message


def test_whitespace_only_name():
    """Test that whitespace-only name is accepted (no stripping by default)."""
    # Note: Unlike CustomFieldCreate, FieldSchemaCreate doesn't have
    # a whitespace validator. Pydantic's min_length=1 only checks length,
    # not content. This is intentional - schema names aren't stripped.
    schema = FieldSchemaCreate(name="   ", fields=[])
    assert schema.name == "   "  # Whitespace preserved


def test_large_fields_list():
    """Test that schema can handle a large list of fields (10 fields)."""
    fields = []
    for i in range(10):
        fields.append(
            SchemaFieldInput(
                field_id=uuid4(),
                display_order=i,
                show_on_card=(i < 3),  # Only first 3 show on card
            )
        )

    schema = FieldSchemaCreate(
        name="Large Schema", description="Schema with 10 fields", fields=fields
    )

    assert len(schema.fields) == 10
    assert len([f for f in schema.fields if f.show_on_card]) == 3
    # Verify all display_orders are unique
    display_orders = [f.display_order for f in schema.fields]
    assert len(display_orders) == len(set(display_orders))
