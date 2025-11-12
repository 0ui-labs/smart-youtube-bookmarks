# Task #152: Add User Ownership to Video Model

**Status:** Planned  
**Estimated Effort:** 1-1.5 hours  
**Priority:** High (Required for multi-tenant security)  
**Dependencies:** Task #148 (JWT Authentication Endpoints)

## 🎯 Goal

Add user ownership to the `Video` model to enable multi-tenant data isolation. The `BookmarkList` model already has user ownership implemented (see `backend/app/models/list.py:28-33`), but the `Video` model currently lacks this relationship.

This task completes the data ownership layer required for JWT-based authentication and ensures videos are scoped to their owners.

## 📋 Acceptance Criteria

- [ ] Video model has `user_id` foreign key column with CASCADE delete
- [ ] Video model has `user` relationship with `back_populates`
- [ ] User model has `videos` relationship with `back_populates`
- [ ] All imports use `TYPE_CHECKING` guards to prevent circular dependencies
- [ ] Manual CASCADE tests verify user deletion cascades to videos
- [ ] TypeScript check passes (`npx tsc --noEmit`)
- [ ] No database migration required (modification only, migration in separate task)

## 📚 Reference Documentation

**REF MCP Findings:**

1. **SQLAlchemy 2.0 CASCADE Pattern:**
   - Source: https://docs.sqlalchemy.org/en/20/orm/cascades.html#using-foreign-key-on-delete-cascade-with-orm-relationships
   - Database-level `ON DELETE CASCADE` is **significantly more efficient** than ORM cascade
   - Use `passive_deletes=True` on relationship to trust DB CASCADE (avoids SELECT before DELETE)
   - Pattern: `ForeignKey("users.id", ondelete="CASCADE")` + `relationship(..., passive_deletes=True)`

2. **back_populates vs backref:**
   - Source: https://docs.sqlalchemy.org/en/20/orm/relationship_api.html#sqlalchemy.orm.relationship.params.back_populates
   - `back_populates` is the modern, explicit form (preferred over legacy `backref`)
   - Enables bidirectional synchronization of in-Python state changes
   - Both sides must explicitly define the relationship (more verbose but clearer)

3. **Why CASCADE over SET NULL:**
   - User deletion should remove all user-owned data (GDPR compliance)
   - Videos without an owner have no meaning in multi-tenant system
   - `nullable=False` enforces ownership constraint at schema level

4. **Existing Pattern Reference:**
   - BookmarkList model (lines 28-33): Already implements user ownership correctly
   - CustomField model (lines 61-66): Similar pattern with list_id FK
   - VideoFieldValue model (lines 79-88): Dual FK pattern with CASCADE

## 🛠️ Implementation Steps

### Step 1: Update Video Model (Add user_id FK and relationship)

**File:** `backend/app/models/video.py`

**Location:** After `list_id` column (after line 24)

**Code to Add:**

```python
user_id: Mapped[PyUUID] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("users.id", ondelete="CASCADE"),
    nullable=False,
    index=True  # Performance: frequent queries filtered by user_id
)
```

**Location:** In Relationships section (after line 40, before `tags` relationship)

**Code to Add:**

```python
user: Mapped["User"] = relationship("User", back_populates="videos")
```

**Import Changes:**

Add to top of file (line 1):
```python
from typing import Optional, Dict, Any, TYPE_CHECKING
from uuid import UUID as PyUUID
```

Add after other imports (around line 9):
```python
if TYPE_CHECKING:
    from .user import User
```

**Full Updated Video Model Structure:**

```python
from datetime import datetime
from typing import Optional, Dict, Any, TYPE_CHECKING
from uuid import UUID as PyUUID

from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .base import BaseModel
from .tag import video_tags

if TYPE_CHECKING:
    from .user import User


class Video(BaseModel):
    """
    Represents a YouTube video within a bookmark list.

    Stores video metadata and extracted data according to the associated
    bookmark list's schema. Tracks processing status for async operations.
    
    Multi-Tenant Ownership:
        - Videos are owned by users (user_id foreign key)
        - Deleting a user cascades to all their videos (ON DELETE CASCADE)
        - Videos are also scoped to lists (list_id foreign key)
    """
    __tablename__ = "videos"

    list_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False
    )
    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True  # Performance: frequent queries filtered by user_id
    )
    youtube_id: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    channel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    extracted_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending"
    )
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="videos")
    list: Mapped["BookmarkList"] = relationship("BookmarkList", back_populates="videos")
    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary=video_tags,
        back_populates="videos"
    )
    field_values: Mapped[list["VideoFieldValue"]] = relationship(
        "VideoFieldValue",
        back_populates="video",
        cascade="all, delete-orphan",
        passive_deletes=True  # Trust DB CASCADE (REF MCP, consistent with CustomField)
    )

    __table_args__ = (
        Index("idx_videos_list_id", "list_id"),
        Index("idx_videos_user_id", "user_id"),  # NEW: For user-scoped queries
        Index("idx_videos_status", "processing_status"),
        Index("idx_videos_list_youtube", "list_id", "youtube_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Video(id={self.id}, youtube_id={self.youtube_id!r}, title={self.title!r})>"
```

### Step 2: Update User Model (Add videos relationship)

**File:** `backend/app/models/user.py`

**Location:** In Relationships section (after line 27, after `tags` relationship)

**Code to Add:**

```python
videos: Mapped[list["Video"]] = relationship("Video", back_populates="user")
```

**Import Changes:**

Add TYPE_CHECKING import:
```python
from typing import TYPE_CHECKING
```

Add conditional import:
```python
if TYPE_CHECKING:
    from .list import BookmarkList
    from .tag import Tag
    from .video import Video
```

**Full Updated User Model:**

```python
"""
User model for authentication.

This is a minimal implementation to support WebSocket authentication.
Can be expanded later with full user management features.
"""

from typing import TYPE_CHECKING
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

if TYPE_CHECKING:
    from .list import BookmarkList
    from .tag import Tag
    from .video import Video


class User(BaseModel):
    """
    User model for authentication.

    Minimal implementation for WebSocket auth.
    
    Relationships:
        - lists: All bookmark lists owned by this user
        - tags: All tags created by this user
        - videos: All videos owned by this user
        
    Cascade Behavior:
        - Deleting user cascades to lists, tags, and videos (ON DELETE CASCADE)
    """
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    lists: Mapped[list["BookmarkList"]] = relationship("BookmarkList", back_populates="user")
    tags: Mapped[list["Tag"]] = relationship("Tag", back_populates="user")
    videos: Mapped[list["Video"]] = relationship("Video", back_populates="user")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
```

### Step 3: Verify TYPE_CHECKING Guards

**Purpose:** Prevent circular import errors at runtime while enabling type hints

**Files to Check:**
- `backend/app/models/video.py` - Should have `if TYPE_CHECKING:` block with User import
- `backend/app/models/user.py` - Should have `if TYPE_CHECKING:` block with Video import
- `backend/app/models/list.py` - Already has TYPE_CHECKING (verify Video, User imports)

**Verification Command:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
python -c "from app.models.video import Video; from app.models.user import User; print('✓ No circular import errors')"
```

### Step 4: Manual CASCADE Tests (CRITICAL)

**Purpose:** Verify database CASCADE constraints work correctly without migration

**Test Script:** `backend/test_cascade.py` (create temporary file)

```python
"""
Manual CASCADE test for user ownership.

This script tests that deleting a user cascades to videos.
Run this BEFORE creating the migration to verify model changes.
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from app.models.list import BookmarkList
from app.models.video import Video
from app.config import settings


async def test_cascade():
    # Create async engine
    engine = create_async_engine(settings.database_url, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Step 1: Create test user
        user = User(email="test-cascade@example.com", hashed_password="fake_hash")
        session.add(user)
        await session.commit()
        user_id = user.id
        print(f"✓ Created user: {user_id}")
        
        # Step 2: Create test list
        bookmark_list = BookmarkList(
            name="Test List",
            description="For CASCADE testing",
            user_id=user_id
        )
        session.add(bookmark_list)
        await session.commit()
        list_id = bookmark_list.id
        print(f"✓ Created list: {list_id}")
        
        # Step 3: Create test video
        video = Video(
            list_id=list_id,
            user_id=user_id,
            youtube_id="test123",
            title="Test Video"
        )
        session.add(video)
        await session.commit()
        video_id = video.id
        print(f"✓ Created video: {video_id}")
        
        # Step 4: Delete user (should CASCADE to list and video)
        await session.delete(user)
        await session.commit()
        print(f"✓ Deleted user: {user_id}")
        
        # Step 5: Verify video was deleted
        from sqlalchemy import select
        result = await session.execute(select(Video).where(Video.id == video_id))
        video_check = result.scalar_one_or_none()
        
        if video_check is None:
            print("✓ CASCADE SUCCESS: Video was deleted when user was deleted")
        else:
            print("✗ CASCADE FAILED: Video still exists after user deletion")
            raise AssertionError("CASCADE constraint not working")
        
        # Step 6: Verify list was deleted
        result = await session.execute(select(BookmarkList).where(BookmarkList.id == list_id))
        list_check = result.scalar_one_or_none()
        
        if list_check is None:
            print("✓ CASCADE SUCCESS: List was deleted when user was deleted")
        else:
            print("✗ CASCADE FAILED: List still exists after user deletion")
            raise AssertionError("CASCADE constraint not working")
    
    await engine.dispose()
    print("\n✓ All CASCADE tests passed!")


if __name__ == "__main__":
    asyncio.run(test_cascade())
```

**Run Command:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
python test_cascade.py
```

**Expected Output:**

```
✓ Created user: <uuid>
✓ Created list: <uuid>
✓ Created video: <uuid>
✓ Deleted user: <uuid>
✓ CASCADE SUCCESS: Video was deleted when user was deleted
✓ CASCADE SUCCESS: List was deleted when user was deleted

✓ All CASCADE tests passed!
```

**IMPORTANT:** If CASCADE fails, it means the database constraints need to be added via migration first. In that case, pause and create migration task before proceeding.

### Step 5: TypeScript Check (Frontend Safety)

**Purpose:** Ensure no TypeScript errors introduced by backend changes

**Command:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/frontend
npx tsc --noEmit
```

**Expected:** No errors (backend model changes shouldn't affect frontend types)

### Step 6: Commit Model Changes

**Commit Message:**

```
feat(models): add user ownership to Video model

- Add user_id foreign key with CASCADE delete to Video model
- Add videos relationship to User model (back_populates)
- Add TYPE_CHECKING guards to prevent circular imports
- Add idx_videos_user_id index for user-scoped queries
- Verified CASCADE behavior with manual tests

Part of Task #152: User Ownership Models
Related to security hardening (Task #148 JWT Auth)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Verification:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks
git status
git diff backend/app/models/video.py
git diff backend/app/models/user.py
```

## 🧪 Testing Strategy

### Manual CASCADE Tests (Primary Validation)

**Test Case 1: User Deletion Cascades to Videos**

1. Create test user
2. Create test list (owned by user)
3. Create test video (owned by user, in list)
4. Delete user
5. Verify video no longer exists
6. Verify list no longer exists

**Test Case 2: Foreign Key Constraint Enforcement**

1. Attempt to create video with invalid user_id (should fail)
2. Verify FK constraint error raised

**Test Case 3: Import Validation**

1. Import Video model
2. Import User model
3. Verify no circular import errors
4. Verify relationships are accessible: `user.videos`, `video.user`

### Performance Testing (Optional)

**Query Performance:**

```python
# Test user-scoped video query (should use idx_videos_user_id)
from sqlalchemy import select
result = await session.execute(
    select(Video).where(Video.user_id == user_id)
)
videos = result.scalars().all()
```

**Expected:** Query plan shows index usage: `idx_videos_user_id`

## 📝 Design Decisions

### 1. Why CASCADE over SET NULL?

**Decision:** Use `ondelete="CASCADE"` instead of `ondelete="SET NULL"`

**Rationale:**

- **GDPR Compliance:** User deletion should remove all user-owned data
- **Data Integrity:** Videos without an owner have no meaning in multi-tenant system
- **Consistency:** BookmarkList already uses CASCADE for user deletion
- **Database Constraint:** `nullable=False` enforces ownership at schema level

**REF MCP Evidence:**

From https://docs.sqlalchemy.org/en/20/orm/cascades.html:

> "Database level foreign keys with no `ON DELETE` setting are often used to **prevent** a parent row from being removed, as it would necessarily leave an unhandled related row present."

For multi-tenant systems, we want the opposite: user deletion should remove all traces.

### 2. Why nullable=False?

**Decision:** Require user_id (not nullable)

**Rationale:**

- **Ownership Requirement:** Every video must have an owner in multi-tenant system
- **Query Safety:** Prevents `WHERE user_id IS NULL` edge cases
- **FK Enforcement:** Database will reject videos without user_id
- **Consistency:** Matches BookmarkList.user_id pattern (nullable=False)

**Alternative Considered:** `nullable=True` with `ondelete="SET NULL"`

**Rejected Because:**
- Orphaned videos would need cleanup jobs
- Unclear ownership model (who can access videos with user_id=NULL?)
- Breaks multi-tenant isolation

### 3. Why index=True on user_id?

**Decision:** Add index to user_id column

**Rationale:**

- **Query Performance:** User-scoped queries are frequent: `WHERE user_id = ?`
- **Join Performance:** Relationship queries will use index: `user.videos`
- **Consistency:** BookmarkList has `index=True` on user_id (line 32)
- **Cost:** Minimal (UUID column, write overhead acceptable for read performance gain)

**Query Pattern:**

```python
# This query benefits from idx_videos_user_id
videos = await session.execute(
    select(Video).where(Video.user_id == current_user.id)
)
```

### 4. Why back_populates over backref?

**Decision:** Use explicit `back_populates` on both sides

**Rationale:**

- **Modern Pattern:** `backref` is legacy (still supported but not preferred)
- **Explicit is Better:** Both sides of relationship are clear in code
- **Type Safety:** Easier for type checkers to understand
- **Consistency:** Existing models use `back_populates` (see CustomField, VideoFieldValue)

**REF MCP Evidence:**

From https://docs.sqlalchemy.org/en/20/orm/backref.html:

> "the `back_populates` is now the preferred method for creating bidirectional relationships"

### 5. Why passive_deletes=True? (Future Enhancement)

**Decision:** Do NOT add `passive_deletes=True` in this task

**Rationale:**

- **Current Status:** Video.user relationship doesn't need cascade (User is parent)
- **Performance:** passive_deletes only matters for parent→child relationships
- **Consistency:** User.videos relationship could use it, but not critical yet

**Future Enhancement:**

When User deletion becomes performance-critical:

```python
# In User model:
videos: Mapped[list["Video"]] = relationship(
    "Video",
    back_populates="user",
    passive_deletes=True  # Trust DB CASCADE, skip SELECT
)
```

**REF MCP Evidence:**

From https://docs.sqlalchemy.org/en/20/orm/cascades.html:

> "Database level `ON DELETE` cascade is generally much more efficient than relying upon the 'cascade' delete feature of SQLAlchemy."

## 🚨 Known Issues & Limitations

### 1. No Migration in This Task

**Issue:** Model changes don't update database schema automatically

**Resolution:** Separate task will create Alembic migration:
- Task #153: Create migration for user_id column in videos table
- Migration will add NOT NULL constraint with default value for existing rows

**Workaround:** Manual testing script creates fresh database state

### 2. Existing Videos Have No user_id

**Issue:** Current production data has videos without user_id

**Resolution:** Migration will:
1. Add column as nullable first
2. Backfill user_id from list.user_id
3. Alter column to NOT NULL
4. Add CASCADE constraint

**Example Migration:**

```python
# In migration file:
def upgrade():
    # Step 1: Add nullable column
    op.add_column('videos', sa.Column('user_id', UUID(as_uuid=True), nullable=True))
    
    # Step 2: Backfill from lists
    op.execute("""
        UPDATE videos v
        SET user_id = l.user_id
        FROM bookmarks_lists l
        WHERE v.list_id = l.id
    """)
    
    # Step 3: Make NOT NULL
    op.alter_column('videos', 'user_id', nullable=False)
    
    # Step 4: Add FK constraint
    op.create_foreign_key(
        'fk_videos_user_id',
        'videos',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE'
    )
```

### 3. API Endpoints Need Updates

**Issue:** Current endpoints use hardcoded MOCK_USER_ID

**Resolution:** Separate tasks will update endpoints:
- Task #160: Update video endpoints to use authenticated user
- Task #161: Add user ownership filters to queries

**Example:**

```python
# Before (current):
video = Video(
    list_id=list_id,
    youtube_id=youtube_id,
    user_id=MOCK_USER_ID  # Hardcoded
)

# After (Task #160):
video = Video(
    list_id=list_id,
    youtube_id=youtube_id,
    user_id=current_user.id  # From JWT token
)
```

## 📊 Success Metrics

- [ ] Video model has user_id column with FK constraint
- [ ] User model has videos relationship (bidirectional)
- [ ] TYPE_CHECKING guards prevent circular imports
- [ ] Manual CASCADE test passes (user deletion → video deletion)
- [ ] TypeScript check passes (no frontend errors)
- [ ] Code committed with descriptive message
- [ ] No runtime errors when importing models

## 🔗 Related Tasks

**Prerequisite:**
- Task #148: JWT Authentication Endpoints (must be complete for user context)

**Follow-Up:**
- Task #153: Create Alembic migration for user_id in videos
- Task #160: Update video endpoints to use authenticated user
- Task #161: Add user ownership filters to queries

**Related:**
- Task #59-#62: Custom Fields System (reference for CASCADE patterns)
- Security Hardening Master Plan: Step 15 (lines 751-784)

## 📖 Reference Implementation

**Existing Patterns to Follow:**

1. **BookmarkList.user_id** (lines 28-33 in list.py):
   ```python
   user_id: Mapped[PyUUID] = mapped_column(
       UUID(as_uuid=True),
       ForeignKey("users.id", ondelete="CASCADE"),
       nullable=False,
       index=True
   )
   ```

2. **CustomField.list_id** (lines 61-66 in custom_field.py):
   ```python
   list_id: Mapped[PyUUID] = mapped_column(
       UUID(as_uuid=True),
       ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
       nullable=False,
       index=True  # Performance: frequent lookups by list_id
   )
   ```

3. **VideoFieldValue Dual FKs** (lines 79-88 in video_field_value.py):
   ```python
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
   ```

## 🎓 Learning Resources

**SQLAlchemy 2.0 CASCADE:**
- Official Docs: https://docs.sqlalchemy.org/en/20/orm/cascades.html
- Foreign Key CASCADE: https://docs.sqlalchemy.org/en/20/orm/cascades.html#using-foreign-key-on-delete-cascade-with-orm-relationships

**Relationship Patterns:**
- back_populates: https://docs.sqlalchemy.org/en/20/orm/relationship_api.html#sqlalchemy.orm.relationship.params.back_populates
- Basic Relationships: https://docs.sqlalchemy.org/en/20/orm/basic_relationships.html

**PostgreSQL CASCADE:**
- FK Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK
- CASCADE vs SET NULL: https://www.postgresql.org/docs/current/sql-createtable.html

---

**Plan Created:** 2025-11-09  
**Estimated Completion Time:** 1-1.5 hours  
**Complexity:** Medium (model changes + CASCADE testing)
