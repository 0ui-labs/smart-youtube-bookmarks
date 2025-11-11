# Task #68: Implement Field Schemas CRUD Endpoints

**Plan Task:** #68
**Wave/Phase:** Wave 1 Custom Fields System
**Dependencies:** Task #60 (FieldSchema ORM Model) ✅ Completed, Task #61 (SchemaField Model) ✅ Completed
**Related Tasks:** Task #66 (Custom Fields CRUD), Task #69 (Schema-Fields Management), Task #70 (Tag-Schema Binding)

---

## 🎯 Ziel

Implement REST API CRUD endpoints for FieldSchema to enable creation, listing, updating, and deletion of field schemas. Schemas are collections of custom fields that can be bound to tags, allowing users to create reusable evaluation templates (e.g., "Video Quality" schema with presentation, rating, and content fields). The endpoints will include schema_fields relationship data in responses and prevent deletion of schemas currently used by tags.

**Expected Outcome:** Fully functional schema management API with comprehensive validation, proper HTTP status codes, eager loading of relationships, and protection against accidental data loss.

---

## 📋 Acceptance Criteria

- [ ] **GET /api/lists/{list_id}/schemas** - Returns all schemas with their fields
  - [ ] Eager loads schema_fields relationship (no N+1 queries)
  - [ ] Each schema_field includes full CustomField details
  - [ ] Results ordered by schema name
  - [ ] Empty list returned if no schemas exist

- [ ] **POST /api/lists/{list_id}/schemas** - Creates new schema
  - [ ] Creates schema with name and description
  - [ ] Optionally creates SchemaField associations if fields array provided
  - [ ] Validates all field_ids exist in same list before creating associations
  - [ ] Returns 201 Created with full schema (including fields)
  - [ ] Returns 400 Bad Request if field_ids invalid

- [ ] **PUT /api/lists/{list_id}/schemas/{schema_id}** - Updates schema metadata
  - [ ] Updates name and/or description only (fields managed by Task #69)
  - [ ] Returns 404 Not Found if schema doesn't exist or belongs to different list
  - [ ] Returns 200 OK with updated schema

- [ ] **DELETE /api/lists/{list_id}/schemas/{schema_id}** - Deletes schema
  - [ ] Counts related tags using schema
  - [ ] Returns 409 Conflict if schema used by tags (with tag count in message)
  - [ ] Deletes schema if not used (CASCADE to schema_fields)
  - [ ] Returns 204 No Content on successful deletion
  - [ ] Returns 404 Not Found if schema doesn't exist

- [ ] **Pydantic Schemas** - Type-safe request/response models
  - [ ] FieldSchemaCreate (name, description, optional fields array)
  - [ ] FieldSchemaUpdate (name, description - both optional)
  - [ ] FieldSchemaResponse (includes schema_fields with nested field details)
  - [ ] SchemaFieldResponse (for nested field data in schema response)

- [ ] **Tests**
  - [ ] Unit tests for all endpoints (4 endpoints × 3-4 tests each = 12-16 tests)
  - [ ] Integration test: Create → Update → Delete flow
  - [ ] Integration test: Create with fields → Verify fields loaded
  - [ ] Integration test: Delete schema with tags → Should fail

---

## 🛠️ Implementation Steps

### Step 1: Create Pydantic Schemas for FieldSchema

**File:** `backend/app/schemas/field_schema.py` (NEW)

**Rationale:** Create comprehensive Pydantic schemas following the established pattern from Task #64 (CustomField schemas). The response schema must include nested schema_fields to avoid N+1 queries in the frontend. Uses Pydantic v2 `model_config` for ORM integration.

**Code:**

```python
"""
Pydantic schemas for Field Schema API endpoints.

Field schemas are collections of custom fields that can be bound to tags,
enabling reusable evaluation templates (e.g., "Video Quality" schema containing
presentation, rating, and content fields).

Schema-field associations are managed via the SchemaField join table, which
tracks display_order and show_on_card settings for each field in a schema.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


# ============================================================================
# Nested Schema for SchemaField (Join Table Data)
# ============================================================================

class SchemaFieldInResponse(BaseModel):
    """
    Nested schema for schema_fields relationship in FieldSchemaResponse.
    
    Represents a single field within a schema, including metadata from the
    SchemaField join table (display_order, show_on_card) and full field details
    from the CustomField model.
    
    Example:
        {
            "field_id": "123e4567-e89b-12d3-a456-426614174000",
            "display_order": 0,
            "show_on_card": true,
            "field": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {"options": ["bad", "good", "great"]},
                ...
            }
        }
    """
    field_id: UUID = Field(..., description="ID of the custom field")
    display_order: int = Field(..., description="Display order within schema (0-indexed)")
    show_on_card: bool = Field(..., description="Whether to show field on video card")
    
    # Nested CustomField details (populated via eager loading)
    # Note: This will be populated by SQLAlchemy relationship loading
    # We'll access it via schemafield.field in the ORM model
    
    model_config = {
        "from_attributes": True
    }


class FieldInSchemaResponse(BaseModel):
    """
    Full custom field details for display in schema response.
    
    Includes all CustomField attributes for rich display in frontend.
    Matches CustomFieldResponse structure from Task #64.
    """
    id: UUID
    list_id: UUID
    name: str
    field_type: str  # 'select' | 'rating' | 'text' | 'boolean'
    config: dict  # Type-specific configuration
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "from_attributes": True
    }


class SchemaFieldResponse(BaseModel):
    """
    Combined schema field data with full custom field details.
    
    This is the main nested object in FieldSchemaResponse, combining
    join table metadata (display_order, show_on_card) with full field data.
    """
    field_id: UUID
    schema_id: UUID
    display_order: int
    show_on_card: bool
    field: FieldInSchemaResponse  # Full nested field details
    
    model_config = {
        "from_attributes": True
    }


# ============================================================================
# Schema Field Input (for POST /schemas with initial fields)
# ============================================================================

class SchemaFieldInput(BaseModel):
    """
    Input schema for adding a field to a schema during creation.
    
    Used in FieldSchemaCreate.fields array to specify initial fields
    when creating a schema.
    
    Example:
        {
            "field_id": "123e4567-e89b-12d3-a456-426614174000",
            "display_order": 0,
            "show_on_card": true
        }
    """
    field_id: UUID = Field(..., description="ID of existing custom field to add")
    display_order: int = Field(..., ge=0, description="Display order (0-indexed)")
    show_on_card: bool = Field(True, description="Show field on video cards")


# ============================================================================
# Main FieldSchema Schemas
# ============================================================================

class FieldSchemaBase(BaseModel):
    """
    Base schema for field schema with shared attributes.
    
    Contains common fields used in create and response operations.
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Schema name (e.g., 'Video Quality', 'Tutorial Metrics')"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional explanation of what this schema evaluates"
    )


class FieldSchemaCreate(FieldSchemaBase):
    """
    Schema for creating a new field schema.
    
    Used in: POST /api/lists/{list_id}/schemas
    
    Optionally accepts an array of fields to add to the schema during creation.
    If provided, all field_ids must exist in the same list as the schema.
    
    Example (minimal):
        {
            "name": "Video Quality",
            "description": "Standard quality metrics"
        }
    
    Example (with fields):
        {
            "name": "Video Quality",
            "description": "Standard quality metrics",
            "fields": [
                {
                    "field_id": "uuid-presentation",
                    "display_order": 0,
                    "show_on_card": true
                },
                {
                    "field_id": "uuid-rating",
                    "display_order": 1,
                    "show_on_card": true
                }
            ]
        }
    """
    fields: Optional[list[SchemaFieldInput]] = Field(
        None,
        description="Optional array of fields to add to schema during creation"
    )


class FieldSchemaUpdate(BaseModel):
    """
    Schema for updating field schema metadata.
    
    Used in: PUT /api/lists/{list_id}/schemas/{schema_id}
    
    Only updates name and/or description. Field management (adding/removing
    fields from schema) is handled by separate endpoints in Task #69.
    
    All fields are optional to support partial updates.
    
    Example (update name only):
        {"name": "Updated Video Quality"}
    
    Example (update both):
        {
            "name": "Tutorial Evaluation",
            "description": "Comprehensive tutorial assessment criteria"
        }
    """
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Schema name"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Schema description"
    )


class FieldSchemaResponse(FieldSchemaBase):
    """
    Schema for field schema response from API.
    
    Includes all database fields plus eager-loaded schema_fields relationship.
    The schema_fields array contains full CustomField details for each field,
    enabling rich display in the frontend without additional queries.
    
    Used in:
    - GET /api/lists/{list_id}/schemas (list)
    - POST /api/lists/{list_id}/schemas (single)
    - PUT /api/lists/{list_id}/schemas/{schema_id} (single)
    - GET /api/lists/{list_id}/schemas/{schema_id} (single)
    
    Example:
        {
            "id": "schema-uuid",
            "list_id": "list-uuid",
            "name": "Video Quality",
            "description": "Standard quality metrics",
            "schema_fields": [
                {
                    "field_id": "field-uuid-1",
                    "schema_id": "schema-uuid",
                    "display_order": 0,
                    "show_on_card": true,
                    "field": {
                        "id": "field-uuid-1",
                        "list_id": "list-uuid",
                        "name": "Presentation Quality",
                        "field_type": "select",
                        "config": {"options": ["bad", "good", "great"]},
                        "created_at": "2025-11-06T10:00:00Z",
                        "updated_at": "2025-11-06T10:00:00Z"
                    }
                },
                {
                    "field_id": "field-uuid-2",
                    "schema_id": "schema-uuid",
                    "display_order": 1,
                    "show_on_card": true,
                    "field": {
                        "id": "field-uuid-2",
                        "name": "Overall Rating",
                        "field_type": "rating",
                        "config": {"max_rating": 5},
                        ...
                    }
                }
            ],
            "created_at": "2025-11-06T09:00:00Z",
            "updated_at": "2025-11-06T09:00:00Z"
        }
    """
    id: UUID = Field(..., description="Unique schema identifier")
    list_id: UUID = Field(..., description="Parent list identifier")
    schema_fields: list[SchemaFieldResponse] = Field(
        default_factory=list,
        description="Fields in this schema (ordered by display_order)"
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    model_config = {
        "from_attributes": True
    }
```

**Design Decisions:**
1. **Nested schema_fields in response:** Frontend needs field details to display schemas without additional queries. Using eager loading with selectinload() prevents N+1 query problem.
2. **Separate Input and Response schemas for SchemaField:** Input only needs field_id, display_order, show_on_card. Response includes full field object from relationship.
3. **Optional fields array in Create:** Allows creating empty schema (add fields later) or fully populated schema (convenient for bulk operations).

---

### Step 2: Export Schemas in __init__.py

**File:** `backend/app/schemas/__init__.py` (MODIFY)

**Action:** Add FieldSchema schema exports to enable clean imports in API routers.

**Code:**

```python
from .list import ListCreate, ListUpdate, ListResponse
from .job_progress import ProgressData, JobProgressEventCreate, JobProgressEventRead
from .tag import TagBase, TagCreate, TagUpdate, TagResponse
from .field_schema import (
    FieldSchemaCreate,
    FieldSchemaUpdate,
    FieldSchemaResponse,
    SchemaFieldInput,
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
    "FieldSchemaCreate",
    "FieldSchemaUpdate",
    "FieldSchemaResponse",
    "SchemaFieldInput",
]
```

---

### Step 3: Create Schemas Router File

**File:** `backend/app/api/schemas.py` (NEW)

**Rationale:** Following the established pattern from tags.py and existing API routers. Router scoped to `/api/lists/{list_id}/schemas` to maintain list isolation. Uses AsyncSession for database access and proper dependency injection.

**Code Structure (Header + Imports):**

```python
"""
API endpoints for Field Schema management.

Field schemas are collections of custom fields that can be bound to tags,
enabling reusable evaluation templates. This module handles CRUD operations
for schemas (not schema-fields management, which is Task #69).

Endpoints:
- GET    /api/lists/{list_id}/schemas                  - List all schemas
- POST   /api/lists/{list_id}/schemas                  - Create new schema
- GET    /api/lists/{list_id}/schemas/{schema_id}      - Get single schema
- PUT    /api/lists/{list_id}/schemas/{schema_id}      - Update schema metadata
- DELETE /api/lists/{list_id}/schemas/{schema_id}      - Delete schema (checks tag usage)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.models.field_schema import FieldSchema
from app.models.schema_field import SchemaField
from app.models.custom_field import CustomField
from app.models.tag import Tag
from app.models.list import BookmarkList
from app.schemas.field_schema import (
    FieldSchemaCreate,
    FieldSchemaUpdate,
    FieldSchemaResponse,
)

router = APIRouter()
```

---

### Step 4: Implement GET /schemas Endpoint

**File:** `backend/app/api/schemas.py` (APPEND)

**Rationale:** Uses selectinload() to eager load schema_fields and their related CustomField objects in a single query. This prevents N+1 query problems when serializing the response. Orders results by name for consistent display.

**Code:**

```python
@router.get(
    "/api/lists/{list_id}/schemas",
    response_model=list[FieldSchemaResponse],
    tags=["schemas"]
)
async def list_schemas(
    list_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    List all field schemas for a list.
    
    Returns all schemas with their associated fields (eager loaded).
    Results ordered by schema name.
    
    Args:
        list_id: UUID of the parent list
        db: Database session (injected)
    
    Returns:
        List of FieldSchemaResponse objects with nested schema_fields
    
    Example Response:
        [
            {
                "id": "schema-uuid",
                "list_id": "list-uuid",
                "name": "Video Quality",
                "description": "Standard quality metrics",
                "schema_fields": [
                    {
                        "field_id": "field-uuid",
                        "schema_id": "schema-uuid",
                        "display_order": 0,
                        "show_on_card": true,
                        "field": {
                            "id": "field-uuid",
                            "name": "Presentation",
                            "field_type": "select",
                            ...
                        }
                    }
                ],
                "created_at": "...",
                "updated_at": "..."
            }
        ]
    """
    # Verify list exists
    list_result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )
    
    # Query schemas with eager loading of schema_fields and their related fields
    # REF MCP: selectinload() emits separate SELECT with IN clause for efficiency
    # (avoids N+1 queries and more efficient than joinedload for one-to-many)
    stmt = (
        select(FieldSchema)
        .where(FieldSchema.list_id == list_id)
        .options(
            selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
        )
        .order_by(FieldSchema.name)
    )
    
    result = await db.execute(stmt)
    schemas = result.scalars().all()
    
    return list(schemas)
```

**REF MCP Evidence:**
- SQLAlchemy docs recommend selectinload() for one-to-many relationships (more efficient than joinedload, emits separate query with IN clause)
- Chained selectinload() loads nested relationships: schema → schema_fields → field
- Source: https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html#select-in-loading

---

### Step 5: Implement POST /schemas Endpoint

**File:** `backend/app/api/schemas.py` (APPEND)

**Rationale:** Creates schema with optional initial fields. If fields array provided, validates all field_ids exist in same list before creating SchemaField associations. Uses transaction semantics (commit only if all operations succeed).

**Code:**

```python
@router.post(
    "/api/lists/{list_id}/schemas",
    response_model=FieldSchemaResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["schemas"]
)
async def create_schema(
    list_id: UUID,
    schema_data: FieldSchemaCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new field schema.
    
    Optionally creates SchemaField associations if fields array provided.
    All field_ids must exist in the same list as the schema.
    
    Args:
        list_id: UUID of the parent list
        schema_data: Schema creation data (name, description, optional fields)
        db: Database session (injected)
    
    Returns:
        Created FieldSchemaResponse with nested schema_fields
    
    Raises:
        HTTPException 404: List not found
        HTTPException 400: One or more field_ids invalid or belong to different list
    
    Example Request:
        {
            "name": "Video Quality",
            "description": "Standard metrics",
            "fields": [
                {
                    "field_id": "uuid-1",
                    "display_order": 0,
                    "show_on_card": true
                }
            ]
        }
    """
    # Verify list exists
    list_result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )
    
    # If fields provided, validate all field_ids exist in same list
    if schema_data.fields:
        field_ids = [f.field_id for f in schema_data.fields]
        
        # Query all fields in one batch
        stmt = select(CustomField).where(
            CustomField.id.in_(field_ids),
            CustomField.list_id == list_id
        )
        result = await db.execute(stmt)
        existing_fields = result.scalars().all()
        
        # Check if all fields found
        if len(existing_fields) != len(field_ids):
            found_ids = {f.id for f in existing_fields}
            missing_ids = set(field_ids) - found_ids
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid field_ids: {missing_ids}. Fields must exist in the same list."
            )
    
    # Create schema
    new_schema = FieldSchema(
        list_id=list_id,
        name=schema_data.name,
        description=schema_data.description
    )
    db.add(new_schema)
    await db.flush()  # Get schema.id for SchemaField creation
    
    # Create SchemaField associations if fields provided
    if schema_data.fields:
        for field_input in schema_data.fields:
            schema_field = SchemaField(
                schema_id=new_schema.id,
                field_id=field_input.field_id,
                display_order=field_input.display_order,
                show_on_card=field_input.show_on_card
            )
            db.add(schema_field)
    
    await db.commit()
    
    # Reload with relationships for response
    stmt = (
        select(FieldSchema)
        .where(FieldSchema.id == new_schema.id)
        .options(
            selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
        )
    )
    result = await db.execute(stmt)
    created_schema = result.scalar_one()
    
    return created_schema
```

**Design Decision: Why flush() then commit()?**
- `flush()` executes INSERT and assigns `new_schema.id` without committing transaction
- Allows using `new_schema.id` for SchemaField foreign keys
- Single `commit()` at end ensures atomicity (all-or-nothing)

---

### Step 6: Implement PUT /schemas/{schema_id} Endpoint

**File:** `backend/app/api/schemas.py` (APPEND)

**Rationale:** Updates only name and/or description (not fields - that's Task #69). Validates schema belongs to correct list before updating. Supports partial updates (only update provided fields).

**Code:**

```python
@router.put(
    "/api/lists/{list_id}/schemas/{schema_id}",
    response_model=FieldSchemaResponse,
    tags=["schemas"]
)
async def update_schema(
    list_id: UUID,
    schema_id: UUID,
    schema_update: FieldSchemaUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update field schema metadata (name and/or description).
    
    Only updates schema metadata. Field management (adding/removing fields
    from schema) is handled by separate endpoints in Task #69.
    
    Args:
        list_id: UUID of the parent list
        schema_id: UUID of the schema to update
        schema_update: Update data (name, description - both optional)
        db: Database session (injected)
    
    Returns:
        Updated FieldSchemaResponse
    
    Raises:
        HTTPException 404: Schema not found or belongs to different list
    
    Example Request:
        {"name": "Updated Video Quality"}
    """
    # Query schema with list verification
    stmt = (
        select(FieldSchema)
        .where(
            FieldSchema.id == schema_id,
            FieldSchema.list_id == list_id
        )
        .options(
            selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
        )
    )
    result = await db.execute(stmt)
    schema = result.scalar_one_or_none()
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema with id {schema_id} not found in list {list_id}"
        )
    
    # Update fields (only if provided)
    if schema_update.name is not None:
        schema.name = schema_update.name
    if schema_update.description is not None:
        schema.description = schema_update.description
    
    await db.commit()
    await db.refresh(schema)
    
    return schema
```

---

### Step 7: Implement DELETE /schemas/{schema_id} Endpoint

**File:** `backend/app/api/schemas.py` (APPEND)

**Rationale:** Checks if schema is used by any tags before deletion. If used, returns 409 Conflict with helpful message including tag count. If not used, deletes schema (CASCADE to schema_fields handled by database). This prevents accidental data loss when users delete schemas still bound to tags.

**Code:**

```python
@router.delete(
    "/api/lists/{list_id}/schemas/{schema_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["schemas"]
)
async def delete_schema(
    list_id: UUID,
    schema_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a field schema.
    
    Before deletion, checks if the schema is currently used by any tags.
    If used, returns 409 Conflict with tag count. User must unbind schema
    from tags before deletion (or implement force delete in future).
    
    If schema is deleted, SchemaField associations are CASCADE deleted
    automatically by the database (via ON DELETE CASCADE).
    
    Args:
        list_id: UUID of the parent list
        schema_id: UUID of the schema to delete
        db: Database session (injected)
    
    Returns:
        None (204 No Content on success)
    
    Raises:
        HTTPException 404: Schema not found or belongs to different list
        HTTPException 409: Schema is used by one or more tags
    
    Edge Case Handling:
        - Design doc line 528-530: ON DELETE SET NULL on tags.schema_id
          would allow deletion, but we prevent it here to avoid data loss
        - User must explicitly unbind schema from tags first
        - Future enhancement: Add ?force=true query param to allow deletion
    """
    # Query schema with list verification
    stmt = select(FieldSchema).where(
        FieldSchema.id == schema_id,
        FieldSchema.list_id == list_id
    )
    result = await db.execute(stmt)
    schema = result.scalar_one_or_none()
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema with id {schema_id} not found in list {list_id}"
        )
    
    # Count tags using this schema
    # REF MCP: Using scalar subquery for efficient count without loading objects
    tag_count_stmt = select(func.count(Tag.id)).where(Tag.schema_id == schema_id)
    tag_count_result = await db.execute(tag_count_stmt)
    tag_count = tag_count_result.scalar()
    
    if tag_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete schema '{schema.name}': "
                f"it is currently used by {tag_count} tag(s). "
                f"Please unbind the schema from all tags before deletion."
            )
        )
    
    # Delete schema (CASCADE to schema_fields handled by DB)
    await db.delete(schema)
    await db.commit()
    
    return None
```

**Design Decision: Why 409 Conflict instead of 400 Bad Request?**
- 409 Conflict indicates resource cannot be deleted due to current state (tags using it)
- 400 Bad Request indicates malformed request (wrong format, invalid data)
- REF: RFC 7231 - 409 is appropriate for delete conflicts

**Alternative Considered: Force delete with ?force=true**
- Could add optional query param to CASCADE delete tags or SET NULL on tags.schema_id
- Rejected for initial implementation (can add in future if needed)
- Current approach is safer (prevents accidental data loss)

---

### Step 8: Register Router in Main App

**File:** `backend/app/main.py` (MODIFY)

**Action:** Import schemas router and register with FastAPI app.

**Code (modify imports):**

```python
from app.api import lists, videos, processing, websocket, tags, schemas
```

**Code (modify router registration):**

```python
# Register routers
app.include_router(lists.router)
app.include_router(videos.router)
app.include_router(processing.router)
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(tags.router)
app.include_router(schemas.router)  # Add this line
```

---

### Step 9: Create Unit Tests

**File:** `backend/tests/api/test_schemas.py` (NEW)

**Rationale:** Comprehensive test coverage for all CRUD operations. Tests grouped by endpoint for clarity. Uses pytest fixtures for database setup and test data.

**Code:**

```python
"""
Unit tests for Field Schema API endpoints.

Tests cover:
- GET /api/lists/{list_id}/schemas (list all)
- POST /api/lists/{list_id}/schemas (create)
- PUT /api/lists/{list_id}/schemas/{schema_id} (update)
- DELETE /api/lists/{list_id}/schemas/{schema_id} (delete)
"""

import pytest
from httpx import AsyncClient
from uuid import uuid4

from app.models.list import BookmarkList
from app.models.user import User
from app.models.field_schema import FieldSchema
from app.models.custom_field import CustomField
from app.models.schema_field import SchemaField
from app.models.tag import Tag


@pytest.mark.asyncio
class TestListSchemas:
    """Tests for GET /api/lists/{list_id}/schemas"""
    
    async def test_list_schemas_empty(
        self,
        async_client: AsyncClient,
        db_session,
        test_user: User,
        test_list: BookmarkList
    ):
        """Should return empty list when no schemas exist."""
        response = await async_client.get(f"/api/lists/{test_list.id}/schemas")
        
        assert response.status_code == 200
        assert response.json() == []
    
    async def test_list_schemas_with_data(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should return all schemas with nested fields."""
        # Create custom field
        field = CustomField(
            list_id=test_list.id,
            name="Presentation",
            field_type="select",
            config={"options": ["bad", "good", "great"]}
        )
        db_session.add(field)
        
        # Create schema
        schema = FieldSchema(
            list_id=test_list.id,
            name="Video Quality",
            description="Standard metrics"
        )
        db_session.add(schema)
        await db_session.flush()
        
        # Create schema-field association
        schema_field = SchemaField(
            schema_id=schema.id,
            field_id=field.id,
            display_order=0,
            show_on_card=True
        )
        db_session.add(schema_field)
        await db_session.commit()
        
        response = await async_client.get(f"/api/lists/{test_list.id}/schemas")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Video Quality"
        assert data[0]["description"] == "Standard metrics"
        assert len(data[0]["schema_fields"]) == 1
        assert data[0]["schema_fields"][0]["field"]["name"] == "Presentation"
    
    async def test_list_schemas_list_not_found(
        self,
        async_client: AsyncClient
    ):
        """Should return 404 if list doesn't exist."""
        fake_list_id = uuid4()
        response = await async_client.get(f"/api/lists/{fake_list_id}/schemas")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
class TestCreateSchema:
    """Tests for POST /api/lists/{list_id}/schemas"""
    
    async def test_create_schema_minimal(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should create schema with name and description only."""
        data = {
            "name": "Video Quality",
            "description": "Standard quality metrics"
        }
        
        response = await async_client.post(
            f"/api/lists/{test_list.id}/schemas",
            json=data
        )
        
        assert response.status_code == 201
        result = response.json()
        assert result["name"] == "Video Quality"
        assert result["description"] == "Standard quality metrics"
        assert result["list_id"] == str(test_list.id)
        assert result["schema_fields"] == []
        assert "id" in result
        assert "created_at" in result
    
    async def test_create_schema_with_fields(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should create schema with initial fields."""
        # Create custom fields
        field1 = CustomField(
            list_id=test_list.id,
            name="Presentation",
            field_type="select",
            config={"options": ["bad", "good"]}
        )
        field2 = CustomField(
            list_id=test_list.id,
            name="Rating",
            field_type="rating",
            config={"max_rating": 5}
        )
        db_session.add_all([field1, field2])
        await db_session.commit()
        
        data = {
            "name": "Video Quality",
            "description": "Quality metrics",
            "fields": [
                {
                    "field_id": str(field1.id),
                    "display_order": 0,
                    "show_on_card": True
                },
                {
                    "field_id": str(field2.id),
                    "display_order": 1,
                    "show_on_card": False
                }
            ]
        }
        
        response = await async_client.post(
            f"/api/lists/{test_list.id}/schemas",
            json=data
        )
        
        assert response.status_code == 201
        result = response.json()
        assert len(result["schema_fields"]) == 2
        assert result["schema_fields"][0]["field"]["name"] == "Presentation"
        assert result["schema_fields"][0]["display_order"] == 0
        assert result["schema_fields"][1]["field"]["name"] == "Rating"
        assert result["schema_fields"][1]["show_on_card"] is False
    
    async def test_create_schema_invalid_field_ids(
        self,
        async_client: AsyncClient,
        test_list: BookmarkList
    ):
        """Should return 400 if field_ids don't exist."""
        data = {
            "name": "Video Quality",
            "fields": [
                {
                    "field_id": str(uuid4()),
                    "display_order": 0,
                    "show_on_card": True
                }
            ]
        }
        
        response = await async_client.post(
            f"/api/lists/{test_list.id}/schemas",
            json=data
        )
        
        assert response.status_code == 400
        assert "Invalid field_ids" in response.json()["detail"]
    
    async def test_create_schema_list_not_found(
        self,
        async_client: AsyncClient
    ):
        """Should return 404 if list doesn't exist."""
        fake_list_id = uuid4()
        data = {"name": "Test Schema"}
        
        response = await async_client.post(
            f"/api/lists/{fake_list_id}/schemas",
            json=data
        )
        
        assert response.status_code == 404


@pytest.mark.asyncio
class TestUpdateSchema:
    """Tests for PUT /api/lists/{list_id}/schemas/{schema_id}"""
    
    async def test_update_schema_name(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should update schema name."""
        schema = FieldSchema(
            list_id=test_list.id,
            name="Original Name",
            description="Original description"
        )
        db_session.add(schema)
        await db_session.commit()
        
        data = {"name": "Updated Name"}
        
        response = await async_client.put(
            f"/api/lists/{test_list.id}/schemas/{schema.id}",
            json=data
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "Updated Name"
        assert result["description"] == "Original description"
    
    async def test_update_schema_description(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should update schema description."""
        schema = FieldSchema(
            list_id=test_list.id,
            name="Schema Name",
            description="Original"
        )
        db_session.add(schema)
        await db_session.commit()
        
        data = {"description": "Updated description"}
        
        response = await async_client.put(
            f"/api/lists/{test_list.id}/schemas/{schema.id}",
            json=data
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "Schema Name"
        assert result["description"] == "Updated description"
    
    async def test_update_schema_not_found(
        self,
        async_client: AsyncClient,
        test_list: BookmarkList
    ):
        """Should return 404 if schema doesn't exist."""
        fake_schema_id = uuid4()
        data = {"name": "Updated"}
        
        response = await async_client.put(
            f"/api/lists/{test_list.id}/schemas/{fake_schema_id}",
            json=data
        )
        
        assert response.status_code == 404


@pytest.mark.asyncio
class TestDeleteSchema:
    """Tests for DELETE /api/lists/{list_id}/schemas/{schema_id}"""
    
    async def test_delete_schema_success(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList
    ):
        """Should delete schema when not used by tags."""
        schema = FieldSchema(
            list_id=test_list.id,
            name="Test Schema"
        )
        db_session.add(schema)
        await db_session.commit()
        
        response = await async_client.delete(
            f"/api/lists/{test_list.id}/schemas/{schema.id}"
        )
        
        assert response.status_code == 204
    
    async def test_delete_schema_with_tags(
        self,
        async_client: AsyncClient,
        db_session,
        test_list: BookmarkList,
        test_user: User
    ):
        """Should return 409 if schema is used by tags."""
        schema = FieldSchema(
            list_id=test_list.id,
            name="Test Schema"
        )
        db_session.add(schema)
        await db_session.flush()
        
        # Create tag using schema
        tag = Tag(
            user_id=test_user.id,
            name="Test Tag",
            schema_id=schema.id
        )
        db_session.add(tag)
        await db_session.commit()
        
        response = await async_client.delete(
            f"/api/lists/{test_list.id}/schemas/{schema.id}"
        )
        
        assert response.status_code == 409
        assert "used by 1 tag" in response.json()["detail"]
    
    async def test_delete_schema_not_found(
        self,
        async_client: AsyncClient,
        test_list: BookmarkList
    ):
        """Should return 404 if schema doesn't exist."""
        fake_schema_id = uuid4()
        
        response = await async_client.delete(
            f"/api/lists/{test_list.id}/schemas/{fake_schema_id}"
        )
        
        assert response.status_code == 404
```

---

### Step 10: Create Integration Tests

**File:** `backend/tests/integration/test_schemas_flow.py` (NEW)

**Rationale:** Integration tests verify full workflows across multiple endpoints. Tests realistic scenarios users will encounter.

**Code:**

```python
"""
Integration tests for Field Schema workflows.

Tests complete user flows:
- Create schema → Update → Delete
- Create schema with fields → Verify field loading
- Create schema → Bind to tag → Try delete → Should fail
"""

import pytest
from httpx import AsyncClient

from app.models.list import BookmarkList
from app.models.user import User
from app.models.custom_field import CustomField


@pytest.mark.asyncio
async def test_schema_full_lifecycle(
    async_client: AsyncClient,
    db_session,
    test_list: BookmarkList
):
    """Test complete schema lifecycle: create → update → delete."""
    # Create schema
    create_data = {
        "name": "Video Quality",
        "description": "Quality metrics"
    }
    create_response = await async_client.post(
        f"/api/lists/{test_list.id}/schemas",
        json=create_data
    )
    assert create_response.status_code == 201
    schema_id = create_response.json()["id"]
    
    # Update schema
    update_data = {"name": "Updated Quality Metrics"}
    update_response = await async_client.put(
        f"/api/lists/{test_list.id}/schemas/{schema_id}",
        json=update_data
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Quality Metrics"
    
    # Delete schema
    delete_response = await async_client.delete(
        f"/api/lists/{test_list.id}/schemas/{schema_id}"
    )
    assert delete_response.status_code == 204
    
    # Verify deletion
    get_response = await async_client.get(f"/api/lists/{test_list.id}/schemas")
    assert len(get_response.json()) == 0


@pytest.mark.asyncio
async def test_schema_with_fields_eager_loading(
    async_client: AsyncClient,
    db_session,
    test_list: BookmarkList
):
    """Test schema creation with fields and verify eager loading works."""
    # Create custom fields
    field1 = CustomField(
        list_id=test_list.id,
        name="Presentation",
        field_type="select",
        config={"options": ["bad", "good", "great"]}
    )
    field2 = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    db_session.add_all([field1, field2])
    await db_session.commit()
    
    # Create schema with fields
    create_data = {
        "name": "Video Quality",
        "description": "Quality assessment",
        "fields": [
            {
                "field_id": str(field1.id),
                "display_order": 0,
                "show_on_card": True
            },
            {
                "field_id": str(field2.id),
                "display_order": 1,
                "show_on_card": True
            }
        ]
    }
    create_response = await async_client.post(
        f"/api/lists/{test_list.id}/schemas",
        json=create_data
    )
    assert create_response.status_code == 201
    
    # Verify GET returns same structure (tests eager loading)
    list_response = await async_client.get(f"/api/lists/{test_list.id}/schemas")
    assert list_response.status_code == 200
    schemas = list_response.json()
    assert len(schemas) == 1
    assert len(schemas[0]["schema_fields"]) == 2
    assert schemas[0]["schema_fields"][0]["field"]["name"] == "Presentation"
    assert schemas[0]["schema_fields"][1]["field"]["name"] == "Rating"


@pytest.mark.asyncio
async def test_cannot_delete_schema_bound_to_tag(
    async_client: AsyncClient,
    db_session,
    test_list: BookmarkList,
    test_user: User
):
    """Test that schemas bound to tags cannot be deleted."""
    # Create schema
    create_data = {"name": "Video Quality"}
    create_response = await async_client.post(
        f"/api/lists/{test_list.id}/schemas",
        json=create_data
    )
    schema_id = create_response.json()["id"]
    
    # Create tag (tags.py endpoint)
    tag_data = {"name": "Tutorial"}
    tag_response = await async_client.post("/api/tags", json=tag_data)
    tag_id = tag_response.json()["id"]
    
    # Bind schema to tag (Task #70 endpoint - future)
    # For now, manually update tag in database
    from app.models.tag import Tag
    from sqlalchemy import select
    stmt = select(Tag).where(Tag.id == tag_id)
    result = await db_session.execute(stmt)
    tag = result.scalar_one()
    tag.schema_id = schema_id
    await db_session.commit()
    
    # Try to delete schema
    delete_response = await async_client.delete(
        f"/api/lists/{test_list.id}/schemas/{schema_id}"
    )
    assert delete_response.status_code == 409
    assert "used by 1 tag" in delete_response.json()["detail"]
```

---

### Step 11: Run Tests and Verify

**Commands:**

```bash
# Run unit tests
cd backend
pytest tests/api/test_schemas.py -v

# Run integration tests
pytest tests/integration/test_schemas_flow.py -v

# Run with coverage
pytest tests/api/test_schemas.py tests/integration/test_schemas_flow.py --cov=app.api.schemas --cov-report=term-missing
```

**Expected Output:**

```
tests/api/test_schemas.py::TestListSchemas::test_list_schemas_empty PASSED
tests/api/test_schemas.py::TestListSchemas::test_list_schemas_with_data PASSED
tests/api/test_schemas.py::TestListSchemas::test_list_schemas_list_not_found PASSED
tests/api/test_schemas.py::TestCreateSchema::test_create_schema_minimal PASSED
tests/api/test_schemas.py::TestCreateSchema::test_create_schema_with_fields PASSED
tests/api/test_schemas.py::TestCreateSchema::test_create_schema_invalid_field_ids PASSED
tests/api/test_schemas.py::TestCreateSchema::test_create_schema_list_not_found PASSED
tests/api/test_schemas.py::TestUpdateSchema::test_update_schema_name PASSED
tests/api/test_schemas.py::TestUpdateSchema::test_update_schema_description PASSED
tests/api/test_schemas.py::TestUpdateSchema::test_update_schema_not_found PASSED
tests/api/test_schemas.py::TestDeleteSchema::test_delete_schema_success PASSED
tests/api/test_schemas.py::TestDeleteSchema::test_delete_schema_with_tags PASSED
tests/api/test_schemas.py::TestDeleteSchema::test_delete_schema_not_found PASSED

tests/integration/test_schemas_flow.py::test_schema_full_lifecycle PASSED
tests/integration/test_schemas_flow.py::test_schema_with_fields_eager_loading PASSED
tests/integration/test_schemas_flow.py::test_cannot_delete_schema_bound_to_tag PASSED

========================== 16 passed in 1.23s ==========================
```

---

### Step 12: Manual Testing via Swagger UI

**URL:** http://localhost:8000/docs

**Test Scenario 1: Create and list schemas**
1. GET /api/lists/{list_id}/schemas → Should return []
2. POST /api/lists/{list_id}/schemas with {"name": "Video Quality", "description": "Standard metrics"}
3. GET /api/lists/{list_id}/schemas → Should return 1 schema

**Test Scenario 2: Create schema with fields**
1. POST /api/lists/{list_id}/custom-fields to create 2 fields (Task #66 endpoint)
2. POST /api/lists/{list_id}/schemas with fields array containing both field_ids
3. Verify response includes schema_fields with full field details

**Test Scenario 3: Update schema**
1. PUT /api/lists/{list_id}/schemas/{schema_id} with {"name": "Updated Name"}
2. Verify only name changed, description unchanged

**Test Scenario 4: Delete protection**
1. Create tag via POST /api/tags
2. Manually bind schema_id to tag (Task #70 will add proper endpoint)
3. DELETE /api/lists/{list_id}/schemas/{schema_id} → Should return 409

---

## 🧪 Testing Strategy

### Unit Tests (13 tests in test_schemas.py)

**TestListSchemas (3 tests):**
1. `test_list_schemas_empty` - Empty list when no schemas
2. `test_list_schemas_with_data` - Returns schemas with nested fields
3. `test_list_schemas_list_not_found` - 404 for invalid list_id

**TestCreateSchema (4 tests):**
1. `test_create_schema_minimal` - Create with name and description only
2. `test_create_schema_with_fields` - Create with initial fields
3. `test_create_schema_invalid_field_ids` - 400 for non-existent field_ids
4. `test_create_schema_list_not_found` - 404 for invalid list_id

**TestUpdateSchema (3 tests):**
1. `test_update_schema_name` - Update name only
2. `test_update_schema_description` - Update description only
3. `test_update_schema_not_found` - 404 for invalid schema_id

**TestDeleteSchema (3 tests):**
1. `test_delete_schema_success` - Delete unused schema
2. `test_delete_schema_with_tags` - 409 when schema used by tags
3. `test_delete_schema_not_found` - 404 for invalid schema_id

---

### Integration Tests (3 tests in test_schemas_flow.py)

1. `test_schema_full_lifecycle` - Create → Update → Delete → Verify
2. `test_schema_with_fields_eager_loading` - Create with fields → Verify GET returns same structure
3. `test_cannot_delete_schema_bound_to_tag` - Create → Bind to tag → Delete fails

**Expected Coverage:** >90% (all endpoints and edge cases covered)

---

### Manual Testing Checklist

- [ ] GET /schemas returns empty list initially
- [ ] POST /schemas creates schema without fields
- [ ] POST /schemas creates schema with fields
- [ ] POST /schemas returns 400 for invalid field_ids
- [ ] GET /schemas returns schemas with nested fields (verify eager loading)
- [ ] PUT /schemas updates name
- [ ] PUT /schemas updates description
- [ ] PUT /schemas returns 404 for non-existent schema
- [ ] DELETE /schemas removes unused schema
- [ ] DELETE /schemas returns 409 for schema with tags
- [ ] DELETE /schemas includes tag count in error message
- [ ] Swagger UI docs are clear and accurate

---

## 📚 Reference

### Related Documentation

**Design Documentation:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 219-249) - Schemas API specification
- `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 528-530) - Edge case: Schema deletion with tags

**Related Task Plans:**
- `docs/plans/tasks/task-059-custom-field-model.md` - CustomField ORM model
- `docs/plans/tasks/task-060-field-schema-model.md` - FieldSchema ORM model
- `docs/plans/tasks/task-064-custom-field-pydantic-schemas.md` - Pydantic schema patterns

**Related Task Reports:**
- Check `docs/reports/` for Task #60 and #61 implementation details

---

### Related Code

**Similar API Patterns:**
- `backend/app/api/tags.py` - CRUD pattern, duplicate checking
- `backend/app/api/videos.py` - List-scoped endpoints, relationship loading

**ORM Models:**
- `backend/app/models/field_schema.py` - FieldSchema model with relationships
- `backend/app/models/schema_field.py` - SchemaField join table
- `backend/app/models/custom_field.py` - CustomField model
- `backend/app/models/tag.py` - Tag model with schema_id foreign key

**Pydantic Schemas:**
- `backend/app/schemas/tag.py` - Base/Create/Update/Response pattern
- `backend/app/schemas/video.py` - Nested response models with relationships

---

### Design Decisions

#### Decision 1: Nested schema_fields in Response vs Separate Endpoint

**Chosen:** Include schema_fields in FieldSchemaResponse

**Alternatives:**
- Separate GET /schemas/{schema_id}/fields endpoint
- Flat response with only field_ids, frontend fetches field details separately

**Rationale:**
- ✅ Single request for complete schema data (better performance)
- ✅ Eager loading prevents N+1 queries (selectinload pattern)
- ✅ Frontend needs field details to display schemas (avoids second request)
- ✅ Matches pattern in design doc (lines 231-249 show nested fields in response)
- ❌ Slightly larger response size (~200 bytes per field)

**REF MCP Validation:**
- SQLAlchemy docs recommend selectinload() for one-to-many eager loading
- FastAPI docs show nested Pydantic models for relationship data
- Source: https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html#select-in-loading

---

#### Decision 2: Prevent Schema Deletion with 409 vs Allow with Cascade

**Chosen:** Return 409 Conflict if schema used by tags

**Alternatives:**
- CASCADE delete tags (delete tags when schema deleted)
- SET NULL on tags (unbind schema automatically, keep tags)
- Force parameter (?force=true to allow deletion)

**Rationale:**
- ✅ Prevents accidental data loss (user might not realize tags use schema)
- ✅ Explicit unbind required (user must take action)
- ✅ Helpful error message with tag count guides user
- ❌ Extra step required (unbind tags first)
- **Future Enhancement:** Add ?force=true to allow CASCADE/SET NULL

**REF MCP Validation:**
- RFC 7231: 409 Conflict is appropriate for resource conflicts
- Design doc lines 528-530: ON DELETE SET NULL exists in schema, but API prevents deletion for safety
- User feedback: Better to warn than accidentally delete

---

#### Decision 3: Optional Fields Array in Create vs Separate Endpoint

**Chosen:** Optional fields array in POST /schemas

**Alternatives:**
- Always require POST /schemas/{schema_id}/fields after creation
- Always require fields array (no empty schemas)

**Rationale:**
- ✅ Convenience: Users can create fully-formed schemas in one request
- ✅ Flexibility: Users can create empty schemas and add fields later
- ✅ Bulk operations: Easier to create schemas with fields from CSV import
- ✅ Matches design doc example (lines 231-249 show fields in POST request)
- ❌ Slightly more complex validation logic

**Design Doc Reference:**
- Lines 231-249 explicitly show fields array in POST request body
- Task #69 will add separate endpoints for field management (add/remove/reorder)

---

#### Decision 4: Update Only Metadata vs Include Field Updates

**Chosen:** PUT /schemas/{schema_id} updates only name and description

**Alternatives:**
- Allow updating fields array in PUT request
- Use PATCH semantics for partial updates

**Rationale:**
- ✅ Cleaner separation of concerns (metadata vs field management)
- ✅ Field management is complex (reordering, show_on_card toggle) → Task #69
- ✅ Simpler validation logic (no need to diff fields array)
- ✅ Matches REST conventions (metadata updates separate from relationship updates)
- **Future:** Task #69 adds endpoints for field management

**Design Doc Reference:**
- Lines 225-228 show separate endpoints for schema-field management
- PUT /schemas/{schema_id} → metadata only
- POST/DELETE /schemas/{schema_id}/fields → field management (Task #69)

---

#### Decision 5: List Verification in All Endpoints

**Chosen:** Verify list_id in path matches schema.list_id

**Alternatives:**
- Trust client to provide correct list_id
- Use schema_id only (ignore list_id in path)

**Rationale:**
- ✅ Security: Prevents cross-list schema access
- ✅ Data integrity: Ensures schemas stay within their list
- ✅ Clear errors: User knows if they provided wrong list_id
- ✅ Matches existing pattern (videos.py, tags.py verify list ownership)

**Implementation:**
- GET: Verify list exists, filter schemas by list_id
- POST: Verify list exists before creating schema
- PUT/DELETE: Query with both schema_id AND list_id in WHERE clause

---

### REF MCP Validation Summary

**Query 1: FastAPI CRUD endpoints best practices**
- Use FastAPI dependency injection for database sessions
- Return proper HTTP status codes (201 Created, 204 No Content, 409 Conflict)
- **Applied:** All endpoints use correct status codes and dependency injection

**Query 2: SQLAlchemy 2.0 async relationships loading**
- Use selectinload() for one-to-many relationships (more efficient than joinedload)
- Chain selectinload() for nested relationships
- **Applied:** `selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)`
- Source: https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html#select-in-loading

**Query 3: SQLAlchemy count related objects before delete**
- Use scalar subquery with func.count() for efficient counting
- Avoids loading full objects just to count them
- **Applied:** `select(func.count(Tag.id)).where(Tag.schema_id == schema_id)`

**Query 4: FastAPI nested response models**
- Use nested Pydantic models for relationships
- Set `model_config = {"from_attributes": True}` for ORM conversion
- **Applied:** SchemaFieldResponse with nested FieldInSchemaResponse
- Source: https://fastapi.tiangolo.com/tutorial/body-nested-models/#nested-models

**Query 5: Pydantic v2 schema with list of related objects**
- Use `list[NestedModel]` type annotation
- Set default_factory=list for empty lists
- **Applied:** `schema_fields: list[SchemaFieldResponse] = Field(default_factory=list)`

---

## ⏱️ Estimated Effort

### Implementation: 3-4 hours

**Breakdown:**
- Step 1: Pydantic schemas (60 min)
- Step 2: Export schemas (5 min)
- Step 3: Router setup (10 min)
- Step 4: GET endpoint (20 min)
- Step 5: POST endpoint (40 min)
- Step 6: PUT endpoint (15 min)
- Step 7: DELETE endpoint (25 min)
- Step 8: Register router (5 min)

### Testing: 2-3 hours

**Breakdown:**
- Step 9: Unit tests (90 min)
- Step 10: Integration tests (45 min)
- Step 11: Run tests and fix issues (30 min)

### Manual Testing: 30 minutes

**Total: 5.5-7.5 hours**

---

## ✅ Completion Checklist

Before marking this task as complete:

- [ ] Pydantic schemas created with nested models
- [ ] All 4 CRUD endpoints implemented
- [ ] GET endpoint uses selectinload() for eager loading
- [ ] POST endpoint validates field_ids exist in same list
- [ ] PUT endpoint updates only metadata (not fields)
- [ ] DELETE endpoint checks tag usage and returns 409 if used
- [ ] Router registered in main.py
- [ ] 13 unit tests written and passing
- [ ] 3 integration tests written and passing
- [ ] Test coverage >90%
- [ ] Manual Swagger UI testing completed
- [ ] All HTTP status codes correct (200, 201, 204, 400, 404, 409)
- [ ] Error messages are clear and actionable
- [ ] Code follows existing patterns (tags.py, videos.py)
- [ ] REF MCP sources cited in code comments

---

## 🔗 Related Tasks

**Depends On:**
- ✅ Task #58: Database migration for custom fields system
- ✅ Task #59: CustomField ORM model
- ✅ Task #60: FieldSchema ORM model
- ✅ Task #61: SchemaField join table model

**Blocks:**
- Task #69: Schema-Fields Management endpoints (add/remove fields to/from schema)
- Task #70: Tag-Schema Binding endpoint (PUT /tags/{tag_id} with schema_id)

**Related:**
- Task #64: CustomField Pydantic schemas (similar pattern)
- Task #66: CustomField CRUD endpoints (similar pattern)

---

**Plan Created:** 2025-11-06
**REF MCP Validated:** ✅ 5 queries completed
**Ready for Implementation:** ✅ Yes
**Estimated Implementation Time:** 5.5-7.5 hours
