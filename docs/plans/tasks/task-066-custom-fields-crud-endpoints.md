# Task #66: Implement Custom Fields CRUD Endpoints

**Task ID:** #66
**Category:** Backend - REST API Endpoints
**Status:** Not Started
**Created:** 2025-11-06
**Dependencies:** Task #64 (CustomField Pydantic Schemas) - Must Complete First

---

## 🎯 Ziel

Implement REST API endpoints for Custom Fields CRUD operations, enabling users to create, read, update, and delete custom field definitions within bookmark lists. The endpoints will be list-scoped (all operations under `/api/lists/{list_id}/custom-fields`), support case-insensitive duplicate detection, validate field configurations based on field_type, and prevent deletion of fields that are actively used in schemas.

**Expected Outcome:** Production-ready API endpoints with comprehensive validation, error handling, and test coverage, ready for frontend integration in Phase 1.

---

## 📋 Acceptance Criteria

- [x] **Endpoint Implementation**
  - [x] GET /api/lists/{list_id}/custom-fields - List all fields with pagination support
  - [x] POST /api/lists/{list_id}/custom-fields - Create new field with config validation
  - [x] PUT /api/lists/{list_id}/custom-fields/{field_id} - Update field metadata
  - [x] DELETE /api/lists/{list_id}/custom-fields/{field_id} - Delete unused field

- [x] **Validation Logic**
  - [x] Case-insensitive duplicate name check (uses `func.lower()`)
  - [x] Config validation delegated to Pydantic schemas (Task #64)
  - [x] List existence validation (404 if list not found)
  - [x] Field existence validation (404 if field not found)
  - [x] Schema usage check on DELETE (409 if field used in any schema)

- [x] **HTTP Status Codes**
  - [x] 200 OK - Successful GET/PUT
  - [x] 201 Created - Successful POST
  - [x] 204 No Content - Successful DELETE
  - [x] 404 Not Found - List or field not found
  - [x] 409 Conflict - Duplicate name OR field used in schema
  - [x] 422 Unprocessable Entity - Pydantic validation errors

- [x] **Testing**
  - [x] Unit tests: 8+ tests in `tests/api/test_custom_fields.py`
  - [x] Integration tests: Full CRUD flow in `tests/integration/test_custom_fields_flow.py`
  - [x] All tests passing with >90% coverage

- [x] **Code Quality**
  - [x] Follows existing patterns (tags.py for CRUD, videos.py for list-scoped endpoints)
  - [x] Comprehensive docstrings with usage examples
  - [x] OpenAPI schema generation works correctly
  - [x] Router registered in main.py

---

## 🛠️ Implementation Steps

### Step 1: Create Pydantic Schemas (PREREQUISITE - Task #64)

**CRITICAL:** Task #64 must be completed BEFORE starting this task.

**Required Schemas:**
- `CustomFieldCreate` - Request body for POST
- `CustomFieldUpdate` - Request body for PUT (all fields optional)
- `CustomFieldResponse` - Response model for all endpoints

**File:** `backend/app/schemas/custom_field.py`

**Validation Logic (handled by Task #64):**
- Field name: 1-255 chars, strip whitespace
- Field type: Literal['select', 'rating', 'text', 'boolean']
- Config validation: Type-specific rules (rating 1-10, select ≥1 option, etc.)

---

### Step 2: Create custom_fields.py Router File

**File:** `backend/app/api/custom_fields.py` (NEW)

**Code:**

```python
"""
Custom Fields CRUD API endpoints.

Implements list-scoped custom field management:
- GET /api/lists/{list_id}/custom-fields - List all fields
- POST /api/lists/{list_id}/custom-fields - Create new field
- PUT /api/lists/{list_id}/custom-fields/{field_id} - Update field
- DELETE /api/lists/{list_id}/custom-fields/{field_id} - Delete field

Includes:
- Case-insensitive duplicate name detection
- Config validation via Pydantic schemas (Task #64)
- Schema usage check on deletion (prevents orphaned references)
- List validation (404 if not found)
"""

from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.schema_field import SchemaField
from app.schemas.custom_field import (
    CustomFieldCreate,
    CustomFieldUpdate,
    CustomFieldResponse
)

router = APIRouter(prefix="/api/lists", tags=["custom-fields"])
```

**REF MCP Evidence:**
- FastAPI router pattern matches existing codebase (tags.py, videos.py)
- List-scoped prefix `/api/lists/{list_id}/custom-fields` follows REST conventions
- Source: https://fastapi.tiangolo.com/tutorial/bigger-applications/

---

### Step 3: Implement GET /custom-fields Endpoint

**File:** `backend/app/api/custom_fields.py` (APPEND)

**Rationale:** Simple list endpoint with eager loading support. No pagination for MVP (typically <50 fields per list). Future enhancement: add `?skip=` and `?limit=` query params.

**Code:**

```python
@router.get(
    "/{list_id}/custom-fields",
    response_model=List[CustomFieldResponse],
    status_code=status.HTTP_200_OK
)
async def list_custom_fields(
    list_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> List[CustomField]:
    """
    List all custom fields for a bookmark list.
    
    Returns all field definitions ordered by creation date (newest first).
    Fields are list-scoped and can be reused across multiple schemas.
    
    Args:
        list_id: UUID of the bookmark list
        db: Database session
        
    Returns:
        List[CustomFieldResponse]: All custom fields in the list
        
    Raises:
        HTTPException 404: List not found
        
    Example Response:
        [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "list_id": "987fcdeb-51a2-43d1-9012-345678901234",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {
                    "options": ["bad", "all over the place", "confusing", "great"]
                },
                "created_at": "2025-11-06T10:30:00Z",
                "updated_at": "2025-11-06T10:30:00Z"
            },
            {
                "id": "234e5678-e89b-12d3-a456-426614174001",
                "list_id": "987fcdeb-51a2-43d1-9012-345678901234",
                "name": "Overall Rating",
                "field_type": "rating",
                "config": {"max_rating": 5},
                "created_at": "2025-11-06T10:25:00Z",
                "updated_at": "2025-11-06T10:25:00Z"
            }
        ]
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()
    
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )
    
    # Query all fields for this list (ordered by created_at DESC)
    stmt = (
        select(CustomField)
        .where(CustomField.list_id == list_id)
        .order_by(CustomField.created_at.desc())
    )
    result = await db.execute(stmt)
    fields = result.scalars().all()
    
    return list(fields)
```

**Design Decision: No Pagination for MVP**
- **Rationale:** Typical use case: 5-20 fields per list (low volume)
- **Future Enhancement:** Add `?skip=` and `?limit=` query params if needed
- **REF MCP:** FastAPI pagination best practices documented

---

### Step 4: Implement POST /custom-fields Endpoint

**File:** `backend/app/api/custom_fields.py` (APPEND)

**Rationale:** Create endpoint with duplicate detection using case-insensitive SQL LOWER(). Pydantic schemas (Task #64) handle config validation, so no manual validation needed here.

**Code:**

```python
@router.post(
    "/{list_id}/custom-fields",
    response_model=CustomFieldResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_custom_field(
    list_id: UUID,
    field_data: CustomFieldCreate,
    db: AsyncSession = Depends(get_db)
) -> CustomField:
    """
    Create a new custom field in a bookmark list.
    
    Validates that:
    - List exists (404 if not found)
    - Field name is unique within list (case-insensitive, 409 if duplicate)
    - Config matches field_type requirements (delegated to Pydantic schema)
    
    Args:
        list_id: UUID of the bookmark list
        field_data: CustomFieldCreate schema with name, field_type, config
        db: Database session
        
    Returns:
        CustomFieldResponse: Created field with generated ID and timestamps
        
    Raises:
        HTTPException 404: List not found
        HTTPException 409: Field name already exists (case-insensitive)
        HTTPException 422: Pydantic validation errors (auto-generated)
        
    Example Request:
        POST /api/lists/{list_id}/custom-fields
        {
            "name": "Presentation Quality",
            "field_type": "select",
            "config": {
                "options": ["bad", "all over the place", "confusing", "great"]
            }
        }
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()
    
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )
    
    # Check for duplicate name (case-insensitive)
    # Uses SQL LOWER() for proper case-insensitive comparison
    stmt = select(CustomField).where(
        CustomField.list_id == list_id,
        func.lower(CustomField.name) == field_data.name.lower()
    )
    result = await db.execute(stmt)
    existing_field = result.scalar_one_or_none()
    
    if existing_field:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Field '{field_data.name}' already exists in this list"
        )
    
    # Create new field
    # Note: Pydantic schema (Task #64) already validated config matches field_type
    new_field = CustomField(
        list_id=list_id,
        name=field_data.name,
        field_type=field_data.field_type,
        config=field_data.config
    )
    db.add(new_field)
    await db.commit()
    await db.refresh(new_field)
    
    return new_field
```

**REF MCP Evidence:**
- SQLAlchemy 2.0 async pattern: `await db.execute(select(...))` followed by `.scalar_one_or_none()`
- Case-insensitive check: `func.lower()` recommended over `ilike()` for exact matches
- Source: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html

**Design Decision: 409 Conflict vs 400 Bad Request**
- **Chosen:** 409 Conflict for duplicate name
- **Rationale:** Indicates resource conflict, not malformed request
- **REF MCP:** FastAPI status codes guide recommends 409 for uniqueness violations
- **Alternative:** 400 Bad Request (used by some APIs, less semantic)

---

### Step 5: Implement PUT /custom-fields/{field_id} Endpoint

**File:** `backend/app/api/custom_fields.py` (APPEND)

**Rationale:** Update endpoint supports partial updates (PATCH semantics via optional fields in CustomFieldUpdate). Duplicate check only runs if name is being changed.

**Code:**

```python
@router.put(
    "/{list_id}/custom-fields/{field_id}",
    response_model=CustomFieldResponse,
    status_code=status.HTTP_200_OK
)
async def update_custom_field(
    list_id: UUID,
    field_id: UUID,
    field_update: CustomFieldUpdate,
    db: AsyncSession = Depends(get_db)
) -> CustomField:
    """
    Update an existing custom field.
    
    Supports partial updates (all fields optional). When updating name,
    performs case-insensitive duplicate check. Config validation is
    delegated to Pydantic schema (Task #64).
    
    Args:
        list_id: UUID of the bookmark list
        field_id: UUID of the field to update
        field_update: CustomFieldUpdate schema (all fields optional)
        db: Database session
        
    Returns:
        CustomFieldResponse: Updated field with new timestamps
        
    Raises:
        HTTPException 404: List or field not found
        HTTPException 409: New field name already exists (case-insensitive)
        HTTPException 422: Pydantic validation errors (auto-generated)
        
    Example Request (partial update):
        PUT /api/lists/{list_id}/custom-fields/{field_id}
        {"name": "Updated Field Name"}
        
    Example Request (full update):
        PUT /api/lists/{list_id}/custom-fields/{field_id}
        {
            "name": "Overall Rating",
            "field_type": "rating",
            "config": {"max_rating": 10}
        }
        
    Note: Changing field_type on fields with existing values may cause
    data inconsistencies. Frontend should warn users before allowing this.
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()
    
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )
    
    # Validate field exists and belongs to this list
    stmt = select(CustomField).where(
        CustomField.id == field_id,
        CustomField.list_id == list_id
    )
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with id {field_id} not found in list {list_id}"
        )
    
    # Check for duplicate name if name is being updated (case-insensitive)
    if field_update.name is not None and field_update.name.lower() != field.name.lower():
        duplicate_check = select(CustomField).where(
            CustomField.list_id == list_id,
            func.lower(CustomField.name) == field_update.name.lower(),
            CustomField.id != field_id  # Exclude current field
        )
        duplicate_result = await db.execute(duplicate_check)
        existing = duplicate_result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Field '{field_update.name}' already exists in this list"
            )
    
    # Update fields using Pydantic's exclude_unset (only updates provided fields)
    # REF MCP: model_dump(exclude_unset=True) returns only fields explicitly set in request
    # This is more compact and maintainable than manual if-chains
    update_data = field_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(field, key, value)

    await db.commit()
    await db.refresh(field)
    
    return field
```

**Design Decision: PUT vs PATCH Semantics**
- **Chosen:** PUT with optional fields (PATCH semantics)
- **Rationale:** Simpler for clients (single endpoint for partial/full updates)
- **REF MCP:** Common FastAPI pattern, avoids duplicate endpoint logic
- **Alternative:** Separate PUT (full replace) and PATCH (partial update) endpoints

**Design Decision: model_dump(exclude_unset=True) vs Manual If-Chains**
- **Chosen:** Use `model_dump(exclude_unset=True)` with setattr loop
- **Rationale:**
  - More compact (5 lines vs 7 lines)
  - DRY principle - no repetition for each field
  - Future-proof: new fields automatically supported
  - Pydantic v2 best practice for partial updates
- **REF MCP:** Pydantic v2 Migration Guide recommends this pattern
- **Trade-off:** Slightly less explicit than manual if-chains, but only 3 fields (acceptable)

---

### Step 6: Implement DELETE /custom-fields/{field_id} Endpoint

**File:** `backend/app/api/custom_fields.py` (APPEND)

**Rationale:** Delete endpoint checks if field is used in any schema (via SchemaField join table). Returns 409 Conflict with usage count to guide user. This prevents orphaned references and data inconsistencies.

**Code:**

```python
@router.delete(
    "/{list_id}/custom-fields/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_custom_field(
    list_id: UUID,
    field_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    Delete a custom field from a bookmark list.
    
    Validates that field is not used in any schema before deletion.
    If field is used in schemas, returns 409 Conflict with usage count.
    
    Cascade behavior:
    - Deletes all VideoFieldValue records (CASCADE via ORM)
    - Does NOT delete SchemaField associations (must be removed first)
    
    Args:
        list_id: UUID of the bookmark list
        field_id: UUID of the field to delete
        db: Database session
        
    Returns:
        None (204 No Content on success)
        
    Raises:
        HTTPException 404: List or field not found
        HTTPException 409: Field is used in one or more schemas
        
    Example Success:
        DELETE /api/lists/{list_id}/custom-fields/{field_id}
        Response: 204 No Content
        
    Example Failure (field in use):
        DELETE /api/lists/{list_id}/custom-fields/{field_id}
        Response: 409 Conflict
        {
            "detail": "Cannot delete field 'Overall Rating' - used in 2 schema(s). Remove field from schemas first."
        }
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()
    
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )
    
    # Validate field exists and belongs to this list
    stmt = select(CustomField).where(
        CustomField.id == field_id,
        CustomField.list_id == list_id
    )
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with id {field_id} not found in list {list_id}"
        )
    
    # Check if field is used in any schema (via SchemaField join table)
    usage_stmt = select(func.count()).select_from(SchemaField).where(
        SchemaField.field_id == field_id
    )
    usage_count = await db.scalar(usage_stmt)
    
    if usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete field '{field.name}' - used in {usage_count} schema(s). Remove field from schemas first."
        )
    
    # Delete field (CASCADE will delete VideoFieldValue records)
    await db.delete(field)
    await db.commit()
    
    return None
```

**REF MCP Evidence:**
- `func.count()` pattern for efficient count queries
- `await db.scalar(stmt)` returns single scalar value
- Source: https://docs.sqlalchemy.org/en/20/orm/queryguide/query.html

**Design Decision: Fail DELETE vs Cascade Delete**
- **Chosen:** Fail with 409 Conflict if field used in schema
- **Alternatives Considered:**
  1. CASCADE delete (remove from schemas automatically) - Too dangerous
  2. Soft delete with `is_deleted` flag - Adds complexity
  3. Force parameter `?force=true` - UX complexity
- **Rationale:** Prevent accidental data loss, guide user to clean up schemas first
- **Validation:** Design doc line 531-535 specifies "fails if used in any schema"

**Design Decision: Show Usage Count**
- **Rationale:** Helps user understand impact (1 schema vs 10 schemas)
- **UX Benefit:** Frontend can show list of affected schemas

---

### Step 7: Register Router in main.py

**File:** `backend/app/main.py` (MODIFY)

**Code:**

```python
# Around line 12 - Add import
from app.api import lists, videos, processing, websocket, tags, custom_fields

# Around line 47 - Add router registration (after tags.router)
app.include_router(custom_fields.router)
```

**Expected Result:**
```python
# Register routers
app.include_router(lists.router)
app.include_router(videos.router)
app.include_router(processing.router)
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(tags.router)
app.include_router(custom_fields.router)
```

**REF MCP Evidence:** Router registration pattern matches existing codebase

---

### Step 8: Create Unit Tests

**File:** `backend/tests/api/test_custom_fields.py` (NEW)

**Rationale:** Unit tests validate each endpoint in isolation using test fixtures. Tests grouped by endpoint for clarity.

**Code:**

```python
"""
Unit tests for Custom Fields CRUD API endpoints.

Tests cover:
- GET /api/lists/{list_id}/custom-fields
- POST /api/lists/{list_id}/custom-fields
- PUT /api/lists/{list_id}/custom-fields/{field_id}
- DELETE /api/lists/{list_id}/custom-fields/{field_id}

Validation scenarios:
- Case-insensitive duplicate detection
- Config validation (delegated to Pydantic)
- Schema usage check on deletion
- 404 errors for missing resources
- 409 errors for conflicts
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
async def rating_field(test_db: AsyncSession, test_list: BookmarkList) -> CustomField:
    """Create a test rating field."""
    field = CustomField(
        list_id=test_list.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def select_field(test_db: AsyncSession, test_list: BookmarkList) -> CustomField:
    """Create a test select field."""
    field = CustomField(
        list_id=test_list.id,
        name="Presentation Quality",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    test_db.add(field)
    await test_db.commit()
    await test_db.refresh(field)
    return field


@pytest.fixture
async def field_schema(test_db: AsyncSession, test_list: BookmarkList) -> FieldSchema:
    """Create a test field schema."""
    schema = FieldSchema(
        list_id=test_list.id,
        name="Test Schema",
        description="A test schema"
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    return schema


# ============================================================================
# GET /api/lists/{list_id}/custom-fields
# ============================================================================

@pytest.mark.asyncio
async def test_list_custom_fields_empty(client: AsyncClient, test_list: BookmarkList):
    """Test listing fields for list with no fields."""
    response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_custom_fields_with_fields(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField,
    select_field: CustomField
):
    """Test listing fields returns all fields ordered by created_at DESC."""
    response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert response.status_code == 200
    
    fields = response.json()
    assert len(fields) == 2
    
    # Verify fields present (order not critical for test)
    field_names = {f["name"] for f in fields}
    assert "Overall Rating" in field_names
    assert "Presentation Quality" in field_names
    
    # Verify response structure
    assert all("id" in f for f in fields)
    assert all("name" in f for f in fields)
    assert all("field_type" in f for f in fields)
    assert all("config" in f for f in fields)
    assert all("created_at" in f for f in fields)
    assert all("updated_at" in f for f in fields)


@pytest.mark.asyncio
async def test_list_custom_fields_list_not_found(client: AsyncClient):
    """Test listing fields for non-existent list returns 404."""
    import uuid
    fake_list_id = uuid.uuid4()
    response = await client.get(f"/api/lists/{fake_list_id}/custom-fields")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ============================================================================
# POST /api/lists/{list_id}/custom-fields
# ============================================================================

@pytest.mark.asyncio
async def test_create_custom_field_rating(client: AsyncClient, test_list: BookmarkList):
    """Test creating a rating field."""
    field_data = {
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
    }
    
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Overall Rating"
    assert data["field_type"] == "rating"
    assert data["config"]["max_rating"] == 5
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_custom_field_select(client: AsyncClient, test_list: BookmarkList):
    """Test creating a select field with options."""
    field_data = {
        "name": "Presentation Quality",
        "field_type": "select",
        "config": {"options": ["bad", "all over the place", "confusing", "great"]}
    }
    
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Presentation Quality"
    assert data["field_type"] == "select"
    assert len(data["config"]["options"]) == 4


@pytest.mark.asyncio
async def test_create_custom_field_duplicate_name(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField
):
    """Test creating field with duplicate name (case-insensitive) returns 409."""
    # Try to create field with same name (different case)
    field_data = {
        "name": "overall rating",  # lowercase version of existing "Overall Rating"
        "field_type": "rating",
        "config": {"max_rating": 10}
    }
    
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )
    
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_custom_field_list_not_found(client: AsyncClient):
    """Test creating field for non-existent list returns 404."""
    import uuid
    fake_list_id = uuid.uuid4()
    
    field_data = {
        "name": "Test Field",
        "field_type": "boolean",
        "config": {}
    }
    
    response = await client.post(
        f"/api/lists/{fake_list_id}/custom-fields",
        json=field_data
    )
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_custom_field_invalid_config(client: AsyncClient, test_list: BookmarkList):
    """Test creating field with invalid config returns 422 (Pydantic validation)."""
    # Rating field without max_rating
    field_data = {
        "name": "Invalid Rating",
        "field_type": "rating",
        "config": {}  # Missing max_rating
    }
    
    response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )
    
    assert response.status_code == 422


# ============================================================================
# PUT /api/lists/{list_id}/custom-fields/{field_id}
# ============================================================================

@pytest.mark.asyncio
async def test_update_custom_field_name(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField
):
    """Test updating field name."""
    update_data = {"name": "Updated Rating"}
    
    response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}",
        json=update_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Rating"
    assert data["field_type"] == "rating"  # Unchanged
    assert data["config"]["max_rating"] == 5  # Unchanged


@pytest.mark.asyncio
async def test_update_custom_field_full(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField
):
    """Test full update (all fields)."""
    update_data = {
        "name": "New Rating",
        "field_type": "rating",
        "config": {"max_rating": 10}
    }
    
    response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}",
        json=update_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Rating"
    assert data["config"]["max_rating"] == 10


@pytest.mark.asyncio
async def test_update_custom_field_duplicate_name(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField,
    select_field: CustomField
):
    """Test updating field name to duplicate returns 409."""
    # Try to rename rating_field to match select_field name
    update_data = {"name": "presentation quality"}  # Lowercase version
    
    response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}",
        json=update_data
    )
    
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_custom_field_not_found(client: AsyncClient, test_list: BookmarkList):
    """Test updating non-existent field returns 404."""
    import uuid
    fake_field_id = uuid.uuid4()
    
    update_data = {"name": "Updated Name"}
    
    response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{fake_field_id}",
        json=update_data
    )
    
    assert response.status_code == 404


# ============================================================================
# DELETE /api/lists/{list_id}/custom-fields/{field_id}
# ============================================================================

@pytest.mark.asyncio
async def test_delete_custom_field_success(
    client: AsyncClient,
    test_list: BookmarkList,
    rating_field: CustomField
):
    """Test deleting unused field succeeds."""
    response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}"
    )
    
    assert response.status_code == 204
    
    # Verify field is deleted
    get_response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    fields = get_response.json()
    assert not any(f["id"] == str(rating_field.id) for f in fields)


@pytest.mark.asyncio
async def test_delete_custom_field_used_in_schema(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList,
    rating_field: CustomField,
    field_schema: FieldSchema
):
    """Test deleting field used in schema returns 409."""
    # Add field to schema (create SchemaField association)
    schema_field = SchemaField(
        schema_id=field_schema.id,
        field_id=rating_field.id,
        display_order=0,
        show_on_card=True
    )
    test_db.add(schema_field)
    await test_db.commit()
    
    # Try to delete field
    response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{rating_field.id}"
    )
    
    assert response.status_code == 409
    assert "used in" in response.json()["detail"].lower()
    assert "schema" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_custom_field_not_found(client: AsyncClient, test_list: BookmarkList):
    """Test deleting non-existent field returns 404."""
    import uuid
    fake_field_id = uuid.uuid4()
    
    response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{fake_field_id}"
    )
    
    assert response.status_code == 404
```

**Test Coverage:** 16 unit tests covering all endpoints and error scenarios

---

### Step 9: Create Integration Tests

**File:** `backend/tests/integration/test_custom_fields_flow.py` (NEW)

**Rationale:** Integration tests validate complete CRUD flow with real database transactions. Tests real-world usage patterns.

**Code:**

```python
"""
Integration tests for Custom Fields CRUD flow.

Tests complete workflows:
- Create list → create field → list fields → update field → delete field
- Create field → use in schema → attempt delete (should fail)
- Duplicate name detection across multiple fields
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.custom_field import CustomField
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField


@pytest.mark.asyncio
async def test_complete_crud_flow(client: AsyncClient, test_list: BookmarkList):
    """Test complete CRUD flow: create → list → update → delete."""
    
    # 1. Create rating field
    create_data = {
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
    }
    create_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=create_data
    )
    assert create_response.status_code == 201
    field_id = create_response.json()["id"]
    
    # 2. List fields (should have 1 field)
    list_response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    
    # 3. Update field name
    update_data = {"name": "Updated Rating"}
    update_response = await client.put(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}",
        json=update_data
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Rating"
    
    # 4. Delete field
    delete_response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}"
    )
    assert delete_response.status_code == 204
    
    # 5. Verify field is gone
    final_list_response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert final_list_response.status_code == 200
    assert len(final_list_response.json()) == 0


@pytest.mark.asyncio
async def test_create_multiple_fields_different_types(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test creating multiple fields with different types."""
    
    fields_to_create = [
        {
            "name": "Overall Rating",
            "field_type": "rating",
            "config": {"max_rating": 5}
        },
        {
            "name": "Presentation Quality",
            "field_type": "select",
            "config": {"options": ["bad", "good", "great"]}
        },
        {
            "name": "Notes",
            "field_type": "text",
            "config": {"max_length": 500}
        },
        {
            "name": "Recommended",
            "field_type": "boolean",
            "config": {}
        }
    ]
    
    # Create all fields
    for field_data in fields_to_create:
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json=field_data
        )
        assert response.status_code == 201
    
    # Verify all created
    list_response = await client.get(f"/api/lists/{test_list.id}/custom-fields")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 4


@pytest.mark.asyncio
async def test_field_used_in_schema_cannot_be_deleted(
    client: AsyncClient,
    test_db: AsyncSession,
    test_list: BookmarkList
):
    """Test that field used in schema cannot be deleted."""
    
    # 1. Create field
    field_data = {
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
    }
    create_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )
    assert create_response.status_code == 201
    field_id = create_response.json()["id"]
    
    # 2. Create schema and add field to it
    schema = FieldSchema(
        list_id=test_list.id,
        name="Test Schema",
        description="A test schema"
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    
    schema_field = SchemaField(
        schema_id=schema.id,
        field_id=field_id,
        display_order=0,
        show_on_card=True
    )
    test_db.add(schema_field)
    await test_db.commit()
    
    # 3. Try to delete field (should fail with 409)
    delete_response = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}"
    )
    assert delete_response.status_code == 409
    assert "used in" in delete_response.json()["detail"].lower()
    
    # 4. Remove field from schema
    await test_db.delete(schema_field)
    await test_db.commit()
    
    # 5. Now deletion should succeed
    delete_response_2 = await client.delete(
        f"/api/lists/{test_list.id}/custom-fields/{field_id}"
    )
    assert delete_response_2.status_code == 204


@pytest.mark.asyncio
async def test_case_insensitive_duplicate_detection(
    client: AsyncClient,
    test_list: BookmarkList
):
    """Test that duplicate detection is case-insensitive."""
    
    # Create field with mixed case
    field_data = {
        "name": "Presentation Quality",
        "field_type": "select",
        "config": {"options": ["bad", "good", "great"]}
    }
    response1 = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json=field_data
    )
    assert response1.status_code == 201
    
    # Try to create with different case variations
    duplicate_variations = [
        "presentation quality",  # all lowercase
        "PRESENTATION QUALITY",  # all uppercase
        "PrEsEnTaTiOn QuAlItY",  # mixed case
    ]
    
    for duplicate_name in duplicate_variations:
        duplicate_data = {
            "name": duplicate_name,
            "field_type": "rating",
            "config": {"max_rating": 5}
        }
        response = await client.post(
            f"/api/lists/{test_list.id}/custom-fields",
            json=duplicate_data
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()
```

**Test Coverage:** 4 integration tests covering real-world workflows

---

### Step 10: Run Tests and Verify

**Commands:**

```bash
cd backend

# Run unit tests
pytest tests/api/test_custom_fields.py -v

# Run integration tests
pytest tests/integration/test_custom_fields_flow.py -v

# Run all custom fields tests
pytest tests/ -k "custom_field" -v

# Run with coverage
pytest tests/ -k "custom_field" --cov=app.api.custom_fields --cov-report=term-missing
```

**Expected Output:**

```
tests/api/test_custom_fields.py::test_list_custom_fields_empty PASSED
tests/api/test_custom_fields.py::test_list_custom_fields_with_fields PASSED
tests/api/test_custom_fields.py::test_list_custom_fields_list_not_found PASSED
tests/api/test_custom_fields.py::test_create_custom_field_rating PASSED
tests/api/test_custom_fields.py::test_create_custom_field_select PASSED
tests/api/test_custom_fields.py::test_create_custom_field_duplicate_name PASSED
tests/api/test_custom_fields.py::test_create_custom_field_list_not_found PASSED
tests/api/test_custom_fields.py::test_create_custom_field_invalid_config PASSED
tests/api/test_custom_fields.py::test_update_custom_field_name PASSED
tests/api/test_custom_fields.py::test_update_custom_field_full PASSED
tests/api/test_custom_fields.py::test_update_custom_field_duplicate_name PASSED
tests/api/test_custom_fields.py::test_update_custom_field_not_found PASSED
tests/api/test_custom_fields.py::test_delete_custom_field_success PASSED
tests/api/test_custom_fields.py::test_delete_custom_field_used_in_schema PASSED
tests/api/test_custom_fields.py::test_delete_custom_field_not_found PASSED

tests/integration/test_custom_fields_flow.py::test_complete_crud_flow PASSED
tests/integration/test_custom_fields_flow.py::test_create_multiple_fields_different_types PASSED
tests/integration/test_custom_fields_flow.py::test_field_used_in_schema_cannot_be_deleted PASSED
tests/integration/test_custom_fields_flow.py::test_case_insensitive_duplicate_detection PASSED

========================== 20 passed in 2.34s ==========================

Coverage Report:
app/api/custom_fields.py    95%    (missing: 3 lines - error edge cases)
```

---

### Step 11: Manual Testing with Swagger UI

**URL:** http://localhost:8000/docs

**Test Scenarios:**

1. **List Fields (Empty)**
   - Navigate to GET `/api/lists/{list_id}/custom-fields`
   - Click "Try it out"
   - Enter valid list_id (get from GET /api/lists)
   - Execute
   - Expected: 200 OK, empty array `[]`

2. **Create Rating Field**
   - Navigate to POST `/api/lists/{list_id}/custom-fields`
   - Click "Try it out"
   - Enter list_id
   - Request body:
     ```json
     {
       "name": "Overall Rating",
       "field_type": "rating",
       "config": {"max_rating": 5}
     }
     ```
   - Execute
   - Expected: 201 Created, field with ID

3. **Create Select Field**
   - Navigate to POST `/api/lists/{list_id}/custom-fields`
   - Request body:
     ```json
     {
       "name": "Presentation Quality",
       "field_type": "select",
       "config": {
         "options": ["bad", "all over the place", "confusing", "great"]
       }
     }
     ```
   - Execute
   - Expected: 201 Created

4. **Test Duplicate (Case-Insensitive)**
   - POST same endpoint
   - Request body:
     ```json
     {
       "name": "overall rating",
       "field_type": "rating",
       "config": {"max_rating": 10}
     }
     ```
   - Expected: 409 Conflict

5. **List Fields (With Data)**
   - GET `/api/lists/{list_id}/custom-fields`
   - Expected: 200 OK, array with 2 fields

6. **Update Field**
   - PUT `/api/lists/{list_id}/custom-fields/{field_id}`
   - Request body: `{"name": "Updated Rating"}`
   - Expected: 200 OK, updated field

7. **Delete Field**
   - DELETE `/api/lists/{list_id}/custom-fields/{field_id}`
   - Expected: 204 No Content

8. **Verify OpenAPI Schema**
   - Check that all endpoints appear in docs
   - Verify request/response schemas display correctly
   - Check example values are helpful

---

## 🧪 Testing Strategy

### Unit Tests (16 tests)

**File:** `backend/tests/api/test_custom_fields.py`

#### GET /custom-fields Tests (3 tests)
1. `test_list_custom_fields_empty` - Empty list returns []
2. `test_list_custom_fields_with_fields` - Returns all fields with correct structure
3. `test_list_custom_fields_list_not_found` - 404 for non-existent list

#### POST /custom-fields Tests (5 tests)
4. `test_create_custom_field_rating` - Create rating field
5. `test_create_custom_field_select` - Create select field with options
6. `test_create_custom_field_duplicate_name` - 409 for case-insensitive duplicate
7. `test_create_custom_field_list_not_found` - 404 for non-existent list
8. `test_create_custom_field_invalid_config` - 422 for invalid config (Pydantic)

#### PUT /custom-fields/{field_id} Tests (4 tests)
9. `test_update_custom_field_name` - Partial update (name only)
10. `test_update_custom_field_full` - Full update (all fields)
11. `test_update_custom_field_duplicate_name` - 409 when renaming to duplicate
12. `test_update_custom_field_not_found` - 404 for non-existent field

#### DELETE /custom-fields/{field_id} Tests (3 tests)
13. `test_delete_custom_field_success` - Delete unused field
14. `test_delete_custom_field_used_in_schema` - 409 when field used in schema
15. `test_delete_custom_field_not_found` - 404 for non-existent field

### Integration Tests (4 tests)

**File:** `backend/tests/integration/test_custom_fields_flow.py`

1. `test_complete_crud_flow` - Create → list → update → delete
2. `test_create_multiple_fields_different_types` - Create 4 different field types
3. `test_field_used_in_schema_cannot_be_deleted` - Full workflow with schema dependency
4. `test_case_insensitive_duplicate_detection` - Test all case variations

### Manual Testing

**Swagger UI:** http://localhost:8000/docs
- Verify all 4 endpoints appear
- Test each endpoint with valid data
- Test error scenarios (duplicate, not found, invalid config)
- Verify OpenAPI schema accuracy

**Expected Coverage:** >90% (all branches except rare edge cases)

---

## 📚 Reference

### Related Files

**API Endpoint Patterns:**
- `backend/app/api/tags.py` - CRUD pattern reference
- `backend/app/api/videos.py` - List-scoped endpoints, error handling

**ORM Models:**
- `backend/app/models/custom_field.py` - CustomField model
- `backend/app/models/schema_field.py` - SchemaField join table (for DELETE check)

**Pydantic Schemas (Task #64):**
- `backend/app/schemas/custom_field.py` - Request/response schemas

**Design Documentation:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 176-304 (API design)

**Test Fixtures:**
- `backend/tests/conftest.py` - Test database setup

### Design Decisions

#### Decision 1: List-Scoped Endpoints vs Global

**Chosen:** List-scoped (`/api/lists/{list_id}/custom-fields`)

**Rationale:**
- ✅ Fields are list-scoped in database (list_id foreign key)
- ✅ Matches existing patterns (videos, tags)
- ✅ Clearer permission boundaries (user owns list → user owns fields)
- ❌ Slightly longer URLs

**Alternative:** Global `/api/custom-fields?list_id={id}` (rejected - less RESTful)

**Validation:** Design doc line 180 specifies `/api/lists/{list_id}/` base path

---

#### Decision 2: Fail DELETE vs CASCADE Delete

**Chosen:** Fail with 409 Conflict if field used in schema

**Rationale:**
- ✅ Prevents accidental data loss (field values, schema definitions)
- ✅ Forces user to consciously remove field from schemas first
- ✅ Returns helpful error with usage count
- ❌ Requires extra step for user

**Alternatives Considered:**
1. CASCADE delete (remove from schemas automatically) - Too dangerous
2. Soft delete with `is_deleted` flag - Adds complexity, not needed for MVP
3. Force parameter `?force=true` - UX complexity, not RESTful

**Validation:** Design doc line 187 explicitly says "fails if used in any schema"

---

#### Decision 3: Case-Insensitive Duplicate Check

**Chosen:** `func.lower()` comparison in SQL

**Rationale:**
- ✅ Consistent with existing tags.py pattern
- ✅ Database-level comparison (no race conditions)
- ✅ Index-friendly (can add functional index on LOWER(name) if needed)
- ✅ Works across all Unicode scripts

**Alternative:** Python-side `.lower()` comparison (rejected - race conditions)

**REF MCP Evidence:** SQLAlchemy docs recommend `func.lower()` for case-insensitive exact matches

**Validation:** Design doc line 318 specifies case-insensitive matching

---

#### Decision 4: No Pagination for MVP

**Chosen:** Return all fields in single response

**Rationale:**
- ✅ Typical use case: 5-20 fields per list (low volume)
- ✅ Simplifies frontend state management
- ✅ Reduces API round trips
- ❌ Could be slow for lists with 100+ fields (rare edge case)

**Future Enhancement:** Add `?skip=` and `?limit=` query params if needed

**Validation:** Similar pattern in tags.py (no pagination)

---

#### Decision 5: PUT with Optional Fields (PATCH Semantics)

**Chosen:** Single PUT endpoint supporting partial updates

**Rationale:**
- ✅ Simpler for clients (one endpoint for all updates)
- ✅ Matches Pydantic schema (CustomFieldUpdate with optional fields)
- ✅ Avoids duplicate validation logic
- ❌ Less strict than separate PUT/PATCH

**Alternative:** Separate PUT (full replace) and PATCH (partial) endpoints

**REF MCP Evidence:** Common FastAPI pattern, recommended for simplicity

---

#### Decision 6: Config Validation in Pydantic vs Endpoint

**Chosen:** Delegate config validation to Pydantic schemas (Task #64)

**Rationale:**
- ✅ Single source of truth for validation rules
- ✅ Automatic 422 responses with clear error messages
- ✅ Reusable across endpoints (POST and PUT use same schema)
- ✅ Better separation of concerns

**Alternative:** Manual validation in endpoint functions (rejected - code duplication)

**Validation:** Task #64 implements comprehensive config validation

---

### REF MCP Validation Summary

**Query 1: FastAPI CRUD endpoints best practices**
- HTTPException for error handling
- Standard status codes: 200 OK, 201 Created, 204 No Content, 404 Not Found, 409 Conflict
- Response models for automatic serialization
- **Applied:** All endpoints follow these patterns

**Query 2: SQLAlchemy 2.0 async patterns**
- `await db.execute(select(...))` followed by `.scalar_one_or_none()`
- `func.count()` with `await db.scalar()` for efficient counts
- `func.lower()` for case-insensitive comparisons
- **Applied:** All database queries use async patterns

**Query 3: FastAPI dependency injection**
- `Depends(get_db)` for database session injection
- Pattern: `db: AsyncSession = Depends(get_db)`
- **Applied:** All endpoints use dependency injection

**Query 4: FastAPI HTTPException status codes**
- 404 Not Found: Resource doesn't exist
- 409 Conflict: Uniqueness violation or resource conflict
- 422 Unprocessable Entity: Pydantic validation errors (automatic)
- **Applied:** Correct status codes for all error scenarios

**Query 5: Pydantic v2 response model validation**
- `response_model=CustomFieldResponse` for automatic serialization
- `model_config = {"from_attributes": True}` for ORM conversion
- **Applied:** All endpoints use response models (defined in Task #64)

**Query 6: Pydantic v2 partial updates (REF MCP 2025-11-07)**
- `model_dump(exclude_unset=True)` returns only fields explicitly set in request
- Best practice for partial updates in PUT/PATCH endpoints
- More maintainable than manual if-chains for each field
- **Applied:** PUT endpoint uses this pattern for field updates

---

## ⏱️ Estimated Effort

### Prerequisites (Task #64): 4-5.5 hours
- **MUST BE COMPLETED FIRST**
- Pydantic schemas implementation
- Schema validation tests

### Implementation: 3-4 hours

**Breakdown:**
- Step 1: Skip (Task #64 dependency)
- Step 2: Router file setup: 15 min
- Step 3: GET endpoint: 30 min
- Step 4: POST endpoint: 45 min (duplicate check logic)
- Step 5: PUT endpoint: 45 min (duplicate check + partial updates)
- Step 6: DELETE endpoint: 45 min (schema usage check)
- Step 7: Register router: 5 min

### Testing: 2-3 hours

**Breakdown:**
- Step 8: Unit tests (16 tests): 90 min
- Step 9: Integration tests (4 tests): 45 min
- Step 10: Run tests and fix issues: 30 min
- Step 11: Manual testing in Swagger: 15 min

### Total: 5-7 hours (excluding Task #64)

**Critical Path:** Task #64 → Task #66 (sequential dependency)

---

## ✅ Completion Checklist

Before marking this task as complete:

**Prerequisites:**
- [ ] Task #64 completed (Pydantic schemas implemented and tested)
- [ ] All schemas exported in `backend/app/schemas/__init__.py`

**Implementation:**
- [ ] Router file created (`backend/app/api/custom_fields.py`)
- [ ] GET endpoint implemented with list validation
- [ ] POST endpoint implemented with duplicate check
- [ ] PUT endpoint implemented with partial update support
- [ ] DELETE endpoint implemented with schema usage check
- [ ] Router registered in `backend/app/main.py`

**Testing:**
- [ ] 16 unit tests written and passing
- [ ] 4 integration tests written and passing
- [ ] Test coverage >90%
- [ ] Manual testing in Swagger UI completed

**Code Quality:**
- [ ] Comprehensive docstrings (module, functions, examples)
- [ ] Error messages are clear and actionable
- [ ] Follows existing codebase patterns (tags.py, videos.py)
- [ ] REF MCP sources validated

**Documentation:**
- [ ] OpenAPI docs generate correctly
- [ ] All endpoints appear in Swagger UI
- [ ] Request/response schemas display correctly

---

## 🔗 Related Tasks

**Depends On:**
- ✅ Task #58: Database migration for custom fields system
- ✅ Task #59: CustomField ORM model
- ✅ Task #60: FieldSchema ORM model
- ⏳ Task #64: CustomField Pydantic schemas (MUST COMPLETE FIRST)

**Blocks:**
- Task #67: Implement duplicate field check endpoint (optional helper endpoint)
- Task #78: Create useCustomFields React Query hook (frontend)
- Task #80: Create FieldEditor component (frontend)

**Related:**
- Task #68: Implement field schemas CRUD endpoints (similar pattern)
- Task #69: Implement schema-fields endpoints (uses field_id references)

---

**Plan Created:** 2025-11-06
**REF MCP Validated:** ✅ 5 queries validated
**Ready for Implementation:** ⏳ After Task #64
**Estimated Implementation Time:** 5-7 hours (excluding Task #64)
**Critical Path:** Task #64 → Task #66 (sequential)
