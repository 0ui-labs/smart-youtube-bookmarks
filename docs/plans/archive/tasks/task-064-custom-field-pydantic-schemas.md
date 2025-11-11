# Task #64: Create CustomField Pydantic Schemas

**Task ID:** #64
**Category:** Backend - Pydantic Schemas
**Status:** Not Started
**Created:** 2025-11-06
**Dependencies:** Task #59 (CustomField ORM Model) ✅ Completed

---

## 🎯 Ziel

Create comprehensive Pydantic v2 schemas for the CustomField model to enable type-safe API request/response handling. This includes four core schemas (Base, Create, Update, Response) plus two specialized schemas for duplicate checking. The schemas will implement field-type-specific config validation using discriminated unions and custom validators, ensuring data integrity at the API boundary before it reaches the database layer.

**Expected Outcome:** Production-ready Pydantic schemas with exhaustive validation logic, enabling immediate implementation of CustomField API endpoints in Task #65.

---

## 📋 Acceptance Criteria

- [x] **Schema Structure**
  - [x] CustomFieldBase schema with shared validation logic
  - [x] CustomFieldCreate schema (inherits Base)
  - [x] CustomFieldUpdate schema (all optional fields)
  - [x] CustomFieldResponse schema (includes ORM fields: id, timestamps)
  - [x] DuplicateCheckRequest schema
  - [x] DuplicateCheckResponse schema

- [x] **Field Type Validation**
  - [x] `field_type` restricted to Literal['select', 'rating', 'text', 'boolean']
  - [x] Enum-style validation with clear error messages

- [x] **Config Validation (Type-Specific)**
  - [x] `select`: options list must have ≥1 string, all non-empty
  - [x] `rating`: max_rating must be int in range [1, 10]
  - [x] `text`: max_length (optional) must be int ≥1 if present
  - [x] `boolean`: empty dict allowed
  - [x] Runtime type guards prevent invalid config/field_type combinations

- [x] **Field Constraints**
  - [x] `name`: min_length=1, max_length=255, strip whitespace
  - [x] Case-insensitive duplicate check support

- [x] **Testing**
  - [x] 15+ unit tests covering all validation scenarios
  - [x] Test file: `backend/tests/schemas/test_custom_field.py`
  - [x] Tests grouped logically (creation, config validation, updates, edge cases)

- [x] **Code Quality**
  - [x] TypeScript type check passes (0 new errors)
  - [x] Comprehensive docstrings (module, classes, validators)
  - [x] Inline comments explaining complex validation logic
  - [x] Follows existing codebase patterns (tag.py, video.py)

- [x] **Integration**
  - [x] Schemas exported in `backend/app/schemas/__init__.py`
  - [x] Ready for immediate use in API endpoints

---

## 🛠️ Implementation Steps

### Step 1: Create Field Type Literal and Config Type Definitions

**File:** `backend/app/schemas/custom_field.py` (NEW)

**Rationale:** Using `Literal` types instead of `Enum` provides better Pydantic integration, clearer error messages, and simpler JSON serialization. Discriminated unions with type guards ensure config validation matches the field_type at runtime.

**Code:**

```python
"""
Pydantic schemas for Custom Field API endpoints.

Custom fields allow users to define reusable evaluation criteria for videos
(e.g., "Presentation Quality", "Overall Rating"). Fields are list-scoped and
support four types: select, rating, text, boolean.

Config validation uses discriminated unions to ensure type-specific constraints
are enforced (e.g., rating fields must have max_rating between 1-10).
"""

from typing import Literal, Annotated, Any, Dict
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
```

**REF MCP Evidence:**
- Pydantic v2 docs confirm `Literal` types provide better type narrowing than Enum
- Discriminated unions allow field-specific validation with clear error context
- Source: https://github.com/pydantic/pydantic/blob/main/docs/concepts/validators.md

**REF MCP Improvement (2025-11-07):**
- Extracted shared validation logic to `_validate_config_for_type()` helper function
- Implements DRY principle: validation logic defined once, reused in Base and Update schemas
- Benefits: easier maintenance, consistent validation, isolated testability
- Source: Python best practices for reducing code duplication

---

### Step 2: Create CustomFieldBase Schema

**File:** `backend/app/schemas/custom_field.py` (APPEND)

**Rationale:** CustomFieldBase contains shared validation logic for Create and Update schemas. The `model_validator` performs runtime type checking to ensure config matches field_type, preventing impossible combinations like `field_type='rating'` with `config={'options': [...]}`.

**Code:**

```python
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
```

**Why model_validator instead of field_validator:**
- `model_validator(mode='after')` has access to all fields simultaneously
- Required for cross-field validation (config depends on field_type)
- Runs after individual field validators, ensuring clean data

**Alternative Considered:** Using Pydantic's discriminated unions with `Field(discriminator='field_type')`. Rejected because config is a raw dict in the ORM model (JSONB), and forcing strict typed configs would break flexibility for future field types.

---

### Step 3: Create CustomFieldCreate Schema

**File:** `backend/app/schemas/custom_field.py` (APPEND)

**Code:**

```python
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
```

**Rationale:** Simple inheritance pattern matches existing codebase (TagCreate inherits TagBase). No additional fields or validation needed for creation.

---

### Step 4: Create CustomFieldUpdate Schema

**File:** `backend/app/schemas/custom_field.py` (APPEND)

**Rationale:** Update schema makes all fields optional to support partial updates (PATCH semantics). Validation logic is reused via inheritance, but only validates fields that are provided.

**Code:**

```python
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
```

**Design Decision:** Use shared validation function (DRY principle).
- **Pro:** No code duplication (maintains single source of truth)
- **Pro:** Easier maintenance (changes in one place)
- **Pro:** Consistent validation across Base and Update schemas
- **Pro:** Helper function can be unit tested independently
- **Chosen:** Shared function for consistency (REF MCP improvement 2025-11-07)

---

### Step 5: Create CustomFieldResponse Schema

**File:** `backend/app/schemas/custom_field.py` (APPEND)

**Rationale:** Response schema includes ORM-generated fields (id, timestamps) and uses `model_config` for Pydantic v2 ORM integration. This pattern matches video.py (uses `model_config`) instead of tag.py (uses deprecated `Config` class).

**Code:**

```python
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
```

**Design Decision: `model_config` vs `Config` class**
- Pydantic v2 recommends `model_config = {...}` (dict syntax)
- `Config` class is deprecated (still works but triggers warnings)
- Matches video.py pattern (line 101-103)
- REF MCP: https://github.com/pydantic/pydantic/blob/main/docs/concepts/config.md

---

### Step 6: Create DuplicateCheckRequest Schema

**File:** `backend/app/schemas/custom_field.py` (APPEND)

**Rationale:** Specialized schema for case-insensitive duplicate checking. Simple structure with single field validation ensures API receives clean input.

**Code:**

```python
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
```

**Why not lowercase in schema?**
- Preserves original user input for display/error messages
- Database query handles case-insensitivity with SQL `LOWER()`
- Avoids confusion (user types "Overall Rating", sees "overall rating" in error)

---

### Step 7: Create DuplicateCheckResponse Schema

**File:** `backend/app/schemas/custom_field.py` (APPEND)

**Code:**

```python
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
```

**Design Decision:** Include full field details instead of just ID/name.
- **Pro:** Frontend can show rich duplicate warning ("A 'select' field named 'X' already exists")
- **Pro:** User can decide if existing field meets their needs
- **Con:** Slightly larger response size
- **Chosen:** Include full details for better UX

---

### Step 8: Update Schema Exports

**File:** `backend/app/schemas/__init__.py` (MODIFY)

**Code:**

```python
from .list import ListCreate, ListUpdate, ListResponse
from .job_progress import ProgressData, JobProgressEventCreate, JobProgressEventRead
from .tag import TagBase, TagCreate, TagUpdate, TagResponse
from .custom_field import (
    CustomFieldBase,
    CustomFieldCreate,
    CustomFieldUpdate,
    CustomFieldResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
)

__all__ = [
    "ListCreate",
    "ListUpdate",
    "ListResponse",
    "ProgressData",
    "JobProgressEventCreate",
    "JobProgressEventRead",
    "TagBase",
    "TagCreate",
    "TagUpdate",
    "TagResponse",
    "CustomFieldBase",
    "CustomFieldCreate",
    "CustomFieldUpdate",
    "CustomFieldResponse",
    "DuplicateCheckRequest",
    "DuplicateCheckResponse",
]
```

**Rationale:** Explicit exports enable clean imports in API endpoint files:
```python
from app.schemas import CustomFieldCreate, CustomFieldResponse
```

---

### Step 9: Create Comprehensive Unit Tests

**File:** `backend/tests/schemas/test_custom_field.py` (NEW)

**Rationale:** Exhaustive test coverage ensures validation logic works correctly before API integration. Tests grouped by functionality for clarity.

**Code:**

See the implementation steps section in the plan for the complete 27-test suite covering:
- Valid field creation (all 4 types)
- Config validation (type-specific rules)
- Field name validation (empty, whitespace, length)
- Invalid field type
- Update schema (partial and full updates)
- Response schema (ORM conversion)
- Duplicate check schemas
- Edge cases and boundary values

---

### Step 10: Run Tests and Verify

**Command:**

```bash
cd backend
pytest tests/schemas/test_custom_field.py -v
```

**Expected Output:**

```
tests/schemas/test_custom_field.py::test_create_select_field_valid PASSED
tests/schemas/test_custom_field.py::test_create_rating_field_valid PASSED
tests/schemas/test_custom_field.py::test_create_text_field_valid_with_max_length PASSED
...
========================== 27 passed in 0.45s ==========================
```

---

### Step 11: TypeScript Type Check

**Command:**

```bash
cd frontend
npx tsc --noEmit
```

**Expected Output:**

```
No errors found.
```

---

### Step 12: Documentation Review Pass

**Files to Review:**

1. **`backend/app/schemas/custom_field.py`**
   - Module docstring: Explains purpose, field types, config examples
   - Class docstrings: Each schema has usage examples
   - Function docstrings: Validators explain logic and constraints
   - Inline comments: Complex validation logic annotated

2. **`backend/tests/schemas/test_custom_field.py`**
   - Module docstring: Test coverage summary
   - Test group comments: Organize tests by functionality
   - Test docstrings: Each test explains what it validates

---

## 🧪 Testing Strategy

### Unit Tests (27 Tests)

**Test File:** `backend/tests/schemas/test_custom_field.py`

#### Test Group 1: Valid Field Creation (5 tests)
1. `test_create_select_field_valid` - Valid select field with options
2. `test_create_rating_field_valid` - Valid rating field with max_rating
3. `test_create_text_field_valid_with_max_length` - Text field with max_length
4. `test_create_text_field_valid_without_max_length` - Text field without max_length
5. `test_create_boolean_field_valid` - Valid boolean field

**Expected Behavior:** All fields create successfully with correct attributes.

#### Test Group 2: Config Validation (8 tests)
6. `test_select_field_missing_options` - Error: select requires options
7. `test_select_field_empty_options_list` - Error: options list must have ≥1 item
8. `test_select_field_empty_string_in_options` - Error: options must be non-empty strings
9. `test_rating_field_missing_max_rating` - Error: rating requires max_rating
10. `test_rating_field_max_rating_too_low` - Error: max_rating < 1
11. `test_rating_field_max_rating_too_high` - Error: max_rating > 10
12. `test_text_field_invalid_max_length` - Error: max_length < 1
13. `test_boolean_field_non_empty_config` - Error: boolean requires empty config

#### Test Group 3: Field Name Validation (4 tests)
14. `test_field_name_strips_whitespace` - Whitespace removed
15. `test_field_name_empty_string` - Error: name too short
16. `test_field_name_only_whitespace` - Error: name cannot be empty
17. `test_field_name_max_length` - Error: name > 255 chars

#### Test Group 4: Invalid Field Type (1 test)
18. `test_invalid_field_type` - Error: field_type must be one of 4 valid types

#### Test Group 5: Update Schema (5 tests)
19. `test_update_field_name_only` - Partial update: name only
20. `test_update_field_config_only` - Partial update: config only
21. `test_update_field_full` - Full update: all fields
22. `test_update_validates_config_when_both_provided` - Error: invalid config/type combo
23. `test_update_skips_validation_when_only_name` - Success: partial update skips validation

#### Test Group 6: Response Schema (2 tests)
24. `test_response_schema_from_dict` - Create response from dict
25. `test_response_schema_model_config` - Verify from_attributes=True

#### Test Group 7: Duplicate Check (4 tests)
26. `test_duplicate_check_request_valid` - Valid request
27. `test_duplicate_check_request_strips_whitespace` - Whitespace stripped
28. `test_duplicate_check_request_empty_name` - Error: empty name
29. `test_duplicate_check_response_exists_with_field` - Response with existing field
30. `test_duplicate_check_response_not_exists` - Response when field doesn't exist

#### Test Group 8: Edge Cases (4 tests)
31. `test_rating_field_boundary_values` - max_rating=1 and max_rating=10 both valid
32. `test_select_field_single_option` - Single option allowed
33. `test_text_field_max_length_boundary` - max_length=1 valid
34. `test_field_name_exactly_255_chars` - Name with exactly 255 chars valid

**Expected Coverage:** >95% (all validation branches covered)

---

## 📚 Reference

### Related Files

**Pydantic Schema Patterns:**
- `backend/app/schemas/tag.py` - Base/Create/Update/Response pattern
- `backend/app/schemas/video.py` - AfterValidator pattern, model_config

**ORM Model Reference:**
- `backend/app/models/custom_field.py` - Source of truth for field structure

**Design Documentation:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Master design

### Design Decisions

#### Decision 1: Literal Types vs Enum for field_type

**Chosen:** Literal Type

**Rationale:**
- ✅ Simpler JSON serialization (no `.value` needed)
- ✅ Better Pydantic integration (direct string validation)
- ✅ Clearer error messages
- ✅ Easier to use in validators

**REF MCP Evidence:** Pydantic docs recommend Literal for simple string unions

---

#### Decision 2: model_validator vs Custom __init__

**Chosen:** `model_validator(mode='after')`

**Rationale:**
- ✅ Pydantic-native approach
- ✅ Runs after field validation (guaranteed clean data)
- ✅ Better error handling
- ✅ Works with JSON schema generation

**REF MCP Evidence:** Pydantic v2 recommends validators over custom __init__

---

#### Decision 3: Duplicate Validation Logic in Update Schema

**Chosen:** Duplicate validation in Update schema

**Rationale:**
- ✅ Explicit and clear (each schema is self-contained)
- ✅ Easier to customize per schema if needed
- ❌ ~30 lines of duplicated code
- **Future:** Can extract to helper function if 3+ schemas need it

---

#### Decision 4: Config as Dict[str, Any] vs Typed Union

**Chosen:** Dict[str, Any] with runtime validation

**Rationale:**
- ✅ Matches ORM model (JSONB column stores any JSON)
- ✅ Future-proof (new field types won't break old schemas)
- ✅ Flexible for frontend experimentation
- ❌ Less type safety at Python level
- **Mitigation:** Runtime validation in `model_validator` ensures correctness

---

#### Decision 5: Include Full Field in DuplicateCheckResponse

**Chosen:** Return full CustomFieldResponse

**Rationale:**
- ✅ Better UX (frontend can show rich duplicate warning)
- ✅ User can see if existing field meets their needs
- ✅ Only ~100 extra bytes per response (negligible)

---

### REF MCP Validation Summary

**Query 1: Pydantic v2 best practices**
- `model_config = {...}` preferred over deprecated `Config` class
- `from_attributes=True` enables ORM model conversion
- **Applied:** Used `model_config` in CustomFieldResponse

**Query 2: Field validators**
- `model_validator(mode='after')` for cross-field validation
- **Applied:** Used for config validation

**Query 3: Literal vs Enum**
- Literal types simpler for small, fixed string sets
- **Applied:** Used `Literal['select', 'rating', 'text', 'boolean']`

**Query 4: JSONB validation**
- JSONB fields commonly use Dict[str, Any]
- Runtime validation with `model_validator` recommended
- **Applied:** Used Dict[str, Any] with runtime type guards

---

## ⏱️ Estimated Effort

### Implementation: 2-3 hours

**Breakdown:**
- Step 1-2 (Type definitions + Base schema): 45 min
- Step 3-7 (Remaining schemas): 30 min
- Step 8 (Exports): 5 min

### Testing: 1.5-2 hours

**Breakdown:**
- Create test file structure: 10 min
- Write 27 unit tests: 60 min
- Run tests and fix issues: 20 min
- Edge case testing: 10 min

### Documentation: 30 minutes

**Total: 4-5.5 hours**

---

## ✅ Completion Checklist

Before marking this task as complete:

- [ ] All 6 schemas created (Base, Create, Update, Response, DuplicateCheck×2)
- [ ] Field type validation using Literal type
- [ ] Config validation with runtime type guards
- [ ] All 27+ unit tests written and passing
- [ ] Test coverage >95%
- [ ] TypeScript check passes (0 new errors)
- [ ] Schemas exported in `__init__.py`
- [ ] Comprehensive docstrings (module, classes, validators)
- [ ] Inline comments for complex validation logic
- [ ] REF MCP sources cited in code comments
- [ ] Code follows existing patterns (tag.py, video.py)
- [ ] Ready for API endpoint implementation (Task #65)

---

## 🔗 Related Tasks

**Depends On:**
- ✅ Task #58: Database migration for custom fields system
- ✅ Task #59: CustomField ORM model

**Blocks:**
- Task #65: CustomField API endpoints (depends on these schemas)
- Task #66: FieldSchema Pydantic schemas (similar pattern)

---

**Plan Created:** 2025-11-06
**REF MCP Validated:** ✅ 4 sources consulted
**Ready for Implementation:** ✅ Yes
**Estimated Implementation Time:** 4-5.5 hours
