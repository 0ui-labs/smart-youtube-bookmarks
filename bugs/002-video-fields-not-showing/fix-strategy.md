# Bug #002: Fix Strategy

## Phase 5: Fix Strategy - Minimal Changes Approach

### Problem Summary
`tag.schema = None` clears `schema_id` FK in `create_tag` because session is still in write mode.
Simply removing the line would cause `MissingGreenletError` when Pydantic tries to serialize.

### Solution Options (Ranked by Quality)

---

## ✅ **Option 1: Detach Object from Session (RECOMMENDED)**

**Strategy**: Expunge the tag from session BEFORE setting schema = None

```python
# In create_tag() - after line 156
await db.commit()
await db.refresh(new_tag)

# NEW: Detach from session to prevent FK sync
db.expunge(new_tag)  # ← Tag no longer tracked

# Now safe - won't trigger UPDATE
new_tag.schema = None

return new_tag
```

**Pros**:
- ✅ Minimal code change (1 line)
- ✅ Prevents FK sync (object not tracked)
- ✅ No MissingGreenlet error (schema = None prevents lazy load)
- ✅ Same pattern can fix list_tags/get_tag if needed

**Cons**:
- ⚠️ Slightly less clean than building explicit response
- ⚠️ Still relies on workaround instead of proper eager loading

**Risk**: **LOW** - Well-understood SQLAlchemy pattern

---

## ✅ **Option 2: Build Explicit Response Dict**

**Strategy**: Don't return ORM object - build dict manually

```python
# In create_tag() - replace lines 158-164
await db.commit()
await db.refresh(new_tag)

# Build explicit response (no lazy loading triggered)
return {
    "id": new_tag.id,
    "name": new_tag.name,
    "color": new_tag.color,
    "user_id": new_tag.user_id,
    "schema_id": new_tag.schema_id,  # ← Keep the FK!
    "schema": None,  # ← Always None (never load)
    "created_at": new_tag.created_at,
    "updated_at": new_tag.updated_at
}
```

**Pros**:
- ✅ Most explicit - no magic behavior
- ✅ Prevents FK sync (dict has no relationship)
- ✅ No MissingGreenlet error (no relationship to access)
- ✅ Easy to understand for future developers

**Cons**:
- ⚠️ More verbose (8 lines vs 1 line)
- ⚠️ Needs updates if TagResponse schema changes

**Risk**: **VERY LOW** - Simple, explicit, no ORM magic

---

## ⚠️ **Option 3: Update TagResponse to Exclude Schema**

**Strategy**: Tell Pydantic to never serialize `schema` field

```python
# In app/schemas/tag.py - modify TagResponse
class TagResponse(TagBase):
    id: UUID
    user_id: UUID
    schema_id: UUID | None = None
    # REMOVE: schema: FieldSchemaResponse | None = None

    model_config = ConfigDict(
        from_attributes=True,
        # No need to exclude - just don't define the field
    )
```

```python
# In create_tag() - REMOVE lines 158-162
await db.commit()
await db.refresh(new_tag)
# REMOVED: new_tag.schema = None
return new_tag  # Works - Pydantic won't access tag.schema
```

**Pros**:
- ✅ Cleanest solution - fixes root cause
- ✅ No workarounds needed
- ✅ Consistent across all endpoints

**Cons**:
- ❌ **BREAKING CHANGE** - Frontend may expect `schema` field
- ❌ Requires frontend code review
- ❌ May break existing tests

**Risk**: **MEDIUM** - Requires frontend changes

---

## ❌ **Option 4: Use Eager Loading (DOESN'T WORK)**

**Strategy**: Load schema relationship properly

```python
stmt = select(Tag).options(
    selectinload(Tag.schema).selectinload(FieldSchema.schema_fields)
)
```

**Why This FAILS**:
- ❌ FieldSchema.schema_fields uses **string primaryjoin**
- ❌ Nested selectinload **doesn't work** with string joins
- ❌ See comment in field_schema.py line 94-96
- ❌ Would need to refactor FieldSchema model (high risk)

**Risk**: **HIGH** - Complex model changes

---

## 📋 **Recommended Implementation Plan**

### **Use Option 1** (Expunge from Session)

**Why**:
- Minimal risk
- One-line change
- Can be applied immediately
- Same fix works for list_tags/get_tag if needed
- No frontend changes required

### **Implementation Steps**:

1. **Fix create_tag()**:
   ```python
   # Line 156-164 in tags.py
   await db.commit()
   await db.refresh(new_tag)

   db.expunge(new_tag)  # ← ADD THIS LINE
   new_tag.schema = None

   return new_tag
   ```

2. **Optional: Fix list_tags() and get_tag()** (defensive):
   - Same pattern - expunge before setting schema = None
   - Not strictly necessary (read-only sessions don't flush)
   - But makes code more defensive

3. **Add explanatory comment**:
   ```python
   # Expunge from session to prevent FK sync when setting schema = None
   # Setting relationship to None would normally clear schema_id FK,
   # but only if object is still tracked by session
   db.expunge(new_tag)
   ```

### **Why Not Option 2 or 3?**

- **Option 2** (Explicit dict): More verbose, no real benefit over Option 1
- **Option 3** (Remove schema field): Breaking change, requires frontend work
- **Option 1**: Best balance of safety, simplicity, and minimal changes

---

## ⚠️ **Important: Data Recovery Needed**

After fixing the code, we need to:

1. **Check database** for corrupted tags:
   ```sql
   SELECT id, name FROM tags WHERE schema_id IS NULL;
   ```

2. **Review creation logs** to find intended schema_id

3. **Manual fix** for affected tags (if any users depend on them)

---

## 🧪 **Testing Plan** (Phase 6)

1. Write regression test that:
   - Creates tag with schema_id
   - Verifies schema_id is NOT NULL after creation
   - Verifies response includes correct schema_id

2. Test scenarios:
   - Create tag WITHOUT schema (schema_id = None) → should work
   - Create tag WITH schema → schema_id must be preserved
   - List tags → should not corrupt schema_id
   - Update tag → should not corrupt schema_id (separate endpoint)

---

## 📊 **Validation Criteria** (Phase 8)

Fix is successful when:
- ✅ Tag created with schema_id → schema_id NOT NULL in DB
- ✅ Tag created with schema_id → response includes schema_id
- ✅ Video with tag shows custom fields in detail view
- ✅ No MissingGreenlet errors
- ✅ Existing tests still pass

---

## 🛡️ **Prevention Strategy** (Phase 9)

1. **Add DB constraint check test** - Fail if schema_id unexpectedly NULL
2. **Add integration test** - Full flow: create tag+schema → assign to video → view fields
3. **Code review guideline** - Never set relationships to None on tracked objects
4. **Consider**: Add SQLAlchemy event listener to warn on unexpected FK changes

