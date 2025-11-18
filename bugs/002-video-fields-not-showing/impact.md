# Bug #002: Impact Analysis

## Phase 3: Impact Analysis

### The Real Problem (It's Worse Than We Thought!)

The `tag.schema = None` workaround is used in **THREE endpoints**:
1. `create_tag()` - line 162 ❌ **CAUSES THE BUG**
2. `list_tags()` - line 188 ⚠️ **SILENT FAILURE**
3. `get_tag()` - line 215 ⚠️ **SILENT FAILURE**

### Why It Causes Different Behavior

#### In `create_tag()` (THE BUG):
```python
new_tag = Tag(schema_id=uuid)  # ✅ FK set correctly
db.add(new_tag)
await db.commit()              # ✅ Saved to DB
await db.refresh(new_tag)      # ✅ Reloaded from DB
new_tag.schema = None          # ❌ TRIGGERS UPDATE!
return new_tag                 # ❌ Response sent, session flushes UPDATE
```

**Why it breaks**: The session is still **in write mode**. Setting `schema = None` marks the object as dirty, and SQLAlchemy automatically:
1. Syncs the FK: `schema_id = None` (relationship consistency)
2. Queues an UPDATE statement
3. Executes the UPDATE when the response is serialized

#### In `list_tags()` and `get_tag()` (SILENT FAILURES):
```python
tags = result.scalars().all()  # ✅ Tags loaded
tag.schema = None              # ⚠️ Looks harmless...
return tags                    # ⚠️ Works but...
```

**Why it seems to work**: These are READ operations, so the session doesn't flush UPDATEs. BUT there's a hidden problem:

### The Hidden Problem with TagResponse

**TagResponse schema** (line 27 in `tag.py`):
```python
class TagResponse(TagBase):
    schema_id: UUID | None = None
    schema: FieldSchemaResponse | None = None  # ← PROBLEM!

    model_config = ConfigDict(from_attributes=True)
```

**FieldSchemaResponse** (line 320 in `field_schema.py`):
```python
class FieldSchemaResponse:
    schema_fields: list[SchemaFieldResponse] = []  # ← NESTED!

    # Each SchemaFieldResponse contains:
    #   - Full CustomField object
    #   - Join table metadata
```

### The Lazy-Loading Trap

When Pydantic serializes a Tag:
1. It accesses `tag.schema` (the relationship)
2. If NOT loaded → SQLAlchemy tries lazy load
3. **Tag model has `lazy='raise'`** → MissingGreenlet error in async!
4. Setting `tag.schema = None` prevents the access

### Why This "Works" But Is Wrong

```python
tag.schema = None  # Prevents MissingGreenlet
return tag         # Pydantic sees schema=None, skips lazy load
```

**In list_tags/get_tag**: Works because session is read-only
**In create_tag**: BREAKS because session is write-enabled!

### The Root Cause of the Workaround

The original developer hit this error:
```
sqlalchemy.exc.MissingGreenletError: greenlet_spawn has not been called;
can't call await_only() here. Was IO attempted in an unexpected place?
```

This happens when:
- Pydantic tries to serialize `tag.schema`
- Schema relationship is NOT eager-loaded (`selectinload`)
- SQLAlchemy tries lazy-load in async context
- ❌ BOOM!

### Why Not Just Use `selectinload`?

**The problem with eager loading schema**:
```python
stmt = select(Tag).options(
    selectinload(Tag.schema).selectinload(FieldSchema.schema_fields)
)
```

This SHOULD work, but there's a **SQLAlchemy bug/quirk**:
- `FieldSchema.schema_fields` uses a **composite PK** in join table
- The `primaryjoin` is a string (line 97 in `field_schema.py`)
- **Nested selectinload doesn't work** with string primaryjoins!
- See comment in model: "Nested selectinload does NOT work with this"

### The Vicious Cycle

1. Can't eager-load schema → lazy load fails in async
2. Setting `schema = None` prevents lazy load → works!
3. But in `create_tag` → also clears the FK ❌
4. Developer didn't notice → bug shipped

### Affected Users

**Severity**: **CRITICAL** - Complete feature breakage

#### Data Corruption:
- ALL tags created since this code was deployed have `schema_id = NULL`
- Existing tags with schemas are UNAFFECTED (until edited)
- Database has correct data initially, then gets corrupted

#### User Impact:
- **100% of users** trying to use schemas with tags are affected
- **No workaround** - feature is completely broken
- Users may create tags+schemas but see NO fields

#### Reproduction Rate:
- **100%** - Every tag creation with schema fails
- **Immediate** - Happens on first API response

### Database State Check Needed

We need to check:
1. How many tags have `schema_id = NULL` that SHOULD have schemas
2. If we can recover the intended schema from creation logs
3. Whether any users have complained (if not, feature may be unused!)

### Next Steps
→ Phase 4: Pattern Recognition - Check if other endpoints have same issue
→ Phase 5: Fix Strategy - Find a proper solution (not just removing the line!)
