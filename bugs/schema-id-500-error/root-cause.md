# Root Cause Analysis: 500 Error When Updating Tag with schema_id

## Bug ID
`schema-id-500-error`

## Date
2025-11-18

## Investigation Method
Systematic debugging with instrumentation (logs written to /tmp/tag_debug.log)

## Findings

### Primary Issue 1: TagCreate Missing schema_id Field
**Location:** `/backend/app/schemas/tag.py:13-14`

**Problem:**
```python
class TagCreate(TagBase):
    pass  # Inherits only name and color from TagBase
```

The `TagCreate` schema does NOT include `schema_id`, while `TagUpdate` does (line 20). This means:
- Frontend sends `schema_id` during tag creation
- Backend ignores it (Pydantic drops unknown fields)
- Tag is always created with `schema_id=null`

**Evidence:**
```bash
curl -X POST http://localhost:8000/api/tags \
  -d '{"name": "Test", "schema_id": "71f69fa1-..."}}'
# Returns: {"schema_id": null, ...} - schema_id ignored!
```

### Primary Issue 2: Nested selectinload with String-Based Join
**Location:** `/backend/app/api/tags.py:283`

**Problem:**
```python
selectinload(Tag.schema).selectinload(FieldSchema.schema_fields)
```

This chained selectinload fails because `FieldSchema.schema_fields` uses a string-based `primaryjoin`:

```python
# /backend/app/models/field_schema.py:93
schema_fields = relationship(
    "SchemaField",
    primaryjoin="FieldSchema.id==SchemaField.schema_id",  # STRING!
    ...
)
```

**Why it fails:**
1. SQLAlchemy resolves string joins at runtime
2. Nested selectinload context prevents proper resolution
3. Pydantic tries to serialize Tag → schema → schema_fields
4. Lazy loading attempted on detached ORM object → AttributeError/DetachedInstanceError
5. FastAPI catches exception → returns 500 Internal Server Error

**Evidence from instrumentation:**
```
=== DEBUG: Re-querying tag 01275161... with schema eager loading ===
=== DEBUG: Successfully loaded tag with schema ===
Tag.schema: <FieldSchema(id=71f69fa1-..., name='Tutorial Difficulty')>
=== DEBUG: Returning tag ===
[Then 500 error during Pydantic serialization]
```

The tag loads successfully, but serialization fails when Pydantic tries to access `schema.schema_fields`.

## Root Cause Chain

```
User creates tag with schema
    ↓
Frontend sends {name, color, schema_id}
    ↓
Backend TagCreate schema IGNORES schema_id
    ↓
Tag created with schema_id=null
    ↓
User manually updates tag via PUT /tags/{id}
    ↓
Backend accepts schema_id (TagUpdate has field)
    ↓
Tag.schema_id set successfully in DB
    ↓
Re-query with nested selectinload fails
    ↓
String-based primaryjoin not resolved in nested context
    ↓
schema_fields relationship not eager-loaded
    ↓
Pydantic serialization triggers lazy load
    ↓
Lazy load on detached object → AttributeError
    ↓
FastAPI returns 500 Internal Server Error
```

## Technical Details

### SQLAlchemy Selectinload Chain Issue
When using:
```python
selectinload(A.b).selectinload(B.c)
```

SQLAlchemy must:
1. Load A objects
2. Extract B foreign keys
3. Query B table with IN clause
4. Load B objects
5. Extract C foreign keys from B
6. Query C table with IN clause

**Problem with string joins:**
Step 5 fails because `FieldSchema.schema_fields` uses:
```python
primaryjoin="FieldSchema.id==SchemaField.schema_id"
```

SQLAlchemy cannot resolve this string in the nested selectinload context, causing the relationship to remain unloaded.

### Why Videos Endpoint Fails
**Location:** `/backend/app/api/videos.py:498-499`

When loading videos with tags:
```python
tags_stmt = (
    select(Tag)
    .options(selectinload(Tag.schema))  # Only loads schema, NOT schema_fields!
    .where(Tag.id.in_(tag_ids))
)
```

If a tag has a schema with `schema_id` set, the schema loads, but NOT its `schema_fields`. When Pydantic tries to serialize the response, it attempts to access `schema.schema_fields` → lazy load → DetachedInstanceError → 500 error.

## Affected Code Paths

1. **POST /api/tags** - Cannot create tags with schemas (schema_id ignored)
2. **PUT /api/tags/{id}** - 500 error when updating with schema_id
3. **GET /api/lists/{id}/videos** - 500 error if videos have tags with schemas
4. **Frontend VideosPage** - Cannot load video list when schema-tagged videos exist

## Verification

To verify this is the root cause:
1. Create tag without schema → Works
2. Update tag to add schema_id → 500 error
3. Check DB: schema_id IS set in database
4. Error occurs during response serialization, not DB update

## Next Steps

See `fix-strategy.md` for solution approach.
