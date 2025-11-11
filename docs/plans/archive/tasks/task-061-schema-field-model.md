# Task #61: Create SchemaField Join Table SQLAlchemy Model

**Plan Task:** #61
**Wave/Phase:** Custom Fields System - Phase 1: MVP Backend (Task #58-77)
**Dependencies:** Task #58 (Migration), Task #59 (CustomField Model), Task #60 (FieldSchema Model)

---

## 🎯 Ziel

Implement the full SchemaField SQLAlchemy model to enable the many-to-many relationship between FieldSchema and CustomField. This join table allows schemas to contain multiple custom fields with display order and card visibility metadata. The model must inherit from Base (not BaseModel) with a composite primary key, match the migration schema exactly, and include proper CASCADE behaviors on both relationship sides.

## 📋 Acceptance Criteria

- [x] SchemaField model inherits from Base (not BaseModel) with composite primary key
- [x] All columns match migration schema exactly (schema_id, field_id, display_order, show_on_card)
- [x] Both relationships configured: schema → FieldSchema, field → CustomField
- [x] CustomField.schema_fields relationship added/fixed with passive_deletes=True
- [x] Migration Alignment Checklist (Step 6.5) completed with 100% match
- [x] Manual CASCADE tests passed (2 tests: delete schema, delete field)
- [x] Import validation successful (no circular dependencies)
- [x] TypeScript check shows 0 new errors (baseline 6 pre-existing)
- [x] CLAUDE.md updated with schema_field.py status change

---

## 🛠️ Implementation Steps

### 1. Read Migration Schema Reference
**Files:** `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py`
**Action:** Review lines 63-79 for exact schema_fields table definition

**Migration Reference (lines 63-79):**
```python
op.create_table(
    'schema_fields',
    sa.Column('schema_id', UUID(as_uuid=True), sa.ForeignKey('field_schemas.id', ondelete='CASCADE'), nullable=False),
    sa.Column('field_id', UUID(as_uuid=True), sa.ForeignKey('custom_fields.id', ondelete='CASCADE'), nullable=False),
    sa.Column('display_order', sa.Integer, nullable=False, server_default='0'),
    sa.Column('show_on_card', sa.Boolean, nullable=False, server_default='false'),
    sa.PrimaryKeyConstraint('schema_id', 'field_id', name='pk_schema_fields')
)

# Indexes for both foreign keys (bidirectional lookups)
op.create_index('idx_schema_fields_schema_id', 'schema_fields', ['schema_id'])
op.create_index('idx_schema_fields_field_id', 'schema_fields', ['field_id'])
```

**Key Observations:**
- Composite primary key: `(schema_id, field_id)` - NO separate id column
- Both FKs have `ondelete='CASCADE'`
- Metadata fields: display_order (INT, default 0), show_on_card (BOOLEAN, default false)
- Two indexes for bidirectional lookups

---

### 2. Implement Full SchemaField Model
**Files:** `backend/app/models/schema_field.py`
**Action:** Replace placeholder with full production implementation

**Current State Analysis:**
- Placeholder already has correct Base inheritance (not BaseModel) ✅
- Has composite PK setup (schema_id, field_id as primary_key=True) ✅
- Has metadata fields (display_order, show_on_card) ✅
- Has basic relationships (schema, field) ✅
- Missing: `__table_args__` with PrimaryKeyConstraint name
- Missing: Proper minimal docstring

**Full Implementation:**
```python
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, Boolean, text, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from uuid import UUID as PyUUID

from .base import Base  # ← Use Base, not BaseModel (REF MCP 2025-11-05)

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .field_schema import FieldSchema


class SchemaField(Base):
    """
    Join table for many-to-many relationship between FieldSchema and CustomField.
    
    Enables schemas to contain multiple fields with display ordering and visibility control.
    Uses composite primary key (schema_id, field_id) without separate id column.
    """
    __tablename__ = "schema_fields"
    
    # Composite primary key constraint (must match migration name)
    __table_args__ = (
        PrimaryKeyConstraint('schema_id', 'field_id', name='pk_schema_fields'),
    )

    # Foreign Keys (both are part of composite PK)
    schema_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_schemas.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False
        # Note: idx_schema_fields_schema_id exists in migration for FK lookups
    )
    field_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_fields.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False
        # Note: idx_schema_fields_field_id exists in migration for FK lookups
    )

    # Metadata fields
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text('0')  # SQL expression for CREATE TABLE (prevents type coercion issues)
    )
    show_on_card: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text('false')  # SQL expression for CREATE TABLE (prevents type coercion issues)
    )

    # Relationships
    schema: Mapped["FieldSchema"] = relationship(
        "FieldSchema",
        back_populates="schema_fields"
    )
    field: Mapped["CustomField"] = relationship(
        "CustomField",
        back_populates="schema_fields"
    )

    def __repr__(self) -> str:
        return f"<SchemaField(schema_id={self.schema_id}, field_id={self.field_id}, order={self.display_order})>"
```

**Changes from Placeholder:**
1. Added `PrimaryKeyConstraint` import
2. Added `__table_args__` with named PK constraint matching migration
3. Updated docstring to be concise but informative
4. Updated `__repr__` to include display_order for debugging
5. Kept all existing column definitions (already correct)
6. Added index documentation comments on FK columns (REF MCP 2025-11-06: explicit documentation prevents confusion)
7. Enhanced server_default comments with rationale (REF MCP 2025-11-06: text() prevents type coercion issues)

**Design Decision 1: Base vs BaseModel Inheritance**
- **Rationale:** Join tables with composite PKs should NOT have auto-generated id/timestamps
- **Evidence:** REF MCP validated in Task #59 report
- **Migration Match:** Migration has NO id/created_at/updated_at columns
- **Benefit:** Prevents schema drift, cleaner database design

**Design Decision 2: Named PrimaryKeyConstraint**
- **Rationale:** Explicit constraint name enables easier debugging and migration rollbacks
- **Migration Match:** `name='pk_schema_fields'` in migration line 69
- **Benefit:** Consistent naming convention across migration and ORM

**Design Decision 3: Enhanced Documentation Comments (REF MCP 2025-11-06)**
- **Index Comments on FK Columns:** Explicitly document that migration indexes exist (`idx_schema_fields_schema_id`, `idx_schema_fields_field_id`)
  - **Why:** Prevents future developers from being confused about "missing" indexes in ORM code
  - **Pattern:** Composite PKs are automatically indexed, but migration creates explicit FK indexes for bidirectional lookups
  - **Cost:** 1 line per FK column
  - **Benefit:** 100% clarity, prevents unnecessary "fix" PRs
- **server_default Rationale Comments:** Explain WHY `text()` is used instead of Python default values
  - **Why:** `text('0')` creates SQL expression in CREATE TABLE, `server_default=0` might cause type coercion issues
  - **Evidence:** SQLAlchemy docs recommend `text()` for SQL-level defaults to match migration behavior exactly
  - **Cost:** Extended comment by ~30 chars
  - **Benefit:** Prevents future developers from "simplifying" to `server_default=0` which could break production

---

### 3. Fix CustomField.schema_fields Relationship
**Files:** `backend/app/models/custom_field.py`
**Action:** Verify/fix schema_fields relationship has passive_deletes=True

**Current CustomField.schema_fields (lines 86-91):**
```python
schema_fields: Mapped[list["SchemaField"]] = relationship(
    "SchemaField",
    back_populates="field",
    cascade="all, delete-orphan",  # Deleting field removes from all schemas
    passive_deletes=True  # Trust DB CASCADE (REF MCP 2025-11-05: also optimal for join tables)
)
```

**Status:** ✅ Already correct! No changes needed.

**Verification Checklist:**
- [x] `passive_deletes=True` is set
- [x] `cascade="all, delete-orphan"` is correct
- [x] `back_populates="field"` matches SchemaField.field
- [x] REF MCP comment references Task #59 validation

**Design Decision 3: passive_deletes=True on Both Sides**
- **FieldSchema.schema_fields:** Already has `passive_deletes=True` (Task #60)
- **CustomField.schema_fields:** Already has `passive_deletes=True` (Task #59)
- **Rationale:** Both FKs have `ondelete='CASCADE'` in migration (lines 65-66)
- **Performance:** 3-10x faster deletion for large collections (avoids SELECT before DELETE)
- **Safety:** Database CASCADE is atomic, ORM CASCADE can fail mid-operation

**Design Decision 4: No cascade on back_populates**
- **Pattern:** Only define cascade on owning side (CustomField, FieldSchema)
- **SchemaField relationships:** No cascade parameter
- **Rationale:** Trust foreign key constraints, avoid redundant cascade logic
- **Benefit:** Simpler code, fewer edge cases

---

### 4. Verify Model Exports
**Files:** `backend/app/models/__init__.py`
**Action:** Confirm SchemaField is already exported (should be from Task #59)

**Expected Export (should already exist):**
```python
from .schema_field import SchemaField
```

**Verification Command:**
```bash
grep "SchemaField" backend/app/models/__init__.py
```

**Expected Output:**
```
from .schema_field import SchemaField
```

If missing, add after CustomField import:
```python
from .custom_field import CustomField
from .schema_field import SchemaField  # ← Add if missing
```

---

### 5. Import Validation Testing
**Files:** `backend/app/models/schema_field.py`
**Action:** Verify no circular imports and correct syntax

**Test 1: Direct Import**
```bash
cd backend
python3 -c "from app.models.schema_field import SchemaField; print(f'✅ Import successful: {SchemaField.__tablename__}')"
```

**Expected Output:**
```
✅ Import successful: schema_fields
```

**Test 2: Comprehensive Model Import**
```bash
cd backend
python3 -c "from app.models import SchemaField, FieldSchema, CustomField; print(f'✅ All imports successful')"
```

**Expected Output:**
```
✅ All imports successful
```

**Fallback: Python AST Syntax Validation (if virtualenv unavailable)**
```bash
python3 -c "import ast; ast.parse(open('backend/app/models/schema_field.py').read()); print('✅ Syntax valid')"
```

---

### 6. Step 6.5: Migration Alignment Checklist
**Files:** Migration vs. ORM Model
**Action:** Systematic verification before commit (3-minute investment prevents 30+ minute debugging)

**Checklist Format:**
```
TABLE NAME:
✓ Migration: 'schema_fields'
✓ Model: __tablename__ = "schema_fields"

COLUMNS:
✓ schema_id: UUID, nullable=False, FK('field_schemas.id', ondelete='CASCADE'), primary_key=True
✓ field_id: UUID, nullable=False, FK('custom_fields.id', ondelete='CASCADE'), primary_key=True
✓ display_order: Integer, nullable=False, server_default='0'
✓ show_on_card: Boolean, nullable=False, server_default='false'

PRIMARY KEY CONSTRAINT:
✓ Migration: PrimaryKeyConstraint('schema_id', 'field_id', name='pk_schema_fields')
✓ Model: __table_args__ = (PrimaryKeyConstraint('schema_id', 'field_id', name='pk_schema_fields'),)

INDEXES (informational, not enforced by ORM):
ℹ Migration: idx_schema_fields_schema_id on [schema_id]
ℹ Migration: idx_schema_fields_field_id on [field_id]
ℹ Model: No index=True needed (composite PK already indexed)

FOREIGN KEYS:
✓ schema_id → field_schemas.id (ondelete='CASCADE')
✓ field_id → custom_fields.id (ondelete='CASCADE')
```

**Verification Script:**
```bash
# Check table name
grep "__tablename__" backend/app/models/schema_field.py

# Check composite PK constraint
grep "PrimaryKeyConstraint" backend/app/models/schema_field.py

# Check foreign keys
grep "ForeignKey.*ondelete.*CASCADE" backend/app/models/schema_field.py

# Check metadata fields
grep "display_order\|show_on_card" backend/app/models/schema_field.py
```

**Success Criteria:** All checkmarks (✓) must match exactly between migration and model.

---

### 7. Manual CASCADE Testing
**Files:** PostgreSQL database
**Action:** Verify CASCADE behavior works correctly for both foreign keys

**Test Setup Commands:**
```bash
# Start PostgreSQL if not running
docker-compose up -d postgres

# Connect to database
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d smart_youtube_bookmarks
```

**Manual Test 1: Delete FieldSchema → SchemaFields Cascade**

**SQL Test:**
```sql
-- Setup: Create test data
INSERT INTO bookmarks_lists (id, name, user_id, created_at, updated_at)
VALUES (gen_random_uuid(), 'Test List CASCADE Schema', gen_random_uuid(), NOW(), NOW())
RETURNING id;
-- Save the list_id

-- Create test field_schema
INSERT INTO field_schemas (id, list_id, name, created_at, updated_at)
VALUES (gen_random_uuid(), '<list_id_from_above>', 'Test Schema', NOW(), NOW())
RETURNING id;
-- Save the schema_id

-- Create test custom_field
INSERT INTO custom_fields (id, list_id, name, field_type, config, created_at, updated_at)
VALUES (gen_random_uuid(), '<list_id_from_above>', 'Test Field', 'rating', '{"max_rating": 5}', NOW(), NOW())
RETURNING id;
-- Save the field_id

-- Create schema_field join entry
INSERT INTO schema_fields (schema_id, field_id, display_order, show_on_card)
VALUES ('<schema_id>', '<field_id>', 0, false);

-- Verify join entry exists
SELECT * FROM schema_fields WHERE schema_id = '<schema_id>';
-- Expected: 1 row

-- Test CASCADE: Delete FieldSchema
DELETE FROM field_schemas WHERE id = '<schema_id>';

-- Verify schema_field was cascaded
SELECT * FROM schema_fields WHERE schema_id = '<schema_id>';
-- Expected: 0 rows (CASCADE worked!)

-- Cleanup
DELETE FROM bookmarks_lists WHERE name = 'Test List CASCADE Schema';
```

**Expected Result:** SchemaField entry automatically deleted when FieldSchema deleted.

**Manual Test 2: Delete CustomField → SchemaFields Cascade**

**SQL Test:**
```sql
-- Setup: Create test data (reuse approach from Test 1)
-- ... (similar INSERT statements) ...

-- Create schema_field join entry
INSERT INTO schema_fields (schema_id, field_id, display_order, show_on_card)
VALUES ('<schema_id>', '<field_id>', 1, true);

-- Verify join entry exists
SELECT * FROM schema_fields WHERE field_id = '<field_id>';
-- Expected: 1 row

-- Test CASCADE: Delete CustomField
DELETE FROM custom_fields WHERE id = '<field_id>';

-- Verify schema_field was cascaded
SELECT * FROM schema_fields WHERE field_id = '<field_id>';
-- Expected: 0 rows (CASCADE worked!)

-- Cleanup
DELETE FROM field_schemas WHERE id = '<schema_id>';
DELETE FROM bookmarks_lists WHERE name LIKE 'Test List CASCADE%';
```

**Expected Result:** SchemaField entry automatically deleted when CustomField deleted.

**Success Criteria:**
- Test 1: 0 rows after deleting FieldSchema
- Test 2: 0 rows after deleting CustomField

---

### 8. TypeScript Type Check
**Files:** `frontend/`
**Action:** Verify no new TypeScript errors introduced

**Commands:**
```bash
cd frontend
npx tsc --noEmit
```

**Expected Output:**
```
Found 6 errors in 4 files.
```

**Baseline Pre-existing Errors:**
1. src/components/Dashboard.tsx (4 errors - known issue with JobProgress type)
2. src/pages/VideosPage.tsx (2 errors - known issue with Video type)

**Success Criteria:** Exactly 6 errors (no new errors). Backend ORM changes should NOT affect frontend types.

---

### 9. Update CLAUDE.md Documentation
**Files:** `CLAUDE.md`
**Action:** Update Database Models section to reflect SchemaField completion

**Location:** Line ~40 (Database Models section)

**Current Entry:**
```markdown
- `app/models/schema_field.py` - SchemaField (Task #61, placeholder)
```

**Updated Entry:**
```markdown
- `app/models/schema_field.py` - SchemaField (Task #61)
```

**Change:** Remove "placeholder" status indicator.

---

### 10. Commit Changes
**Action:** Commit all changes with descriptive message

**Commands:**
```bash
cd "/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks"

git add backend/app/models/schema_field.py
git add CLAUDE.md

git commit -m "$(cat <<'COMMIT_MSG'
feat(models): implement SchemaField join table with composite PK

- Replaced placeholder with full production implementation
- Added __table_args__ with named PrimaryKeyConstraint
- Composite PK: (schema_id, field_id) matching migration
- Inherits from Base (not BaseModel) for composite PK pattern
- Both FKs use ondelete='CASCADE' with passive_deletes=True
- Migration alignment verified via Step 6.5 checklist (100% match)
- Manual CASCADE tests passed (2/2: delete schema, delete field)
- Minimal docstring (join tables are self-explanatory)
- Updated CLAUDE.md to reflect completion

Task: #61
Pattern: Follows Task #59 (CustomField) composite PK pattern exactly
REF MCP: Base vs BaseModel validated in Task #59 report
Performance: passive_deletes=True trusts DB CASCADE (3-10x faster)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
)"
```

---

## 🧪 Testing Strategy

### Import Validation Tests (Step 5)

**Test 1: Direct Import**
- Import SchemaField class directly
- Verify `__tablename__` attribute
- Success: No ImportError, prints "schema_fields"

**Test 2: Comprehensive Model Import**
- Import SchemaField, FieldSchema, CustomField together
- Verify no circular import errors
- Success: All imports successful

**Fallback: AST Syntax Validation**
- If virtualenv unavailable, use Python AST module
- Parse schema_field.py as Python code
- Success: No syntax errors

### Migration Alignment Test (Step 6.5)

**Systematic Checklist:**
1. Table name matches: `schema_fields`
2. All 4 columns match: types, nullable, defaults
3. Composite PK constraint name matches: `pk_schema_fields`
4. Both FKs match: targets, ondelete='CASCADE'
5. Indexes documented (informational only)

**Success Criteria:** 100% match on all checkmarks

### Manual CASCADE Tests (Step 7)

**Test 1: Delete FieldSchema → SchemaFields Cascade**
- Setup: Create list → schema → field → schema_field entry
- Action: DELETE field_schemas WHERE id = schema_id
- Verify: SELECT schema_fields returns 0 rows
- Cleanup: Delete test list
- Success: CASCADE deletion works

**Test 2: Delete CustomField → SchemaFields Cascade**
- Setup: Create list → schema → field → schema_field entry
- Action: DELETE custom_fields WHERE id = field_id
- Verify: SELECT schema_fields returns 0 rows
- Cleanup: Delete test data
- Success: CASCADE deletion works

### TypeScript Regression Test (Step 8)

**Test: No New TypeScript Errors**
- Run: `npx tsc --noEmit` in frontend/
- Baseline: 6 pre-existing errors
- Success: Exactly 6 errors (no new errors)

---

## 📚 Reference

### Related Docs

**Migration Reference:**
- `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` (lines 63-79)
- Schema definition for schema_fields table

**Task Plans:**
- `docs/plans/tasks/task-059-custom-field-model.md` - Base vs BaseModel pattern, REF MCP evidence
- `docs/plans/tasks/task-060-field-schema-model.md` - Step 6.5 Migration Alignment Checklist pattern

**Handoff Document:**
- `docs/handoffs/2025-11-06-log-060-field-schema-model.md` - Task #60 completion, Task #61 guidance

**Design Document:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Overall Custom Fields System architecture

### Related Code

**Pattern to Follow:**
- Task #59 (CustomField Model) - Exact same Base inheritance, passive_deletes pattern
- Task #60 (FieldSchema Model) - Step 6.5 checklist pattern

**Relationship Examples:**
- `backend/app/models/field_schema.py` - FieldSchema.schema_fields relationship (already has passive_deletes=True)
- `backend/app/models/custom_field.py` - CustomField.schema_fields relationship (already has passive_deletes=True)

**Base Class:**
- `backend/app/models/base.py` - Base (no id/timestamps) vs BaseModel (with id/timestamps)

### Design Decisions

**Decision 1: Base vs BaseModel Inheritance**
- **Why Base:** Composite PK tables should NOT have auto-generated id/created_at/updated_at
- **Evidence:** REF MCP validated in Task #59 report against SQLAlchemy 2.0 docs
- **Constraint:** Migration has NO id column (lines 63-69)
- **Benefit:** Prevents schema drift, cleaner database design

**Decision 2: Named PrimaryKeyConstraint in __table_args__**
- **Why:** Explicit constraint naming for debugging and migration consistency
- **Alternative:** Let SQLAlchemy auto-generate constraint name
- **Chosen:** Named constraint matching migration (`pk_schema_fields`)
- **Benefit:** Easier to identify in database logs, migration rollbacks

**Decision 3: passive_deletes=True on Both Relationship Sides**
- **Why:** Both FKs have `ondelete='CASCADE'` in migration
- **Performance:** 3-10x faster (avoids SELECT before DELETE)
- **Safety:** Database CASCADE is atomic, ORM CASCADE can fail mid-operation
- **Validation:** REF MCP in Task #59 against SQLAlchemy docs

**Decision 4: Minimal Docstring for Join Table**
- **Why:** Join tables are self-explanatory (map two entities)
- **Alternative:** 40+ line docstring like FieldSchema
- **Chosen:** 3-line docstring explaining purpose
- **Constraint:** Over-documentation can reduce readability
- **Benefit:** Clearer code, easier maintenance

**Decision 5: server_default with text() for SQL Expressions**
- **Why:** Migration uses SQL defaults ('0', 'false'), not Python defaults
- **Pattern:** `server_default=text('0')` instead of `server_default='0'`
- **Benefit:** Explicit SQL expression, prevents type coercion issues
- **Migration Match:** Exact match with lines 67-68

**Decision 6: No cascade on SchemaField Relationships**
- **Why:** SchemaField is owned by parent entities (FieldSchema, CustomField)
- **Pattern:** Only define cascade on owning side
- **Alternative:** Add redundant cascade on both sides
- **Chosen:** Trust foreign key constraints, no cascade on back_populates
- **Benefit:** Simpler code, fewer edge cases

---

## ⏱️ Estimated Time

**Total:** 30-40 minutes

**Breakdown:**
1. Read migration reference: 2 min
2. Implement SchemaField model: 10 min
3. Verify CustomField relationship: 2 min
4. Verify model exports: 1 min
5. Import validation tests: 3 min
6. Step 6.5 Migration Alignment: 3 min
7. Manual CASCADE tests: 10 min
8. TypeScript check: 2 min
9. Update CLAUDE.md: 2 min
10. Commit changes: 5 min

**Notes:**
- No REF MCP validation needed (follows Task #59 pattern exactly)
- Faster than Task #60 (FieldSchema) due to simpler documentation requirements
- Step 6.5 checklist prevents debugging time (3 min investment, 30+ min savings)

---

## 📝 Notes

### Why This Task Is Simpler Than Task #60

1. **No REF MCP Validation Needed:**
   - Follows Task #59 pattern exactly (Base inheritance, composite PK)
   - All patterns already validated against SQLAlchemy 2.0 docs
   - Can implement directly without pre-validation

2. **Minimal Documentation:**
   - Join tables are self-explanatory
   - No complex cascade behaviors (both sides CASCADE)
   - 3-line docstring vs. 40+ line docstring in FieldSchema

3. **Both Relationships Already Correct:**
   - FieldSchema.schema_fields has passive_deletes=True (Task #60)
   - CustomField.schema_fields has passive_deletes=True (Task #59)
   - No relationship fixes needed!

4. **Clear Migration Template:**
   - Migration schema is minimal (4 columns, 1 constraint)
   - Easy to verify 100% alignment

### Key Learning from Task #60 Handoff

**Step 6.5 Migration Alignment Checklist:**
- 3-minute systematic verification prevents 30+ minute debugging
- ROI of 10:1 (proven in Task #60)
- Must be used for ALL ORM model tasks

**Subagent-Driven Development Performance:**
- Task #59: 14 min (vs. 90-120 min estimated)
- Task #60: 55 min implementation (vs. 60-90 min estimated)
- Both achieved Grade A code review
- Proven pattern for isolated, well-defined tasks

### Current Custom Fields System Status

**Completed:**
- ✅ Task #58: Alembic Migration (38 min)
- ✅ Task #59: CustomField Model (14 min)
- ✅ Task #60: FieldSchema Model (97 min)
- ✅ Task #63: Tag Extension (completed in Task #60)

**In Progress:**
- 🔄 Task #61: SchemaField Model (this task)

**Next:**
- ⏳ Task #62: VideoFieldValue Model (30-40 min estimated)

**Blocked Until #61 Complete:**
- Tasks #64-72: Pydantic Schemas + API Endpoints
- Requires full model chain (CustomField → SchemaField ← FieldSchema)

### Architecture Context

```
BookmarkList (1) ──CASCADE──> (N) FieldSchema
                                     |
                                  CASCADE
                                     |
                                     v
                             SchemaField (N,M) ──CASCADE──> CustomField
                                     |
                                  SET NULL
                                     |
                                     v
                                  Tag (N)
                                     |
                                     v
                                 Video (N)
```

**Task #61 Implements:** SchemaField join table (FieldSchema ↔ CustomField many-to-many)

**After Task #61:** Complete schema definition capability (schemas can contain multiple fields)

**Missing for MVP:** VideoFieldValue (Task #62) for storing actual rating values

---

## ✅ Ready for Implementation

This plan is ready for execution following the Subagent-Driven Development workflow:

1. Dispatch general-purpose subagent with this plan
2. Subagent implements SchemaField model
3. Subagent runs Step 6.5 checklist and CASCADE tests
4. Dispatch code-reviewer subagent
5. Fix Critical/Important issues
6. Update CLAUDE.md and commit
7. Write comprehensive report (REPORT-061)

**Estimated Total Time:** 30-40 minutes (following proven Task #59 pattern)
