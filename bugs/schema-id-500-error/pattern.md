# Pattern Recognition: Nested Selectinload with String-Based Joins

## Bug ID
`schema-id-500-error`

## Date
2025-11-18

## Pattern Identified

**Root Pattern:** Nested `selectinload()` with string-based `primaryjoin` relationships fails in SQLAlchemy.

```python
# BROKEN PATTERN:
class Model:
    relationship_a = relationship(
        "OtherModel",
        primaryjoin="Model.id==OtherModel.foreign_id",  # String join!
        ...
    )

# Usage that fails:
selectinload(Parent.child).selectinload(Child.relationship_a)  # FAILS!
```

## Affected Locations

### 1. String-Based primaryjoin (1 location)
**File:** `/backend/app/models/field_schema.py:93`

```python
schema_fields = relationship(
    "SchemaField",
    primaryjoin="FieldSchema.id==SchemaField.schema_id",  # ← STRING!
    uselist=True,
    back_populates="schema",
    ...
)
```

**Why string join?**
Comment says: `# Explicit join for composite PK`

The `SchemaField` table has a composite primary key `(schema_id, field_id)`, and the comment suggests SQLAlchemy couldn't infer the join condition automatically.

**Impact:** ANY nested selectinload involving `schema_fields` will fail.

### 2. Nested Selectinload Usage (9 locations)

#### schemas.py (5 occurrences)
```python
# Lines: 102, 147, 269, 318, 344
select(FieldSchema).options(
    selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
)
```

**Status:** ✅ **Working** (first level is FieldSchema, not nested under Tag)

**Why it works:** Direct selectinload on FieldSchema, not nested through Tag.schema

#### tags.py (3 occurrences)
```python
# Lines: 159, 182, 287
select(Tag).options(
    selectinload(Tag.schema).selectinload(FieldSchema.schema_fields)
)
```

**Status:** ❌ **BROKEN** (nested selectinload through Tag.schema)

**Why it fails:** String-based join not resolved in nested selectinload context

**Endpoints affected:**
- Line 159: `GET /api/tags` (list all tags)
- Line 182: `GET /api/tags/{id}` (get single tag)
- Line 287: `PUT /api/tags/{id}` (update tag)

#### videos.py (1 occurrence)
```python
# Line 884
select(VideoFieldValue).options(
    selectinload(VideoFieldValue.field)
)
```

**Status:** ✅ **Not affected** (different relationship, no string join)

### 3. Working vs. Broken Patterns

#### ✅ Works: Direct Selectinload
```python
# FieldSchema is root entity
select(FieldSchema).options(
    selectinload(FieldSchema.schema_fields).selectinload(SchemaField.field)
)
```

**Why:** Even though `schema_fields` uses string join, SQLAlchemy can resolve it when FieldSchema is the root query entity.

#### ❌ Fails: Nested Selectinload Through Another Entity
```python
# Tag is root, FieldSchema is nested
select(Tag).options(
    selectinload(Tag.schema).selectinload(FieldSchema.schema_fields)
)
```

**Why:** String join resolution fails in nested context - SQLAlchemy can't find FieldSchema model when processing the second selectinload.

## Similar Bugs Likely Exist

### Potential Affected Endpoints

1. **GET /api/tags** (line 159)
   - Loads all tags with schemas
   - If any tag has schema_id → 500 error
   - **Impact**: Cannot list tags if ANY tag has schema

2. **GET /api/tags/{id}** (line 182)
   - Loads single tag with schema
   - If tag has schema_id → 500 error
   - **Impact**: Cannot view tag details

3. **PUT /api/tags/{id}** (line 287) ← **Currently being debugged**
   - Updates tag and re-loads with schema
   - If tag has schema_id → 500 error
   - **Impact**: Cannot update tags with schemas

### Testing Required
Need to test if:
1. GET /api/tags returns 500 with schema-linked tags
2. GET /api/tags/{id} returns 500 for tags with schemas
3. Other endpoints using Tag.schema relationship

## Root Cause of Pattern

**Why string-based join exists:**
Composite primary key in `SchemaField` table:
```sql
CREATE TABLE schema_fields (
    schema_id UUID NOT NULL,
    field_id UUID NOT NULL,
    display_order INTEGER,
    show_on_card BOOLEAN,
    PRIMARY KEY (schema_id, field_id)
);
```

SQLAlchemy's relationship inference struggles with composite PKs in join tables, requiring explicit `primaryjoin`.

## Why Pattern Wasn't Caught Earlier

1. **Schemas endpoint works** (direct selectinload)
2. **Tags without schemas work** (no schema relationship loaded)
3. **Only fails when tags HAVE schemas** (edge case)
4. **Silent failure** (500 error, no clear indication of cause)

## Prevention Strategy

See `prevention.md` for recommendations to prevent this pattern:
- Replace string-based joins with mapped column joins
- Add integration tests for nested eager loading
- Document SQLAlchemy relationship best practices
- Add CI check for string-based primaryjoin usage

## Related Patterns

### Other String-Based Joins?
```bash
$ grep -r "primaryjoin=" backend/app/models/
# Only one found: FieldSchema.schema_fields
```

**Good news:** This is the ONLY string-based join in the codebase.

**Action:** Fix this one location and the pattern disappears.

## Recommendation

**Fix the root:** Replace string-based `primaryjoin` with mapped column reference:

```python
# BEFORE (string):
primaryjoin="FieldSchema.id==SchemaField.schema_id"

# AFTER (mapped columns):
primaryjoin=lambda: FieldSchema.id == SchemaField.schema_id
```

Or use explicit foreign key:
```python
relationship("SchemaField", foreign_keys=[SchemaField.schema_id], ...)
```

This will fix ALL 3 affected endpoints at once.
