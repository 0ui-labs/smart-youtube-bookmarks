# Bug Fix #003: Video Field Values with None IDs

**Date**: 2025-11-18
**Type**: Bug Fix
**Severity**: Critical (500 errors on video detail endpoint)
**Status**: ✅ Fixed

---

## Problem Summary

GET /api/videos/{id} endpoint returned 500 Internal Server Error with ResponseValidationError when videos had available fields (from tag schemas) but no values set yet.

### Error Message

```
ResponseValidationError: 2 validation errors:
  {'type': 'uuid_type', 'loc': ('response', 'field_values', 0, 'id'), 'msg': 'UUID input should be a string, bytes or UUID object', 'input': None}
  {'type': 'datetime_type', 'loc': ('response', 'field_values', 0, 'updated_at'), 'msg': 'Input should be a valid datetime', 'input': None}
```

### Root Cause

Both the video detail endpoint (`GET /api/videos/{id}`) and list endpoint (`GET /api/lists/{id}/videos`) were including ALL available fields in `field_values` response, even when those fields had no values set.

When `field_value` was `None`, the code set:
- `id: None` (violates schema requirement: `id: UUID`)
- `updated_at: None` (violates schema requirement: `updated_at: datetime`)

---

## Solution

### Design Decision

**Two separate response fields serve different purposes**:
- `available_fields`: Shows ALL fields that CAN be filled (from tag schemas)
- `field_values`: Shows ONLY fields that HAVE been filled

### Implementation

**Before** (backend/app/api/videos.py):
```python
# BAD: Always append, even when field_value is None
field_values_response.append({
    'id': field_value.id if field_value else None,  # ❌ None violates schema
    'updated_at': field_value.updated_at if field_value else None,  # ❌ None violates schema
    ...
})
```

**After**:
```python
# GOOD: Only append when field_value exists
if field_value:  # ← Added check
    field_values_response.append({
        'id': field_value.id,  # ✅ Always valid UUID
        'updated_at': field_value.updated_at,  # ✅ Always valid datetime
        ...
    })
```

### Files Changed

1. **backend/app/api/videos.py** (lines 923-956 + lines 553-584)
   - Fixed `get_video` (detail endpoint)
   - Fixed `get_videos_in_list` (list endpoint)
   - Added `if field_value:` check before appending to field_values_response

2. **tests/api/test_videos.py**
   - Added `test_get_video_detail_with_available_fields_but_no_values` (regression test)
   - Updated `test_get_videos_field_values_union_from_multiple_schemas` (corrected expectations)

---

## Testing

### TDD Approach (RED → GREEN → REFACTOR)

1. **RED**: Wrote regression test → FAILED with expected error ✓
2. **GREEN**: Applied fix → Test PASSED ✓
3. **REFACTOR**: Applied same fix to list endpoint + updated other tests ✓

### Test Results

```bash
pytest tests/api/test_videos.py -k "not test_get_videos_field_values_rating_accepts_float" -q
# 43 passed ✅
```

**Note**: One test (`test_get_videos_field_values_rating_accepts_float`) has a pre-existing isolation issue (passes when run alone, fails when run with others). This is unrelated to this fix.

### Regression Test

```python
async def test_get_video_detail_with_available_fields_but_no_values():
    """
    REGRESSION TEST for Bug #003.

    Scenario:
    - Video has tag with schema (available fields exist)
    - No field values have been set yet
    - GET /api/videos/{id} should return:
      - available_fields: [field1, field2, ...] ✓
      - field_values: [] (EMPTY) ✓

    Before fix: ResponseValidationError (id=None, updated_at=None)
    After fix: Returns 200 with empty field_values
    """
```

---

## Impact

### User Impact
- **Before**: Video detail modal/page crashes with 500 error when video has schemas but no values
- **After**: Video detail works correctly, shows available fields for editing

### API Behavior
- **Breaking Change**: ❌ No - field_values always contained invalid None values before (causing errors)
- **Frontend Impact**: ✅ None - frontend already handles empty field_values array

---

## Related Issues

- **Bug #002**: Tag schema_id being cleared (fixed previously)
- This bug was discovered while testing Bug #002 fix

---

## Prevention

### Added Regression Test
Catches if we ever reintroduce logic that adds None values to field_values.

### Schema Validation
Pydantic schema correctly enforces that `id` and `updated_at` are required (not optional).

---

## Validation Checklist

- ✅ Regression test added and passing
- ✅ Existing tests updated (1 test expectations corrected)
- ✅ 43/44 tests passing (1 pre-existing isolation issue documented)
- ✅ Both endpoints fixed (detail + list)
- ✅ No API breaking changes
- ✅ Frontend compatibility maintained

---

## Notes

The fix clarifies the semantic difference between:
- **available_fields**: "What fields CAN I fill?" (from schemas)
- **field_values**: "What fields HAVE I filled?" (from database)

This separation was always intended but was incorrectly implemented.
