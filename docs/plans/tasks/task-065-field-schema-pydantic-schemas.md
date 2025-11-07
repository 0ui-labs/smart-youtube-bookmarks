# Task #65: Create FieldSchema Pydantic Schemas

**Plan Task:** #65
**Wave/Phase:** Wave 1 Custom Fields System - Core Models & Schemas
**Dependencies:** Task #60 (FieldSchema SQLAlchemy model), Task #64 (CustomFieldResponse schema - will be created in parallel)

---

## 🎯 Ziel

Create Pydantic validation schemas for the FieldSchema model to enable API request/response handling with nested field definitions. These schemas will support creating field schemas with multiple custom fields, partial updates, and rich responses that include full field data without requiring additional API calls.

## 📋 Acceptance Criteria

- [ ] FieldSchemaCreate schema with nested fields array validation
- [ ] FieldSchemaUpdate schema with partial updates (name/description only)
- [ ] FieldSchemaResponse schema with nested CustomField data
- [ ] Custom validator for max 3 show_on_card constraint
- [ ] Field display_order validation (non-negative integers)
- [ ] All schemas use Pydantic v2 patterns (ConfigDict, from_attributes)
- [ ] All schemas exported in `__init__.py`
- [ ] Code follows existing schema patterns (tag.py, list.py)
- [ ] Handles missing CustomFieldResponse gracefully (Task #64 may not exist yet)

---

## 🛠️ Implementation Steps

### 1. Create FieldSchema Pydantic Schemas File

**Files:** `backend/app/schemas/field_schema.py` (new file)

**Action:** Create the main schema file with three Pydantic models: FieldSchemaCreate, FieldSchemaUpdate, and FieldSchemaResponse. Handle the dependency on CustomFieldResponse which may not exist yet.

**Code:**

```python
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Handle optional dependency on CustomFieldResponse (Task #64)
# If it doesn't exist yet, we'll use a temporary Dict placeholder
try:
    from .custom_field import CustomFieldResponse
    CUSTOM_FIELD_RESPONSE_AVAILABLE = True
except ImportError:
    CUSTOM_FIELD_RESPONSE_AVAILABLE = False
    # Temporary placeholder until Task #64 is completed
    class CustomFieldResponse(BaseModel):
        id: UUID
        name: str
        field_type: str
        config: dict


class SchemaFieldItem(BaseModel):
    """
    Represents a field within a schema during creation.
    
    Used in POST /schemas to define which custom fields belong to the schema
    and their display configuration.
    
    Example:
        {
            "field_id": "uuid-presentation",
            "display_order": 0,
            "show_on_card": true
        }
    """
    field_id: UUID = Field(
        ...,
        description="ID of the CustomField to include in this schema"
    )
    display_order: int = Field(
        ...,
        ge=0,
        description="Display order (0-based, lower numbers appear first)"
    )
    show_on_card: bool = Field(
        default=False,
        description="Whether this field should be visible on video cards (max 3 per schema)"
    )


class FieldSchemaCreate(BaseModel):
    """
    Schema for creating a new FieldSchema.
    
    Validates:
    - Name is required (1-255 chars)
    - Description is optional
    - Fields array with field_id, display_order, show_on_card
    - Max 3 fields can have show_on_card=true
    
    Example Request:
        {
            "name": "Video Quality",
            "description": "Standard video quality metrics",
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
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Human-readable schema name (e.g., 'Video Quality')"
    )
    description: Optional[str] = Field(
        None,
        description="Optional explanation of what this schema evaluates"
    )
    fields: list[SchemaFieldItem] = Field(
        default_factory=list,
        description="List of custom fields to include in this schema"
    )

    @field_validator('fields')
    @classmethod
    def validate_show_on_card_limit(cls, fields: list[SchemaFieldItem]) -> list[SchemaFieldItem]:
        """
        Validate that at most 3 fields have show_on_card=true.
        
        This constraint ensures the UI doesn't become cluttered with too many
        fields displayed on video cards. Users can still define more fields,
        but only 3 will be prominently displayed.
        
        Raises:
            ValueError: If more than 3 fields have show_on_card=true
        """
        show_on_card_count = sum(1 for field in fields if field.show_on_card)
        if show_on_card_count > 3:
            raise ValueError(
                f"At most 3 fields can have show_on_card=true, got {show_on_card_count}. "
                f"Please set show_on_card=false for {show_on_card_count - 3} field(s)."
            )
        return fields


class FieldSchemaUpdate(BaseModel):
    """
    Schema for updating an existing FieldSchema.
    
    Only allows updating name and description. Field associations are managed
    through separate endpoints (POST/PUT/DELETE /schemas/{id}/fields/{field_id}).
    
    All fields are optional to support partial updates.
    
    Example Request:
        {
            "name": "Updated Video Quality",
            "description": "Updated description"
        }
    """
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Updated schema name"
    )
    description: Optional[str] = Field(
        None,
        description="Updated schema description"
    )


class SchemaFieldResponse(BaseModel):
    """
    Represents a field within a schema in API responses.
    
    Includes full CustomField data to avoid N+1 queries. This enables the
    frontend to display all field details without making additional API calls.
    
    Example:
        {
            "field_id": "uuid",
            "field": {
                "id": "uuid",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {"options": ["bad", "good", "great"]},
                "created_at": "2025-11-05T10:00:00Z",
                "updated_at": "2025-11-05T10:00:00Z"
            },
            "display_order": 0,
            "show_on_card": true
        }
    """
    model_config = ConfigDict(from_attributes=True)

    field_id: UUID = Field(
        ...,
        description="ID of the CustomField"
    )
    field: CustomFieldResponse = Field(
        ...,
        description="Full CustomField definition with name, type, config"
    )
    display_order: int = Field(
        ...,
        description="Display order (0-based)"
    )
    show_on_card: bool = Field(
        ...,
        description="Whether this field is shown on video cards"
    )


class FieldSchemaResponse(BaseModel):
    """
    Schema for FieldSchema API responses.
    
    Includes full nested field data via SchemaFieldResponse. This rich response
    format eliminates the need for the frontend to make separate API calls to
    fetch CustomField details.
    
    The schema_fields list is ordered by display_order (handled by SQLAlchemy
    relationship ordering in the model).
    
    Example Response:
        {
            "id": "uuid",
            "list_id": "uuid",
            "name": "Video Quality",
            "description": "Standard quality metrics",
            "schema_fields": [
                {
                    "field_id": "uuid-1",
                    "field": {...CustomField...},
                    "display_order": 0,
                    "show_on_card": true
                },
                {
                    "field_id": "uuid-2",
                    "field": {...CustomField...},
                    "display_order": 1,
                    "show_on_card": false
                }
            ],
            "created_at": "2025-11-05T10:00:00Z",
            "updated_at": "2025-11-05T10:00:00Z"
        }
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    list_id: UUID
    name: str
    description: Optional[str]
    schema_fields: list[SchemaFieldResponse] = Field(
        default_factory=list,
        description="Ordered list of fields in this schema"
    )
    created_at: datetime
    updated_at: datetime
```

**Why:**
- **Nested Models Pattern**: Following Pydantic v2 best practices for nested relationships (REF MCP: pydantic/pydantic nested-models docs)
- **from_attributes ConfigDict**: Replaces deprecated `orm_mode=True` in Pydantic v2 (REF MCP: migration guide)
- **Field Validator Pattern**: Uses `@field_validator` decorator with `@classmethod` for the show_on_card constraint (REF MCP: field-validators docs)
- **Graceful Dependency Handling**: Try/except import allows this task to be completed even if Task #64 (CustomFieldResponse) doesn't exist yet
- **Separate SchemaFieldItem**: Cleaner separation between create payloads (minimal data) and response payloads (full nested data)

### 2. Export Schemas in __init__.py

**Files:** `backend/app/schemas/__init__.py`

**Action:** Add the new schemas to the module exports so they can be imported throughout the application.

**Code:**

```python
from .list import ListCreate, ListUpdate, ListResponse
from .job_progress import ProgressData, JobProgressEventCreate, JobProgressEventRead
from .tag import TagBase, TagCreate, TagUpdate, TagResponse
from .field_schema import (
    SchemaFieldItem,
    FieldSchemaCreate,
    FieldSchemaUpdate,
    SchemaFieldResponse,
    FieldSchemaResponse,
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
    # Field Schema schemas
    "SchemaFieldItem",
    "FieldSchemaCreate",
    "FieldSchemaUpdate",
    "SchemaFieldResponse",
    "FieldSchemaResponse",
]
```

**Why:**
- Consistent with existing export pattern in the codebase
- Makes schemas easily importable: `from app.schemas import FieldSchemaCreate`
- __all__ list ensures proper module documentation

### 3. Create CustomFieldResponse Placeholder (if Task #64 not done)

**Files:** `backend/app/schemas/custom_field.py` (new file, temporary)

**Action:** If Task #64 hasn't created this file yet, create a minimal placeholder schema that can be used by FieldSchemaResponse. This will be replaced by the full implementation in Task #64.

**Code:**

```python
from typing import Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CustomFieldResponse(BaseModel):
    """
    Temporary placeholder for CustomField API responses.
    
    This minimal implementation allows Task #65 (FieldSchema schemas) to be
    completed independently. Task #64 will provide the full implementation.
    
    TODO: Replace with full implementation in Task #64
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    list_id: UUID
    name: str
    field_type: str = Field(
        ...,
        description="One of: 'select', 'rating', 'text', 'boolean'"
    )
    config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Field-type specific configuration (e.g., options for select fields)"
    )
    created_at: datetime
    updated_at: datetime
```

**Why:**
- Allows Task #65 to proceed independently of Task #64
- Provides enough structure for FieldSchemaResponse to work correctly
- Minimal implementation that matches the SQLAlchemy model structure
- Will be completely replaced by Task #64 (no merge conflicts)

---

## 🧪 Testing Strategy

**Unit Tests:**

Testing deferred to Task #68 (API Endpoints) for the following reasons:
1. Pydantic schemas are self-validating through their type system
2. The most valuable tests are integration tests with real API requests
3. The show_on_card validator will be tested during API endpoint testing
4. This follows the existing pattern in the codebase (no dedicated schema tests for tag.py, list.py)

**Manual Testing in Python REPL:**

Test schema validation immediately after implementation:

```python
# Start Python REPL in backend directory
cd backend
python

# Test 1: Valid FieldSchemaCreate with fields
from app.schemas.field_schema import FieldSchemaCreate, SchemaFieldItem
from uuid import uuid4

field_id_1 = uuid4()
field_id_2 = uuid4()

schema_create = FieldSchemaCreate(
    name="Video Quality",
    description="Standard quality metrics",
    fields=[
        SchemaFieldItem(field_id=field_id_1, display_order=0, show_on_card=True),
        SchemaFieldItem(field_id=field_id_2, display_order=1, show_on_card=False)
    ]
)
print(schema_create.model_dump())
# Expected: All fields present, validation passes

# Test 2: Validation error - more than 3 show_on_card=true
try:
    schema_create = FieldSchemaCreate(
        name="Too Many Fields",
        fields=[
            SchemaFieldItem(field_id=uuid4(), display_order=0, show_on_card=True),
            SchemaFieldItem(field_id=uuid4(), display_order=1, show_on_card=True),
            SchemaFieldItem(field_id=uuid4(), display_order=2, show_on_card=True),
            SchemaFieldItem(field_id=uuid4(), display_order=3, show_on_card=True)
        ]
    )
    print("FAIL: Should have raised ValidationError")
except ValueError as e:
    print(f"PASS: {e}")
# Expected: ValueError with message about max 3 fields

# Test 3: Validation error - negative display_order
try:
    schema_create = FieldSchemaCreate(
        name="Invalid Order",
        fields=[
            SchemaFieldItem(field_id=uuid4(), display_order=-1, show_on_card=False)
        ]
    )
    print("FAIL: Should have raised ValidationError")
except Exception as e:
    print(f"PASS: {e}")
# Expected: ValidationError for display_order < 0

# Test 4: Partial update with FieldSchemaUpdate
from app.schemas.field_schema import FieldSchemaUpdate

update = FieldSchemaUpdate(name="Updated Name")
print(update.model_dump(exclude_unset=True))
# Expected: Only {"name": "Updated Name"}

update = FieldSchemaUpdate(description="Updated description")
print(update.model_dump(exclude_unset=True))
# Expected: Only {"description": "Updated description"}

# Test 5: FieldSchemaResponse with nested data
from app.schemas.field_schema import FieldSchemaResponse, SchemaFieldResponse
from app.schemas.custom_field import CustomFieldResponse
from datetime import datetime

response = FieldSchemaResponse(
    id=uuid4(),
    list_id=uuid4(),
    name="Video Quality",
    description="Standard metrics",
    schema_fields=[
        SchemaFieldResponse(
            field_id=field_id_1,
            field=CustomFieldResponse(
                id=field_id_1,
                list_id=uuid4(),
                name="Presentation Quality",
                field_type="select",
                config={"options": ["bad", "good", "great"]},
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            display_order=0,
            show_on_card=True
        )
    ],
    created_at=datetime.now(),
    updated_at=datetime.now()
)
print(response.model_dump())
# Expected: Full nested structure with field data included
```

**Integration Tests:**

Full integration testing will be done in Task #68 (FieldSchema API Endpoints) which will include:
- Creating schemas with fields and validating database persistence
- Testing show_on_card constraint at the API level
- Testing field_id foreign key validation (field must exist in same list)
- Testing response serialization with real SQLAlchemy models

---

## 📚 Reference

### REF MCP Validation Results

✅ **Nested Models Pattern is Current** (Pydantic v2 Docs, 2024)
- Source: pydantic/pydantic nested-models docs
- Pydantic v2 supports nested models naturally through type annotations
- Use `list[CustomFieldResponse]` syntax instead of `List[CustomFieldResponse]`
- Nested validation happens automatically during model instantiation

✅ **ConfigDict with from_attributes Replaces orm_mode** (Pydantic v2 Migration Guide)
- Source: pydantic/pydantic migration guide - changes-to-config
- Old: `class Config: orm_mode = True` (Pydantic v1, deprecated)
- New: `model_config = ConfigDict(from_attributes=True)` (Pydantic v2)
- Required for ORM models to be converted to Pydantic schemas

✅ **Field Validators Use @field_validator Decorator** (Pydantic v2 Docs, 2024)
- Source: pydantic/pydantic field-validators docs
- Use `@field_validator('field_name')` decorator with `@classmethod`
- Default mode is 'after' (runs after Pydantic's internal validation)
- Must return the validated value (even if unchanged)
- Can validate multiple fields: `@field_validator('f1', 'f2')`

💡 **Best Practice: After Validators for Type-Safe Validation**
- Source: pydantic/pydantic field-validators docs
- After validators run after type coercion, making them more type-safe
- Use 'before' validators only when you need to transform raw input
- Use 'plain' validators when you want to skip Pydantic's validation entirely
- The show_on_card validator should use default 'after' mode

⚠️ **Optional Fields Must Use None Default**
- Source: Pydantic v2 best practices
- For partial updates (FieldSchemaUpdate), use `field: Optional[str] = None`
- Use `model_dump(exclude_unset=True)` to get only provided fields
- Distinguishes between "not provided" vs "explicitly set to None"

### Related Docs

- Master Design Doc: `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 176-249 (API Design)
- Task #60 Report: `docs/reports/2025-11-06-report-060-field-schema-model.md` - FieldSchema SQLAlchemy model details
- Task #60 Handoff: `docs/handoffs/2025-11-06-log-060-field-schema-model.md` - Context for this task

### Related Code

- Pattern Reference: `backend/app/schemas/tag.py` - Simple schema pattern with validation
- Pattern Reference: `backend/app/schemas/list.py` - Pydantic v2 ConfigDict usage
- SQLAlchemy Model: `backend/app/models/field_schema.py` - Source of truth for field types
- SQLAlchemy Model: `backend/app/models/custom_field.py` - Referenced in nested responses

### Design Decisions

**1. Why separate SchemaFieldItem and SchemaFieldResponse?**
- SchemaFieldItem: Minimal data for creation (field_id only)
- SchemaFieldResponse: Rich data for responses (full field object)
- Separates concerns: API clients provide IDs, backend resolves to full objects
- Follows FastAPI best practice of different schemas for different operations

**2. Why include full CustomField data in response?**
- Alternative: Return only field_ids, require frontend to fetch CustomField details separately
- Chosen approach: Nested CustomFieldResponse in SchemaFieldResponse
- Rationale: 
  - Eliminates N+1 query problem
  - Frontend can render field schemas with single API call
  - Matches design doc specification (lines 236-249)
  - SQLAlchemy relationship already eager-loads this data efficiently

**3. Why validate show_on_card limit in Pydantic instead of database?**
- Alternative: Add CHECK constraint in database migration
- Chosen approach: Pydantic field validator
- Rationale:
  - More flexible (easy to change limit from 3 to another number)
  - Better error messages for API consumers
  - Validation happens before database transaction
  - Can be conditionally skipped for internal operations if needed
  - Database still enforces referential integrity (field_id FK)

**4. Why only name/description in FieldSchemaUpdate?**
- Alternative: Allow updating fields array in PUT request
- Chosen approach: Separate endpoints for field management
- Rationale:
  - Follows design doc API specification (line 223: PUT only updates metadata)
  - Field management has dedicated endpoints: POST/PUT/DELETE /schemas/{id}/fields/{field_id}
  - Cleaner separation of concerns (metadata vs relationships)
  - Easier to implement granular permissions later

**5. Why handle missing CustomFieldResponse with try/except?**
- Alternative: Make Task #64 a hard dependency, block Task #65 until completed
- Chosen approach: Graceful import with placeholder
- Rationale:
  - Enables parallel development (Task #64 and #65 can proceed independently)
  - Placeholder schema has minimal but sufficient structure
  - Zero merge conflicts when Task #64 replaces the placeholder
  - Real-world development often requires working with incomplete dependencies

**6. Why defer tests to Task #68?**
- Alternative: Write dedicated unit tests for Pydantic schemas
- Chosen approach: Defer to API endpoint integration tests
- Rationale:
  - Pydantic's type system provides built-in validation testing
  - Most valuable tests are with real HTTP requests and database operations
  - Matches existing codebase pattern (no tests for tag.py, list.py schemas)
  - Avoids test duplication (same validations tested in integration tests)
  - Manual REPL testing provides immediate feedback during development

---

## 📝 Notes

**Implementation Order:**

1. Create `custom_field.py` with placeholder if Task #64 not done
2. Create `field_schema.py` with all schemas
3. Update `__init__.py` exports
4. Run manual REPL tests
5. Document completion in status.md

**Verification Checklist:**

- [ ] Import schemas in Python REPL without errors
- [ ] Create valid FieldSchemaCreate instance with 3 show_on_card fields
- [ ] Validation error when 4+ show_on_card fields
- [ ] Validation error when display_order < 0
- [ ] FieldSchemaUpdate allows partial updates
- [ ] FieldSchemaResponse serializes nested data correctly
- [ ] All schemas exported in __init__.py

**Handoff for Task #68 (API Endpoints):**

When implementing API endpoints, use these schemas as follows:
- POST /schemas: Accept `FieldSchemaCreate`, create SchemaField join table entries
- PUT /schemas/{id}: Accept `FieldSchemaUpdate`, only update name/description
- GET /schemas: Return `list[FieldSchemaResponse]` with eager-loaded schema_fields
- GET /schemas/{id}: Return `FieldSchemaResponse` with eager-loaded schema_fields

Remember to validate that all field_ids in the fields array exist in the same list_id as the schema being created (database FK will enforce this, but explicit check gives better error message).
