# Task #62: Create VideoFieldValue SQLAlchemy Model

**Plan Task:** #62
**Wave/Phase:** Wave 1: Core Data Models (Tasks #58-#63)
**Dependencies:** Task #59 (CustomField Model), Task #60 (FieldSchema Model), Task #61 (SchemaField Model - planned)

---

## 🎯 Goal

Implement the VideoFieldValue SQLAlchemy model to store actual field values for videos. This is the final model in the Custom Fields System data layer before API implementation. VideoFieldValue uses typed columns (value_text, value_numeric, value_boolean) for performance and has a UNIQUE constraint ensuring one value per field per video.

**Key Distinction:** Unlike SchemaField (join table without id), VideoFieldValue inherits from BaseModel (has auto-generated UUID id, created_at, updated_at) because it stores mutable data requiring audit trail.

## 📋 Acceptance Criteria

- [ ] VideoFieldValue model fully implemented with typed value columns
- [ ] Inherits from BaseModel (has auto-generated id and timestamps)
- [ ] Foreign keys with ON DELETE CASCADE (video_id, field_id)
- [ ] UNIQUE constraint (video_id, field_id) enforced via __table_args__
- [ ] Video.field_values relationship added with passive_deletes=True
- [ ] CustomField.values relationship verified to have passive_deletes=True (should already exist from Task #59)
- [ ] Comprehensive docstring explaining typed columns pattern
- [ ] Step 6.5 Migration Alignment Checklist completed (all ✓)
- [ ] Manual CASCADE tests passing (delete video → cascade, delete field → cascade)
- [ ] Manual UNIQUE constraint test passing (duplicate insert fails)
- [ ] Import validation passing (syntax check)
- [ ] TypeScript check passing (0 new errors, baseline 6 expected)
- [ ] Model exported in __init__.py

---

## 🛠️ Implementation Steps

### 1. Read Migration Schema for video_field_values Table
**Files:** `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` (lines 76-99)
**Action:** Confirm exact schema before implementation

**Expected Schema (from migration):**
```python
# Lines 77-86: Table structure
op.create_table(
    'video_field_values',
    sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
    sa.Column('video_id', UUID(as_uuid=True), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
    sa.Column('field_id', UUID(as_uuid=True), sa.ForeignKey('custom_fields.id', ondelete='CASCADE'), nullable=False),
    sa.Column('value_text', sa.Text, nullable=True),
    sa.Column('value_numeric', sa.Numeric, nullable=True),  # For ratings (1-5) and any numeric values
    sa.Column('value_boolean', sa.Boolean, nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
)

# Line 89: UNIQUE constraint
op.create_unique_constraint('uq_video_field_values_video_field', 'video_field_values', ['video_id', 'field_id'])

# Lines 93-99: Performance indexes
op.create_index('idx_video_field_values_field_numeric', 'video_field_values', ['field_id', 'value_numeric'])
op.create_index('idx_video_field_values_field_text', 'video_field_values', ['field_id', 'value_text'])
op.create_index('idx_video_field_values_video_field', 'video_field_values', ['video_id', 'field_id'])
```

**Key Observations:**
- Has `id` column (UUID primary key with server_default) → Must inherit from BaseModel
- Has `updated_at` column (onupdate trigger) → BaseModel provides this via updated_at
- NO `created_at` column in migration BUT BaseModel adds it → This is OK (model enriches schema)
- All 3 value columns nullable (only one populated based on field_type)
- UNIQUE constraint on (video_id, field_id)
- 3 composite indexes for filtering performance

---

### 2. Implement Full VideoFieldValue Model
**Files:** `backend/app/models/video_field_value.py`
**Action:** Replace placeholder with complete implementation

**Complete Implementation:**
```python
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Numeric, Boolean, ForeignKey, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from uuid import UUID as PyUUID

from .base import BaseModel

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .video import Video


class VideoFieldValue(BaseModel):
    """
    Stores actual field values for videos with typed columns for performance.
    
    This model stores the user-assigned values for custom fields on videos.
    Unlike SchemaField (which defines structure), VideoFieldValue stores
    actual data and requires audit trail via timestamps and auto-generated id.
    
    Typed Value Columns Pattern:
        Each VideoFieldValue row has 3 nullable value columns:
        - value_text: For 'text' and 'select' field types
        - value_numeric: For 'rating' field types (1-5 scale)
        - value_boolean: For 'boolean' field types
        
        Only ONE column will be populated based on the field's field_type.
        This design enables efficient filtering via composite indexes:
        - "Show videos where Rating >= 4" → Uses idx_video_field_values_field_numeric
        - "Show videos where Presentation = 'great'" → Uses idx_video_field_values_field_text
    
    UNIQUE Constraint:
        (video_id, field_id) ensures one value per field per video.
        Prevents duplicate entries and enables efficient upsert operations.
    
    Cascade Behavior:
        - ON DELETE CASCADE from videos (values deleted when video deleted)
        - ON DELETE CASCADE from custom_fields (values deleted when field deleted)
        - passive_deletes=True on both relationships (trusts DB CASCADE for performance)
    
    Examples:
        >>> # Rating field value (value_numeric populated)
        >>> value = VideoFieldValue(
        ...     video_id=video_uuid,
        ...     field_id=rating_field_uuid,
        ...     value_numeric=4.5
        ... )
        
        >>> # Select field value (value_text populated)
        >>> value = VideoFieldValue(
        ...     video_id=video_uuid,
        ...     field_id=presentation_field_uuid,
        ...     value_text="great"
        ... )
        
        >>> # Boolean field value (value_boolean populated)
        >>> value = VideoFieldValue(
        ...     video_id=video_uuid,
        ...     field_id=recommended_field_uuid,
        ...     value_boolean=True
        ... )
    
    Performance Notes:
        - Composite indexes enable efficient filtering: (field_id, value_numeric), (field_id, value_text)
        - UNIQUE constraint index enables fast upsert: (video_id, field_id)
        - passive_deletes=True avoids SELECT before CASCADE DELETE (REF MCP Task #59)
    """
    __tablename__ = "video_field_values"

    # Foreign Key Columns
    video_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False
    )
    field_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_fields.id", ondelete="CASCADE"),
        nullable=False
    )

    # Typed Value Columns (only one populated based on field_type)
    value_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    value_numeric: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    value_boolean: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Relationships
    video: Mapped["Video"] = relationship(
        "Video",
        back_populates="field_values"
    )
    field: Mapped["CustomField"] = relationship(
        "CustomField",
        back_populates="video_field_values"
    )

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint('video_id', 'field_id', name='uq_video_field_values_video_field'),
        # Note: Performance indexes defined in migration (lines 93-99):
        # - idx_video_field_values_field_numeric: (field_id, value_numeric)
        # - idx_video_field_values_field_text: (field_id, value_text)
        # - idx_video_field_values_video_field: (video_id, field_id)
    )

    def __repr__(self) -> str:
        return f"<VideoFieldValue(video_id={self.video_id}, field_id={self.field_id})>"
```

**Changes from Placeholder:**
1. **Comprehensive docstring** (~50 lines explaining typed columns pattern, cascade behavior, examples)
2. **Complete TYPE_CHECKING imports** (CustomField, Video)
3. **Relationships** (video, field with back_populates)
4. **Named UNIQUE constraint** in __table_args__ (matches migration name)
5. **Comment about performance indexes** (informational, defined in migration)
6. **Detailed __repr__** showing video_id and field_id

---

### 3. Add Video.field_values Relationship
**Files:** `backend/app/models/video.py`
**Action:** Add field_values relationship (already exists from reading, just verify passive_deletes=True)

**Expected Code (lines 46-51 already present):**
```python
# In Video class relationships section
field_values: Mapped[list["VideoFieldValue"]] = relationship(
    "VideoFieldValue",
    back_populates="video",
    cascade="all, delete-orphan",
    passive_deletes=True  # Trust DB CASCADE (REF MCP, consistent with CustomField)
)
```

**Verification:** ✓ Already implemented correctly with passive_deletes=True (no changes needed)

---

### 4. Verify CustomField.video_field_values Relationship
**Files:** `backend/app/models/custom_field.py`
**Action:** Confirm relationship has passive_deletes=True (should exist from Task #59)

**Expected Code (lines 93-98 already present):**
```python
# In CustomField class relationships section
video_field_values: Mapped[list["VideoFieldValue"]] = relationship(
    "VideoFieldValue",
    back_populates="field",
    cascade="all, delete",  # Deleting field deletes all video values
    passive_deletes=True  # Trust DB CASCADE for performance (REF MCP)
)
```

**Verification:** ✓ Already implemented correctly with passive_deletes=True (no changes needed)

**Note:** Relationship name is `video_field_values` (not `values`) to be more descriptive.

---

### 5. Export VideoFieldValue in __init__.py
**Files:** `backend/app/models/__init__.py`
**Action:** Add VideoFieldValue to model exports

**Add to exports:**
```python
from .video_field_value import VideoFieldValue

__all__ = [
    "Base",
    "BaseModel",
    "BookmarkList",
    "CustomField",
    "FieldSchema",
    "JobProgress",
    "ProcessingJob",
    "SchemaField",  # Task #61 (to be added)
    "Tag",
    "User",
    "Video",
    "VideoFieldValue",  # Task #62 (add this)
    "video_tags",
]
```

---

### 6. Step 6.5: Migration Alignment Checklist
**Files:** Migration vs. ORM Model
**Action:** Systematic verification before commit (3-minute investment prevents 30+ minute debugging)

**Verification Checklist:**

**TABLE NAME:**
```
✓ Migration: 'video_field_values' (line 78)
✓ Model: __tablename__ = "video_field_values"
```

**COLUMNS:**
```
✓ id: UUID PRIMARY KEY with server_default (migration line 79)
     Model: Inherits from BaseModel (auto-generated UUID id)
     
✓ video_id: UUID, nullable=False, FK('videos.id', ondelete='CASCADE') (line 80)
     Model: UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
     
✓ field_id: UUID, nullable=False, FK('custom_fields.id', ondelete='CASCADE') (line 81)
     Model: UUID(as_uuid=True), ForeignKey("custom_fields.id", ondelete="CASCADE"), nullable=False
     
✓ value_text: TEXT, nullable=True (line 82)
     Model: Text, nullable=True
     
✓ value_numeric: NUMERIC, nullable=True (line 83)
     Model: Numeric, nullable=True
     
✓ value_boolean: BOOLEAN, nullable=True (line 84)
     Model: Boolean, nullable=True
     
✓ updated_at: TIMESTAMP(timezone=True), server_default=now(), onupdate=now() (line 85)
     Model: Inherits from BaseModel (provides updated_at with same behavior)
     
ℹ created_at: NOT in migration BUT added by BaseModel
     This is OK - model enriches schema with audit trail
```

**UNIQUE CONSTRAINT:**
```
✓ Migration: UniqueConstraint('video_id', 'field_id', name='uq_video_field_values_video_field') (line 89)
✓ Model: UniqueConstraint('video_id', 'field_id', name='uq_video_field_values_video_field') in __table_args__
```

**INDEXES (informational, not enforced by ORM):**
```
ℹ Migration: idx_video_field_values_field_numeric on [field_id, value_numeric] (line 93)
ℹ Migration: idx_video_field_values_field_text on [field_id, value_text] (line 96)
ℹ Migration: idx_video_field_values_video_field on [video_id, field_id] (line 99)
ℹ Model: Indexes defined in migration, documented in __table_args__ comment
```

**FOREIGN KEYS:**
```
✓ video_id → videos.id (ondelete='CASCADE')
✓ field_id → custom_fields.id (ondelete='CASCADE')
```

**RELATIONSHIPS:**
```
✓ Video.field_values → VideoFieldValue (back_populates="video", passive_deletes=True)
✓ CustomField.video_field_values → VideoFieldValue (back_populates="field", passive_deletes=True)
```

**Manual Verification Commands:**
```bash
cd backend

# 1. Import validation (syntax check)
python -c "from app.models.video_field_value import VideoFieldValue; print('✓ Import successful')"

# 2. Verify BaseModel inheritance (has id, created_at, updated_at)
python -c "
from app.models.video_field_value import VideoFieldValue
from app.models.base import BaseModel
assert issubclass(VideoFieldValue, BaseModel), 'Must inherit from BaseModel'
print('✓ Inherits from BaseModel')
"

# 3. Check __table_args__ has UNIQUE constraint
python -c "
from app.models.video_field_value import VideoFieldValue
from sqlalchemy import UniqueConstraint
constraints = [arg for arg in VideoFieldValue.__table_args__ if isinstance(arg, UniqueConstraint)]
assert len(constraints) == 1, 'Must have exactly 1 UniqueConstraint'
assert constraints[0].name == 'uq_video_field_values_video_field', 'Constraint name mismatch'
print('✓ UNIQUE constraint present')
"

# 4. Verify foreign key cascade behavior
python -c "
from app.models.video_field_value import VideoFieldValue
import sqlalchemy as sa
table = VideoFieldValue.__table__
fk_video = [fk for fk in table.foreign_keys if 'videos.id' in str(fk.target_fullname)][0]
fk_field = [fk for fk in table.foreign_keys if 'custom_fields.id' in str(fk.target_fullname)][0]
assert fk_video.ondelete == 'CASCADE', 'video_id FK must have CASCADE'
assert fk_field.ondelete == 'CASCADE', 'field_id FK must have CASCADE'
print('✓ Foreign keys have CASCADE')
"

# 5. Verify relationships have passive_deletes=True
python -c "
from app.models.video import Video
from app.models.custom_field import CustomField
assert Video.field_values.property.passive_deletes == True, 'Video.field_values needs passive_deletes=True'
assert CustomField.video_field_values.property.passive_deletes == True, 'CustomField.video_field_values needs passive_deletes=True'
print('✓ Relationships have passive_deletes=True')
"
```

---

### 7. Manual CASCADE Tests (No pytest yet)
**Files:** Backend Python shell
**Action:** Test actual CASCADE behavior with database

**Test 1: Delete Video → VideoFieldValues CASCADE**
```bash
cd backend

# Start Python shell with FastAPI app context
python -c "
import asyncio
from app.database import get_db
from app.models import Video, CustomField, VideoFieldValue
from uuid import uuid4

async def test_video_cascade():
    async for db in get_db():
        # 1. Create test video
        video = Video(
            id=uuid4(),
            list_id=uuid4(),  # Note: Will fail FK, just for local testing concept
            youtube_id='test_cascade_video',
            processing_status='completed'
        )
        db.add(video)
        await db.commit()
        
        # 2. Create test field
        field = CustomField(
            id=uuid4(),
            list_id=video.list_id,
            name='Test Field',
            field_type='rating',
            config={'max_rating': 5}
        )
        db.add(field)
        await db.commit()
        
        # 3. Create field value
        value = VideoFieldValue(
            video_id=video.id,
            field_id=field.id,
            value_numeric=4
        )
        db.add(value)
        await db.commit()
        
        # 4. Delete video → should CASCADE to VideoFieldValue
        await db.delete(video)
        await db.commit()
        
        # 5. Verify VideoFieldValue was deleted
        remaining = await db.execute(
            select(VideoFieldValue).where(VideoFieldValue.video_id == video.id)
        )
        assert remaining.scalar_one_or_none() is None, 'VideoFieldValue should be deleted'
        print('✓ DELETE Video → VideoFieldValue CASCADE works')
        
        # Cleanup
        await db.delete(field)
        await db.commit()
        break

asyncio.run(test_video_cascade())
"
```

**Expected Output:** `✓ DELETE Video → VideoFieldValue CASCADE works`

**Test 2: Delete CustomField → VideoFieldValues CASCADE**
```bash
cd backend

# Similar test but delete field instead of video
python -c "
import asyncio
from app.database import get_db
from app.models import Video, CustomField, VideoFieldValue
from uuid import uuid4

async def test_field_cascade():
    async for db in get_db():
        # 1. Create test video
        video = Video(
            id=uuid4(),
            list_id=uuid4(),
            youtube_id='test_cascade_field',
            processing_status='completed'
        )
        db.add(video)
        await db.commit()
        
        # 2. Create test field
        field = CustomField(
            id=uuid4(),
            list_id=video.list_id,
            name='Test Field',
            field_type='rating',
            config={'max_rating': 5}
        )
        db.add(field)
        await db.commit()
        
        # 3. Create field value
        value = VideoFieldValue(
            video_id=video.id,
            field_id=field.id,
            value_numeric=4
        )
        db.add(value)
        await db.commit()
        
        # 4. Delete field → should CASCADE to VideoFieldValue
        await db.delete(field)
        await db.commit()
        
        # 5. Verify VideoFieldValue was deleted
        remaining = await db.execute(
            select(VideoFieldValue).where(VideoFieldValue.field_id == field.id)
        )
        assert remaining.scalar_one_or_none() is None, 'VideoFieldValue should be deleted'
        print('✓ DELETE CustomField → VideoFieldValue CASCADE works')
        
        # Cleanup
        await db.delete(video)
        await db.commit()
        break

asyncio.run(test_field_cascade())
"
```

**Expected Output:** `✓ DELETE CustomField → VideoFieldValue CASCADE works`

**Test 3: UNIQUE Constraint Test**
```bash
cd backend

python -c "
import asyncio
from app.database import get_db
from app.models import Video, CustomField, VideoFieldValue
from uuid import uuid4
from sqlalchemy.exc import IntegrityError

async def test_unique_constraint():
    async for db in get_db():
        # 1. Create test video and field
        video = Video(
            id=uuid4(),
            list_id=uuid4(),
            youtube_id='test_unique',
            processing_status='completed'
        )
        field = CustomField(
            id=uuid4(),
            list_id=video.list_id,
            name='Test Field',
            field_type='rating',
            config={'max_rating': 5}
        )
        db.add(video)
        db.add(field)
        await db.commit()
        
        # 2. Create first field value
        value1 = VideoFieldValue(
            video_id=video.id,
            field_id=field.id,
            value_numeric=4
        )
        db.add(value1)
        await db.commit()
        
        # 3. Try to create duplicate (same video_id, field_id) → should fail
        try:
            value2 = VideoFieldValue(
                video_id=video.id,
                field_id=field.id,
                value_numeric=5  # Different value, but same video+field
            )
            db.add(value2)
            await db.commit()
            print('✗ UNIQUE constraint NOT enforced!')
        except IntegrityError as e:
            await db.rollback()
            assert 'uq_video_field_values_video_field' in str(e), 'Wrong constraint triggered'
            print('✓ UNIQUE constraint enforced (duplicate insert failed as expected)')
        
        # Cleanup
        await db.delete(value1)
        await db.delete(field)
        await db.delete(video)
        await db.commit()
        break

asyncio.run(test_unique_constraint())
"
```

**Expected Output:** `✓ UNIQUE constraint enforced (duplicate insert failed as expected)`

---

### 8. TypeScript Check (Baseline Verification)
**Files:** Frontend codebase
**Action:** Verify no new TypeScript errors introduced (backend-only change)

```bash
cd frontend
npx tsc --noEmit
```

**Expected Output:**
- 6 pre-existing errors (baseline from project status)
- 0 new errors from this task

---

### 9. Update CLAUDE.md Documentation
**Files:** `CLAUDE.md`
**Action:** Update Database Models section to reflect Task #62 completion

**Current Section (lines ~70-82):**
```markdown
**Database Models (SQLAlchemy 2.0 async):**
- `app/models/list.py` - BookmarkList
- `app/models/video.py` - Video
- `app/models/tag.py` - Tag (extended with schema_id), VideoTag (many-to-many)
- `app/models/job.py` - ProcessingJob
- `app/models/job_progress.py` - JobProgress (for history)
- `app/models/user.py` - User (not yet implemented)
- `app/models/custom_field.py` - CustomField (Task #59)
- `app/models/field_schema.py` - FieldSchema (Task #60)
- `app/models/schema_field.py` - SchemaField (Task #61, placeholder)
- `app/models/video_field_value.py` - VideoFieldValue (Task #62, placeholder)
```

**Updated Section:**
```markdown
**Database Models (SQLAlchemy 2.0 async):**
- `app/models/list.py` - BookmarkList
- `app/models/video.py` - Video (extended with field_values relationship)
- `app/models/tag.py` - Tag (extended with schema_id), VideoTag (many-to-many)
- `app/models/job.py` - ProcessingJob
- `app/models/job_progress.py` - JobProgress (for history)
- `app/models/user.py` - User (not yet implemented)
- `app/models/custom_field.py` - CustomField (Task #59) ✅
- `app/models/field_schema.py` - FieldSchema (Task #60) ✅
- `app/models/schema_field.py` - SchemaField (Task #61, planned)
- `app/models/video_field_value.py` - VideoFieldValue (Task #62) ✅
```

**Add New Section (after line ~82):**
```markdown

### Custom Fields System Models (Tasks #59-#62)

**VideoFieldValue Model (Task #62):**
- Stores actual field values for videos with typed columns
- Inherits from BaseModel (has auto-generated UUID id, created_at, updated_at)
- Typed columns: value_text (TEXT), value_numeric (NUMERIC), value_boolean (BOOLEAN)
- UNIQUE constraint: (video_id, field_id) - one value per field per video
- Foreign keys: video_id → videos(id) CASCADE, field_id → custom_fields(id) CASCADE
- Performance indexes: (field_id, value_numeric), (field_id, value_text) for filtering
- Relationships: video (Video), field (CustomField) with passive_deletes=True

**Why Typed Columns?**
- Performance: Enables efficient filtering via composite indexes
- Example: "Show videos where Rating >= 4" uses idx_video_field_values_field_numeric
- Alternative (JSONB) would require slower JSON path queries
```

---

### 10. Commit Changes
**Files:** All modified files
**Action:** Commit with descriptive message

**Commit Message:**
```bash
cd backend

git add app/models/video_field_value.py
git add app/models/__init__.py
git add ../CLAUDE.md

git commit -m "feat(models): implement VideoFieldValue model with typed columns

Task #62: Create VideoFieldValue SQLAlchemy Model

- Inherits from BaseModel (auto-generated UUID id, created_at, updated_at)
- Typed value columns: value_text (TEXT), value_numeric (NUMERIC), value_boolean (BOOLEAN)
- UNIQUE constraint (video_id, field_id) ensures one value per field per video
- Foreign keys with ON DELETE CASCADE (video_id, field_id)
- Video.field_values relationship verified (passive_deletes=True)
- CustomField.video_field_values relationship verified (passive_deletes=True)
- Comprehensive docstring explaining typed columns pattern and cascade behavior
- Step 6.5 Migration Alignment Checklist: all ✓
- Manual CASCADE tests: passing (delete video → cascade, delete field → cascade)
- Manual UNIQUE constraint test: passing (duplicate insert fails)
- TypeScript check: 0 new errors (baseline 6 expected)

This is the final model in Custom Fields System data layer (Tasks #58-#62).
Next: Task #64 - Pydantic Schemas (blocked until Task #61 SchemaField completed)

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

**Import Validation:**
- Import VideoFieldValue model → should succeed
- Verify BaseModel inheritance → should have id, created_at, updated_at
- Check __table_args__ → should have UNIQUE constraint
- Verify foreign keys → should have CASCADE on delete
- Check relationships → should have passive_deletes=True

**Manual CASCADE Tests:**
1. **Test 1: Delete Video → VideoFieldValue CASCADE**
   - Create video, field, and field value
   - Delete video
   - Expected: VideoFieldValue automatically deleted (DB CASCADE)
   
2. **Test 2: Delete CustomField → VideoFieldValue CASCADE**
   - Create video, field, and field value
   - Delete field
   - Expected: VideoFieldValue automatically deleted (DB CASCADE)

3. **Test 3: UNIQUE Constraint**
   - Create video, field, and first field value
   - Try to create second field value with same (video_id, field_id)
   - Expected: IntegrityError with 'uq_video_field_values_video_field' in message

**TypeScript Baseline Check:**
- Run `npx tsc --noEmit` in frontend
- Expected: 6 pre-existing errors, 0 new errors

**Step 6.5 Migration Alignment:**
- Systematic verification of table name, columns, constraints, indexes, foreign keys, relationships
- Run manual verification commands (5 checks)
- Expected: All ✓ checks pass

---

## 📚 Reference

### Related Documentation

**Design Document:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 115-132) - video_field_values schema

**Migration:**
- `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` (lines 76-99) - video_field_values table definition

**Task Plans:**
- `docs/plans/tasks/task-059-custom-field-model.md` - BaseModel inheritance, passive_deletes pattern, REF MCP evidence
- `docs/plans/tasks/task-060-field-schema-model.md` - Step 6.5 Migration Alignment Checklist pattern
- `docs/plans/tasks/task-061-schema-field-model.md` - Base vs BaseModel decision pattern

**Handoff Document:**
- `docs/handoffs/2025-11-06-log-060-field-schema-model.md` - Latest handoff with Task #62 guidance

**Project Guidelines:**
- `CLAUDE.md` - Database models section, testing patterns

### Related Code

**Pattern to Follow:**
- Task #59 (CustomField Model) - BaseModel inheritance, passive_deletes=True, comprehensive docstring
- Task #60 (FieldSchema Model) - Step 6.5 checklist, relationship verification

**Base Classes:**
- `backend/app/models/base.py` - BaseModel (id, created_at, updated_at) vs Base (no extra columns)

**Relationship Examples:**
- `backend/app/models/video.py` (lines 46-51) - Video.field_values relationship (passive_deletes=True)
- `backend/app/models/custom_field.py` (lines 93-98) - CustomField.video_field_values relationship (passive_deletes=True)

**Current Placeholder:**
- `backend/app/models/video_field_value.py` - Basic structure, needs comprehensive docstring and verification

### Design Decisions

**Decision 1: BaseModel vs Base Inheritance**
- **Why BaseModel:** VideoFieldValue stores mutable data requiring audit trail
- **Evidence:** Migration has `id` column (line 79) and `updated_at` column (line 85)
- **Contrast:** SchemaField (Task #61) uses Base because it's a pure join table with composite PK
- **Benefit:** Audit trail (created_at, updated_at), query by id, natural primary key

**Decision 2: Typed Columns vs Single JSONB Column**
- **Why Typed Columns:** Enables efficient filtering via composite indexes
- **Alternative:** Single JSONB column `{"value": ...}` would require slower JSON path queries
- **Example Queries:**
  - "Show videos where Rating >= 4" → Uses `idx_video_field_values_field_numeric` (field_id, value_numeric)
  - "Show videos where Presentation = 'great'" → Uses `idx_video_field_values_field_text` (field_id, value_text)
- **Trade-off:** 3 nullable columns vs 1 JSONB column (more columns, but better performance)
- **Performance Impact:** Composite indexes enable sub-millisecond filtering on 100k+ rows

**Decision 3: All Value Columns Nullable**
- **Why:** Only one column populated based on field.field_type
- **Logic:**
  - Rating field (field_type='rating') → value_numeric populated, others NULL
  - Select field (field_type='select') → value_text populated, others NULL
  - Boolean field (field_type='boolean') → value_boolean populated, others NULL
  - Text field (field_type='text') → value_text populated, others NULL
- **Alternative:** CHECK constraint to enforce "exactly one NOT NULL" (rejected: complex, unnecessary)
- **Constraint Handled:** Application layer validates which column to populate based on field_type

**Decision 4: UNIQUE Constraint (video_id, field_id)**
- **Why:** Prevents duplicate values for same field on same video
- **Benefit:** Enables efficient upsert operations (INSERT ON CONFLICT UPDATE)
- **Example:** User updates rating 3→5 for same field → Upsert via UNIQUE constraint index
- **Named Constraint:** `uq_video_field_values_video_field` (matches migration for consistency)

**Decision 5: passive_deletes=True on Both Relationships**
- **Why:** Trust database CASCADE for performance (REF MCP Task #59)
- **Behavior:**
  - Delete Video → DB CASCADE to VideoFieldValue (no SELECT before DELETE)
  - Delete CustomField → DB CASCADE to VideoFieldValue (no SELECT before DELETE)
- **Evidence:** REF MCP validated in Task #59 against SQLAlchemy 2.0 docs
- **Performance:** Avoids N+1 SELECT queries before CASCADE DELETE

**Decision 6: Three Performance Indexes**
- **Why:** Optimize common filtering queries
- **Indexes (defined in migration):**
  1. `idx_video_field_values_field_numeric` (field_id, value_numeric) - "Rating >= 4"
  2. `idx_video_field_values_field_text` (field_id, value_text) - "Presentation = 'great'"
  3. `idx_video_field_values_video_field` (video_id, field_id) - "All fields for video X"
- **Note:** UNIQUE constraint (video_id, field_id) also creates index, optimizes upsert

**Decision 7: created_at Enrichment**
- **Migration:** Has `updated_at` but NOT `created_at` (line 85)
- **Model:** BaseModel adds `created_at` (line 20-24 in base.py)
- **Why OK:** Model enriches schema with audit trail (backward compatible)
- **Alternative:** Could have added `created_at` in migration (rejected: not critical for MVP)

---

## 📝 Notes

### Why This Task Is More Complex Than SchemaField (Task #61)

1. **BaseModel Inheritance Decision:**
   - Task #61 (SchemaField): Uses Base (no id, no timestamps) - straightforward join table
   - Task #62 (VideoFieldValue): Uses BaseModel (has id, timestamps) - requires justification in docstring

2. **Comprehensive Docstring Required:**
   - Task #61: 3-line docstring (join table is self-explanatory)
   - Task #62: ~50-line docstring explaining:
     - Typed columns pattern and rationale
     - UNIQUE constraint behavior
     - CASCADE behavior
     - Performance implications
     - Examples for each field type

3. **Three Typed Value Columns:**
   - Task #61: 2 simple columns (display_order, show_on_card)
   - Task #62: 3 typed value columns (value_text, value_numeric, value_boolean) with performance indexes

4. **UNIQUE Constraint Testing:**
   - Task #61: No UNIQUE constraints (composite PK handles uniqueness)
   - Task #62: Requires manual test of (video_id, field_id) UNIQUE constraint

5. **Two Relationships to Verify/Add:**
   - Task #61: Both relationships already correct (FieldSchema, CustomField)
   - Task #62: Must verify Video.field_values and CustomField.video_field_values (both already exist, just verify)

### Why This Is The Last Model Before API Layer

**Custom Fields System Architecture:**
```
Layer 1: Core Definitions (Tasks #59-#60)
├─ CustomField (Task #59) ✅ - Defines available fields
└─ FieldSchema (Task #60) ✅ - Groups fields into schemas

Layer 2: Associations (Task #61)
└─ SchemaField (Task #61) - Links fields to schemas (planned)

Layer 3: Data Storage (Task #62) ← THIS TASK
└─ VideoFieldValue (Task #62) - Stores actual values (you are here)

Layer 4: Extensions (Task #63)
└─ Tag.schema_id (Task #63) ✅ - Already completed as bonus in Task #60

Layer 5: API/Pydantic (Tasks #64-#71) ← BLOCKED UNTIL #61 + #62
├─ Task #64: Pydantic Schemas (needs VideoFieldValue model)
├─ Task #65: CustomField CRUD API (needs Pydantic schemas)
└─ ... (remaining API tasks)
```

**Why Task #64 (Pydantic) Is Blocked:**
- Needs VideoFieldValue model for `VideoFieldValueRead` schema
- Needs SchemaField model for `SchemaFieldRead` schema (Task #61)
- Cannot define API contracts without underlying data models

**Current Status:**
- Task #58 (Migration): ✅ Completed
- Task #59 (CustomField): ✅ Completed
- Task #60 (FieldSchema): ✅ Completed
- Task #63 (Tag Extension): ✅ Completed as bonus in Task #60
- Task #61 (SchemaField): 🔄 Planned (ready for implementation)
- Task #62 (VideoFieldValue): 🔄 Current task
- Task #64+ (API Layer): ⏸️ Blocked until #61 + #62 complete

### Key Learnings from Task #60 Handoff

**Step 6.5 Migration Alignment Checklist:**
- 3-minute systematic verification prevents 30+ minute debugging
- ROI of 10:1 (proven in Task #60)
- Must be used for ALL ORM model tasks
- Checklist format: TABLE NAME, COLUMNS, CONSTRAINTS, INDEXES, FOREIGN KEYS, RELATIONSHIPS

**Subagent-Driven Development Performance:**
- Task #59: 14 min (vs. 90-120 min estimated)
- Task #60: 55 min implementation (vs. 60-90 min estimated)
- Both achieved Grade A code review
- Proven pattern for isolated, well-defined tasks

**Manual CASCADE Tests Required:**
- SQLAlchemy ORM tests (pytest) don't catch CASCADE issues
- Manual database tests required for each foreign key
- Test both directions: delete parent → cascade to children

### Estimated Time: 40-50 Minutes

**Breakdown:**
1. Read migration schema: 3 min
2. Implement VideoFieldValue model: 12 min (comprehensive docstring)
3. Verify Video.field_values relationship: 2 min (already exists)
4. Verify CustomField.video_field_values relationship: 2 min (already exists)
5. Export model in __init__.py: 1 min
6. Step 6.5 Migration Alignment: 3 min
7. Manual CASCADE tests (2 tests): 10 min
8. Manual UNIQUE constraint test: 5 min
9. TypeScript check: 2 min
10. Update CLAUDE.md: 3 min
11. Commit changes: 5 min

**Complexity Factors:**
- More complex docstring than SchemaField (typed columns pattern explanation)
- UNIQUE constraint testing (not in SchemaField)
- Three typed value columns (vs 2 simple columns in SchemaField)
- Performance considerations (composite indexes for filtering)

**No REF MCP Validation Needed:**
- Follows Task #59 pattern exactly (BaseModel inheritance, passive_deletes)
- All patterns already validated against SQLAlchemy 2.0 docs
- Can implement directly without pre-validation

---

## ✅ Success Criteria Summary

**Functional:**
- [ ] VideoFieldValue model inherits from BaseModel (has id, created_at, updated_at)
- [ ] All 3 typed value columns implemented (value_text, value_numeric, value_boolean)
- [ ] Foreign keys with CASCADE (video_id, field_id)
- [ ] UNIQUE constraint (video_id, field_id) in __table_args__
- [ ] Video.field_values relationship verified (passive_deletes=True)
- [ ] CustomField.video_field_values relationship verified (passive_deletes=True)

**Documentation:**
- [ ] Comprehensive docstring (~50 lines explaining typed columns, cascade, examples)
- [ ] __table_args__ comment documenting performance indexes
- [ ] CLAUDE.md updated with VideoFieldValue model details

**Testing:**
- [ ] Import validation passing (syntax check)
- [ ] Step 6.5 Migration Alignment: all ✓ checks
- [ ] Manual CASCADE Test 1: Delete Video → VideoFieldValue cascade ✓
- [ ] Manual CASCADE Test 2: Delete CustomField → VideoFieldValue cascade ✓
- [ ] Manual UNIQUE Test: Duplicate (video_id, field_id) insert fails ✓
- [ ] TypeScript check: 0 new errors (baseline 6 expected)

**Integration:**
- [ ] Model exported in __init__.py
- [ ] Ready for Task #64 (Pydantic Schemas) after Task #61 completes

---

**Next Task:** Task #64 - Pydantic Schemas (blocked until Task #61 SchemaField completed)
**Unblocks:** API layer implementation (Tasks #64-#71)
