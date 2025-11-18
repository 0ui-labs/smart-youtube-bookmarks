# Task #76: Write Backend Unit Tests (Duplicate Check, Validation, Union Logic, Conflict Resolution)

**Plan Task:** #76
**Wave/Phase:** Phase 1 - Backend Data Layer (Custom Fields System)
**Dependencies:** Task #64 (CustomField Pydantic Schemas) ✅ Completed, Task #65 (FieldSchema Pydantic Schemas) ✅ Completed, Task #62 (VideoFieldValue Model) ✅ Completed

---

## 🎯 Ziel

Create comprehensive unit test suite for Custom Fields business logic, covering Pydantic validation, duplicate checking, field value validation, multi-tag union logic, and conflict resolution. Tests should be fast, isolated (no database), and follow TDD principles to guide API endpoint implementation (Tasks #66-73).

**Expected Outcome:** 95%+ code coverage for all Custom Fields business logic, with complete test suite for helpers, validators, and union algorithms before endpoints are implemented.

---

## 📋 Acceptance Criteria

- [ ] **Pydantic Schema Tests** (ALREADY COMPLETE - Tasks #64-65)
  - [x] CustomField schemas: 35+ tests ✅ EXISTS at `backend/tests/schemas/test_custom_field.py`
  - [x] FieldSchema schemas: 20+ tests ✅ EXISTS at `backend/tests/schemas/test_field_schema.py`
  - [x] All field types tested: select, rating, text, boolean
  - [x] Edge cases: boundary values, empty configs, invalid types

- [ ] **Duplicate Check Logic Tests** (NEW - 8 tests)
  - [ ] Case-insensitive duplicate detection
  - [ ] Whitespace normalization before comparison
  - [ ] Duplicate found vs not found scenarios
  - [ ] Edge cases: unicode characters, special characters, emojis

- [ ] **Field Value Validation Tests** (NEW - 18 tests)
  - [ ] Select field: valid option vs invalid option
  - [ ] Rating field: boundary conditions (1, max_rating, out of range)
  - [ ] Text field: max_length enforcement (optional constraint)
  - [ ] Boolean field: true/false values only
  - [ ] Type mismatch errors (string for rating, int for text, etc.)
  - [ ] Null/None value handling for optional fields

- [ ] **Multi-Tag Union Logic Tests** (NEW - 11 tests)
  - [ ] Single tag with schema → fields displayed
  - [ ] Multiple tags with same schema → deduplicate fields
  - [ ] Multiple tags with different schemas → union all fields
  - [ ] No tags → empty fields list
  - [ ] Tag with no schema → empty fields list
  - [ ] Empty schema (no fields) → empty fields list
  - [ ] Field value inclusion when exists vs null when not set
  - [ ] Correct typed column used for each field type

- [ ] **Conflict Resolution Tests** (NEW - 10 tests)
  - [ ] Same name + same type → show once (deduplication)
  - [ ] Same name + different type → prefix with schema name
  - [ ] Multiple conflicts in same video → all prefixed correctly
  - [ ] No conflicts → original field names preserved
  - [ ] Display order preservation after conflict resolution
  - [ ] Value priority (first tag's schema wins for duplicates)

- [ ] **Test Quality Standards**
  - [ ] All tests use pytest parametrize for exhaustive coverage
  - [ ] Clear test names following `test_<function>_<scenario>_<expected>` pattern
  - [ ] Comprehensive docstrings explaining what/why
  - [ ] Fixtures for common test data (fields, schemas, videos)
  - [ ] No database access (pure unit tests, mocks for DB queries)
  - [ ] Fast execution (<1s for entire unit test suite)

- [ ] **Coverage Requirements**
  - [ ] 95%+ line coverage for new helper modules
  - [ ] 90%+ branch coverage for conditional logic
  - [ ] pytest-cov report generated with missing lines highlighted

---

## 🛠️ Implementation Steps

### 1. Create Test File Structure

**Files:** 
- `backend/tests/helpers/__init__.py` (new)
- `backend/tests/helpers/test_duplicate_check.py` (new)
- `backend/tests/helpers/test_field_value_validator.py` (new)
- `backend/tests/helpers/test_field_union.py` (new)
- `backend/tests/helpers/test_conflict_resolution.py` (new)

**Action:** Create new test directory for helper module tests.

```bash
mkdir -p backend/tests/helpers
touch backend/tests/helpers/__init__.py
```

---

### 2. Duplicate Check Tests (8 tests)

**File:** `backend/tests/helpers/test_duplicate_check.py`

**Test Groups:**
1. Case-Insensitive Detection (4 tests)
   - Exact match
   - Case variations (lowercase, uppercase, mixed)
   - Leading/trailing whitespace normalization
   - No duplicate found

2. Edge Cases (4 tests)
   - Unicode characters (German umlauts, etc.)
   - Special characters (parentheses, hyphens)
   - Emoji in field name
   - Different list_id scoping

**Key Pattern:** Mock database query results, test pure string comparison logic

---

### 3. Field Value Validation Tests (18 tests)

**File:** `backend/tests/helpers/test_field_value_validator.py`

**Test Groups:**
1. Select Field (4 tests)
   - Valid option from config
   - Invalid option not in config
   - Case-sensitive validation
   - Type validation (rejects non-string)

2. Rating Field (6 tests)
   - Valid values within 1 to max_rating
   - Below minimum (0)
   - Above maximum
   - Boundary edge cases
   - Type validation (rejects non-integer)
   - Negative values rejected

3. Text Field (5 tests)
   - Valid without max_length
   - Valid within max_length
   - Exceeds max_length rejected
   - Empty string allowed
   - Type validation (rejects non-string)

4. Boolean Field (3 tests)
   - Valid true/false values
   - Type validation (rejects non-boolean)
   - Truthy/falsy values not accepted

**Key Pattern:** Use `@pytest.mark.parametrize` for exhaustive type testing

---

### 4. Multi-Tag Union Logic Tests (11 tests)

**File:** `backend/tests/helpers/test_field_union.py`

**Test Groups:**
1. Basic Union Logic (6 tests)
   - Single tag with single schema
   - Multiple tags with same schema (deduplication)
   - Multiple tags with different schemas (union)
   - Video with no tags
   - Tag with no schema
   - Schema with no fields

2. Field Value Inclusion (3 tests)
   - Field value included when exists
   - Field value null when not set
   - Correct typed column used (value_text/numeric/boolean)

3. Display Order Preservation (2 tests)
   - Fields ordered by display_order
   - Multiple schemas ordered by schema then display_order

**Key Pattern:** Mock SQLAlchemy relationships, test 4-step union algorithm

---

### 5. Conflict Resolution Tests (10 tests)

**File:** `backend/tests/helpers/test_conflict_resolution.py`

**Test Groups:**
1. Same Name + Same Type (3 tests)
   - Show once (deduplication)
   - Uses first tag's field
   - Three schemas with same field

2. Same Name + Different Type (5 tests)
   - Both fields get schema prefix
   - Multiple conflicts all prefixed
   - Conflict and non-conflict mixed
   - Case-insensitive conflict detection
   - Prefix format: "Schema Name: Field Name"

**Key Pattern:** Test conflict detection algorithm, verify prefix logic

---

### 6. Create Test Fixtures

**File:** `backend/tests/conftest.py` (append)

**Fixtures to Add:**
- `test_custom_field` - Single test field (rating type)
- `test_field_schema` - Single test schema
- `custom_field_factory` - Factory for creating multiple fields

---

## 🧪 Testing Strategy

### Coverage Measurement

```bash
# Run tests with coverage
pytest backend/tests/helpers/ \
  --cov=app/helpers \
  --cov-report=html \
  --cov-report=term-missing \
  --cov-fail-under=95

# Expected coverage: 96%+ line coverage, 92%+ branch coverage
```

### Test Execution Speed

```bash
# Run with timing
pytest backend/tests/helpers/ --durations=10

# Expected: All tests complete in <1 second total (no database)
```

### Meta-Testing (Optional)

```bash
# Mutation testing to verify test quality
pip install mutpy
mutpy --target app/helpers/duplicate_check.py \
      --unit-test backend/tests/helpers/test_duplicate_check.py \
      --runner pytest
```

---

## 📚 Reference

### REF MCP Research Findings

**Pydantic Validation Testing:**
- Pattern: Use `pytest.raises(ValidationError)` to test validators
- Check error messages: `str(exc_info.value)`
- Test both `@field_validator` and `@model_validator`

**pytest Parametrize:**
- Pattern: `@pytest.mark.parametrize("param", [val1, val2])`
- Benefit: Exhaustive coverage with single test function
- Example: Test all 4 field types with one test

**Async Testing:**
- Pattern: `@pytest.mark.asyncio` for async test functions
- Mock: Use `AsyncMock()` for async DB queries
- Important: AsyncClient for API tests (Task #77)

---

### Design Decisions

**1. Unit Tests vs Integration Tests**

**Chosen:** Separate unit tests (Task #76) from integration tests (Task #77)

**Rationale:**
- Speed: Unit tests <1s, integration tests 10-30s
- TDD: Unit tests written BEFORE endpoints
- Isolation: Pinpoint exact logic errors
- Coverage: 95%+ achievable with unit tests

---

**2. Mock Strategy for SQLAlchemy**

**Chosen:** Mock query results, not individual methods

```python
# DON'T mock every method
mock_db.query.return_value.filter.return_value.first.return_value = field

# DO mock final result
mock_result = MagicMock()
mock_result.scalar_one_or_none.return_value = field
mock_db.execute.return_value = mock_result
```

**Rationale:** Less brittle, clearer intent, easier maintenance

---

**3. Parametrize for Field Types**

**Chosen:** Use `@pytest.mark.parametrize` for all 4 field types

```python
@pytest.mark.parametrize("field_type,config,valid_value", [
    ("select", {"options": ["a", "b"]}, "a"),
    ("rating", {"max_rating": 5}, 3),
    ("text", {"max_length": 100}, "hello"),
    ("boolean", {}, True),
])
def test_field_value_validation(field_type, config, valid_value):
    # Single test covers all 4 types
```

**Rationale:** Exhaustive, DRY, maintainable

---

**4. Test Organization**

**Chosen:** 4 separate test files for 4 helper modules

```
backend/tests/helpers/
├── test_duplicate_check.py       (8 tests)
├── test_field_value_validator.py (18 tests)
├── test_field_union.py           (11 tests)
└── test_conflict_resolution.py   (10 tests)
```

**Rationale:** Clear separation, parallel execution, failure isolation

---

## Coverage Targets

| Module | Line Coverage | Branch Coverage | Tests |
|--------|--------------|----------------|-------|
| duplicate_check | 98%+ | 95%+ | 8 |
| field_value_validator | 97%+ | 92%+ | 18 |
| field_union | 96%+ | 90%+ | 11 |
| conflict_resolution | 95%+ | 90%+ | 10 |
| **TOTAL** | **96%+** | **92%+** | **47** |

---

## Implementation Checklist

### Phase 1: Setup (10 min)
- [ ] Create `backend/tests/helpers/` directory
- [ ] Create `backend/tests/helpers/__init__.py`
- [ ] Add fixtures to `backend/tests/conftest.py`
- [ ] Verify pytest discovers new directory

### Phase 2: Duplicate Check (30 min)
- [ ] Write 4 case-insensitive detection tests
- [ ] Write 4 edge case tests
- [ ] Run tests (expect import errors)

### Phase 3: Field Value Validation (60 min)
- [ ] Write 4 select field tests
- [ ] Write 6 rating field tests
- [ ] Write 5 text field tests
- [ ] Write 3 boolean field tests
- [ ] Use parametrize for type checking

### Phase 4: Union Logic (45 min)
- [ ] Write 6 basic union tests
- [ ] Write 3 field value inclusion tests
- [ ] Write 2 display order tests
- [ ] Mock SQLAlchemy relationships

### Phase 5: Conflict Resolution (45 min)
- [ ] Write 3 deduplication tests
- [ ] Write 5 conflict tests
- [ ] Write 2 mixed scenario tests
- [ ] Verify prefix format

### Phase 6: Verification (15 min)
- [ ] Run full suite: `pytest backend/tests/helpers/ -v`
- [ ] Verify 47 tests discovered
- [ ] Generate coverage report
- [ ] Review test names and docstrings
- [ ] Commit test files (TDD: tests before implementation)

---

**Estimated Duration:** 3-4 hours

**Ready for:** Immediate implementation (Tasks #64-65 complete)

**Enables:** Tasks #66-73 (API endpoints) with TDD guidance

**Next Steps:**
1. Implement this task (write tests first)
2. Implement helper modules to make tests pass
3. Task #77: Integration tests with real database
4. Tasks #66-73: API endpoints guided by these tests

---

**Notes:**
- Schema tests (Tasks #64-65) complete with 55+ tests ✅
- Focus on business logic (helpers, validators)
- Integration tests (Task #77) test API + DB
- TDD: Tests → fail → implement → pass
