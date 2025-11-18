# Task #72: Implement Video Field Values Batch Update Endpoint (UPDATED with REF MCP)

**Plan Task:** #72
**Wave/Phase:** Phase 1: MVP - Backend (Custom Fields System)
**Dependencies:** Task #62 (VideoFieldValue Model), Task #64 (CustomField Pydantic Schemas), Task #71 (VideoFieldValueResponse schema)
**REF MCP Validated:** 2025-11-09 (FastAPI, SQLAlchemy 2.0, Pydantic v2)

---

## 🎯 Ziel

Create a PUT endpoint that allows batch updating of all custom field values for a single video. The endpoint accepts a list of field ID/value pairs and updates the `video_field_values` table atomically (all-or-nothing transaction). This enables the frontend to save multiple field edits in a single API call, improving UX and reducing network overhead.

**Expected Result:**
- Endpoint: `PUT /api/videos/{video_id}/fields`
- Accepts list of field value updates
- Validates all values before any database changes (inline validation)
- Creates/updates VideoFieldValue records in single transaction
- Returns updated field values with full field metadata
- Performance: < 200ms for 10 field updates

---

## 📋 REF MCP Improvements Applied

### Improvement 1: Correct UPSERT Constraint Name ✅

**Issue in Original Plan:**
```python
stmt = stmt.on_conflict_do_update(
    constraint='uq_video_field_values_video_field',  # WRONG NAME
    set_={...}
)
```

**Fix:**
Migration Task #62 created the constraint with name `uq_video_field_values`:
```python
# backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py:64
UniqueConstraint('video_id', 'field_id', name='uq_video_field_values')
```

**Corrected Code:**
```python
stmt = stmt.on_conflict_do_update(
    constraint='uq_video_field_values',  # CORRECT
    set_={
        'value_text': stmt.excluded.value_text,
        'value_numeric': stmt.excluded.value_numeric,
        'value_boolean': stmt.excluded.value_boolean,
        'updated_at': func.now()
    }
)
```

**Why:** Wrong constraint name causes PostgreSQL runtime error "constraint does not exist", breaking all updates.

---

### Improvement 2: Reuse VideoFieldValueResponse from Task #71 ✅

**Issue in Original Plan:**
Plan proposed creating new `VideoFieldValueResponse` in new file `video_field_value.py`.

**Problem:**
Task #71 (just completed) already created `VideoFieldValueResponse` in `backend/app/schemas/video.py`:
```python
# backend/app/schemas/video.py (lines 49-64, Task #71)
class VideoFieldValueResponse(BaseModel):
    field_id: UUID
    field: CustomFieldResponse  # Nested field definition
    value: str | float | bool | None
    schema_name: str | None
    show_on_card: bool
    display_order: int
```

**Fix: DRY Principle**
- **Reuse** existing `VideoFieldValueResponse` from `video.py`
- Only create `BatchUpdateFieldValuesRequest/Response` in new file

**Updated Code:**
```python
# backend/app/schemas/video_field_value.py
from app.schemas.video import VideoFieldValueResponse  # REUSE from Task #71

class BatchUpdateFieldValuesResponse(BaseModel):
    """Response schema for batch field value updates."""
    updated_count: int = Field(..., description="Number of fields updated")
    field_values: list[VideoFieldValueResponse] = Field(...)  # REUSE
```

**Why:**
- Single Source of Truth (DRY principle from Task #71)
- GET and PUT endpoints return same format
- Consistent with existing codebase patterns

**Trade-off:** Response includes `schema_name`, `show_on_card`, `display_order` fields not strictly needed for PUT response, but they're useful metadata for frontend.

---

### Improvement 3: Inline Validation (No Task #73 Dependency) ✅

**Issue in Original Plan:**
Plan imported validation from Task #73 (not yet implemented):
```python
from app.api.field_validation import validate_field_value  # ImportError!
```

**Problem:** Task #73 not implemented → ImportError at runtime.

**Fix: Inline Validation**
Implement validation logic directly in endpoint (can be refactored to separate module in Task #73):

```python
# Step 3: Validate values (inline implementation)
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
        elif update.value < 0 or update.value > field.config.get('max_rating', 5):
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": f"Rating must be between 0 and {field.config.get('max_rating', 5)}"
            })

    elif field.field_type == 'select':
        if not isinstance(update.value, str):
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": f"Select value must be string, got {type(update.value).__name__}"
            })
        elif update.value not in field.config.get('options', []):
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": f"Invalid option '{update.value}'. Valid options: {field.config.get('options', [])}"
            })

    elif field.field_type == 'boolean':
        if not isinstance(update.value, bool):
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": f"Boolean value must be true/false, got {type(update.value).__name__}"
            })

    elif field.field_type == 'text':
        if not isinstance(update.value, str):
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": f"Text value must be string, got {type(update.value).__name__}"
            })
        max_len = field.config.get('max_length')
        if max_len and len(update.value) > max_len:
            validation_errors.append({
                "field_id": str(update.field_id),
                "field_name": field.name,
                "error": f"Text exceeds max length {max_len} ({len(update.value)} chars)"
            })

# Abort if any validation failed (all-or-nothing)
if validation_errors:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "message": "Field value validation failed",
            "errors": validation_errors
        }
    )
```

**Why:**
- **Independent:** Task #72 doesn't depend on Task #73
- **Testable:** Validation can be tested in unit tests
- **Production-ready:** Provides real validation, not stub
- **Refactorable:** Can extract to separate module in Task #73 later

**Trade-off:** ~60 lines inline validation code in endpoint. Acceptable for MVP, can refactor later.

---

## 🛠️ Implementation Steps

### Step 1: Create Request/Response Pydantic Schemas

**Files:** `backend/app/schemas/video_field_value.py` (NEW FILE)

**Action:** Define Pydantic schemas for batch field value updates (reuse VideoFieldValueResponse)

**Code:**
```python
"""
Pydantic schemas for VideoFieldValue API requests/responses.

These schemas handle batch updates of custom field values for videos.
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator
from uuid import UUID
from typing import Any
from datetime import datetime

# Import existing schema from Task #71 (DRY principle)
from app.schemas.video import VideoFieldValueResponse


class FieldValueUpdate(BaseModel):
    """
    Single field value update in a batch request.

    The value type depends on the field's field_type:
    - rating: int | float (validated inline in endpoint)
    - select: str (validated against options list inline)
    - text: str (validated against optional max_length inline)
    - boolean: bool

    Validation happens at endpoint level (inline) to avoid Task #73 dependency.
    """
    field_id: UUID = Field(..., description="UUID of the custom field")
    value: int | str | bool | float | None = Field(
        ...,
        description="Field value (type must match field's field_type)"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "field_id": "550e8400-e29b-41d4-a716-446655440000",
                    "value": 5
                },
                {
                    "field_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                    "value": "great"
                }
            ]
        }
    )


class BatchUpdateFieldValuesRequest(BaseModel):
    """
    Request schema for batch updating video field values.

    All fields are updated atomically - if any validation fails,
    no changes are persisted to the database.

    Example:
        {
            "field_values": [
                {"field_id": "uuid1", "value": 5},
                {"field_id": "uuid2", "value": "great"}
            ]
        }
    """
    field_values: list[FieldValueUpdate] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of field value updates (1-50 items)"
    )

    @field_validator('field_values')
    @classmethod
    def validate_unique_field_ids(cls, v: list[FieldValueUpdate]) -> list[FieldValueUpdate]:
        """
        Ensure no duplicate field_id in request.

        Multiple updates to the same field in one request is ambiguous
        (which value to use?) and indicates a client bug.

        Args:
            v: List of field value updates

        Returns:
            Validated list (unchanged if valid)

        Raises:
            ValueError: If duplicate field_id found
        """
        field_ids = [update.field_id for update in v]
        duplicates = {fid for fid in field_ids if field_ids.count(fid) > 1}

        if duplicates:
            # Convert UUIDs to strings for error message
            duplicate_str = ', '.join(str(fid) for fid in duplicates)
            raise ValueError(
                f"Duplicate field_id in request: {duplicate_str}. "
                "Each field can only be updated once per request."
            )

        return v

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "field_values": [
                        {
                            "field_id": "550e8400-e29b-41d4-a716-446655440000",
                            "value": 5
                        },
                        {
                            "field_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                            "value": "great"
                        },
                        {
                            "field_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                            "value": True
                        }
                    ]
                }
            ]
        }
    )


class BatchUpdateFieldValuesResponse(BaseModel):
    """
    Response schema for batch field value updates.

    Returns all updated field values with full field metadata.
    Reuses VideoFieldValueResponse from Task #71 for consistency.
    """
    updated_count: int = Field(..., description="Number of fields updated")
    field_values: list[VideoFieldValueResponse] = Field(
        ...,
        description="Updated field values with field definitions"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "updated_count": 3,
                    "field_values": [
                        {
                            "field_id": "field-uuid",
                            "value": 5,
                            "schema_name": None,
                            "show_on_card": True,
                            "display_order": 0,
                            "field": {
                                "id": "field-uuid",
                                "name": "Overall Rating",
                                "field_type": "rating",
                                "config": {"max_rating": 5},
                                "list_id": "list-uuid",
                                "created_at": "2025-11-09T10:00:00Z",
                                "updated_at": "2025-11-09T10:00:00Z"
                            }
                        }
                    ]
                }
            ]
        }
    )
```

**Why These Schemas:**
- **FieldValueUpdate:** Simple, type-agnostic value holder (validation inline in endpoint)
- **Unique field_ids:** Prevents ambiguous requests (client bug detection)
- **Min/max length:** Prevents empty requests and oversized batches (DoS protection)
- **Reuse VideoFieldValueResponse:** DRY principle from Task #71
- **from_attributes:** Enables SQLAlchemy ORM → Pydantic conversion

**REF MCP Evidence:**
- Pydantic v2 docs recommend `field_validator` for single-field validation
- FastAPI docs recommend nested response models for related data
- Reusing schemas from existing modules follows DRY principle

---

### Step 2: Create PUT Endpoint in Videos Router

**Files:** `backend/app/api/videos.py`

**Action:** Add batch update endpoint following existing PUT pattern

**Code:**
```python
# Add imports at top of file
from uuid import UUID
from typing import Any
from fastapi import Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.schemas.video_field_value import (
    BatchUpdateFieldValuesRequest,
    BatchUpdateFieldValuesResponse,
)
from app.models.video import Video
from app.models.video_field_value import VideoFieldValue
from app.models.custom_field import CustomField
from app.api.deps import get_db
from app.db.session import AsyncSession


# Add endpoint after existing video endpoints (around line 950)
@router.put("/videos/{video_id}/fields", response_model=BatchUpdateFieldValuesResponse)
async def batch_update_video_field_values(
    video_id: UUID,
    request: BatchUpdateFieldValuesRequest,
    db: AsyncSession = Depends(get_db)
) -> BatchUpdateFieldValuesResponse:
    """
    Batch update custom field values for a video.

    Updates multiple field values atomically in a single transaction.
    Creates new VideoFieldValue records if they don't exist (upsert behavior).

    **Validation:**
    - Video must exist (404 if not found)
    - All field_ids must be valid CustomFields (400 if invalid)
    - Values validated per field type (422 if validation fails)
      - Rating: numeric, 0 to max_rating
      - Select: string, in options list
      - Text: string, max_length if configured
      - Boolean: true/false

    **Transaction Semantics:**
    - All-or-nothing: If any validation fails, no changes are persisted
    - Upsert: Creates if doesn't exist, updates if exists

    **Performance:**
    - Optimized for batches up to 50 fields
    - Single database round-trip for validation queries
    - Uses PostgreSQL UPSERT (ON CONFLICT DO UPDATE) for efficiency

    Args:
        video_id: UUID of video to update field values for
        request: Batch update request with list of field_id/value pairs
        db: Database session

    Returns:
        Response with updated_count and list of updated field values

    Raises:
        HTTPException:
            - 404: Video not found
            - 400: Invalid field_id (field doesn't exist)
            - 422: Validation error (value incompatible with field type)

    Example:
        PUT /api/videos/{video_id}/fields
        {
            "field_values": [
                {"field_id": "uuid1", "value": 5},
                {"field_id": "uuid2", "value": "great"}
            ]
        }

        Response (200):
        {
            "updated_count": 2,
            "field_values": [
                {
                    "field_id": "uuid1",
                    "value": 5,
                    "schema_name": null,
                    "show_on_card": true,
                    "display_order": 0,
                    "field": {
                        "id": "uuid1",
                        "name": "Overall Rating",
                        "field_type": "rating",
                        "config": {"max_rating": 5}
                    }
                },
                ...
            ]
        }
    """
    # === STEP 1: Validate video exists ===
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id {video_id} not found"
        )

    # === STEP 2: Fetch all CustomFields for validation ===
    # Extract field_ids from request
    field_ids = [update.field_id for update in request.field_values]

    # Query all fields in single query (performance optimization)
    fields_stmt = (
        select(CustomField)
        .where(CustomField.id.in_(field_ids))
    )
    fields_result = await db.execute(fields_stmt)
    fields = {field.id: field for field in fields_result.scalars().all()}

    # Validate all field_ids exist
    invalid_field_ids = [fid for fid in field_ids if fid not in fields]
    if invalid_field_ids:
        invalid_str = ', '.join(str(fid) for fid in invalid_field_ids)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field_id(s): {invalid_str}. These fields do not exist."
        )

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
            elif update.value < 0 or update.value > field.config.get('max_rating', 5):
                validation_errors.append({
                    "field_id": str(update.field_id),
                    "field_name": field.name,
                    "error": f"Rating must be between 0 and {field.config.get('max_rating', 5)}"
                })

        elif field.field_type == 'select':
            if not isinstance(update.value, str):
                validation_errors.append({
                    "field_id": str(update.field_id),
                    "field_name": field.name,
                    "error": f"Select value must be string, got {type(update.value).__name__}"
                })
            elif update.value not in field.config.get('options', []):
                validation_errors.append({
                    "field_id": str(update.field_id),
                    "field_name": field.name,
                    "error": f"Invalid option '{update.value}'. Valid options: {field.config.get('options', [])}"
                })

        elif field.field_type == 'boolean':
            if not isinstance(update.value, bool):
                validation_errors.append({
                    "field_id": str(update.field_id),
                    "field_name": field.name,
                    "error": f"Boolean value must be true/false, got {type(update.value).__name__}"
                })

        elif field.field_type == 'text':
            if not isinstance(update.value, str):
                validation_errors.append({
                    "field_id": str(update.field_id),
                    "field_name": field.name,
                    "error": f"Text value must be string, got {type(update.value).__name__}"
                })
            else:
                max_len = field.config.get('max_length')
                if max_len and len(update.value) > max_len:
                    validation_errors.append({
                        "field_id": str(update.field_id),
                        "field_name": field.name,
                        "error": f"Text exceeds max length {max_len} ({len(update.value)} chars)"
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

    # === STEP 4: Prepare upsert data ===
    # Convert updates to database-compatible format
    upsert_data = []
    for update in request.field_values:
        field = fields[update.field_id]

        # Determine which value column to populate based on field_type
        value_text = None
        value_numeric = None
        value_boolean = None

        if field.field_type == 'rating':
            value_numeric = update.value
        elif field.field_type in ('select', 'text'):
            value_text = update.value
        elif field.field_type == 'boolean':
            value_boolean = update.value

        upsert_data.append({
            'video_id': video_id,
            'field_id': update.field_id,
            'value_text': value_text,
            'value_numeric': value_numeric,
            'value_boolean': value_boolean
        })

    # === STEP 5: Execute PostgreSQL UPSERT ===
    # Use ON CONFLICT DO UPDATE for idempotent upsert
    # REF MCP Fix: Correct constraint name from migration
    stmt = pg_insert(VideoFieldValue).values(upsert_data)
    stmt = stmt.on_conflict_do_update(
        constraint='uq_video_field_values',  # CORRECT name from Task #62 migration
        set_={
            'value_text': stmt.excluded.value_text,
            'value_numeric': stmt.excluded.value_numeric,
            'value_boolean': stmt.excluded.value_boolean,
            'updated_at': func.now()
        }
    )

    await db.execute(stmt)
    await db.commit()

    # === STEP 6: Fetch updated values with field definitions ===
    # Query all updated field values with eager loading
    # Note: Response uses VideoFieldValueResponse from Task #71
    # which expects field_id (not nested id), so we need to transform
    updated_stmt = (
        select(VideoFieldValue)
        .where(
            VideoFieldValue.video_id == video_id,
            VideoFieldValue.field_id.in_(field_ids)
        )
        .options(selectinload(VideoFieldValue.field))  # Eager load CustomField
    )
    updated_result = await db.execute(updated_stmt)
    updated_values_raw = updated_result.scalars().all()

    # Transform VideoFieldValue ORM to VideoFieldValueResponse format
    # (match Task #71 response structure)
    from app.schemas.custom_field import CustomFieldResponse

    field_values_response = []
    for fv in updated_values_raw:
        # Determine value based on field type
        if fv.field.field_type == 'rating':
            value = fv.value_numeric
        elif fv.field.field_type in ('select', 'text'):
            value = fv.value_text
        elif fv.field.field_type == 'boolean':
            value = fv.value_boolean
        else:
            value = None

        field_values_response.append(
            VideoFieldValueResponse(
                field_id=fv.field_id,
                field=CustomFieldResponse.model_validate(fv.field),
                value=value,
                schema_name=None,  # Not applicable for direct update
                show_on_card=False,  # Not applicable for direct update
                display_order=0  # Not applicable for direct update
            )
        )

    # === STEP 7: Build response ===
    return BatchUpdateFieldValuesResponse(
        updated_count=len(field_values_response),
        field_values=field_values_response
    )
```

**Why This Pattern:**
- **Step-by-step validation:** Video → Fields → Values (fail fast at each stage)
- **Single query validation:** Fetches all fields in one query (no N+1)
- **All-or-nothing:** No database changes until all validation passes
- **PostgreSQL UPSERT:** `ON CONFLICT DO UPDATE` for idempotent updates (REF MCP validated)
- **Eager loading:** `selectinload(VideoFieldValue.field)` prevents N+1 on response
- **Atomic transaction:** Single `commit()` after all operations
- **Inline validation:** No external dependency on Task #73

**REF MCP Evidence:**
- FastAPI docs recommend detailed docstrings for OpenAPI generation
- SQLAlchemy 2.0 docs recommend `pg_insert()` for PostgreSQL-specific features
- Existing codebase pattern: Tags endpoint uses similar validation flow
- Constraint name `uq_video_field_values` verified in migration file

---

### Step 3: Verify VideoFieldValue Model UNIQUE Constraint

**Files:** `backend/app/models/video_field_value.py`

**Action:** Verify UNIQUE constraint exists for upsert behavior

**Expected Code:**
```python
# Verify this exists in the model (should already be there from Task #62)
from sqlalchemy import UniqueConstraint

class VideoFieldValue(BaseModel):
    __tablename__ = "video_field_values"

    # ... existing columns ...

    __table_args__ = (
        UniqueConstraint('video_id', 'field_id', name='uq_video_field_values'),
    )
```

**Why:** The UPSERT in Step 2 relies on this constraint to determine insert vs update.

**Note:** Task #62 should have already created this constraint. This step is verification only.

---

### Step 4: Add Unit Tests for Batch Update Endpoint

**Files:** `backend/tests/api/test_video_field_values.py` (NEW FILE)

**Action:** Create comprehensive test suite

**Code Structure:**
```python
"""
Unit tests for video field values batch update endpoint.

Tests PUT /api/videos/{video_id}/fields endpoint with:
- Happy path: create, update, mixed upsert
- Validation errors: invalid field_id, invalid values
- Atomicity: all-or-nothing transaction
- Edge cases: empty request, duplicates, batch size
"""
import pytest
from uuid import uuid4, UUID
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.video import Video
from app.models.custom_field import CustomField
from app.models.video_field_value import VideoFieldValue


class TestBatchUpdateVideoFieldValues:
    """Tests for PUT /api/videos/{video_id}/fields endpoint."""

    @pytest.fixture
    async def test_video(self, db_session: AsyncSession) -> Video:
        """Create a test video."""
        video = Video(
            list_id=uuid4(),
            youtube_id="dQw4w9WgXcQ",
            title="Test Video"
        )
        db_session.add(video)
        await db_session.commit()
        await db_session.refresh(video)
        return video

    @pytest.fixture
    async def test_fields(self, db_session: AsyncSession) -> dict[str, CustomField]:
        """Create test custom fields (rating, select, text, boolean)."""
        list_id = uuid4()
        fields = {}

        # Rating field
        rating_field = CustomField(
            list_id=list_id,
            name="Overall Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        db_session.add(rating_field)

        # Select field
        select_field = CustomField(
            list_id=list_id,
            name="Quality",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        db_session.add(select_field)

        # Text field
        text_field = CustomField(
            list_id=list_id,
            name="Notes",
            field_type="text",
            config={"max_length": 500}
        )
        db_session.add(text_field)

        # Boolean field
        boolean_field = CustomField(
            list_id=list_id,
            name="Watched",
            field_type="boolean",
            config={}
        )
        db_session.add(boolean_field)

        await db_session.commit()
        await db_session.refresh(rating_field)
        await db_session.refresh(select_field)
        await db_session.refresh(text_field)
        await db_session.refresh(boolean_field)

        return {
            'rating': rating_field,
            'select': select_field,
            'text': text_field,
            'boolean': boolean_field
        }

    @pytest.mark.asyncio
    async def test_create_new_field_values(
        self, client: AsyncClient, test_video: Video, test_fields: dict
    ):
        """Test creating new field values (INSERT behavior)."""
        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields['rating'].id), "value": 5},
                    {"field_id": str(test_fields['select'].id), "value": "great"}
                ]
            }
        )

        assert response.status_code == 200
        data = response.json()

        assert data['updated_count'] == 2
        assert len(data['field_values']) == 2

        # Verify rating field
        rating_fv = next(
            fv for fv in data['field_values']
            if fv['field_id'] == str(test_fields['rating'].id)
        )
        assert rating_fv['value'] == 5
        assert rating_fv['field']['field_type'] == 'rating'

        # Verify select field
        select_fv = next(
            fv for fv in data['field_values']
            if fv['field_id'] == str(test_fields['select'].id)
        )
        assert select_fv['value'] == 'great'
        assert select_fv['field']['field_type'] == 'select'

    @pytest.mark.asyncio
    async def test_update_existing_field_values(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_video: Video,
        test_fields: dict
    ):
        """Test updating existing field values (UPDATE behavior)."""
        # Create initial values
        initial_value = VideoFieldValue(
            video_id=test_video.id,
            field_id=test_fields['rating'].id,
            value_numeric=3
        )
        db_session.add(initial_value)
        await db_session.commit()

        # Update value from 3 to 5
        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields['rating'].id), "value": 5}
                ]
            }
        )

        assert response.status_code == 200
        data = response.json()

        assert data['updated_count'] == 1
        assert data['field_values'][0]['value'] == 5  # Updated from 3 to 5

    @pytest.mark.asyncio
    async def test_mixed_create_and_update(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_video: Video,
        test_fields: dict
    ):
        """Test upsert: some values exist, some don't (mixed INSERT/UPDATE)."""
        # Create initial value for rating field only
        initial_value = VideoFieldValue(
            video_id=test_video.id,
            field_id=test_fields['rating'].id,
            value_numeric=3
        )
        db_session.add(initial_value)
        await db_session.commit()

        # Update rating (exists) + create select (doesn't exist)
        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields['rating'].id), "value": 5},  # UPDATE
                    {"field_id": str(test_fields['select'].id), "value": "great"}  # INSERT
                ]
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data['updated_count'] == 2

    @pytest.mark.asyncio
    async def test_error_video_not_found(self, client: AsyncClient, test_fields: dict):
        """Test 404 error when video doesn't exist."""
        fake_video_id = uuid4()

        response = await client.put(
            f"/api/videos/{fake_video_id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields['rating'].id), "value": 5}
                ]
            }
        )

        assert response.status_code == 404
        assert "not found" in response.json()['detail'].lower()

    @pytest.mark.asyncio
    async def test_error_invalid_field_id(self, client: AsyncClient, test_video: Video):
        """Test 400 error when field_id doesn't exist."""
        fake_field_id = uuid4()

        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(fake_field_id), "value": 5}
                ]
            }
        )

        assert response.status_code == 400
        assert "invalid field_id" in response.json()['detail'].lower()

    @pytest.mark.asyncio
    async def test_error_duplicate_field_ids(
        self, client: AsyncClient, test_video: Video, test_fields: dict
    ):
        """Test 422 error when request has duplicate field_ids."""
        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields['rating'].id), "value": 3},
                    {"field_id": str(test_fields['rating'].id), "value": 5}  # Duplicate!
                ]
            }
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_error_validation_failure_rating_out_of_range(
        self, client: AsyncClient, test_video: Video, test_fields: dict
    ):
        """Test 422 error when rating value exceeds max_rating."""
        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields['rating'].id), "value": 10}  # Max is 5
                ]
            }
        )

        assert response.status_code == 422
        data = response.json()
        assert "validation failed" in data['detail']['message'].lower()

    @pytest.mark.asyncio
    async def test_error_validation_failure_invalid_select_option(
        self, client: AsyncClient, test_video: Video, test_fields: dict
    ):
        """Test 422 error when select value not in options list."""
        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields['select'].id), "value": "invalid"}
                ]
            }
        )

        assert response.status_code == 422
        data = response.json()
        assert "validation failed" in data['detail']['message'].lower()

    @pytest.mark.asyncio
    async def test_atomicity_all_or_nothing(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_video: Video,
        test_fields: dict
    ):
        """Test transaction atomicity: if one value fails validation, none are updated."""
        # Create initial value
        initial_value = VideoFieldValue(
            video_id=test_video.id,
            field_id=test_fields['rating'].id,
            value_numeric=3
        )
        db_session.add(initial_value)
        await db_session.commit()

        # Try to update with one valid + one invalid value
        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={
                "field_values": [
                    {"field_id": str(test_fields['rating'].id), "value": 5},  # Valid
                    {"field_id": str(test_fields['select'].id), "value": "invalid"}  # Invalid
                ]
            }
        )

        assert response.status_code == 422

        # Verify original value unchanged (atomicity)
        check_stmt = select(VideoFieldValue).where(
            VideoFieldValue.video_id == test_video.id,
            VideoFieldValue.field_id == test_fields['rating'].id
        )
        result = await db_session.execute(check_stmt)
        unchanged = result.scalar_one()

        assert unchanged.value_numeric == 3  # Still 3, not 5

    @pytest.mark.asyncio
    async def test_batch_size_limit(self, client: AsyncClient, test_video: Video):
        """Test 422 error when batch exceeds max size (50 fields)."""
        # Generate 51 fake field updates
        fake_updates = [
            {"field_id": str(uuid4()), "value": i}
            for i in range(51)
        ]

        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={"field_values": fake_updates}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_request_rejected(self, client: AsyncClient, test_video: Video):
        """Test 422 error when field_values list is empty."""
        response = await client.put(
            f"/api/videos/{test_video.id}/fields",
            json={"field_values": []}
        )

        assert response.status_code == 422
```

**Why These Tests:**
- **Happy path:** Create, update, mixed (upsert behavior)
- **Error cases:** 404, 400, 422 (validation)
- **Atomicity:** Verifies all-or-nothing transaction (critical!)
- **Edge cases:** Empty, duplicate field_ids, batch size limit
- **Validation:** Tests inline validation logic

---

### Step 5: Manual Testing Checklist

**Action:** Test endpoint with Swagger UI or curl

**Test Cases:**

1. **Create new values:**
   ```bash
   curl -X PUT "http://localhost:8000/api/videos/{video_id}/fields" \
     -H "Content-Type: application/json" \
     -d '{
       "field_values": [
         {"field_id": "uuid1", "value": 5},
         {"field_id": "uuid2", "value": "great"}
       ]
     }'
   ```
   - Verify: 200 OK, updated_count=2, values created

2. **Update existing values:**
   - Call same endpoint again with different values
   - Verify: 200 OK, values updated (not duplicated)

3. **Invalid video ID:**
   - Verify: 404 Not Found

4. **Invalid field ID:**
   - Verify: 400 Bad Request

5. **Validation error (rating out of range):**
   - Verify: 422 Unprocessable Entity with error details

6. **Duplicate field_ids:**
   - Verify: 422 Unprocessable Entity

7. **Empty request:**
   - Verify: 422 Unprocessable Entity

8. **Performance test:**
   - Update 50 fields in single request
   - Measure response time
   - Verify: < 200ms

---

### Step 6: Update CLAUDE.md Documentation

**Files:** `CLAUDE.md`

**Action:** Add batch update endpoint documentation

**Code:**
```markdown
### Video Field Values Batch Update (Task #72)

**PUT /api/videos/{video_id}/fields:**

Batch update all custom field values for a video in a single atomic transaction.

```json
// Request
{
  "field_values": [
    {"field_id": "uuid1", "value": 5},
    {"field_id": "uuid2", "value": "great"},
    {"field_id": "uuid3", "value": true}
  ]
}

// Response (200)
{
  "updated_count": 3,
  "field_values": [
    {
      "field_id": "uuid1",
      "value": 5,
      "schema_name": null,
      "show_on_card": false,
      "display_order": 0,
      "field": {
        "id": "uuid1",
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
      }
    },
    ...
  ]
}
```

**Transaction Semantics:**
- All-or-nothing: If any validation fails, no changes are persisted
- Upsert: Creates new values or updates existing (idempotent)
- Atomic: Single database transaction for all updates

**Validation (Inline):**
- Video must exist (404 if not)
- All field_ids must be valid (400 if not)
- Values validated per field type (422 if invalid):
  - Rating: numeric, 0 to max_rating
  - Select: string, in options list
  - Text: string, max_length if configured
  - Boolean: true/false
- No duplicate field_ids in request (422 if duplicates)

**Performance:**
- Optimized for batches up to 50 fields
- Single query for validation
- PostgreSQL UPSERT for efficiency
- Target: < 200ms for 10 field updates

**Error Codes:**
- 200: Success
- 400: Invalid field_id
- 404: Video not found
- 422: Validation error (duplicate field_ids, invalid values)

**Implementation Notes:**
- Uses correct constraint name `uq_video_field_values` from migration
- Reuses `VideoFieldValueResponse` from Task #71 (DRY principle)
- Inline validation (independent of Task #73)
```

---

## 🧪 Testing Strategy

### Unit Tests (12 tests in TestBatchUpdateVideoFieldValues)

1. **test_create_new_field_values** - INSERT behavior
2. **test_update_existing_field_values** - UPDATE behavior
3. **test_mixed_create_and_update** - UPSERT mixed
4. **test_error_video_not_found** - 404
5. **test_error_invalid_field_id** - 400
6. **test_error_duplicate_field_ids** - 422
7. **test_error_validation_failure_rating_out_of_range** - 422
8. **test_error_validation_failure_invalid_select_option** - 422
9. **test_atomicity_all_or_nothing** - Transaction atomicity (critical!)
10. **test_batch_size_limit** - 422
11. **test_empty_request_rejected** - 422
12. **test_idempotency** - Repeated requests succeed

### Manual Testing (8 scenarios)

1. Create new values → 200 OK
2. Update existing values → 200 OK
3. Invalid video ID → 404
4. Invalid field ID → 400
5. Validation error → 422
6. Duplicate field_ids → 422
7. Empty request → 422
8. Performance test (50 fields) → < 200ms

---

## ⏱️ Estimated Time

**Total: 3-4 hours**

- Step 1: Create schemas (30 min - reduced from 45 min due to reuse)
- Step 2: Create endpoint (75 min - increased from 60 min due to inline validation)
- Step 3: Verify model constraint (5 min)
- Step 4: Unit tests (90 min)
- Step 5: Manual testing (20 min)
- Step 6: Docs + commit (20 min)

**Subagent-Driven Development Recommended:** Yes

---

## 📝 Implementation Notes

### REF MCP Validation Summary

1. ✅ **Constraint name corrected:** `uq_video_field_values` (verified in migration)
2. ✅ **Schema reuse:** Import `VideoFieldValueResponse` from Task #71
3. ✅ **Inline validation:** No Task #73 dependency, production-ready validation
4. ✅ **All imports included:** UUID, Any, AsyncSession, get_db, etc.

### Differences from Original Plan

| Aspect | Original Plan | Updated Plan (REF MCP) |
|--------|--------------|------------------------|
| Constraint name | `uq_video_field_values_video_field` | `uq_video_field_values` ✅ |
| Response schema | New `VideoFieldValueResponse` | Reuse from Task #71 ✅ |
| Validation | Import from Task #73 | Inline implementation ✅ |
| Dependencies | Task #73 required | Independent ✅ |
| Implementation time | 3-4h | 3-4h (same) |

---

**Plan Created:** 2025-11-09
**REF MCP Validated:** 2025-11-09 (FastAPI, SQLAlchemy 2.0, Pydantic v2, Migration verification)
**Ready for Implementation:** ✅
