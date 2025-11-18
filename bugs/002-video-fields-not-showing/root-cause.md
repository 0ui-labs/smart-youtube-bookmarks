# Bug #002: Root Cause Analysis

## Phase 2: Root Cause Analysis

### Root Cause Identified
✅ **Bug located in**: `backend/app/api/tags.py:162`

### The Problem
After creating a tag with a `schema_id`, the code explicitly sets `new_tag.schema = None` to prevent lazy-loading issues:

```python
# Line 148-164 in tags.py
new_tag = Tag(
    name=tag.name,
    color=tag.color,
    schema_id=tag.schema_id,  # ✅ Correctly set
    user_id=current_user.id
)
db.add(new_tag)
await db.commit()
await db.refresh(new_tag)

# BUG WORKAROUND: Set schema to None to avoid lazy load issues
# Loading schema causes ResponseValidationError (schema.schema_fields lazy load issue)
# Frontend can fetch schema separately if needed via GET /api/schemas/{schema_id}
# Tag response includes schema_id, which is sufficient for most use cases
new_tag.schema = None  # ❌ THIS BREAKS schema_id!

return new_tag
```

### Why This Breaks
In SQLAlchemy, when you modify a relationship, the ORM automatically synchronizes the foreign key column to match:

1. **Tag created** with `schema_id = <valid-uuid>`
2. **Committed to DB** - Tag saved with correct schema_id
3. **Refreshed from DB** - Tag reloaded (still has correct schema_id)
4. **Relationship set to None**: `new_tag.schema = None`
5. **SQLAlchemy synchronizes FK**: Sets `new_tag.schema_id = None` to match the relationship
6. **On next flush/commit**: Database updated with `schema_id = NULL`

This is standard SQLAlchemy behavior - relationships and foreign keys are kept in sync automatically.

### Database Evidence
From the logs when creating "Juchtel Fuchtel" tag:

```sql
-- Step 1: INSERT with correct schema_id
INSERT INTO tags (name, color, user_id, schema_id, id)
VALUES ('Juchtel Fuchtel', '#f73bde', ..., UUID('71f69fa1-...'), ...)

-- Step 2: SELECT tag back (refresh)
SELECT * FROM tags WHERE tags.id = UUID('2dbf3904-...')

-- Step 3: SELECT all tags for this schema (relationship navigation)
SELECT * FROM tags WHERE UUID('71f69fa1-...') = tags.schema_id

-- Step 4: UPDATE sets schema_id to NULL (relationship sync!)
UPDATE tags SET schema_id=NULL, updated_at=now() WHERE tags.id = UUID('2dbf3904-...')
```

### Why The Original "Fix" Was Added
The comment says it's a "BUG WORKAROUND" for `ResponseValidationError` when loading the schema relationship. The schema relationship has nested `schema_fields`, which can cause lazy-loading issues in async contexts (M

issingGreenlet errors).

### The Actual Issue Chain
1. User creates tag with schema → schema_id saved
2. **Backend bug** clears schema_id → tag has no schema
3. Video gets tagged → video has tag with `schema_id = null`
4. Video detail view loads → `get_available_fields_for_video()` finds no schemas
5. **Result**: Empty `available_fields` and `field_values` arrays
6. **Frontend**: CustomFieldsSection renders "Keine benutzerdefinierten Felder verfügbar"

### Impact on Users
- **Severity**: HIGH - Core feature completely broken
- **Scope**: ALL tags created with schemas are affected
- **Data Loss**: schema_id is cleared on tag creation (permanent until manually fixed)
- **Workaround**: None - users cannot use custom fields via tags at all

### Related Code Sections
1. **Tag model** (`backend/app/models/tag.py:86-92`): Bidirectional relationship
   ```python
   schema: Mapped[Optional["FieldSchema"]] = relationship(
       "FieldSchema",
       back_populates="tags",
       lazy='raise'  # Prevents lazy loading
   )
   ```

2. **FieldSchema model** (`backend/app/models/field_schema.py:105-112`): Back-reference
   ```python
   tags: Mapped[list["Tag"]] = relationship(
       "Tag",
       back_populates="schema",
       # No passive_deletes - ORM tracks relationship changes
   )
   ```

3. **Tag creation endpoint** (`backend/app/api/tags.py:100-164`): Where the bug occurs

### Next Steps
→ Phase 3: Impact Analysis - Assess how many tags are affected
→ Phase 5: Fix Strategy - Remove the `new_tag.schema = None` line and handle serialization properly
