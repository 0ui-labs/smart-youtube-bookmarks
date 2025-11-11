# Task #67: Implement Duplicate Field Check Endpoint

**Plan Task:** #67
**Wave/Phase:** Wave 1 Backend - Custom Fields System
**Dependencies:** Task #64 (CustomField Pydantic Schemas), Task #66 (CRUD Endpoints)

---

## 🎯 Ziel

Implement a specialized POST endpoint for real-time duplicate field name checking in the Custom Fields UI. The endpoint performs case-insensitive matching and returns the existing field details if found, enabling the DuplicateWarning component to provide rich user feedback during field creation.

**Expected Outcome:** Fast (<100ms) duplicate check endpoint used by frontend for real-time validation with case-insensitive matching.

---

## 📋 Acceptance Criteria

- [ ] POST /api/lists/{list_id}/custom-fields/check-duplicate endpoint implemented
- [ ] Request body: `{"name": "field name"}`
- [ ] Response if exists: `{"exists": true, "field": {CustomField object}}`
- [ ] Response if not exists: `{"exists": false, "field": null}`
- [ ] Case-insensitive matching using func.lower()
- [ ] Returns 200 OK even when field exists (not an error)
- [ ] Query performance <100ms (uses existing index on list_id)
- [ ] Unit tests passing (4+ test cases)
- [ ] Integration test passing (full flow)

---

## 🛠️ Implementation Steps

### Step 1: Verify Pydantic Schemas Exist (Prerequisite Check)

**File:** `backend/app/schemas/custom_field.py`

**Action:** Verify Task #64 is complete and schemas are available:
- DuplicateCheckRequest (with name field)
- DuplicateCheckResponse (with exists, field)
- CustomFieldResponse (full field object)

**If schemas don't exist:** Complete Task #64 first, then return to this task.

**Expected Schemas:**
```python
class DuplicateCheckRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

class DuplicateCheckResponse(BaseModel):
    exists: bool
    field: CustomFieldResponse | None
```

---

### Step 2: Add Duplicate Check Endpoint to Router

**File:** `backend/app/api/custom_fields.py`

**Action:** Add new POST endpoint after the main CRUD endpoints

**Complete Code:**
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.models.custom_field import CustomField
from app.models.list import BookmarkList
from app.schemas.custom_field import (
    CustomFieldCreate,
    CustomFieldUpdate,
    CustomFieldResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
)

router = APIRouter(
    prefix="/api/lists/{list_id}/custom-fields",
    tags=["custom-fields"]
)


@router.post(
    "/check-duplicate",
    response_model=DuplicateCheckResponse,
    status_code=status.HTTP_200_OK
)
async def check_duplicate_field(
    list_id: UUID,
    request: DuplicateCheckRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Check if a custom field with the given name already exists (case-insensitive).
    
    This endpoint is used for real-time duplicate validation in the UI.
    Returns 200 OK regardless of whether the field exists - this is a check,
    not an error condition.
    
    Args:
        list_id: UUID of the list to check within
        request: Request body containing the field name to check
        db: Database session
    
    Returns:
        DuplicateCheckResponse with exists=True and field details if found,
        or exists=False if not found.
    
    Example Response (exists):
        {
            "exists": true,
            "field": {
                "id": "uuid",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {"options": ["bad", "good", "great"]},
                ...
            }
        }
    
    Example Response (not exists):
        {
            "exists": false,
            "field": null
        }
    """
    # Verify list exists
    list_stmt = select(BookmarkList).where(BookmarkList.id == list_id)
    list_result = await db.execute(list_stmt)
    bookmark_list = list_result.scalar_one_or_none()
    
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )
    
    # Case-insensitive query for existing field
    # Uses func.lower() for PostgreSQL compatibility and index usage
    stmt = select(CustomField).where(
        CustomField.list_id == list_id,
        func.lower(CustomField.name) == request.name.lower()
    )
    result = await db.execute(stmt)
    existing_field = result.scalar_one_or_none()
    
    if existing_field:
        # Field exists - return full details for rich UI feedback
        return DuplicateCheckResponse(
            exists=True,
            field=CustomFieldResponse.model_validate(existing_field)
        )
    else:
        # Field does not exist
        return DuplicateCheckResponse(
            exists=False,
            field=None
        )
```

**Design Decisions:**

1. **Return 200 OK even if exists:**
   - Alternative: 409 Conflict if field exists
   - Chosen: 200 OK with exists boolean
   - Rationale: This is a check, not an error. Frontend uses it for warnings, not blocking.
   
2. **Include full field object:**
   - Alternative: Return only exists=true with field ID/name
   - Chosen: Return complete CustomFieldResponse
   - Rationale: Enables rich UI ("A 'select' field named 'X' already exists. Use it instead?")
   - Validation: Design doc lines 206-216

3. **Verify list exists first:**
   - Prevents checking fields in non-existent lists
   - Returns 404 for invalid list_id (standard REST behavior)
   - Performance: Single additional query, but prevents confusion

---

### Step 3: Create Unit Tests

**File:** `backend/tests/api/test_custom_fields.py`

**Action:** Add duplicate check tests to existing test file (or create if doesn't exist)

**Complete Test Code:**
```python
import pytest
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_field import CustomField


class TestDuplicateCheck:
    """Tests for POST /api/lists/{list_id}/custom-fields/check-duplicate"""
    
    @pytest.mark.asyncio
    async def test_duplicate_check_exact_match(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_list_id: UUID
    ):
        """Test that exact name match returns exists=true"""
        # Create a field
        field = CustomField(
            list_id=test_list_id,
            name="Presentation Quality",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        db.add(field)
        await db.commit()
        await db.refresh(field)
        
        # Check for exact match
        response = await client.post(
            f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
            json={"name": "Presentation Quality"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is True
        assert data["field"] is not None
        assert data["field"]["id"] == str(field.id)
        assert data["field"]["name"] == "Presentation Quality"
        assert data["field"]["field_type"] == "select"
    
    @pytest.mark.asyncio
    async def test_duplicate_check_case_insensitive(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_list_id: UUID
    ):
        """Test that case-insensitive matching works (CRITICAL)"""
        # Create field with mixed case
        field = CustomField(
            list_id=test_list_id,
            name="Overall Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        db.add(field)
        await db.commit()
        
        # Check with lowercase
        response = await client.post(
            f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
            json={"name": "overall rating"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is True
        assert data["field"]["name"] == "Overall Rating"  # Original casing preserved
        
        # Check with uppercase
        response = await client.post(
            f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
            json={"name": "OVERALL RATING"}
        )
        
        assert response.status_code == 200
        assert response.json()["exists"] is True
        
        # Check with random casing
        response = await client.post(
            f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
            json={"name": "OvErAlL rAtInG"}
        )
        
        assert response.status_code == 200
        assert response.json()["exists"] is True
    
    @pytest.mark.asyncio
    async def test_duplicate_check_not_exists(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_list_id: UUID
    ):
        """Test that non-existent field returns exists=false"""
        response = await client.post(
            f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
            json={"name": "Non-Existent Field"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is False
        assert data["field"] is None
    
    @pytest.mark.asyncio
    async def test_duplicate_check_scoped_to_list(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_list_id: UUID
    ):
        """Test that duplicate check is scoped to specific list"""
        # Create field in test_list
        field = CustomField(
            list_id=test_list_id,
            name="Field A",
            field_type="text",
            config={}
        )
        db.add(field)
        
        # Create another list with same field name
        other_list_id = uuid4()
        other_list = BookmarkList(
            id=other_list_id,
            name="Other List",
            user_id=test_user_id  # Assuming fixture exists
        )
        db.add(other_list)
        
        other_field = CustomField(
            list_id=other_list_id,
            name="Field A",
            field_type="text",
            config={}
        )
        db.add(other_field)
        await db.commit()
        
        # Check in test_list - should find field
        response = await client.post(
            f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
            json={"name": "Field A"}
        )
        assert response.status_code == 200
        assert response.json()["exists"] is True
        assert response.json()["field"]["id"] == str(field.id)  # Returns test_list field
        
        # Check in other_list - should find different field
        response = await client.post(
            f"/api/lists/{other_list_id}/custom-fields/check-duplicate",
            json={"name": "Field A"}
        )
        assert response.status_code == 200
        assert response.json()["exists"] is True
        assert response.json()["field"]["id"] == str(other_field.id)  # Returns other_list field
    
    @pytest.mark.asyncio
    async def test_duplicate_check_invalid_list_id(
        self,
        client: AsyncClient,
        db: AsyncSession
    ):
        """Test that checking in non-existent list returns 404"""
        fake_list_id = uuid4()
        response = await client.post(
            f"/api/lists/{fake_list_id}/custom-fields/check-duplicate",
            json={"name": "Any Field"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_duplicate_check_empty_name(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_list_id: UUID
    ):
        """Test that empty name is rejected by schema validation"""
        response = await client.post(
            f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
            json={"name": ""}
        )
        
        assert response.status_code == 422  # Validation error
    
    @pytest.mark.asyncio
    async def test_duplicate_check_whitespace_name(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_list_id: UUID
    ):
        """Test that whitespace-only name is rejected"""
        response = await client.post(
            f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
            json={"name": "   "}
        )
        
        assert response.status_code == 422  # Validation error
```

**Test Coverage:**
- ✅ Exact match returns exists=true
- ✅ Case-insensitive matching (lowercase, UPPERCASE, MiXeD)
- ✅ Non-existent field returns exists=false
- ✅ Duplicate check scoped to list (not global)
- ✅ Invalid list_id returns 404
- ✅ Empty/whitespace names rejected

---

### Step 4: Create Integration Test

**File:** `backend/tests/integration/test_custom_fields_workflow.py`

**Action:** Add integration test for complete duplicate check flow

**Code:**
```python
@pytest.mark.asyncio
async def test_duplicate_check_workflow(
    client: AsyncClient,
    db: AsyncSession,
    test_list_id: UUID
):
    """
    Integration test: Full duplicate check workflow
    
    1. Check field doesn't exist
    2. Create field
    3. Check field exists (case-insensitive)
    4. Verify full field details returned
    """
    field_name = "Presentation Quality"
    
    # Step 1: Check field doesn't exist yet
    response = await client.post(
        f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
        json={"name": field_name}
    )
    assert response.status_code == 200
    assert response.json()["exists"] is False
    
    # Step 2: Create the field
    create_response = await client.post(
        f"/api/lists/{test_list_id}/custom-fields",
        json={
            "name": field_name,
            "field_type": "select",
            "config": {"options": ["bad", "good", "great"]}
        }
    )
    assert create_response.status_code == 201
    created_field = create_response.json()
    
    # Step 3: Check field exists (case-insensitive)
    check_response = await client.post(
        f"/api/lists/{test_list_id}/custom-fields/check-duplicate",
        json={"name": "presentation quality"}  # lowercase
    )
    assert check_response.status_code == 200
    data = check_response.json()
    
    # Step 4: Verify full field details
    assert data["exists"] is True
    assert data["field"] is not None
    assert data["field"]["id"] == created_field["id"]
    assert data["field"]["name"] == field_name  # Original casing
    assert data["field"]["field_type"] == "select"
    assert data["field"]["config"]["options"] == ["bad", "good", "great"]
    assert "created_at" in data["field"]
    assert "updated_at" in data["field"]
```

---

### Step 5: Update Router Registration (if needed)

**File:** `backend/app/main.py`

**Action:** Verify custom_fields router is registered. If Task #66 already registered it, skip this step.

**Expected Code:**
```python
from app.api import lists, videos, tags, processing, websocket, custom_fields

# ...

app.include_router(custom_fields.router)
```

---

### Step 6: Run Tests and Verify

**Commands:**
```bash
cd backend

# Run unit tests
pytest tests/api/test_custom_fields.py::TestDuplicateCheck -v

# Run integration test
pytest tests/integration/test_custom_fields_workflow.py::test_duplicate_check_workflow -v

# Run all custom field tests
pytest tests/ -k "duplicate" -v

# Check coverage
pytest tests/api/test_custom_fields.py --cov=app.api.custom_fields --cov-report=term-missing
```

**Expected Output:**
```
tests/api/test_custom_fields.py::TestDuplicateCheck::test_duplicate_check_exact_match PASSED
tests/api/test_custom_fields.py::TestDuplicateCheck::test_duplicate_check_case_insensitive PASSED
tests/api/test_custom_fields.py::TestDuplicateCheck::test_duplicate_check_not_exists PASSED
tests/api/test_custom_fields.py::TestDuplicateCheck::test_duplicate_check_scoped_to_list PASSED
tests/api/test_custom_fields.py::TestDuplicateCheck::test_duplicate_check_invalid_list_id PASSED
tests/api/test_custom_fields.py::TestDuplicateCheck::test_duplicate_check_empty_name PASSED
tests/api/test_custom_fields.py::TestDuplicateCheck::test_duplicate_check_whitespace_name PASSED

========================== 7 passed in 1.2s ==========================
```

---

### Step 7: Manual Testing with Swagger UI

**Action:** Test endpoint manually in Swagger UI

**URL:** http://localhost:8000/docs

**Test Cases:**

1. **Non-existent field:**
   - POST /api/lists/{list_id}/custom-fields/check-duplicate
   - Body: `{"name": "New Field"}`
   - Expected: `{"exists": false, "field": null}`

2. **Exact match:**
   - Create field "Presentation Quality"
   - Check: `{"name": "Presentation Quality"}`
   - Expected: `{"exists": true, "field": {...}}`

3. **Case-insensitive:**
   - Check: `{"name": "presentation quality"}`
   - Expected: `{"exists": true, "field": {...}}`

4. **Invalid list_id:**
   - Use fake UUID
   - Expected: 404 error

5. **Performance check:**
   - Use browser DevTools Network tab
   - Verify response time <100ms

---

## 🧪 Testing Strategy

### Unit Tests (7 Tests)

**File:** `backend/tests/api/test_custom_fields.py`

**Test Group: Duplicate Check Endpoint**

1. `test_duplicate_check_exact_match` - Exact name match returns exists=true with full field
2. `test_duplicate_check_case_insensitive` - Lowercase, UPPERCASE, MiXeD case all match
3. `test_duplicate_check_not_exists` - Non-existent field returns exists=false, field=null
4. `test_duplicate_check_scoped_to_list` - Same field name in different lists handled correctly
5. `test_duplicate_check_invalid_list_id` - Non-existent list returns 404
6. `test_duplicate_check_empty_name` - Empty name rejected (422)
7. `test_duplicate_check_whitespace_name` - Whitespace-only name rejected (422)

**Expected Coverage:** >95% of duplicate check endpoint

---

### Integration Tests (1 Test)

**File:** `backend/tests/integration/test_custom_fields_workflow.py`

**Test: Complete Duplicate Check Flow**
1. Check field doesn't exist → exists=false
2. Create field → 201 Created
3. Check field exists (case-insensitive) → exists=true
4. Verify full field details in response

---

### Manual Testing

**Swagger UI Tests:**
1. Create field "Presentation Quality"
2. Check duplicate with exact name → exists=true
3. Check with "presentation quality" → exists=true
4. Check with "PRESENTATION QUALITY" → exists=true
5. Check non-existent field → exists=false
6. Verify response time <100ms in DevTools

**Edge Cases:**
- Field name with special characters: "Test Field (v2)"
- Very long field name (255 chars)
- Multiple fields with similar names: "Rating", "Rating Quality"

---

## 📚 Reference

### Related Documentation

**Design Document:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 201-217 (API examples)
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 548-551 (duplicate check edge cases)

**Related Code:**
- `backend/app/api/tags.py` - Lines 27-41 (case-insensitive duplicate check pattern using func.lower())
- `backend/app/schemas/custom_field.py` - DuplicateCheckRequest/Response schemas (Task #64)

### REF MCP Validation

**Query 1: SQLAlchemy case-insensitive query with func.lower()**
- **Source:** https://docs.sqlalchemy.org/en/20/core/operators.html#string-comparisons
- **Findings:**
  - `func.lower()` recommended for case-insensitive exact match
  - `ilike()` operator for pattern matching (not needed here)
  - PostgreSQL can optimize `func.lower()` with expression indexes
- **Applied:** Used `func.lower(CustomField.name) == request.name.lower()`

**Query 2: FastAPI POST endpoint for existence checking**
- **Source:** https://fastapi.tiangolo.com/tutorial/response-model/
- **Findings:**
  - `response_model` parameter for automatic validation
  - Return 200 OK for check endpoints (not 409 Conflict)
  - Use status_code parameter for explicit codes
- **Applied:** Used `response_model=DuplicateCheckResponse, status_code=200`

**Query 3: Pydantic response model with optional field**
- **Source:** https://github.com/pydantic/pydantic/blob/main/docs/migration.md#required-optional-and-nullable-fields
- **Findings:**
  - `field: Type | None` for optional fields in Pydantic v2
  - `None` default makes field not required
  - Can be validated in response even when None
- **Applied:** `field: CustomFieldResponse | None` in DuplicateCheckResponse

**Query 4: FastAPI debouncing and real-time validation**
- **Source:** General FastAPI best practices
- **Findings:**
  - Debouncing handled on frontend (not backend)
  - Backend should optimize query performance (<100ms)
  - Use database indexes for fast lookups
- **Applied:** Endpoint uses indexed list_id column for fast queries

---

### Design Decisions

#### Decision 1: Return 200 OK even if field exists

**Chosen:** Always return 200 OK with `exists` boolean

**Alternatives:**
- 409 Conflict if field exists
- 200 if not exists, 409 if exists

**Rationale:**
- ✅ This is a check, not an error condition
- ✅ Frontend uses response for warnings, not blocking
- ✅ Simpler client-side handling (no error case)
- ✅ Matches REST best practices for check endpoints
- **Validation:** Standard pattern for existence checks

---

#### Decision 2: Return full CustomFieldResponse vs minimal data

**Chosen:** Return complete CustomFieldResponse object

**Alternatives:**
- Return only field ID
- Return only field ID + name
- Return exists boolean only

**Rationale:**
- ✅ Enables rich UI feedback ("A 'select' field named 'X' with options [A, B, C] already exists")
- ✅ User can see if existing field meets their needs
- ✅ Only ~200 extra bytes per response (negligible)
- ✅ Design doc lines 206-216 show full field in response
- **Validation:** Design document explicitly shows full field object

---

#### Decision 3: Case-insensitive with func.lower() vs ILIKE

**Chosen:** `func.lower(CustomField.name) == request.name.lower()`

**Alternatives:**
- `CustomField.name.ilike(request.name)` - Pattern matching
- `CustomField.name.collate('NOCASE')` - SQLite-style
- Custom PostgreSQL function

**Rationale:**
- ✅ Exact match (not pattern matching)
- ✅ PostgreSQL can optimize with expression index
- ✅ More predictable behavior than ILIKE
- ✅ Matches pattern in tags.py (lines 31-32)
- **REF MCP:** SQLAlchemy docs recommend func.lower() for exact matches

---

#### Decision 4: Verify list exists before checking fields

**Chosen:** Query list first, return 404 if not found

**Alternatives:**
- Skip list check, just query fields (faster)
- Let foreign key constraint handle validation

**Rationale:**
- ✅ Clear error message for invalid list_id
- ✅ Standard REST behavior (404 for missing parent resource)
- ✅ Prevents confusion (exists=false could mean "list doesn't exist" OR "field doesn't exist")
- ❌ One extra query per request
- **Chosen:** Clarity > performance for this endpoint

---

## ⏱️ Estimated Duration

**Implementation Time:**
- Step 1 (Verify schemas): 5 minutes
- Step 2 (Endpoint implementation): 30 minutes
- Step 3 (Unit tests): 40 minutes
- Step 4 (Integration test): 15 minutes
- Step 5 (Router registration check): 5 minutes
- Step 6 (Run tests): 10 minutes
- Step 7 (Manual testing): 15 minutes

**Total: 2 hours**

This is a straightforward endpoint with simple logic and well-defined requirements.

---

## ✅ Completion Checklist

Before marking this task as complete:

- [ ] DuplicateCheckRequest and DuplicateCheckResponse schemas exist (Task #64)
- [ ] POST /check-duplicate endpoint implemented in custom_fields.py
- [ ] Case-insensitive matching with func.lower()
- [ ] Returns 200 OK with exists boolean (not 409)
- [ ] Returns full CustomFieldResponse when exists=true
- [ ] List existence verified before checking fields
- [ ] 7 unit tests written and passing
- [ ] Integration test written and passing
- [ ] Manual testing completed in Swagger UI
- [ ] Query performance verified (<100ms)
- [ ] Router registered in main.py
- [ ] Code follows existing patterns (tags.py duplicate check)
- [ ] Comprehensive docstring with examples

---

## 🔗 Related Tasks

**Dependencies:**
- Task #64: CustomField Pydantic Schemas (DuplicateCheckRequest/Response) - MUST be complete
- Task #66: CustomField CRUD Endpoints (router setup) - Should be complete

**Blocks:**
- Frontend Task: DuplicateWarning component implementation
- Frontend Task: Real-time field name validation in CreateFieldDialog

**Related:**
- Task #59: CustomField ORM Model (database layer)
- Task #60: FieldSchema ORM Model (may need similar duplicate check)

---

**Plan Created:** 2025-11-06  
**REF MCP Validated:** ✅ 4 queries completed  
**Ready for Implementation:** ✅ Yes (after Task #64 complete)  
**Estimated Implementation Time:** 2 hours  
**Complexity:** Low (simple query endpoint with case-insensitive matching)
