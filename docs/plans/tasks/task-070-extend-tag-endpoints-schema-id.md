# Task Plan - Extend Tag Endpoints with schema_id Support

**Task ID:** Task #70
**Task Name:** Extend Tag endpoints with schema_id support (PUT /tags/{id})
**Date:** 2025-11-06
**Estimated Duration:** 45-60 minutes
**Phase:** Phase 1: MVP - Backend (Custom Fields System)

---

## 🎯 Ziel

Extend the existing PUT /tags/{tag_id} endpoint to accept an optional `schema_id` field in the request body, enabling users to bind or unbind FieldSchemas to tags. The endpoint must validate that the schema exists and belongs to the same list as the tag, support unbinding via `null`, and return the updated tag with the full schema relationship data.

**Expected Outcome:** PUT /tags/{tag_id} accepts `{"schema_id": "uuid"}` to bind a schema, `{"schema_id": null}` to unbind, validates schema ownership, and returns the tag with populated schema data for the frontend.

---

## 📋 Acceptance Criteria

### Functional Requirements
- [ ] TagUpdate Pydantic schema accepts optional `schema_id: UUID | None` field
- [ ] TagResponse Pydantic schema returns optional `schema: FieldSchemaResponse` nested object
- [ ] PUT /tags/{tag_id} validates schema_id exists in database if provided (non-null)
- [ ] PUT /tags/{tag_id} validates schema belongs to same list as tag (prevents cross-list binding)
- [ ] PUT /tags/{tag_id} allows `schema_id: null` to unbind schema from tag
- [ ] PUT /tags/{tag_id} distinguishes between `null` (unbind) and missing field (no change)
- [ ] PUT /tags/{tag_id} eager loads schema relationship for response (no N+1 queries)
- [ ] Returns 404 if tag not found
- [ ] Returns 404 if schema_id provided but schema doesn't exist
- [ ] Returns 400 if schema exists but belongs to different list (with German error message)

### Testing Requirements
- [ ] Unit tests for TagUpdate schema validation (valid UUID, null, missing)
- [ ] API integration test: Bind schema to tag (200 OK, schema in response)
- [ ] API integration test: Change schema (from schema A to schema B)
- [ ] API integration test: Unbind schema (schema_id=null, schema becomes null in response)
- [ ] API integration test: Invalid schema UUID (404 Not Found)
- [ ] API integration test: Schema from different list (400 Bad Request, German message)
- [ ] API integration test: Update only name (schema_id unchanged)
- [ ] Manual verification: TypeScript check shows 0 new errors

### Code Quality Requirements
- [ ] Code follows existing pattern from lists.py and tags.py
- [ ] Uses SQLAlchemy `selectinload()` for eager loading schema relationship
- [ ] Error messages in German matching codebase style
- [ ] Inline comments explain validation logic (list ownership check)

---

## 🛠️ Implementation Steps

### Step 1: Update TagUpdate Pydantic Schema

**Files:** `backend/app/schemas/tag.py`

**Action:** Add optional `schema_id` field to TagUpdate schema to accept UUID or explicit null

**Code:**
```python
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tag name")
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', description="Hex color code")


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    schema_id: UUID | None = Field(
        default=...,  # Use ellipsis to distinguish "not provided" from None
        description="FieldSchema UUID to bind (or null to unbind)"
    )


class TagResponse(TagBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Why:** 
- `UUID | None` allows both valid UUID and explicit `null` value
- `default=...` (ellipsis) makes field truly optional - if not provided, Pydantic won't include it in parsed data
- This enables distinction between "unbind schema" (`null`) and "don't change schema" (field missing from request)
- Follows FastAPI best practice for partial updates (see REF MCP findings)

---

### Step 2: Create FieldSchemaResponse (Minimal Version)

**Files:** `backend/app/schemas/tag.py`

**Action:** Add minimal FieldSchemaResponse class for nested schema data in TagResponse

**Code:**
```python
# Add after TagUpdate, before TagResponse

class FieldSchemaResponse(BaseModel):
    """Minimal FieldSchema data for Tag responses."""
    id: UUID
    name: str
    description: str | None
    
    class Config:
        from_attributes = True
```

**Why:**
- TagResponse needs to return schema data when tag has a bound schema
- Minimal version includes only essential fields (id, name, description)
- Full FieldSchemaResponse with fields will be created in Task #65
- Avoids circular import issues (Tag schema doesn't need to know about SchemaField)

---

### Step 3: Update TagResponse with Schema Field

**Files:** `backend/app/schemas/tag.py`

**Action:** Add optional `schema` field to TagResponse to return bound schema data

**Code:**
```python
class TagResponse(TagBase):
    id: UUID
    user_id: UUID
    schema_id: UUID | None = None  # Add schema_id to response
    schema: FieldSchemaResponse | None = None  # Add nested schema object
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Why:**
- Frontend needs both `schema_id` (for quick checks) and full `schema` object (for displaying schema name)
- `| None` indicates field is optional (tags without schemas return null)
- Pydantic automatically populates from SQLAlchemy relationship when eager loaded

---

### Step 4: Update PUT /tags/{tag_id} Endpoint - Add Imports

**Files:** `backend/app/api/tags.py`

**Action:** Add necessary imports for schema validation and eager loading

**Code:**
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload  # ADD THIS
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.models.tag import Tag
from app.models.user import User
from app.models.field_schema import FieldSchema  # ADD THIS
from app.schemas.tag import TagCreate, TagUpdate, TagResponse
```

**Why:**
- `selectinload()` needed for eager loading schema relationship (prevents N+1 queries)
- `FieldSchema` model needed for schema existence and list ownership validation

---

### Step 5: Update PUT /tags/{tag_id} Endpoint - Schema Validation Logic

**Files:** `backend/app/api/tags.py`

**Action:** Extend update_tag endpoint with schema_id validation before updating tag

**Code:**
```python
@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    tag_update: TagUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a tag (rename, change color, or bind/unbind schema)."""
    # Get first user (for testing - in production, use get_current_user dependency)
    user_result = await db.execute(select(User))
    current_user = user_result.scalars().first()

    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")

    # Fetch tag with eager loaded schema (for response)
    stmt = select(Tag).options(selectinload(Tag.schema)).where(
        Tag.id == tag_id, 
        Tag.user_id == current_user.id
    )
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check for duplicate name if name is being updated (case-insensitive)
    if tag_update.name is not None and tag_update.name.lower() != tag.name.lower():
        duplicate_check = select(Tag).where(
            Tag.user_id == current_user.id,
            func.lower(Tag.name) == tag_update.name.lower()
        )
        duplicate_result = await db.execute(duplicate_check)
        existing = duplicate_result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tag '{tag_update.name}' already exists"
            )

    # Validate schema_id if provided (check field exists in update)
    # Note: tag_update.model_dump(exclude_unset=True) distinguishes null from missing
    update_data = tag_update.model_dump(exclude_unset=True)
    
    if "schema_id" in update_data:
        schema_id_value = update_data["schema_id"]
        
        if schema_id_value is not None:
            # Validate schema exists
            schema_stmt = select(FieldSchema).where(FieldSchema.id == schema_id_value)
            schema_result = await db.execute(schema_stmt)
            schema = schema_result.scalar_one_or_none()
            
            if not schema:
                raise HTTPException(
                    status_code=404,
                    detail=f"Schema mit ID '{schema_id_value}' nicht gefunden"
                )
            
            # Validate schema belongs to tag's list (prevent cross-list binding)
            # Tags are user-scoped, schemas are list-scoped - need to find tag's list first
            # For MVP: Tags don't have list_id yet, so we skip this validation
            # TODO: When list_id added to tags, validate schema.list_id == tag.list_id
            # For now, validate schema belongs to same user (safer than no check)
            # Actually, FieldSchema has list_id, and tags have user_id
            # We need to check if user owns the list that owns the schema
            
            # Get the list that owns this schema
            from app.models.list import BookmarkList
            list_stmt = select(BookmarkList).where(BookmarkList.id == schema.list_id)
            list_result = await db.execute(list_stmt)
            schema_list = list_result.scalar_one_or_none()
            
            if not schema_list:
                # Schema references non-existent list (shouldn't happen due to FK)
                raise HTTPException(
                    status_code=500,
                    detail="Schema referenziert ungültige Liste"
                )
            
            if schema_list.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Schema '{schema.name}' gehört zu einer anderen Liste und kann nicht verwendet werden"
                )
        # If schema_id_value is None, we're unbinding (allow this)

    # Update fields
    if tag_update.name is not None:
        tag.name = tag_update.name
    if tag_update.color is not None:
        tag.color = tag_update.color
    if "schema_id" in update_data:
        # Set to new value (could be UUID or None for unbinding)
        tag.schema_id = update_data["schema_id"]

    await db.commit()
    await db.refresh(tag)
    
    # Reload with schema relationship (refresh doesn't reload relationships)
    stmt = select(Tag).options(selectinload(Tag.schema)).where(Tag.id == tag_id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()
    
    return tag
```

**Why:**
- `selectinload(Tag.schema)` eager loads schema relationship to avoid N+1 queries
- `tag_update.model_dump(exclude_unset=True)` is FastAPI best practice for distinguishing null from missing field
- Schema existence check prevents binding to non-existent schema
- List ownership validation prevents users from binding schemas from other users' lists
- German error messages match existing codebase style
- Refresh + reload ensures response includes updated schema data

---

### Step 6: Update GET /tags/{tag_id} Endpoint - Eager Load Schema

**Files:** `backend/app/api/tags.py`

**Action:** Add eager loading to existing GET endpoint for consistency

**Code:**
```python
@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(tag_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific tag by ID."""
    # Get first user (for testing - in production, use get_current_user dependency)
    user_result = await db.execute(select(User))
    current_user = user_result.scalars().first()

    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")

    # Eager load schema relationship
    stmt = select(Tag).options(selectinload(Tag.schema)).where(
        Tag.id == tag_id, 
        Tag.user_id == current_user.id
    )
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    return tag
```

**Why:**
- Consistency: All endpoints returning TagResponse should include schema data
- Frontend may need schema information when fetching single tag
- Performance: Eager loading prevents N+1 query if schema accessed

---

### Step 7: Update GET /tags Endpoint - Eager Load Schemas

**Files:** `backend/app/api/tags.py`

**Action:** Add eager loading to list endpoint for consistency

**Code:**
```python
@router.get("", response_model=list[TagResponse])
async def list_tags(db: AsyncSession = Depends(get_db)):
    """List all tags for current user."""
    # Get first user (for testing - in production, use get_current_user dependency)
    user_result = await db.execute(select(User))
    current_user = user_result.scalars().first()

    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")

    # Eager load schema relationships
    stmt = select(Tag).options(selectinload(Tag.schema)).where(
        Tag.user_id == current_user.id
    ).order_by(Tag.name)
    result = await db.execute(stmt)
    tags = result.scalars().all()
    return list(tags)
```

**Why:**
- Frontend TagNavigation component may display schema indicators
- Eager loading prevents N+1 queries when iterating over tags
- Consistent API responses across all Tag endpoints

---

## 🧪 Testing Strategy

### Unit Tests - Pydantic Schema Validation

**File:** `backend/tests/schemas/test_tag_schemas.py` (create new)

```python
import pytest
from uuid import uuid4
from app.schemas.tag import TagUpdate

def test_tag_update_with_schema_id():
    """Test TagUpdate accepts valid UUID for schema_id."""
    schema_id = uuid4()
    data = {"name": "Updated Tag", "schema_id": schema_id}
    tag_update = TagUpdate(**data)
    assert tag_update.schema_id == schema_id

def test_tag_update_with_null_schema_id():
    """Test TagUpdate accepts null to unbind schema."""
    data = {"name": "Updated Tag", "schema_id": None}
    tag_update = TagUpdate(**data)
    assert tag_update.schema_id is None

def test_tag_update_without_schema_id():
    """Test TagUpdate allows missing schema_id (no change)."""
    data = {"name": "Updated Tag"}
    tag_update = TagUpdate(**data)
    # Field not set, excluded from model_dump(exclude_unset=True)
    assert "schema_id" not in tag_update.model_dump(exclude_unset=True)

def test_tag_update_schema_id_distinguishes_null_from_missing():
    """Test distinction between null (unbind) and missing (no change)."""
    # Explicit null
    with_null = TagUpdate(name="Tag", schema_id=None)
    assert "schema_id" in with_null.model_dump(exclude_unset=True)
    assert with_null.model_dump(exclude_unset=True)["schema_id"] is None
    
    # Missing field
    without_field = TagUpdate(name="Tag")
    assert "schema_id" not in without_field.model_dump(exclude_unset=True)
```

---

### API Integration Tests

**File:** `backend/tests/api/test_tags.py` (extend existing)

```python
import pytest
from uuid import uuid4
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_update_tag_bind_schema(client: AsyncClient, db_session, test_user, test_list, test_schema):
    """Test binding a schema to a tag."""
    # Create tag without schema
    tag = Tag(name="Test Tag", user_id=test_user.id, color="#FF0000")
    db_session.add(tag)
    await db_session.commit()
    
    # Bind schema
    response = await client.put(
        f"/api/tags/{tag.id}",
        json={"schema_id": str(test_schema.id)}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["schema_id"] == str(test_schema.id)
    assert data["schema"]["id"] == str(test_schema.id)
    assert data["schema"]["name"] == test_schema.name

@pytest.mark.asyncio
async def test_update_tag_change_schema(client: AsyncClient, db_session, test_user, test_list):
    """Test changing from schema A to schema B."""
    # Create two schemas
    schema_a = FieldSchema(list_id=test_list.id, name="Schema A")
    schema_b = FieldSchema(list_id=test_list.id, name="Schema B")
    db_session.add_all([schema_a, schema_b])
    
    # Create tag with schema A
    tag = Tag(name="Test Tag", user_id=test_user.id, schema_id=schema_a.id)
    db_session.add(tag)
    await db_session.commit()
    
    # Change to schema B
    response = await client.put(
        f"/api/tags/{tag.id}",
        json={"schema_id": str(schema_b.id)}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["schema_id"] == str(schema_b.id)
    assert data["schema"]["name"] == "Schema B"

@pytest.mark.asyncio
async def test_update_tag_unbind_schema(client: AsyncClient, db_session, test_user, test_schema):
    """Test unbinding schema with null."""
    # Create tag with schema
    tag = Tag(name="Test Tag", user_id=test_user.id, schema_id=test_schema.id)
    db_session.add(tag)
    await db_session.commit()
    
    # Unbind schema
    response = await client.put(
        f"/api/tags/{tag.id}",
        json={"schema_id": None}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["schema_id"] is None
    assert data["schema"] is None

@pytest.mark.asyncio
async def test_update_tag_invalid_schema_id(client: AsyncClient, db_session, test_user):
    """Test binding non-existent schema returns 404."""
    tag = Tag(name="Test Tag", user_id=test_user.id)
    db_session.add(tag)
    await db_session.commit()
    
    fake_schema_id = uuid4()
    response = await client.put(
        f"/api/tags/{tag.id}",
        json={"schema_id": str(fake_schema_id)}
    )
    
    assert response.status_code == 404
    assert "nicht gefunden" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_update_tag_schema_from_different_list(client: AsyncClient, db_session, test_user):
    """Test binding schema from another user's list returns 400."""
    # Create two users with separate lists
    other_user = User(id=uuid4(), email="other@example.com")
    other_list = BookmarkList(name="Other List", user_id=other_user.id)
    other_schema = FieldSchema(list_id=other_list.id, name="Other Schema")
    db_session.add_all([other_user, other_list, other_schema])
    
    # Create tag for test_user
    tag = Tag(name="Test Tag", user_id=test_user.id)
    db_session.add(tag)
    await db_session.commit()
    
    # Try to bind schema from other user's list
    response = await client.put(
        f"/api/tags/{tag.id}",
        json={"schema_id": str(other_schema.id)}
    )
    
    assert response.status_code == 400
    assert "andere liste" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_update_tag_name_only_preserves_schema(client: AsyncClient, db_session, test_user, test_schema):
    """Test updating only name doesn't change schema_id."""
    # Create tag with schema
    tag = Tag(name="Original Name", user_id=test_user.id, schema_id=test_schema.id)
    db_session.add(tag)
    await db_session.commit()
    
    # Update only name
    response = await client.put(
        f"/api/tags/{tag.id}",
        json={"name": "New Name"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["schema_id"] == str(test_schema.id)  # Schema unchanged
    assert data["schema"]["name"] == test_schema.name
```

---

### Manual Testing Checklist

**Prerequisites:**
- [ ] Database migration applied (Task #58)
- [ ] FieldSchema model exists (Task #60)
- [ ] Tag model has schema_id column (Task #63)
- [ ] Backend running: `uvicorn app.main:app --reload`

**Test Cases:**

1. **Bind Schema to Tag:**
   ```bash
   # Create a list
   curl -X POST http://localhost:8000/api/lists \
     -H "Content-Type: application/json" \
     -d '{"name": "Test List"}'
   # Note list_id from response
   
   # Create a schema (will be available in Task #68, for now use SQL)
   psql smart_youtube_bookmarks -c "INSERT INTO field_schemas (id, list_id, name) VALUES (gen_random_uuid(), '<list_id>', 'Video Quality') RETURNING id;"
   # Note schema_id
   
   # Create a tag
   curl -X POST http://localhost:8000/api/tags \
     -H "Content-Type: application/json" \
     -d '{"name": "Tutorials", "color": "#0000FF"}'
   # Note tag_id
   
   # Bind schema to tag
   curl -X PUT http://localhost:8000/api/tags/<tag_id> \
     -H "Content-Type: application/json" \
     -d '{"schema_id": "<schema_id>"}'
   
   # Expected: 200 OK, response includes schema object with name
   ```

2. **Unbind Schema:**
   ```bash
   curl -X PUT http://localhost:8000/api/tags/<tag_id> \
     -H "Content-Type: application/json" \
     -d '{"schema_id": null}'
   
   # Expected: 200 OK, schema_id and schema are null
   ```

3. **Update Name Without Changing Schema:**
   ```bash
   curl -X PUT http://localhost:8000/api/tags/<tag_id> \
     -H "Content-Type: application/json" \
     -d '{"name": "Updated Name"}'
   
   # Expected: 200 OK, name changed, schema_id unchanged
   ```

4. **Invalid Schema ID:**
   ```bash
   curl -X PUT http://localhost:8000/api/tags/<tag_id> \
     -H "Content-Type: application/json" \
     -d '{"schema_id": "00000000-0000-0000-0000-000000000000"}'
   
   # Expected: 404 Not Found, German error message
   ```

5. **TypeScript Check:**
   ```bash
   cd frontend
   npx tsc --noEmit
   # Expected: 0 new errors (same baseline as before)
   ```

---

## 📚 Reference

### Related Documentation

**Design Doc:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 250-254 (Tag-Schema Binding API)

**Task Reports:**
- `docs/reports/2025-11-06-task-060-report.md` - FieldSchema model patterns, REF MCP validation
- `docs/reports/2025-11-05-task-059-report.md` - CustomField model reference

**Migration:**
- `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` - Lines 102-107 (tags.schema_id extension)

### Code Patterns to Follow

**Pattern 1: Partial Updates with exclude_unset (FastAPI Best Practice)**
```python
update_data = pydantic_model.model_dump(exclude_unset=True)
if "field_name" in update_data:
    # Field was provided (could be None or a value)
    model_instance.field_name = update_data["field_name"]
# If field not in update_data, it wasn't provided (leave unchanged)
```
**Source:** FastAPI docs on PATCH vs PUT, Pydantic v2 model_dump()

**Pattern 2: Eager Loading with selectinload (SQLAlchemy 2.0)**
```python
from sqlalchemy.orm import selectinload

stmt = select(Model).options(selectinload(Model.relationship)).where(...)
result = await db.execute(stmt)
model = result.scalar_one_or_none()
# Relationship is now loaded, no N+1 queries
```
**Source:** Task #60 Report, SQLAlchemy 2.0 async patterns

**Pattern 3: German Error Messages**
```python
raise HTTPException(
    status_code=400,
    detail=f"Schema '{schema.name}' gehört zu einer anderen Liste und kann nicht verwendet werden"
)
```
**Source:** Existing tags.py endpoint (line 40, 124)

---

## 🤔 Design Decisions

### Decision 1: PUT vs PATCH for Partial Updates

**Decision:** Use PUT (keep existing endpoint method) with `exclude_unset=True` pattern

**Alternatives:**
1. **Change to PATCH (Semantic REST):**
   - Pros: Semantically correct for partial updates, follows HTTP spec
   - Cons: Breaking change for frontend, inconsistent with existing list.py pattern
2. **Keep PUT with exclude_unset (Chosen):**
   - Pros: No breaking changes, FastAPI supports partial updates with PUT, consistent with codebase
   - Cons: Not strictly REST-compliant

**Rationale:**
- FastAPI docs state: "You are free to use [PUT/PATCH] however you want, FastAPI doesn't impose any restrictions"
- Existing codebase uses PUT for tag updates (line 91 of tags.py)
- `exclude_unset=True` pattern works for both PUT and PATCH
- Consistency with existing API is more important than strict REST semantics for internal API

**Trade-offs:**
- ✅ Benefits: No breaking changes, consistent codebase, simpler migration path
- ⚠️ Trade-offs: Not following REST spec strictly (acceptable for internal API)

---

### Decision 2: Minimal FieldSchemaResponse vs Full Schema

**Decision:** Create minimal FieldSchemaResponse with only id, name, description (no fields list)

**Alternatives:**
1. **Return full FieldSchema with fields array:**
   - Pros: Frontend gets all schema data in one request
   - Cons: Requires SchemaField join, heavy payload, circular dependencies
2. **Return only schema_id (no nested object):**
   - Pros: Minimal payload, simple response
   - Cons: Frontend needs second request to get schema name for display
3. **Minimal schema (id, name, description) - Chosen:**
   - Pros: Enough data for UI (tag chips, dialogs), lightweight, no circular deps
   - Cons: Frontend needs separate request for full schema details (acceptable)

**Rationale:**
- Frontend TagNavigation likely shows schema indicator (needs schema name)
- Full schema with fields is heavy and rarely needed when listing tags
- Task #65 will create full FieldSchemaResponse when needed for schema CRUD endpoints
- Minimal response prevents circular import issues (Tag → Schema → SchemaField → CustomField)

**Trade-offs:**
- ✅ Benefits: Lightweight response, no circular imports, sufficient for UI
- ⚠️ Trade-offs: Frontend needs separate request for full schema with fields (rare use case)

---

### Decision 3: List Ownership Validation Strategy

**Decision:** Validate schema.list_id owner matches current_user.id

**Alternatives:**
1. **Skip validation (trust frontend):**
   - Pros: Simpler code, faster endpoint
   - Cons: Security hole - users could bind schemas from other users' lists
2. **Validate schema belongs to tag's list:**
   - Pros: Most correct validation
   - Cons: Tags don't have list_id yet (list_id will be added in future task)
3. **Validate schema's list owner is current user (Chosen):**
   - Pros: Secure, works with current schema (tags have user_id, lists have user_id)
   - Cons: Extra JOIN query to bookmarks_lists table

**Rationale:**
- Security: Must prevent cross-user schema binding (privacy violation)
- Current schema: Tags have user_id, FieldSchemas have list_id, Lists have user_id
- Validation path: Tag.user_id == User.id AND Schema.list_id → List.user_id == User.id
- Future-proof: When tags get list_id, this validation becomes simpler

**Trade-offs:**
- ✅ Benefits: Secure, prevents cross-user data leakage, future-proof
- ⚠️ Trade-offs: Extra query (acceptable - binding happens rarely, not hot path)

---

### Decision 4: null vs Missing Field Semantics

**Decision:** Use `default=...` (ellipsis) in Pydantic to distinguish null from missing

**Alternatives:**
1. **Always treat missing as null:**
   - Pros: Simpler logic, no need for exclude_unset
   - Cons: Can't update name without unbinding schema (missing field treated as unbind)
2. **Use sentinel value (e.g., UNSET constant):**
   - Pros: Explicit in code
   - Cons: Non-standard pattern, confusing for API consumers
3. **Use exclude_unset pattern (Chosen):**
   - Pros: FastAPI best practice, clear API semantics, standard pattern
   - Cons: Slightly more code (exclude_unset check)

**Rationale:**
- FastAPI docs recommend `exclude_unset=True` for partial updates
- API semantics:
  - `{"name": "New Name"}` - Update name, leave schema unchanged
  - `{"schema_id": null}` - Unbind schema
  - `{"schema_id": "<uuid>"}` - Bind schema
- This matches user expectations and frontend needs

**Trade-offs:**
- ✅ Benefits: Clear API semantics, follows FastAPI best practice, flexible updates
- ⚠️ Trade-offs: Requires exclude_unset check (minimal code overhead)

---

### Decision 5: Eager Loading vs Lazy Loading for Schema Relationship

**Decision:** Use `selectinload(Tag.schema)` on all Tag endpoints

**Alternatives:**
1. **Lazy loading (default SQLAlchemy):**
   - Pros: Only loads when accessed, saves bandwidth if not needed
   - Cons: N+1 queries if frontend iterates over tags, async issues
2. **Joined loading (joinedload):**
   - Pros: Single query with JOIN
   - Cons: Duplicates tag data if schema has many fields, less efficient for nullable relationships
3. **Select in loading (Chosen):**
   - Pros: Separate query, efficient for nullable relationships, avoids N+1
   - Cons: Two queries instead of one

**Rationale:**
- SQLAlchemy docs recommend selectinload for nullable one-to-many relationships
- TagResponse schema includes schema field, so eager loading prevents N+1
- List endpoint (GET /tags) would trigger N+1 queries without eager loading
- selectinload is more efficient than joinedload for nullable relationships

**Trade-offs:**
- ✅ Benefits: No N+1 queries, optimal for nullable relationships, fast
- ⚠️ Trade-offs: Two queries instead of one (negligible performance difference)

---

## REF MCP Validation Results

### Query 1: FastAPI Pydantic v2 Optional Field Update Patterns

**Query:** "FastAPI Pydantic v2 optional field update patterns PUT PATCH 2024"

**Key Findings:**
1. **Partial Updates with PATCH:**
   - FastAPI recommends PATCH for partial updates but allows PUT
   - Use `exclude_unset=True` to distinguish provided fields from defaults
   - Pattern: `update_data = model.model_dump(exclude_unset=True)`

2. **Pydantic v2 Changes:**
   - `.dict()` renamed to `.model_dump()`
   - `.copy()` renamed to `.model_copy()`
   - Backward compatible but should use v2 names

3. **null vs Missing Semantics:**
   - `default=...` (ellipsis) makes field truly optional
   - Missing field: Not in `exclude_unset=True` dict
   - Explicit null: In dict with None value

**Application to Task #70:**
- Use `schema_id: UUID | None = Field(default=...)` pattern
- Check `"schema_id" in update_data` to distinguish null from missing
- Follow FastAPI tutorial pattern from body-updates.md

**Source:** https://github.com/fastapi/fastapi/blob/master/docs/en/docs/tutorial/body-updates.md

---

### Query 2: SQLAlchemy 2.0 Nullable Foreign Key Validation

**Query:** "SQLAlchemy 2.0 nullable foreign key validation best practices async"

**Key Findings:**
1. **Foreign Key Constraints:**
   - Database enforces FK existence automatically (no need to manually check)
   - nullable=True allows NULL values (validated by Pydantic, not DB)
   - ON DELETE SET NULL handled by database CASCADE

2. **Async Validation Pattern:**
   - Use `scalar_one_or_none()` for existence checks
   - Return 404 if FK reference doesn't exist
   - Validate business logic (e.g., list ownership) in application layer

3. **Performance:**
   - Database FK checks are fast (indexed by default)
   - Application-layer validation needed for cross-table rules

**Application to Task #70:**
- Check schema existence with `select(FieldSchema).where(id == schema_id)`
- Validate list ownership in application (DB can't enforce cross-table rules)
- Use 404 for non-existent schema, 400 for ownership violation

**Source:** SQLAlchemy 2.0 Documentation on constraints and metadata

---

### Query 3: REST API Partial Update Semantics

**Query:** "FastAPI REST API partial update patterns null vs missing field semantics"

**Key Findings:**
1. **HTTP Semantics:**
   - PUT: Replace entire resource (but FastAPI allows partial with exclude_unset)
   - PATCH: Partial update (semantic intent)
   - Both methods can use same implementation with Pydantic

2. **Null vs Missing:**
   - Missing field: Don't update (leave unchanged)
   - `null` value: Set to NULL (clear/unbind)
   - Empty string: Set to empty string (different from NULL)

3. **API Design:**
   - Document null semantics clearly in API docs
   - Use exclude_unset to implement "missing = no change"
   - Pydantic validates types, application validates business logic

**Application to Task #70:**
- Document that `"schema_id": null` unbinds schema
- Missing schema_id field = no change to schema binding
- Implement with `if "schema_id" in update_data` check

**Source:** FastAPI body-updates tutorial, REST API best practices

---

## ✅ Pre-Implementation Checklist

Before starting implementation, verify:

- [x] Task #58 complete (migration applied, tables exist)
- [x] Task #60 complete (FieldSchema model exists)
- [x] Task #63 complete (Tag.schema_id column added - done in Task #60)
- [x] Database running (PostgreSQL accessible)
- [x] Backend dependencies installed (SQLAlchemy 2.0, Pydantic v2)
- [x] REF MCP findings reviewed (partial update patterns, FK validation)

**Estimated Implementation Time:** 45-60 minutes
- Step 1-3 (Pydantic schemas): 10-15 min
- Step 4-5 (PUT endpoint validation): 20-25 min
- Step 6-7 (GET endpoints eager loading): 10 min
- Testing (pytest + manual): 15-20 min

---

## 🎯 Success Criteria Summary

**Implementation Complete When:**
1. ✅ PUT /tags/{id} accepts `{"schema_id": "uuid"}` and returns tag with schema object
2. ✅ PUT /tags/{id} accepts `{"schema_id": null}` and unbinds schema
3. ✅ PUT /tags/{id} without schema_id field leaves schema unchanged
4. ✅ Validates schema exists (404 if not found)
5. ✅ Validates schema belongs to user's list (400 if wrong owner)
6. ✅ All tag endpoints eager load schema relationship (no N+1 queries)
7. ✅ API tests passing (7 test cases)
8. ✅ Manual tests verified (5 scenarios)
9. ✅ TypeScript check: 0 new errors
10. ✅ Code follows existing patterns (tags.py, lists.py)

---

**Next Task:** Task #71 - Extend Video GET endpoint with field union logic (requires Task #70 complete)

**Related Tasks:**
- Task #68: Field Schemas CRUD endpoints (required before frontend can create schemas)
- Task #82: Extend TagEditDialog with SchemaSelector (frontend integration)
