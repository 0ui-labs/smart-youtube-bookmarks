# Bug #004: Video Detail Endpoint 500 Error - Field Values Not Iterable

**Date:** 2025-11-18
**Status:** ✅ FIXED
**Severity:** HIGH (500 error blocking feature usage)
**Test Coverage:** ✅ Regression test added

## Summary

The video detail endpoint (`GET /api/videos/{id}`) returned a 500 Internal Server Error when fetching videos with multiple field values, causing the error:
```
TypeError: 'VideoFieldValue' object is not iterable
```

This prevented users from viewing or editing custom fields in video detail views (both modal and dedicated page).

## Root Cause

**SQLAlchemy Relationship Loading Issue**

When loading the `video.field_values` relationship using `selectinload(Video.field_values)`, SQLAlchemy sometimes returns a **single `VideoFieldValue` object** instead of a **list**, even though the relationship is defined with `uselist=True`.

This occurred when:
1. A video has multiple field values in the database
2. The endpoint tried to iterate over `field_values`: `for fv in field_values_list`
3. SQLAlchemy returned a single object → `TypeError: 'VideoFieldValue' object is not iterable`

### Affected Code Location
`backend/app/api/videos.py:935` (before fix)
```python
field_values_list = video.field_values if video.field_values is not None else []
values_by_field_id = {fv.field_id: fv for fv in field_values_list}  # ❌ Fails here
```

## Investigation Process

1. **Initial Symptom:** Frontend showed 500 errors when clicking on videos with field values
2. **Debug Script:** Created `backend/debug_video.py` to test the endpoint directly
3. **Key Finding:** SQLAlchemy warning appeared:
   ```
   SAWarning: Multiple rows returned with uselist=False for eagerly-loaded attribute 'Video.field_values'
   ```
4. **Direct Test:** Called `get_video_by_id()` endpoint → confirmed `TypeError`

## Solution

Applied the same manual loading workaround used for tags:

### Code Changes

**File:** `backend/app/api/videos.py`

**Before (lines 886-895):**
```python
# Step 1: Load video with field_values (tags loaded separately below)
stmt = (
    select(Video)
    .where(Video.id == video_id)
    .options(
        selectinload(Video.field_values).selectinload(VideoFieldValue.field)
    )
)
result = await db.execute(stmt)
video = result.scalar_one_or_none()
```

**After (lines 886-906):**
```python
# Step 1: Load video (field_values and tags loaded separately below)
stmt = select(Video).where(Video.id == video_id)
result = await db.execute(stmt)
video = result.scalar_one_or_none()

if not video:
    raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

# Step 2A: Load field_values manually (workaround for SQLAlchemy relationship loading issue)
# BUG #004 FIX: SQLAlchemy sometimes returns a single VideoFieldValue object instead of a list
# Loading field_values explicitly with eager loading ensures we always get a proper list
from app.models.video_field_value import VideoFieldValue
from app.models.custom_field import CustomField
field_values_stmt = (
    select(VideoFieldValue)
    .where(VideoFieldValue.video_id == video_id)
    .options(selectinload(VideoFieldValue.field))
)
field_values_result = await db.execute(field_values_stmt)
field_values_list = list(field_values_result.scalars().all())
video.__dict__['field_values'] = field_values_list
```

**Also Updated (line 942):**
```python
# Removed redundant assignment:
# field_values_list = video.field_values if video.field_values is not None else []
# Now uses field_values_list from Step 2A above
```

## Testing

### Manual Testing
```bash
# Test video with multiple field values
curl http://localhost:8000/api/videos/8655b3cb-5e2c-4889-aa26-ec8ce51e5ddc

# Response (200 OK):
{
  "title": "How LLMLingua can help cut your AI bill by 20x",
  "available_fields": [...],  # 4 fields
  "field_values": [...]       # 2 filled values
}

# Test field update
curl -X PUT http://localhost:8000/api/videos/{id}/fields \
  -H "Content-Type: application/json" \
  -d '{"field_values": [{"field_id": "...", "value": 4}]}'

# Response (200 OK): Field successfully updated
```

### Regression Test Added

**File:** `backend/tests/api/test_videos.py`
**Test:** `test_get_video_detail_with_multiple_field_values()`

Creates a video with 3 field values and verifies:
- ✅ GET returns 200 (not 500)
- ✅ All 3 field values returned as a list
- ✅ Values are correctly populated

**Test Result:** ✅ PASSED

## Impact

### Before Fix
- ❌ Videos with field values caused 500 errors
- ❌ Custom fields not viewable in video detail views
- ❌ Users couldn't edit field values

### After Fix
- ✅ All videos load successfully
- ✅ Custom fields visible in video detail modal and page
- ✅ Field editing works correctly
- ✅ Values persist and display properly

## Related Issues

This is the **same root cause** as the tags loading issue (lines 908-919), which was already using manual loading to work around SQLAlchemy's behavior.

## Prevention

### Regression Test Coverage
- ✅ Test for videos with NO field values (Bug #003)
- ✅ Test for videos with MULTIPLE field values (Bug #004)

### Pattern to Follow
When loading relationships that can have multiple items:
```python
# ❌ DON'T: Use selectinload on Video query
stmt = select(Video).options(selectinload(Video.field_values))

# ✅ DO: Load relationship manually with separate query
field_values_stmt = select(VideoFieldValue).where(VideoFieldValue.video_id == video_id)
field_values_result = await db.execute(field_values_stmt)
field_values_list = list(field_values_result.scalars().all())
video.__dict__['field_values'] = field_values_list
```

## Files Modified

1. `backend/app/api/videos.py` - Fixed field_values loading (lines 886-906, 942)
2. `backend/tests/api/test_videos.py` - Added regression test (lines 1686-1820)

## Verification Commands

```bash
# Run regression test
cd backend
pytest tests/api/test_videos.py::test_get_video_detail_with_multiple_field_values -v

# Test endpoint manually
curl http://localhost:8000/api/videos/{video_id}
```
