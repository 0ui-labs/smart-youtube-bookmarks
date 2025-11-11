# Task #73: Extract Field Value Validation Logic (Refactoring)

**Plan Task:** #73
**Wave/Phase:** Phase 1: MVP - Backend (Custom Fields System)
**Dependencies:** Task #72 (Batch update endpoint - ALREADY IMPLEMENTED with inline validation)
**Type:** REFACTORING (Extracting existing working code into reusable module)

---

## 🎯 Ziel

**WICHTIG:** Task #72 hat bereits funktionierende Validierungslogik inline implementiert (~60 Zeilen in `backend/app/api/videos.py:1294-1360`). Diese Task extrahiert diese Logik in ein wiederverwendbares Modul, um:

1. **DRY-Prinzip** zu folgen (Don't Repeat Yourself)
2. **Wiederverwendbarkeit** für zukünftige CRUD Endpoints zu ermöglichen
3. **Testbarkeit** zu verbessern (isolierte Validation Tests)
4. **Wartbarkeit** zu erhöhen (zentrale Validation Logic)

**Expected Result:**
- Central validation module `backend/app/api/field_validation.py` mit extrahierter Logik
- Task #72 Endpoint refactored um neues Modul zu nutzen
- Alle 11/11 bestehenden Task #72 Tests bleiben passing
- Zusätzliche isolierte Unit Tests für Validation Modul
- 100% backward-compatible (keine API-Änderungen)

---

## 📋 Acceptance Criteria

- [ ] Validation module erstellt: `backend/app/api/field_validation.py`
- [ ] `validate_field_value()` Funktion mit Logik aus Task #72 (Zeilen 1294-1360)
- [ ] `FieldValidationError` Custom Exception (simple ValueError subclass)
- [ ] Task #72 Endpoint refactored um Modul zu verwenden
- [ ] Alle 11/11 bestehenden Task #72 Tests passing nach Refactoring
- [ ] 20+ neue Unit Tests für isolierte Validation Logic
- [ ] Performance: < 1ms pro Field (bereits in Task #72 erreicht)
- [ ] Code Review: Subagent Grade A
- [ ] Documentation: CLAUDE.md updated mit Validation Pattern

---

## 🛠️ Implementation Steps

### Step 1: Extract Validation Logic into Module

**Files:** `backend/app/api/field_validation.py` (NEW FILE)

**Action:** Extrahiere die funktionierende Validation aus Task #72 in wiederverwendbares Modul

**Code:**
```python
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
        # Type check
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
        if max_len and len(value) > max_len:
            raise FieldValidationError(
                f"Text exceeds max length {max_len} ({len(value)} chars)"
            )

    else:
        # Unknown field type
        raise ValueError(
            f"Unknown field_type: '{field_type}'. "
            f"Must be one of: rating, select, text, boolean"
        )
```

**Why This Design:**

1. **EXACT Logic from Task #72:** Keine Änderungen an der Validierung selbst - nur Extraktion
2. **Simple Exception:** `FieldValidationError(ValueError)` ohne extra Attribute (YAGNI)
3. **field_name Parameter:** Optional für bessere Error Messages, aber nicht in Exception gespeichert
4. **No Batch Function:** Batch-Logic bleibt im Endpoint (Separation of Concerns)
5. **Performance:** < 1ms per field (bereits in Task #72 verifiziert)

**REF MCP Evidence:**
- Existing Task #72 code: Bewährte, getestete Validation Logic
- Python ValueError pattern: Standard für Validation Errors
- No database queries: Pure function validation

---

### Step 2: Refactor Task #72 Endpoint to Use Module

**Files:** `backend/app/api/videos.py` (MODIFY)

**Action:** Replace inline validation (lines 1294-1360) with module import

**BEFORE (Task #72 inline - 67 lines):**
```python
# === STEP 3: Validate values against field types (INLINE) ===
validation_errors = []
for update in request.field_values:
    field = fields[update.field_id]

    # Type compatibility and range checks
    if field.field_type == 'rating':
        if not isinstance(update.value, (int, float)):
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": f"Rating value must be numeric, got {type(update.value).__name__}"
            })
        # ... 60 more lines
```

**AFTER (Using module - 15 lines):**
```python
from app.api.field_validation import validate_field_value, FieldValidationError

# === STEP 3: Validate values against field types (MODULE) ===
validation_errors = []
for update in request.field_values:
    field = fields[update.field_id]

    try:
        validate_field_value(
            value=update.value,
            field_type=field.field_type,
            config=field.config,
            field_name=field.name
        )
    except FieldValidationError as e:
        validation_errors.append({
            "field_id": str(update.field_id),
            "field_name": field.name,
            "error": str(e)
        })
    except ValueError as e:
        # Unknown field_type
        validation_errors.append({
            "field_id": str(update.field_id),
            "field_name": field.name,
            "error": str(e)
        })

# If any validation failed, abort before database changes
if validation_errors:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "message": "Field value validation failed",
            "errors": validation_errors
        }
    )
```

**Why This Refactoring:**
- **-52 lines in videos.py:** Cleaner endpoint code
- **Backward compatible:** Same error format, same HTTP responses
- **Same behavior:** All 11/11 existing tests will pass
- **Better separation:** Validation logic decoupled from endpoint logic

**Verification Strategy:**
1. Run Task #72 tests BEFORE refactoring → 11/11 passing (baseline)
2. Apply refactoring
3. Run Task #72 tests AFTER refactoring → 11/11 passing (verify)
4. If any test fails → rollback and debug

---

### Step 3: Add Comprehensive Unit Tests for Validation Module

**Files:** `backend/tests/api/test_field_validation.py` (NEW FILE)

**Action:** Test isolated validation logic (independent of endpoint)

**Code:**
```python
"""
Unit tests for field value validation logic.

These tests verify the EXTRACTED validation logic from Task #72.
Tests are independent of the endpoint and database.
"""
import pytest
from app.api.field_validation import (
    validate_field_value,
    FieldValidationError
)


class TestRatingValidation:
    """Tests for rating field validation."""

    def test_valid_rating_integer(self):
        """Test valid integer rating within range."""
        validate_field_value(5, 'rating', {'max_rating': 5})
        validate_field_value(0, 'rating', {'max_rating': 5})
        validate_field_value(3, 'rating', {'max_rating': 5})
        # Should not raise

    def test_valid_rating_float(self):
        """Test valid float rating (e.g., 3.5 stars)."""
        validate_field_value(3.5, 'rating', {'max_rating': 5})
        validate_field_value(0.5, 'rating', {'max_rating': 5})
        # Should not raise

    def test_invalid_rating_exceeds_max(self):
        """Test rating value exceeds max_rating."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(6, 'rating', {'max_rating': 5})

        assert "between 0 and 5" in str(exc_info.value)

    def test_invalid_rating_negative(self):
        """Test negative rating value."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(-1, 'rating', {'max_rating': 5})

        assert "between 0 and" in str(exc_info.value)

    def test_invalid_rating_wrong_type(self):
        """Test rating value with wrong type (string)."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value('5', 'rating', {'max_rating': 5})

        assert "must be numeric" in str(exc_info.value)

    def test_rating_default_max(self):
        """Test rating uses default max_rating=5 if not in config."""
        validate_field_value(5, 'rating', {})  # No max_rating in config

        with pytest.raises(FieldValidationError):
            validate_field_value(6, 'rating', {})


class TestSelectValidation:
    """Tests for select field validation."""

    def test_valid_select_value(self):
        """Test valid select value in options list."""
        config = {'options': ['bad', 'good', 'great']}
        validate_field_value('good', 'select', config)
        validate_field_value('bad', 'select', config)
        validate_field_value('great', 'select', config)
        # Should not raise

    def test_invalid_select_value_not_in_options(self):
        """Test select value not in options list."""
        config = {'options': ['bad', 'good', 'great']}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value('invalid', 'select', config)

        error_msg = str(exc_info.value)
        assert "'invalid'" in error_msg
        assert "Valid options:" in error_msg

    def test_invalid_select_case_sensitive(self):
        """Test select validation is case-sensitive."""
        config = {'options': ['bad', 'good', 'great']}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value('Good', 'select', config)  # Capital G

        assert "'Good'" in str(exc_info.value)

    def test_invalid_select_wrong_type(self):
        """Test select value with wrong type (integer)."""
        config = {'options': ['bad', 'good', 'great']}
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(123, 'select', config)

        assert "must be string" in str(exc_info.value)

    def test_select_empty_options_list(self):
        """Test select with empty options list still validates type."""
        config = {'options': []}
        with pytest.raises(FieldValidationError):
            validate_field_value('anything', 'select', config)


class TestTextValidation:
    """Tests for text field validation."""

    def test_valid_text_without_max_length(self):
        """Test valid text value with no max_length constraint."""
        validate_field_value('Hello world', 'text', {})
        validate_field_value('A' * 10000, 'text', {})  # Very long text
        # Should not raise

    def test_valid_text_within_max_length(self):
        """Test valid text value within max_length."""
        validate_field_value('Hello', 'text', {'max_length': 10})
        validate_field_value('Hello', 'text', {'max_length': 5})  # Exactly at limit
        # Should not raise

    def test_invalid_text_exceeds_max_length(self):
        """Test text value exceeds max_length."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value('Hello world', 'text', {'max_length': 5})

        error_msg = str(exc_info.value)
        assert "exceeds max length 5" in error_msg
        assert "11 chars" in error_msg

    def test_invalid_text_wrong_type(self):
        """Test text value with wrong type (integer)."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(123, 'text', {'max_length': 10})

        assert "must be string" in str(exc_info.value)

    def test_valid_text_empty_string(self):
        """Test empty string is valid text."""
        validate_field_value('', 'text', {'max_length': 10})
        validate_field_value('', 'text', {})
        # Should not raise


class TestBooleanValidation:
    """Tests for boolean field validation."""

    def test_valid_boolean_true(self):
        """Test valid boolean True value."""
        validate_field_value(True, 'boolean', {})
        # Should not raise

    def test_valid_boolean_false(self):
        """Test valid boolean False value."""
        validate_field_value(False, 'boolean', {})
        # Should not raise

    def test_invalid_boolean_integer_1(self):
        """Test integer 1 is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(1, 'boolean', {})

        assert "must be true/false" in str(exc_info.value)

    def test_invalid_boolean_integer_0(self):
        """Test integer 0 is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value(0, 'boolean', {})

        assert "must be true/false" in str(exc_info.value)

    def test_invalid_boolean_string(self):
        """Test string 'true' is not valid boolean."""
        with pytest.raises(FieldValidationError) as exc_info:
            validate_field_value('true', 'boolean', {})

        assert "must be true/false" in str(exc_info.value)


class TestUnknownFieldType:
    """Tests for unknown field_type handling."""

    def test_unknown_field_type_raises_valueerror(self):
        """Test unknown field_type raises ValueError (not FieldValidationError)."""
        with pytest.raises(ValueError) as exc_info:
            validate_field_value(5, 'unknown_type', {})

        assert "Unknown field_type" in str(exc_info.value)
        assert "'unknown_type'" in str(exc_info.value)


class TestFieldNameInErrors:
    """Tests for field_name parameter in error messages."""

    def test_field_name_included_in_error(self):
        """Test field_name parameter is used for context (optional)."""
        # Note: field_name is parameter but not stored in exception
        # Just verify validation still works with field_name
        with pytest.raises(FieldValidationError):
            validate_field_value(
                10,
                'rating',
                {'max_rating': 5},
                field_name='Overall Rating'
            )
```

**Why These Tests:**
- **Independent of endpoint:** Test validation logic in isolation
- **Fast execution:** No database, no FastAPI TestClient
- **Comprehensive coverage:** All 4 field types + edge cases
- **Regression prevention:** Ensure refactoring doesn't break validation
- **Documentation:** Tests serve as usage examples

**Test Count:** 23 tests total
- Rating: 6 tests
- Select: 5 tests
- Text: 5 tests
- Boolean: 5 tests
- Unknown type: 1 test
- Field name: 1 test

---

### Step 4: Add Performance Benchmark Tests

**Files:** `backend/tests/api/test_field_validation.py` (ADD TO EXISTING)

**Action:** Verify < 1ms per field target (realistic batch scenario)

**Code:**
```python
import time


class TestPerformance:
    """Performance tests for validation logic."""

    def test_validation_performance_batch_50_fields(self):
        """
        Test realistic batch scenario: 50 field validations.

        This simulates the max batch size from Task #72 endpoint.
        Target: < 50ms total (< 1ms average per field)
        """
        # Simulate 50 field updates (max batch size)
        fields_config = [
            ('rating', {'max_rating': 5}, 4),
            ('select', {'options': ['a', 'b', 'c']}, 'b'),
            ('text', {'max_length': 100}, 'Hello'),
            ('boolean', {}, True),
        ]

        # Create 50 validations (cycling through 4 types)
        validations = []
        for i in range(50):
            field_type, config, value = fields_config[i % 4]
            validations.append((value, field_type, config))

        # Benchmark
        start = time.perf_counter()
        for value, field_type, config in validations:
            validate_field_value(value, field_type, config)
        end = time.perf_counter()

        total_time_ms = (end - start) * 1000
        avg_time_ms = total_time_ms / 50

        assert total_time_ms < 50.0, \
            f"Batch validation {total_time_ms:.3f}ms exceeds 50ms target"
        assert avg_time_ms < 1.0, \
            f"Avg validation {avg_time_ms:.3f}ms exceeds 1ms target"

    def test_validation_performance_single_field(self):
        """Test single field validation completes in < 1ms."""
        iterations = 1000

        start = time.perf_counter()
        for _ in range(iterations):
            validate_field_value(3, 'rating', {'max_rating': 5})
        end = time.perf_counter()

        avg_time_ms = ((end - start) / iterations) * 1000
        assert avg_time_ms < 1.0, \
            f"Avg validation time {avg_time_ms:.3f}ms exceeds 1ms target"
```

**Why These Performance Tests:**
- **Realistic scenario:** 50 fields = max batch size from Task #72
- **Target verified:** < 1ms per field (< 50ms total for batch)
- **No database:** Pure in-memory validation speed
- **Regression detection:** Alerts if validation becomes slow

---

### Step 5: Verify All Task #72 Tests Still Pass

**Action:** Run existing Task #72 test suite to verify refactoring didn't break anything

**Commands:**
```bash
cd backend

# Run Task #72 specific tests
pytest tests/api/test_video_field_values.py -v

# Expected: 11/11 tests passing (same as before refactoring)
# - test_batch_update_create_new_values
# - test_batch_update_update_existing_values
# - test_batch_update_mixed_create_and_update
# - test_batch_update_video_not_found
# - test_batch_update_invalid_field_id
# - test_batch_update_duplicate_field_ids
# - test_batch_update_invalid_rating_value
# - test_batch_update_invalid_select_value
# - test_batch_update_validation_atomic_rollback
# - test_batch_update_empty_request
# - test_batch_update_exceeds_max_batch_size
```

**Success Criteria:**
- ✅ All 11/11 tests passing
- ✅ Same error messages as before
- ✅ Same HTTP status codes
- ✅ Same response format

**If Tests Fail:**
1. Check import statement in videos.py
2. Verify exception handling (FieldValidationError → validation_errors list)
3. Compare error message format (must match original)
4. Rollback refactoring and debug in isolation

---

### Step 6: Run New Validation Module Tests

**Action:** Run new isolated validation tests

**Commands:**
```bash
cd backend

# Run new validation module tests
pytest tests/api/test_field_validation.py -v

# Expected: 25/25 tests passing
# - 6 rating tests
# - 5 select tests
# - 5 text tests
# - 5 boolean tests
# - 1 unknown type test
# - 1 field name test
# - 2 performance tests

# Run with coverage
pytest tests/api/test_field_validation.py --cov=app.api.field_validation --cov-report=term-missing

# Target: 100% line coverage (validation module is small and linear)
```

---

### Step 7: Update CLAUDE.md Documentation

**Files:** `CLAUDE.md`

**Action:** Document the validation pattern for future reference

**Code:**
```markdown
### Custom Field Value Validation

**Validation Module:** `backend/app/api/field_validation.py`

All custom field values are validated before persisting to database.

**Validation Rules:**

| Field Type | Validation Rules | Example |
|------------|------------------|---------|
| **rating** | `0 <= value <= config['max_rating']` (default: 5) | If max_rating=5, valid: 0-5 |
| **select** | `value in config['options']` (case-sensitive) | If options=['bad','good','great'], valid: 'good' |
| **text** | `len(value) <= config.get('max_length', ∞)` | If max_length=500, valid: strings ≤ 500 chars |
| **boolean** | `isinstance(value, bool)` (strict, not truthy) | Valid: True, False (not 1, 0, 'true') |

**Usage Pattern:**

```python
from app.api.field_validation import validate_field_value, FieldValidationError

try:
    validate_field_value(
        value=5,
        field_type='rating',
        config={'max_rating': 5},
        field_name='Overall Rating'  # Optional, for context
    )
except FieldValidationError as e:
    # Handle validation error
    return {"error": str(e)}
```

**Performance:**
- Single field: < 1ms (no database queries)
- Batch of 50: < 50ms (verified with benchmark tests)

**Testing:**
- 23 unit tests covering all validation paths
- 2 performance tests verifying speed targets
- Validation module tests: `backend/tests/api/test_field_validation.py`

**Integration:**
- Task #72: Batch update endpoint uses validation module
- Future CRUD endpoints: Should reuse same validation

**Implementation Note:**
Extracted from Task #72 inline validation (videos.py:1294-1360) in Task #73.
Original inline logic was production-tested with 11/11 passing tests.
```

---

### Step 8: TypeScript Check and Commit

**Action:** Verify no breaking changes, commit refactored code

**Commands:**
```bash
# Backend: Python syntax check
cd backend
python -m py_compile app/api/field_validation.py

# Backend: Run ALL tests (Task #72 + new validation tests)
pytest tests/api/test_video_field_values.py tests/api/test_field_validation.py -v

# Frontend: Type check (verify no breaking changes)
cd ../frontend
npx tsc --noEmit

# Commit
cd ..
git add -A
git commit -m "refactor(validation): extract field value validation into reusable module

- Extract validation logic from Task #72 inline code (videos.py:1294-1360)
- Create field_validation.py module with validate_field_value() function
- Add FieldValidationError custom exception (simple ValueError subclass)
- Refactor Task #72 endpoint to use validation module (-52 lines)
- Add 23 unit tests for isolated validation logic (100% coverage)
- Add 2 performance tests (< 1ms per field, < 50ms for 50 fields)
- Update CLAUDE.md with validation pattern documentation

Validation Logic (unchanged from Task #72):
- rating: 0 <= value <= max_rating (default 5)
- select: value in options (case-sensitive)
- text: len(value) <= max_length (optional)
- boolean: strict bool type check (not truthy/falsy)

Performance (verified):
- Single field: < 1ms (pure in-memory validation)
- Batch of 50: < 50ms (max batch size from Task #72)
- Zero database queries (pure function validation)

Backward Compatibility:
- All 11/11 Task #72 tests passing after refactoring
- Same error messages and HTTP status codes
- Same API response format (no breaking changes)

Benefits:
- DRY principle: Validation logic reusable for future endpoints
- Better testability: 23 isolated unit tests independent of endpoint
- Improved maintainability: Central validation logic (single source of truth)
- Cleaner endpoint code: -52 lines in videos.py

REF MCP Best Practices:
- Python ValueError pattern for validation errors
- Simple exception hierarchy (no over-engineering)
- Extracted working code (not reimplemented)
- Performance benchmarks verify targets

Task #73 (Custom Fields System Phase 1) - REFACTORING

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### 1. Regression Tests (Task #72)

**Purpose:** Verify refactoring didn't break existing functionality

**Tests:** 11 existing tests in `test_video_field_values.py`
- 3 Happy path tests
- 5 Validation error tests
- 3 Edge case tests

**Success Criteria:** All 11/11 passing (same as before refactoring)

### 2. Unit Tests (New Validation Module)

**Purpose:** Test isolated validation logic

**Tests:** 23 new tests in `test_field_validation.py`
- Rating: 6 tests (valid int/float, invalid range/type)
- Select: 5 tests (valid option, invalid option/type/case)
- Text: 5 tests (valid length, invalid length/type, empty)
- Boolean: 5 tests (valid True/False, invalid int/string)
- Unknown type: 1 test
- Field name: 1 test

**Coverage Target:** 100% line coverage (module is small and linear)

### 3. Performance Tests

**Purpose:** Verify < 1ms per field target

**Tests:** 2 performance tests
- Batch scenario: 50 fields < 50ms total
- Single field: < 1ms average over 1000 iterations

### 4. Manual Integration Test

**Purpose:** Verify end-to-end flow still works

**Steps:**
1. Start backend server: `uvicorn app.main:app --reload`
2. Create test video with field values via Swagger UI
3. Update field values with invalid data → expect 422 error
4. Update field values with valid data → expect 200 success
5. Verify error messages match original format

---

## 📚 Reference

### Related Code

**Task #72 Implementation (baseline):**
- `backend/app/api/videos.py` lines 1294-1360 (inline validation to be extracted)
- `backend/tests/api/test_video_field_values.py` (11 tests, all must pass after refactoring)

**Existing Patterns:**
- `backend/app/schemas/video.py` lines 19-58 - Similar validation pattern (validate_youtube_url)

**REF MCP Validation:**
- Python ValueError pattern: Standard for validation errors
- FastAPI exception handling: HTTPException with detail
- SQLAlchemy session management: No queries in validation (pure function)

---

## 🎯 Design Decisions

### Decision 1: Simple FieldValidationError (No Extra Attributes)

**Alternatives:**
- A. Store field_type, config, field_name in exception ❌
- B. Simple ValueError subclass with just message ✅ (CHOSEN)

**Rationale:**
- **YAGNI:** Extra attributes werden nirgends genutzt
- **Einfachheit:** `str(e)` reicht für Error Message
- **Konsistenz:** Matching Task #72 pattern (nur Message in error dict)

**Code:**
```python
# Simple approach (chosen)
class FieldValidationError(ValueError):
    pass

raise FieldValidationError("Rating must be between 0 and 5")

# vs Complex approach (rejected)
class FieldValidationError(ValueError):
    def __init__(self, message, field_type, config):
        self.field_type = field_type  # Not used anywhere
        self.config = config  # Not used anywhere
        super().__init__(message)
```

---

### Decision 2: No Batch Validation Function

**Alternatives:**
- A. Add `validate_field_values_batch()` helper function ❌
- B. Keep batch logic in endpoint, only extract single-field validation ✅ (CHOSEN)

**Rationale:**
- **Separation of Concerns:** Validation kennt einzelne Werte, Endpoint organisiert Batch
- **Avoid Duplication:** Batch-Loop ist bereits optimal in Task #72
- **Simplicity:** Weniger Code im Modul = einfacher zu testen

**Code:**
```python
# Endpoint keeps batch logic (chosen)
validation_errors = []
for update in request.field_values:
    try:
        validate_field_value(...)  # Single field
    except FieldValidationError as e:
        validation_errors.append(...)

# vs Batch function in module (rejected)
def validate_field_values_batch(updates, fields):
    # Duplicate loop logic from endpoint
    # Tight coupling to endpoint's data structures
    # Harder to test independently
```

---

### Decision 3: Extract Exact Logic (No Improvements)

**Alternatives:**
- A. Extract AND improve validation (add config checks, defensive validation) ❌
- B. Extract EXACT logic from Task #72 without changes ✅ (CHOSEN)

**Rationale:**
- **Risk Minimization:** Keine Änderungen = keine neuen Bugs
- **Verified Logic:** Task #72 validation ist bereits production-tested (11/11 tests)
- **Refactoring vs Rewrite:** Dies ist Refactoring, nicht Feature-Entwicklung
- **Backward Compatibility:** Garantiert dass Task #72 Tests weiterhin passen

**Example:**
```python
# EXACT extraction (chosen)
if field_type == 'rating':
    if not isinstance(value, (int, float)):
        raise FieldValidationError(...)
    max_rating = config.get('max_rating', 5)  # Same default
    if value < 0 or value > max_rating:
        raise FieldValidationError(...)

# vs Improved version (rejected for this task)
if field_type == 'rating':
    # Defensive: validate config first
    if 'max_rating' not in config:
        raise ValueError("Config missing max_rating")
    if not isinstance(config['max_rating'], (int, float)):
        raise ValueError("Invalid max_rating type")
    # Then validate value...
```

**Future:** Improvements können in separater Task gemacht werden (nicht in Refactoring)

---

### Decision 4: Performance Tests with Realistic Batch Size

**Alternatives:**
- A. Test with 1000 iterations (original plan) ❌
- B. Test with 50 fields (max batch size from Task #72) ✅ (CHOSEN)

**Rationale:**
- **Realistic Scenario:** 50 fields ist die tatsächliche Batch-Größe aus Task #72
- **Request Context:** Validation passiert im Request-Lifecycle, nicht in Loop
- **Meaningful Target:** < 50ms total für 50 Felder ist aussagekräftig
- **Regression Detection:** Warnt bei Performance-Problemen unter realen Bedingungen

**Code:**
```python
# Realistic batch test (chosen)
def test_validation_performance_batch_50_fields():
    """Simulate max batch size from Task #72."""
    validations = [(value, type, config) for _ in range(50)]

    start = time.perf_counter()
    for value, field_type, config in validations:
        validate_field_value(value, field_type, config)
    end = time.perf_counter()

    total_ms = (end - start) * 1000
    assert total_ms < 50.0  # < 50ms total
    assert (total_ms / 50) < 1.0  # < 1ms average

# vs Unrealistic iteration test (rejected)
def test_validation_performance_1000_iterations():
    """Not representative of actual usage."""
    for _ in range(1000):
        validate_field_value(3, 'rating', {'max_rating': 5})
    # Doesn't simulate request context or mixed field types
```

---

### Decision 5: field_name Parameter (Optional for Better Errors)

**Alternatives:**
- A. No field_name parameter ❌
- B. Required field_name parameter ❌
- C. Optional field_name parameter with default "(unnamed)" ✅ (CHOSEN)

**Rationale:**
- **Flexibility:** Caller kann field_name übergeben für bessere Error Messages
- **Not Required:** Function funktioniert auch ohne (default "(unnamed)")
- **Not Stored:** field_name wird NICHT in Exception gespeichert (YAGNI)
- **Better DX:** Developer Experience - optionaler Context für Debugging

**Code:**
```python
# Optional parameter (chosen)
def validate_field_value(
    value: Any,
    field_type: str,
    config: dict,
    field_name: str = "(unnamed)"  # Optional
) -> None:
    # field_name can be used in error messages if needed
    # But not stored in exception (YAGNI)
    pass

# Usage
validate_field_value(5, 'rating', {'max_rating': 5})  # OK without name
validate_field_value(5, 'rating', {'max_rating': 5}, 'Overall Rating')  # OK with name
```

---

## 🚨 Risk Mitigation

### Risk 1: Refactoring Breaks Task #72 Tests

**Risk:** Changing endpoint code könnte Tests brechen

**Mitigation:**
- ✅ Run Task #72 tests BEFORE refactoring (establish baseline)
- ✅ Extract EXACT logic (no improvements/changes)
- ✅ Verify error message format matches original
- ✅ Run Task #72 tests AFTER refactoring (verify 11/11 passing)
- ✅ Rollback strategy prepared (git revert if tests fail)

**Verification:**
```bash
# Before refactoring
pytest tests/api/test_video_field_values.py -v  # Baseline: 11/11 passing

# After refactoring
pytest tests/api/test_video_field_values.py -v  # Must: 11/11 passing
```

---

### Risk 2: Import Circular Dependencies

**Risk:** Validation module imports could cause circular imports

**Mitigation:**
- ✅ Validation module is LEAF module (no imports from app.api)
- ✅ Only imports from typing (standard library)
- ✅ Endpoint imports from validation module (one-way dependency)
- ✅ No database imports (pure validation logic)

**Dependency Graph:**
```
videos.py (endpoint)
    ↓ imports
field_validation.py (validation)
    ↓ imports
typing (stdlib) + nothing else

# No circular dependency possible
```

---

### Risk 3: Performance Regression

**Risk:** Extracted function could be slower than inline

**Mitigation:**
- ✅ Benchmark tests verify < 1ms per field (< 50ms for 50 fields)
- ✅ Pure function with no database queries (same as inline)
- ✅ Function call overhead negligible (< 0.001ms)
- ✅ Performance tests fail if regression detected

**Evidence:**
- Inline validation in Task #72: < 1ms per field (verified)
- Function call overhead: ~0.0001ms (negligible)
- Expected performance: Identical to inline (pure function extraction)

---

## ⏱️ Estimated Time

**Total: 1.5-2 hours** (significantly faster than original 2-3h estimate)

**Breakdown:**
- Step 1: Extract validation module (30 min)
  - Copy logic from Task #72
  - Add imports and docstrings
  - Create FieldValidationError exception
- Step 2: Refactor Task #72 endpoint (15 min)
  - Replace inline validation with module import
  - Update exception handling
  - Verify error format matches
- Step 3: Create unit tests (30 min)
  - 23 tests covering all field types
  - Edge cases and error messages
- Step 4: Add performance tests (10 min)
  - Batch scenario test
  - Single field test
- Step 5-8: Verification, docs, commit (15 min)
  - Run Task #72 tests
  - Run new validation tests
  - Update CLAUDE.md
  - Git commit

**Why Faster than Original Plan:**
- ✅ No `validate_field_values_batch()` function needed
- ✅ Simple FieldValidationError (no extra attributes)
- ✅ Extracting working code (not implementing new logic)
- ✅ Fewer tests needed (23 vs 30+ in original plan)

**Subagent-Driven Development:** Recommended
- Fresh subagent for extraction + refactoring
- Code review after refactoring to verify backward compatibility

---

## 📝 Notes

### REF MCP Findings (2025-11-09)

**Consulted Documentation:**
- ✅ FastAPI validation patterns
- ✅ Python custom exception hierarchy
- ✅ SQLAlchemy session management (no queries in validation)

**Key Findings:**
1. **Task #72 Already Complete:** Inline validation production-ready (11/11 tests passing)
2. **ValueError Pattern:** Standard Python pattern for validation errors
3. **No Database Queries:** Pure function validation (< 1ms per field)
4. **Backward Compatibility:** Must preserve exact error message format

**Improvements Applied:**
1. **Refactoring Focus:** Treat as extraction, not reimplementation
2. **No Batch Function:** Keep batch logic in endpoint (Separation of Concerns)
3. **Simple Exception:** No YAGNI attributes in FieldValidationError
4. **Realistic Performance Tests:** 50 fields (max batch size) not 1000 iterations
5. **Verification Strategy:** Run Task #72 tests before/after to ensure no regression

---

### Comparison: Original Plan vs Updated Plan

| Aspect | Original Plan | Updated Plan | Why Changed |
|--------|---------------|--------------|-------------|
| **Approach** | Implement new validation | Extract existing validation | Task #72 already implemented |
| **Batch Function** | `validate_field_values_batch()` | No batch function | YAGNI - endpoint has batch logic |
| **Exception** | FieldValidationError with attributes | Simple ValueError subclass | YAGNI - attributes not used |
| **Performance Test** | 1000 iterations | 50 fields batch | Realistic scenario |
| **Integration** | "Verification" | "Refactor Task #72" | Reflects actual work needed |
| **Estimated Time** | 2-3 hours | 1.5-2 hours | Simpler scope, no new logic |

---

### Success Criteria Summary

**Must Have:**
- ✅ Validation module created with extracted logic
- ✅ Task #72 refactored to use module
- ✅ All 11/11 Task #72 tests passing after refactoring
- ✅ 23+ new unit tests for validation module
- ✅ Performance < 1ms per field verified
- ✅ No breaking changes (backward compatible)

**Nice to Have:**
- ✅ 100% line coverage on validation module
- ✅ CLAUDE.md updated with validation pattern
- ✅ Code review Grade A

---

**Plan Updated:** 2025-11-09 11:44 CET
**REF MCP Validated:** 2025-11-09 (FastAPI, Python, SQLAlchemy patterns)
**Ready for Implementation:** ✅ (Subagent-Driven Development recommended)
