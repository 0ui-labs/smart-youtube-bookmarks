# Task #132: Update All Pydantic Schemas with Validation

**Status:** 🔴 Not Started  
**Priority:** P1 (Security - Input Validation)  
**Estimated Effort:** 4-6 hours  
**Parent Task:** Task #5 - Input Validation & ReDoS Protection  
**Related:** Task #131 (sanitize_string applied to endpoints)

---

## 🎯 Goal

Update ALL Pydantic schemas across the backend to use the centralized validation module (`backend/app/utils/validation.py`) consistently, ensuring comprehensive input validation with security protections (ReDoS prevention, length limits, sanitization).

**Success Criteria:**
- ✅ Every Create/Update schema has appropriate field validators
- ✅ All text fields use `sanitize_string()` with appropriate max_length
- ✅ All URL fields use `validate_youtube_url()`
- ✅ All validation rules are documented in docstrings
- ✅ Comprehensive test coverage for validation edge cases
- ✅ No regressions in existing functionality

---

## 📋 Current State Analysis

### Existing Validation (Good Examples)

**✅ video.py (Lines 24-66):**
- Has `validate_youtube_url()` with comprehensive security checks
- Uses `AfterValidator` with Field constraints
- **Issue:** Uses local function, not centralized validation module

**✅ custom_field.py (Lines 173-180, 257-266):**
- Has `strip_name` validator for name fields
- Uses `field_validator` with `@classmethod`
- **Issue:** No max_length enforcement, no sanitization

**✅ field_schema.py (Lines 150-228):**
- Has multiple validation layers (show_on_card_limit, no duplicate IDs)
- Good error messages with context
- **Issue:** No text sanitization

**✅ tag.py (Lines 8-10, 18-19):**
- Has max_length constraints on name (100 chars)
- Has regex pattern for color validation
- **Issue:** No sanitization, no strip whitespace

**⚠️ list.py (Lines 7-16):**
- Has min_length/max_length on Field()
- **Issue:** No validation, no sanitization, no whitespace stripping

**⚠️ job.py:**
- Response-only schemas, no validation needed

**⚠️ job_progress.py:**
- Not examined yet, likely response-only

**⚠️ schema_field.py:**
- Not examined yet

**⚠️ video_field_value.py:**
- Not examined yet

### Validation Module Location

**Expected:** `backend/app/core/validation.py` (per master plan)  
**Actual:** Module does not exist yet  
**Alternative:** `backend/app/api/field_validation.py` exists (Task #73 - for custom field values)

**Decision:** Create `backend/app/utils/validation.py` to match actual project structure (utils/ is used for shared utilities).

---

## 🛠️ Implementation Steps

### Phase 1: Create Centralized Validation Module (30 min)

**File:** `backend/app/utils/validation.py`

**Action:** Create new validation module with security-hardened utilities

**Functions to Implement:**

1. **`sanitize_string(value: str, max_length: int, allow_newlines: bool) -> str`**
   - Strip leading/trailing whitespace
   - Remove control characters (except newlines if allowed)
   - Enforce max_length limit
   - Raise `ValueError` if validation fails

2. **`validate_youtube_url(url: str, max_length: int) -> str`**
   - Move existing logic from `video.py` (lines 24-66)
   - Add length check before regex (prevent ReDoS)
   - Add timeout protection for regex matching
   - Return validated URL (not video ID, for consistency)

3. **`validate_hex_color(color: str) -> str`**
   - Simple regex pattern: `^#[0-9A-Fa-f]{6}$`
   - Return lowercase normalized color
   - Raise `ValueError` if invalid

4. **`ValidationError` Exception Class**
   - Custom exception for validation errors
   - Subclass of `ValueError` for backward compatibility

**Test File:** `backend/tests/utils/test_validation.py` (create directory if needed)

**Reference Implementation (from master plan lines 1810-1957):**
- Use ThreadPoolExecutor for cross-platform timeout (not signal.alarm)
- Max URL length: 2048 chars
- Regex timeout: 500ms
- All functions should have comprehensive docstrings

---

### Phase 2: Update video.py Schema (20 min)

**File:** `backend/app/schemas/video.py`

**Changes:**

1. **Import validation module:**
   ```python
   from app.utils.validation import validate_youtube_url, sanitize_string, ValidationError
   ```

2. **Replace local `validate_youtube_url()` (lines 24-66) with imported version**

3. **Update `VideoAdd` schema:**
   - Keep existing `AfterValidator` pattern
   - Update to use imported `validate_youtube_url`

**Testing:**
- Run existing tests: `pytest tests/api/test_videos.py -v`
- Verify URL validation still works
- Test invalid URLs are rejected

---

### Phase 3: Update list.py Schema (15 min)

**File:** `backend/app/schemas/list.py`

**Changes:**

1. **Add validators to `ListCreate`:**
   ```python
   @field_validator('name')
   @classmethod
   def sanitize_name(cls, v: str) -> str:
       """Sanitize list name (strip whitespace, remove control chars)."""
       return sanitize_string(v, max_length=255, allow_newlines=False)
   
   @field_validator('description')
   @classmethod
   def sanitize_description(cls, v: str | None) -> str | None:
       """Sanitize list description."""
       if v:
           return sanitize_string(v, max_length=1000, allow_newlines=True)
       return v
   ```

2. **Add same validators to `ListUpdate`:**
   - Same logic, but handle Optional fields

**Testing:**
- Test list creation with whitespace in name (should strip)
- Test list with description containing control characters (should remove)
- Test list with name > 255 chars (should raise ValidationError)
- Test list with description > 1000 chars (should raise ValidationError)

---

### Phase 4: Update tag.py Schema (15 min)

**File:** `backend/app/schemas/tag.py`

**Changes:**

1. **Add validators to `TagBase`:**
   ```python
   @field_validator('name')
   @classmethod
   def sanitize_name(cls, v: str) -> str:
       """Sanitize tag name (strip whitespace, remove control chars)."""
       return sanitize_string(v, max_length=100, allow_newlines=False)
   
   @field_validator('color')
   @classmethod
   def validate_color(cls, v: str | None) -> str | None:
       """Validate and normalize hex color."""
       if v:
           return validate_hex_color(v)
       return v
   ```

2. **Add same validators to `TagUpdate`:**
   - Same logic, but handle Optional fields

**Note:** Current regex pattern in Field() is redundant after validator, but keep for schema documentation.

**Testing:**
- Test tag creation with whitespace in name (should strip)
- Test tag with name > 100 chars (should raise ValidationError)
- Test tag with invalid color format (should raise ValidationError)
- Test tag with uppercase color (should normalize to lowercase)

---

### Phase 5: Update custom_field.py Schema (20 min)

**File:** `backend/app/schemas/custom_field.py`

**Changes:**

1. **Update `CustomFieldBase.strip_name` validator (line 173):**
   ```python
   @field_validator('name')
   @classmethod
   def sanitize_name(cls, v: str) -> str:
       """Sanitize field name (strip whitespace, remove control chars)."""
       return sanitize_string(v, max_length=255, allow_newlines=False)
   ```

2. **Update `CustomFieldUpdate.strip_name` validator (line 257):**
   ```python
   @field_validator('name')
   @classmethod
   def sanitize_name(cls, v: str | None) -> str | None:
       """Sanitize field name (strip whitespace, remove control chars)."""
       if v:
           return sanitize_string(v, max_length=255, allow_newlines=False)
       return v
   ```

3. **Add validator for select options:**
   ```python
   # In SelectConfig class (after line 44)
   @field_validator('options')
   @classmethod
   def sanitize_options(cls, options: list[str]) -> list[str]:
       """Strip whitespace and sanitize all options."""
       return [sanitize_string(opt, max_length=100, allow_newlines=False) for opt in options]
   ```

**Testing:**
- Test field creation with whitespace in name (should strip)
- Test field with name containing control characters (should remove)
- Test field with name > 255 chars (should raise ValidationError)
- Test select field with option > 100 chars (should raise ValidationError)

---

### Phase 6: Update field_schema.py Schema (15 min)

**File:** `backend/app/schemas/field_schema.py`

**Changes:**

1. **Add validators to `FieldSchemaBase`:**
   ```python
   @field_validator('name')
   @classmethod
   def sanitize_name(cls, v: str) -> str:
       """Sanitize schema name (strip whitespace, remove control chars)."""
       return sanitize_string(v, max_length=255, allow_newlines=False)
   
   @field_validator('description')
   @classmethod
   def sanitize_description(cls, v: str | None) -> str | None:
       """Sanitize schema description."""
       if v:
           return sanitize_string(v, max_length=1000, allow_newlines=True)
       return v
   ```

2. **Add same validators to `FieldSchemaUpdate`:**
   - Same logic, but handle Optional fields

**Testing:**
- Test schema creation with whitespace in name (should strip)
- Test schema with name > 255 chars (should raise ValidationError)
- Test schema with description > 1000 chars (should raise ValidationError)

---

### Phase 7: Review Response-Only Schemas (10 min)

**Files to Check:**
- `backend/app/schemas/job.py` - Response only, no validation needed
- `backend/app/schemas/job_progress.py` - Response only, no validation needed
- `backend/app/schemas/schema_field.py` - Join table input, check if validation needed
- `backend/app/schemas/video_field_value.py` - Check if validation needed

**Action:** Read each file and determine if validation is needed. Document findings.

---

### Phase 8: Write Comprehensive Validation Tests (60 min)

**File:** `backend/tests/utils/test_validation.py`

**Test Categories:**

1. **`sanitize_string()` Tests:**
   - ✅ Valid string passes through
   - ✅ Leading/trailing whitespace is stripped
   - ✅ Control characters are removed
   - ✅ Newlines preserved when `allow_newlines=True`
   - ✅ Newlines removed when `allow_newlines=False`
   - ✅ Max length enforced (raises ValidationError)
   - ✅ Empty string returns empty string
   - ✅ None handling (if applicable)

2. **`validate_youtube_url()` Tests:**
   - ✅ Valid YouTube URLs pass (www.youtube.com, youtu.be, m.youtube.com)
   - ✅ Invalid URLs raise ValidationError
   - ✅ Non-HTTPS URLs rejected
   - ✅ Non-YouTube domains rejected
   - ✅ Missing video ID rejected
   - ✅ URL length limit enforced (2048 chars)
   - ✅ ReDoS protection (timeout test with crafted input)
   - ✅ Unicode bypass prevention

3. **`validate_hex_color()` Tests:**
   - ✅ Valid hex colors pass (#FF5733)
   - ✅ Invalid formats rejected (no #, wrong length, non-hex chars)
   - ✅ Uppercase normalized to lowercase
   - ✅ None handling (if applicable)

**File:** `backend/tests/api/test_schemas_validation.py`

**Test Categories:**

4. **Schema Integration Tests:**
   - ✅ ListCreate with invalid name (too long, control chars)
   - ✅ TagCreate with invalid color format
   - ✅ CustomFieldCreate with invalid name
   - ✅ FieldSchemaCreate with invalid description
   - ✅ VideoAdd with invalid URL

**Performance Tests:**
- ✅ `sanitize_string()` < 1ms for 500 char string
- ✅ `validate_youtube_url()` < 100ms for valid URL
- ✅ `validate_youtube_url()` < 1s for crafted ReDoS input (timeout protection)

---

### Phase 9: Update API Error Handling (20 min)

**Files to Update:**
- `backend/app/api/lists.py`
- `backend/app/api/tags.py`
- `backend/app/api/videos.py`
- `backend/app/api/custom_fields.py`
- `backend/app/api/field_schemas.py`

**Changes:**

1. **Ensure ValidationError is caught and converted to 422 HTTP response**
   - Pydantic already handles `ValueError` from validators → 422 Unprocessable Entity
   - Verify error messages are user-friendly

2. **Test error responses:**
   ```bash
   curl -X POST http://localhost:8000/api/lists \
     -H "Content-Type: application/json" \
     -d '{"name": "A"*300, "description": "Test"}'
   # Expected: 422 with clear error message
   ```

---

### Phase 10: Run Full Test Suite & Regression Check (30 min)

**Commands:**

```bash
cd backend

# Run all validation tests
pytest tests/utils/test_validation.py -v
pytest tests/api/test_schemas_validation.py -v

# Run full test suite to check for regressions
pytest tests/ -v

# Run specific API tests
pytest tests/api/test_lists.py -v
pytest tests/api/test_tags.py -v
pytest tests/api/test_videos.py -v
pytest tests/api/test_custom_fields.py -v
pytest tests/api/test_field_schemas.py -v

# Run integration tests
pytest tests/integration/ -v

# Coverage report
pytest --cov=app.utils.validation --cov=app.schemas --cov-report=term-missing
```

**Expected Results:**
- ✅ All tests pass
- ✅ No regressions in existing functionality
- ✅ Coverage > 90% for validation module
- ✅ Coverage > 80% for schema validators

---

## 🧪 Testing Strategy

### Unit Tests (backend/tests/utils/test_validation.py)

**Focus:** Test validation functions in isolation

**Test Cases (23 tests minimum):**

1. **sanitize_string (8 tests):**
   - Valid input passes through
   - Whitespace stripped
   - Control chars removed
   - Newlines handled correctly
   - Max length enforced
   - Empty string handling
   - None handling
   - Unicode characters preserved

2. **validate_youtube_url (12 tests):**
   - Valid URLs (youtube.com, youtu.be, m.youtube.com)
   - Invalid domains rejected
   - Non-HTTPS rejected
   - Missing video ID rejected
   - Malformed URLs rejected
   - Length limit enforced
   - ReDoS timeout protection
   - Unicode bypass prevention
   - Query parameters preserved
   - Embed URLs supported

3. **validate_hex_color (3 tests):**
   - Valid colors pass
   - Invalid formats rejected
   - Case normalization

### Integration Tests (backend/tests/api/test_schemas_validation.py)

**Focus:** Test validation through Pydantic schemas

**Test Cases (15 tests minimum):**

1. **ListCreate/ListUpdate (4 tests):**
   - Valid data passes
   - Name too long rejected
   - Name with control chars sanitized
   - Description too long rejected

2. **TagCreate/TagUpdate (3 tests):**
   - Valid data passes
   - Name too long rejected
   - Invalid color rejected

3. **CustomFieldCreate/CustomFieldUpdate (4 tests):**
   - Valid data passes
   - Name too long rejected
   - Name with control chars sanitized
   - Select options sanitized

4. **FieldSchemaCreate/FieldSchemaUpdate (3 tests):**
   - Valid data passes
   - Name too long rejected
   - Description too long rejected

5. **VideoAdd (1 test):**
   - Invalid URL rejected

### Performance Tests (backend/tests/utils/test_validation_performance.py)

**Focus:** Ensure validation doesn't impact performance

**Test Cases (3 tests):**

1. **sanitize_string performance:**
   - 1000 iterations < 100ms total
   - Single call < 1ms

2. **validate_youtube_url performance:**
   - Valid URL < 10ms
   - Crafted ReDoS input < 1s (timeout protection)

3. **Batch validation performance:**
   - 100 list names validated < 50ms

### End-to-End Tests (Manual Testing)

**Test Scenarios:**

1. **Create list with whitespace in name:**
   - POST /api/lists with `{"name": "  My List  ", "description": "Test"}`
   - Expected: List created with name "My List" (stripped)

2. **Create tag with invalid color:**
   - POST /api/tags with `{"name": "Red", "color": "red"}`
   - Expected: 422 error with clear message

3. **Create video with invalid URL:**
   - POST /api/lists/{id}/videos with `{"url": "http://youtube.com/watch?v=123"}`
   - Expected: 422 error (HTTP required)

4. **Create field with very long name:**
   - POST /api/lists/{id}/custom-fields with `{"name": "A"*300, "field_type": "text"}`
   - Expected: 422 error with clear message

---

## 📚 Reference

### Master Plan

**File:** `docs/plans/2025-11-02-security-hardening-implementation.md`  
**Section:** Task #5: Input Validation & ReDoS Protection (lines 1731-2086)

**Key Requirements:**
- Implement `validation.py` module with ReDoS protection (lines 1807-1994)
- Update video schema with validation (lines 1996-2026)
- Apply `sanitize_string()` to all text inputs (lines 2063-2070)

### Pydantic v2 Documentation

**REF MCP Results:**
- [Field Validators - Decorator Pattern](https://github.com/pydantic/pydantic/blob/main/docs/concepts/validators.md#using-the-decorator-pattern)
- [Which Validator Pattern to Use](https://github.com/pydantic/pydantic/blob/main/docs/concepts/validators.md#which-validator-pattern-to-use)
- [Migration Guide - Changes to Validators](https://github.com/pydantic/pydantic/blob/main/docs/migration.md#changes-to-validators)

**Best Practices:**
1. Use `@field_validator` for single-field validation
2. Use `@model_validator(mode='after')` for cross-field validation
3. Use `@classmethod` decorator on validator methods
4. Use `AfterValidator` for reusable validation with Field()
5. Raise `ValueError` for validation errors (auto-converts to 422)

### Existing Code References

**Good Examples:**
- `backend/app/schemas/custom_field.py` (lines 173-197): Model validator pattern
- `backend/app/schemas/field_schema.py` (lines 150-228): Multiple validators with clear errors
- `backend/app/schemas/video.py` (lines 24-66): AfterValidator pattern
- `backend/app/api/field_validation.py`: Validation module example (Task #73)

**Validation Module Example:**
- `backend/app/api/field_validation.py`: Shows validation function structure

---

## ✅ Definition of Done

- [x] Phase 1: `backend/app/utils/validation.py` created with 3 functions
- [x] Phase 2: `video.py` updated to use centralized validation
- [x] Phase 3: `list.py` updated with sanitize_string validators
- [x] Phase 4: `tag.py` updated with sanitize_string validators
- [x] Phase 5: `custom_field.py` updated with enhanced validation
- [x] Phase 6: `field_schema.py` updated with sanitize_string validators
- [x] Phase 7: Response-only schemas reviewed (documented)
- [x] Phase 8: Comprehensive tests written (38+ tests total)
- [x] Phase 9: API error handling verified
- [x] Phase 10: Full test suite passes with no regressions
- [x] All validation rules documented in docstrings
- [x] Test coverage > 90% for validation module
- [x] Performance benchmarks met (<1ms sanitize, <1s ReDoS timeout)

---

## 📝 Implementation Notes

### Security Considerations

1. **ReDoS Protection:**
   - All regex operations must have timeout protection
   - Use ThreadPoolExecutor for cross-platform compatibility
   - Timeout threshold: 500ms for URLs, 100ms for simple patterns

2. **Length Limits:**
   - Check length BEFORE applying regex (prevents resource exhaustion)
   - URL max: 2048 chars (standard browser limit)
   - Text fields: Per-schema limits (255 for names, 1000 for descriptions)

3. **Unicode Bypass Prevention:**
   - Use `.isascii()` check for URLs before parsing
   - Preserve Unicode for user-facing text (names, descriptions)

4. **Control Character Removal:**
   - Remove all control chars except newlines (if allowed)
   - Use `char.isprintable()` check

### Backward Compatibility

**Existing Validation:**
- `video.py` already has URL validation → migrate to centralized version
- `custom_field.py` already strips whitespace → enhance with sanitization
- `tag.py` has Field() constraints → add validators for consistency

**Migration Path:**
1. Import centralized validation functions
2. Replace/enhance existing validators
3. Keep Field() constraints for schema documentation
4. Test all endpoints to ensure no regressions

### Error Messages

**User-Friendly Messages:**
- ❌ "Input too long" → ✅ "List name too long (max 255 characters)"
- ❌ "Invalid URL" → ✅ "Invalid YouTube URL format - must be HTTPS from youtube.com or youtu.be"
- ❌ "Bad color" → ✅ "Color must be a hex code (e.g., #FF5733)"

**Implementation:**
```python
def sanitize_string(value: str, max_length: int, field_name: str = "Input") -> str:
    """
    Sanitize string with user-friendly error messages.
    
    Args:
        value: String to sanitize
        max_length: Maximum allowed length
        field_name: Name of field for error messages (default: "Input")
    
    Raises:
        ValueError: With clear error message including field_name and max_length
    """
    if len(value) > max_length:
        raise ValueError(f"{field_name} too long (max {max_length} characters)")
    # ... rest of validation
```

### Performance Targets

**Function-Level:**
- `sanitize_string()`: < 1ms for 500 char input
- `validate_youtube_url()`: < 10ms for valid URL
- `validate_hex_color()`: < 1ms

**Endpoint-Level:**
- List creation: < 100ms (validation should not be bottleneck)
- Bulk operations: < 5ms per item validation overhead

### Testing Coverage Goals

**Module Coverage:**
- `app.utils.validation`: > 95% (core security module)
- `app.schemas.*`: > 85% (validators in schemas)
- Overall branch coverage: > 80%

**Test Distribution:**
- Unit tests: 23+ (validation functions)
- Integration tests: 15+ (schema validation)
- Performance tests: 3+ (timeout & speed)
- Total: 41+ tests minimum

---

## 🚀 Rollout Plan

### Step 1: Validate in Development
- Run full test suite locally
- Manual testing of all affected endpoints
- Verify error messages are user-friendly

### Step 2: Deploy to Staging
- Run integration tests against staging database
- Monitor logs for validation errors
- Test with real-world data patterns

### Step 3: Deploy to Production
- Enable validation incrementally (if possible)
- Monitor error rates for 24h
- Have rollback plan ready

### Step 4: Document Changes
- Update API documentation (OpenAPI/Swagger)
- Update README with validation rules
- Update CLAUDE.md if needed

---

## 🔗 Related Tasks

**Dependencies:**
- Task #131: Apply sanitize_string to endpoints (should be done together)

**Follow-Up Tasks:**
- Task #133: Add structured logging for validation errors
- Task #134: Rate limiting on validation-heavy endpoints
- Task #135: Input validation metrics/monitoring

**Related Security Tasks:**
- Task #1: JWT Authentication
- Task #2: Rate Limiting
- Task #3: CORS Configuration
- Task #4: Secrets Management

---

## 📊 Success Metrics

**Code Quality:**
- ✅ Test coverage > 90% for validation module
- ✅ Zero TODO/FIXME comments in validation code
- ✅ All functions have docstrings with examples

**Security:**
- ✅ All text inputs sanitized (no XSS vectors)
- ✅ All URLs validated (no open redirects)
- ✅ ReDoS timeout protection verified
- ✅ Length limits enforced everywhere

**Performance:**
- ✅ Validation overhead < 5ms per request
- ✅ No performance regressions in test suite
- ✅ Timeout protection works under load

**User Experience:**
- ✅ Clear, actionable error messages
- ✅ No false positives (valid input rejected)
- ✅ Consistent validation across all endpoints

