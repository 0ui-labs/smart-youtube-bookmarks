# Task #115: Create Alembic Migration for User Relationships

**Status:** Not Started  
**Estimated Time:** 2-2.5 hours  
**Assignee:** TBD  
**Dependencies:** Task #114 (User model fields added)

---

## 🎯 Goal

Create an Alembic migration to add user ownership (`user_id` foreign key) to the `videos` table, completing the user authentication system for video management.

**Note:** The `bookmarks_lists` table already has `user_id` (added in migration `2ce4f55587a6`). This task focuses on adding `user_id` to the `videos` table only.

---

## 📋 Acceptance Criteria

- [ ] Migration adds `user_id` column to `videos` table
- [ ] Column is NOT NULL with CASCADE delete behavior
- [ ] Index created on `videos.user_id` for query performance
- [ ] Existing video rows backfilled with default test user ID
- [ ] Foreign key constraint references `users.id` with `ondelete='CASCADE'`
- [ ] Downgrade function cleanly removes all changes
- [ ] Migration tested with `alembic upgrade head`
- [ ] Migration tested with `alembic downgrade -1`
- [ ] Idempotency verified (running upgrade twice doesn't fail)
- [ ] CASCADE delete behavior verified (deleting user deletes videos)

---

## 🛠️ Implementation Steps

### Step 1: Generate Migration Skeleton

```bash
cd backend
alembic revision --autogenerate -m "Add user_id to videos table"
```

**Expected Output:**
- New migration file created in `backend/alembic/versions/`
- Revision ID generated
- File named: `<revision>_add_user_id_to_videos_table.py`

**Action:** Review the auto-generated migration to ensure it detected the `user_id` column addition.

---

### Step 2: Review Auto-Generated Migration

**File:** `backend/alembic/versions/<revision>_add_user_id_to_videos_table.py`

Check that the migration includes:
- `op.add_column('videos', sa.Column('user_id', UUID(as_uuid=True), ...))` 
- Foreign key constraint to `users.id`

**Important:** Alembic autogenerate may NOT correctly handle the nullable → NOT NULL transition or backfill logic. Manual editing is required.

---

### Step 3: Implement `upgrade()` Function

**File:** `backend/alembic/versions/<revision>_add_user_id_to_videos_table.py`

Replace the auto-generated `upgrade()` with this complete implementation:

```python
def upgrade() -> None:
    """Add user_id to videos table with backfill for existing data."""
    
    # Step 1: Add user_id column as NULLABLE first
    # (Required for existing rows that can't have a value yet)
    op.add_column(
        'videos',
        sa.Column('user_id', UUID(as_uuid=True), nullable=True)
    )
    
    # Step 2: Backfill existing videos with default test user
    # Query the existing test user (created in migration 2ce4f55587a6)
    connection = op.get_bind()
    result = connection.execute(
        text("SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1")
    )
    default_user_row = result.fetchone()
    
    if default_user_row is None:
        raise RuntimeError(
            "Migration failed: Default test user not found. "
            "Ensure migration 2ce4f55587a6 has been applied."
        )
    
    default_user_id = str(default_user_row[0])
    
    # Update all existing videos to have user_id set to default user
    connection.execute(
        text("""
            UPDATE videos
            SET user_id = :user_id
            WHERE user_id IS NULL
        """),
        {'user_id': default_user_id}
    )
    
    # Step 3: Make user_id NOT NULL now that all rows have a value
    op.alter_column('videos', 'user_id', nullable=False)
    
    # Step 4: Add foreign key constraint with CASCADE delete
    op.create_foreign_key(
        'fk_videos_user_id',           # Constraint name
        'videos',                       # Source table
        'users',                        # Target table
        ['user_id'],                    # Source columns
        ['id'],                         # Target columns
        ondelete='CASCADE'              # Deleting user deletes all their videos
    )
    
    # Step 5: Create index for query performance
    # Queries like "Get all videos for user X" will use this index
    op.create_index('idx_videos_user_id', 'videos', ['user_id'])
```

**Add Required Imports:**

```python
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import text
```

---

### Step 4: Implement `downgrade()` Function

**File:** `backend/alembic/versions/<revision>_add_user_id_to_videos_table.py`

```python
def downgrade() -> None:
    """Remove user_id from videos table."""
    
    # Remove in reverse order to avoid foreign key violations
    
    # Step 1: Drop index first
    op.drop_index('idx_videos_user_id', table_name='videos')
    
    # Step 2: Drop foreign key constraint
    op.drop_constraint('fk_videos_user_id', 'videos', type_='foreignkey')
    
    # Step 3: Drop user_id column (data will be lost)
    op.drop_column('videos', 'user_id')
```

**Important:** Downgrading this migration will lose user ownership data for videos. This is acceptable for development but should be avoided in production.

---

### Step 5: Test Migration Upgrade

```bash
cd backend

# Check current migration status
alembic current

# Run upgrade
alembic upgrade head

# Verify migration applied
alembic current
```

**Expected Output:**
```
INFO  [alembic.runtime.migration] Running upgrade 1a6e18578c31 -> <new_revision>, Add user_id to videos table
```

**Verification Queries:**

```bash
# Connect to PostgreSQL
docker exec -it smart-youtube-bookmarks-postgres-1 psql -U postgres -d youtube_bookmarks

# Check videos table structure
\d videos

# Verify user_id column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'videos' AND column_name = 'user_id';

# Verify foreign key constraint
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'videos'::regclass AND conname = 'fk_videos_user_id';

# Verify index
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'videos' AND indexname = 'idx_videos_user_id';

# Verify all existing videos have user_id set
SELECT COUNT(*) as total, COUNT(user_id) as with_user_id 
FROM videos;
```

**Expected:**
- `user_id` column exists, type `uuid`, NOT NULL
- Foreign key constraint `fk_videos_user_id` exists
- Index `idx_videos_user_id` exists
- All videos have `user_id` populated

---

### Step 6: Test Migration Downgrade

```bash
cd backend

# Downgrade one step
alembic downgrade -1

# Verify migration reverted
alembic current
```

**Expected Output:**
```
INFO  [alembic.runtime.migration] Running downgrade <new_revision> -> 1a6e18578c31, Add user_id to videos table
```

**Verification:**

```bash
# Check videos table structure
docker exec -it smart-youtube-bookmarks-postgres-1 psql -U postgres -d youtube_bookmarks -c "\d videos"
```

**Expected:**
- `user_id` column does NOT exist
- Foreign key constraint `fk_videos_user_id` does NOT exist
- Index `idx_videos_user_id` does NOT exist

**Restore State:**

```bash
# Re-apply migration for further testing
alembic upgrade head
```

---

### Step 7: Test Idempotency

```bash
cd backend

# Run upgrade twice (should not fail)
alembic upgrade head
alembic upgrade head
```

**Expected:** Second upgrade does nothing (already at head).

**Why This Matters:** In production, accidentally running migrations twice should be safe.

---

### Step 8: Test CASCADE Delete Behavior

```bash
# Create a test user and video via Python shell
docker exec -it smart-youtube-bookmarks-backend-1 python

# In Python shell:
from app.database import get_session_factory
from app.models.user import User
from app.models.list import BookmarkList
from app.models.video import Video
import asyncio

async def test_cascade():
    async_session = get_session_factory()
    async with async_session() as session:
        # Create test user
        test_user = User(email="cascade_test@example.com", hashed_password="test", is_active=True)
        session.add(test_user)
        await session.commit()
        await session.refresh(test_user)
        
        user_id = test_user.id
        print(f"Created user: {user_id}")
        
        # Create test list for user
        test_list = BookmarkList(name="Test List", user_id=user_id)
        session.add(test_list)
        await session.commit()
        await session.refresh(test_list)
        
        # Create test video
        test_video = Video(
            list_id=test_list.id,
            user_id=user_id,
            youtube_id="test123",
            processing_status="completed"
        )
        session.add(test_video)
        await session.commit()
        await session.refresh(test_video)
        
        video_id = test_video.id
        print(f"Created video: {video_id}")
        
        # Delete user (should cascade to video)
        await session.delete(test_user)
        await session.commit()
        
        # Verify video was deleted
        from sqlalchemy import select
        result = await session.execute(select(Video).where(Video.id == video_id))
        deleted_video = result.scalar_one_or_none()
        
        print(f"Video after user delete: {deleted_video}")  # Should be None

asyncio.run(test_cascade())
```

**Expected Output:**
```
Created user: <uuid>
Created video: <uuid>
Video after user delete: None
```

**If CASCADE works:** Video is automatically deleted when user is deleted.

---

### Step 9: Commit Migration

```bash
cd backend
git add alembic/versions/<revision>_add_user_id_to_videos_table.py
git commit -m "feat(migration): add user_id to videos table with CASCADE

- Add user_id foreign key to videos table
- Backfill existing videos with test user
- Add index for user_id queries
- Implement CASCADE delete (deleting user deletes videos)
- Tested upgrade/downgrade/idempotency

Part of Task #115 - User Relationships Migration"
```

---

## 🧪 Testing Strategy

### 1. Fresh Database Test

**Setup:**
```bash
# Drop and recreate database
docker-compose down -v
docker-compose up -d postgres redis

# Run all migrations from scratch
cd backend
alembic upgrade head
```

**Expected:** All migrations apply cleanly, including the new user_id migration.

---

### 2. Existing Data Test

**Setup:**
```bash
# Ensure database has existing videos without user_id
# (If starting fresh, create some test data first)

# Run migration
alembic upgrade head
```

**Verification:**
```sql
-- All videos should have user_id populated
SELECT COUNT(*) as total, COUNT(user_id) as with_user_id 
FROM videos;
-- Expected: total = with_user_id
```

---

### 3. Downgrade Test

```bash
# Test downgrade
alembic downgrade -1

# Verify videos table has no user_id
docker exec -it smart-youtube-bookmarks-postgres-1 psql -U postgres -d youtube_bookmarks -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'videos';"
```

**Expected:** `user_id` column does NOT appear in output.

---

### 4. Idempotency Test

```bash
# Run upgrade multiple times
alembic upgrade head
alembic upgrade head
alembic upgrade head
```

**Expected:** No errors, migrations are idempotent.

---

### 5. CASCADE Delete Test

See Step 8 above for complete test procedure.

**Expected:** Deleting a user automatically deletes all their videos.

---

## 📚 Reference Materials

### Pattern Source: Migration 2ce4f55587a6

**File:** `backend/alembic/versions/2ce4f55587a6_add_users_table_and_user_id_to_.py`

This migration already implemented the same pattern for `bookmarks_lists.user_id`:

1. Add column as nullable
2. Backfill with default user
3. Alter to NOT NULL
4. Add foreign key with CASCADE
5. Add index

**Key Code Snippet:**

```python
# Add nullable first
op.add_column('bookmarks_lists', sa.Column('user_id', UUID(as_uuid=True), nullable=True))

# Backfill
op.execute(text("UPDATE bookmarks_lists SET user_id = :user_id WHERE user_id IS NULL"), {'user_id': default_user_id})

# Make NOT NULL
op.alter_column('bookmarks_lists', 'user_id', nullable=False)

# Add FK with CASCADE
op.create_foreign_key('fk_bookmarks_lists_user_id', 'bookmarks_lists', 'users', ['user_id'], ['id'], ondelete='CASCADE')

# Add index
op.create_index('idx_bookmarks_lists_user_id', 'bookmarks_lists', ['user_id'])
```

---

### REF MCP Findings: Foreign Key CASCADE

**Source:** AWS DMS PostgreSQL Documentation

**ON DELETE CASCADE Behavior:**
- When parent row (user) is deleted, all child rows (videos) are automatically deleted
- No need for application-level cleanup logic
- Performance: Database handles deletion efficiently in a single transaction

**PostgreSQL Syntax:**
```sql
ALTER TABLE videos 
ADD CONSTRAINT fk_videos_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

**Alembic Equivalent:**
```python
op.create_foreign_key(
    'fk_videos_user_id',
    'videos', 'users',
    ['user_id'], ['id'],
    ondelete='CASCADE'
)
```

---

### REF MCP Findings: Adding NOT NULL to Existing Table

**Pattern:** Nullable → Backfill → NOT NULL

**Why This Works:**
1. PostgreSQL allows adding nullable columns to existing tables instantly (no table rewrite)
2. Backfill operation updates existing rows
3. ALTER COLUMN to NOT NULL only checks constraint, doesn't rewrite table

**Alternative (Not Recommended):**
```sql
-- ❌ This would fail if table has existing rows
ALTER TABLE videos ADD COLUMN user_id UUID NOT NULL;
```

**Correct Approach:**
```sql
-- ✅ Three-step process
ALTER TABLE videos ADD COLUMN user_id UUID;          -- Nullable
UPDATE videos SET user_id = '<default>';             -- Backfill
ALTER TABLE videos ALTER COLUMN user_id SET NOT NULL; -- Constraint
```

---

### Alembic Documentation

**Downgrade Best Practices:**
- Always drop indexes before dropping columns
- Always drop foreign keys before dropping columns
- Use `type_='foreignkey'` parameter when dropping constraints

**Example:**
```python
op.drop_index('idx_videos_user_id', table_name='videos')
op.drop_constraint('fk_videos_user_id', 'videos', type_='foreignkey')
op.drop_column('videos', 'user_id')
```

---

## 🎨 Design Decisions

### 1. Backfill Strategy: Use Default Test User

**Decision:** Backfill all existing videos with the default test user (email: `test@example.com`) created in migration `2ce4f55587a6`.

**Rationale:**
- Simple and deterministic
- Consistent with existing `bookmarks_lists` migration
- Suitable for development environment
- Production would need custom backfill logic based on business rules

**Alternative Considered:** Create a new "system" user for orphaned videos.
- **Rejected:** Adds complexity; test user already exists.

---

### 2. Migration Pattern: Nullable → NOT NULL

**Decision:** Use three-step process (add nullable, backfill, alter to NOT NULL).

**Rationale:**
- Only way to add NOT NULL column to table with existing rows
- Avoids "column contains null values" error
- Recommended by PostgreSQL and Alembic communities

**REF MCP Evidence:** Standard pattern for adding NOT NULL constraints to populated tables.

---

### 3. CASCADE Delete Rationale

**Decision:** Use `ondelete='CASCADE'` for `videos.user_id` foreign key.

**Rationale:**
- **Data Integrity:** Videos without owners are meaningless
- **Privacy Compliance:** When user is deleted, all their data should be removed
- **Simplicity:** No application-level cleanup logic needed
- **Performance:** Single database transaction handles all deletions

**Alternative Considered:** `ondelete='SET NULL'`
- **Rejected:** Videos must always have an owner (NOT NULL constraint)

**Consistency:** Matches existing pattern in `bookmarks_lists.user_id` (also CASCADE).

---

### 4. Index Column Order

**Decision:** Single-column index on `user_id` only.

**Rationale:**
- Primary query pattern: "Get all videos for user X"
- Simple index is sufficient for foreign key lookups
- Composite indexes (e.g., `(user_id, list_id)`) can be added later if needed

**Performance Impact:**
- Query: `SELECT * FROM videos WHERE user_id = '<uuid>'` → Uses `idx_videos_user_id`
- Typical result set: 100-10,000 videos per user
- Index size: ~8KB per 1,000 users (UUID = 16 bytes + overhead)

---

### 5. Constraint Naming Convention

**Decision:** Use `fk_<table>_<column>` pattern for foreign key names.

**Rationale:**
- Consistent with existing migrations (e.g., `fk_bookmarks_lists_user_id`)
- Descriptive and self-documenting
- Aligns with SQLAlchemy naming conventions

**Example:** `fk_videos_user_id` clearly indicates "foreign key on videos table, user_id column".

---

## ⚠️ Breaking Change Notice

### Production Deployment Considerations

**This migration introduces a BREAKING CHANGE:**

1. **Requires Existing Users:**
   - Application CANNOT create videos without a valid `user_id`
   - Unauthenticated API endpoints will fail after this migration
   - Ensure authentication system is fully deployed BEFORE running this migration

2. **Data Backfill Strategy:**
   - Development: Uses default test user (acceptable)
   - Production: May need custom logic to assign videos to correct users
   - Consider manual backfill script if videos should belong to specific users

3. **API Changes Required:**
   - All video creation endpoints must include `user_id`
   - Protected endpoints must use `get_current_active_user()` dependency
   - Update API tests to include authentication

4. **Rollback Considerations:**
   - Downgrading migration LOSES user ownership data
   - No way to recover `user_id` values after downgrade
   - In production, downgrade should only be emergency measure

---

### Pre-Deployment Checklist

Before running this migration in production:

- [ ] Authentication endpoints deployed and tested
- [ ] User accounts created for existing video owners
- [ ] Backfill strategy decided (test user or real users)
- [ ] API endpoints updated to require authentication
- [ ] Frontend updated to send auth tokens
- [ ] Integration tests pass with authentication enabled
- [ ] Database backup taken (in case of rollback)

---

### Deployment Order

**Correct Sequence:**

1. Deploy User model and authentication endpoints (Tasks #110-#113)
2. Deploy protected API endpoints (Task #114)
3. **Run this migration (Task #115)**
4. Verify all features work with authentication

**Incorrect Sequence:**

❌ Running migration BEFORE deploying authentication will break the application.

---

## 📊 Migration File Template

**File:** `backend/alembic/versions/<revision>_add_user_id_to_videos_table.py`

```python
"""Add user_id to videos table

Revision ID: <revision>
Revises: 1a6e18578c31
Create Date: <timestamp>

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision: str = '<revision>'
down_revision: Union[str, None] = '1a6e18578c31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add user_id to videos table with backfill for existing data."""
    
    # Step 1: Add user_id column as NULLABLE first
    op.add_column(
        'videos',
        sa.Column('user_id', UUID(as_uuid=True), nullable=True)
    )
    
    # Step 2: Backfill existing videos with default test user
    connection = op.get_bind()
    result = connection.execute(
        text("SELECT id FROM users WHERE email = 'test@example.com' LIMIT 1")
    )
    default_user_row = result.fetchone()
    
    if default_user_row is None:
        raise RuntimeError(
            "Migration failed: Default test user not found. "
            "Ensure migration 2ce4f55587a6 has been applied."
        )
    
    default_user_id = str(default_user_row[0])
    
    # Update all existing videos
    connection.execute(
        text("""
            UPDATE videos
            SET user_id = :user_id
            WHERE user_id IS NULL
        """),
        {'user_id': default_user_id}
    )
    
    # Step 3: Make user_id NOT NULL
    op.alter_column('videos', 'user_id', nullable=False)
    
    # Step 4: Add foreign key constraint with CASCADE delete
    op.create_foreign_key(
        'fk_videos_user_id',
        'videos',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    # Step 5: Create index for query performance
    op.create_index('idx_videos_user_id', 'videos', ['user_id'])


def downgrade() -> None:
    """Remove user_id from videos table."""
    
    # Remove in reverse order
    op.drop_index('idx_videos_user_id', table_name='videos')
    op.drop_constraint('fk_videos_user_id', 'videos', type_='foreignkey')
    op.drop_column('videos', 'user_id')
```

---

## ✅ Completion Checklist

- [ ] Migration file created with correct revision ID
- [ ] `upgrade()` function implemented with 5 steps
- [ ] `downgrade()` function implemented with 3 steps
- [ ] Imports added (`UUID`, `text`)
- [ ] Tested: Fresh database upgrade
- [ ] Tested: Existing data backfill
- [ ] Tested: Downgrade removes changes
- [ ] Tested: Idempotency (upgrade twice)
- [ ] Tested: CASCADE delete behavior
- [ ] Verified: Index created correctly
- [ ] Verified: Foreign key constraint exists
- [ ] Verified: All videos have user_id populated
- [ ] Committed to git with descriptive message
- [ ] Updated CLAUDE.md if necessary

---

## 📝 Notes

- Migration follows exact pattern from `2ce4f55587a6` (lists user_id)
- Test user email: `test@example.com` (hardcoded in migration)
- Current head: `1a6e18578c31` (custom fields system)
- New head after this migration: `<revision>` (user ownership complete)
- Videos inherit user from their parent list (both have user_id now)

---

**Estimated Time Breakdown:**
- Step 1-4: Generate and implement migration (30 min)
- Step 5-7: Test upgrade/downgrade/idempotency (45 min)
- Step 8: Test CASCADE delete (30 min)
- Step 9: Documentation and commit (15 min)
- **Total: 2 hours**

**Complexity:** Medium (following established pattern, but requires careful backfill testing)
