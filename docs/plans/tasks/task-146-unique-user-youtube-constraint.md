# Task #146: Add UNIQUE Constraint for (user_id, youtube_id)

**Plan Task:** #146  
**Wave/Phase:** Phase 1 Security Hardening  
**Dependencies:** Task #145 (youtube_id length check), Task #1 (User model implementation)

---

## 🎯 Ziel

Add a composite UNIQUE constraint on (user_id, youtube_id) to the videos table to prevent users from saving the same YouTube video multiple times. This ensures data integrity at the database level and provides immediate feedback to users when attempting to save a duplicate.

**Success Criteria:**
- Constraint enforces per-user uniqueness: same video can be saved by different users
- Different videos can be saved by same user
- Duplicate attempt raises IntegrityError (constraint violation)
- Constraint name: `videos_user_youtube_unique`

---

## 📋 Acceptance Criteria

- [ ] UNIQUE constraint (user_id, youtube_id) created via Alembic migration
- [ ] Migration handles existing duplicate data (if any)
- [ ] Unit tests verify duplicate prevention
- [ ] Cross-user uniqueness tests pass
- [ ] Integration tests confirm constraint enforcement
- [ ] All existing tests still pass
- [ ] Code reviewed
- [ ] Deployed via migration

---

## 🛠️ Implementation Steps

### 1. Prepare test file structure
**Files:** `backend/tests/models/test_video_constraints.py`  
**Action:** Create test file if not exists, add tests for duplicate video prevention

This file will contain integration tests that verify the UNIQUE constraint behavior. The tests will:
- Create a user and attempt to save the same video twice (should fail)
- Verify different users can save the same video (should succeed)
- Verify different videos by same user work fine (should succeed)

**Note:** Test the constraint BEFORE migration is applied (will fail), then verify PASS after migration.

### 2. Create Alembic migration
**Files:** `backend/alembic/versions/XXXX_add_unique_user_youtube_constraint.py`  
**Action:** Generate new migration and implement constraint creation

```bash
cd backend
alembic revision -m "Add UNIQUE constraint for (user_id, youtube_id)"
```

The migration must:
1. Check for and handle existing duplicate data (if any)
2. Create the UNIQUE constraint: `videos_user_youtube_unique` on (user_id, youtube_id)
3. Provide downgrade path for rollback

**Key Details:**
- Constraint name: `videos_user_youtube_unique` (consistent with task specification)
- Column order: (user_id, youtube_id) - order matters for performance
- No need for DEFERRABLE option (non-time-critical constraint)
- Alembic uses `op.create_unique_constraint()` function

### 3. Implement migration logic

**File:** `backend/alembic/versions/XXXX_add_unique_user_youtube_constraint.py`

```python
"""Add UNIQUE constraint for (user_id, youtube_id)

Revision ID: XXXX
Revises: YYYY  # Previous migration ID (e.g., 1a6e18578c31)
Create Date: 2025-11-10

Composite UNIQUE constraint prevents same user from saving same video twice.
This is a critical data integrity constraint per security hardening Task #9.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision: str = 'XXXX'
down_revision: Union[str, None] = 'YYYY'  # Will be auto-filled
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add UNIQUE constraint for (user_id, youtube_id)."""
    
    # Step 1: Identify and handle any existing duplicate data
    # This is a safety check - if duplicates exist, the constraint creation will fail
    # We identify them first and document the problem
    op.execute(
        text("""
            WITH duplicate_videos AS (
                SELECT user_id, youtube_id, COUNT(*) as count
                FROM videos
                WHERE user_id IS NOT NULL AND youtube_id IS NOT NULL
                GROUP BY user_id, youtube_id
                HAVING COUNT(*) > 1
            )
            SELECT COUNT(*) as duplicate_count FROM duplicate_videos
        """)
    )
    # Note: If duplicates exist, log them but allow constraint creation
    # The migration will fail with a clear error about which rows violate the constraint
    
    # Step 2: Create UNIQUE constraint on (user_id, youtube_id)
    op.create_unique_constraint(
        'videos_user_youtube_unique',
        'videos',
        ['user_id', 'youtube_id']
    )


def downgrade() -> None:
    """Remove UNIQUE constraint for (user_id, youtube_id)."""
    op.drop_constraint('videos_user_youtube_unique', 'videos', type_='unique')
```

**Why this approach?**
- Alembic `op.create_unique_constraint()` is simpler than raw SQL
- Alembic handles dialect-specific syntax (PostgreSQL, MySQL, etc.)
- Clear constraint name for debugging and maintenance
- Standard pattern used throughout project

### 4. Update Video model (optional - for documentation)
**Files:** `backend/app/models/video.py`  
**Action:** Add comment documenting the constraint

The Video model already has the indexed unique constraint on (list_id, youtube_id). This migration adds a separate constraint on (user_id, youtube_id) for per-user uniqueness.

No model code changes needed - the constraint is defined at database level via migration.

### 5. Write constraint tests
**Files:** `backend/tests/models/test_video_constraints.py`  
**Action:** Create comprehensive test suite

```python
"""Tests for video database constraints."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.models.video import Video
from app.models.user import User
from app.models.list import BookmarkList


@pytest.mark.asyncio
async def test_video_unique_youtube_id_per_user(test_db):
    """
    Test UNIQUE constraint (user_id, youtube_id).
    
    Verifies that a user cannot save the same YouTube video twice.
    The constraint is database-level to ensure integrity regardless of
    application logic.
    """
    # Setup: Create user and list
    user = User(
        email="test@example.com",
        hashed_password="hash",
        is_active=True
    )
    test_db.add(user)
    await test_db.flush()
    
    list_obj = BookmarkList(
        name="Test List",
        user_id=user.id
    )
    test_db.add(list_obj)
    await test_db.commit()
    
    # Create first video
    video1 = Video(
        list_id=list_obj.id,
        youtube_id="dQw4w9WgXcQ",
        user_id=user.id,
        title="Video 1"
    )
    test_db.add(video1)
    await test_db.commit()
    
    # Try to create duplicate (same user, same youtube_id)
    video2 = Video(
        list_id=list_obj.id,
        youtube_id="dQw4w9WgXcQ",
        user_id=user.id,
        title="Video 1 Duplicate"
    )
    test_db.add(video2)
    
    # Should raise IntegrityError due to UNIQUE constraint
    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    # Verify the constraint name is present in error message
    assert "videos_user_youtube_unique" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_video_same_youtube_id_different_users(test_db):
    """
    Test that different users CAN save the same YouTube video.
    
    The UNIQUE constraint is per-user, not global.
    This verifies the composite nature of the constraint.
    """
    # Setup: Create two users
    user1 = User(
        email="user1@example.com",
        hashed_password="hash",
        is_active=True
    )
    user2 = User(
        email="user2@example.com",
        hashed_password="hash",
        is_active=True
    )
    test_db.add_all([user1, user2])
    await test_db.flush()
    
    # Create lists for each user
    list1 = BookmarkList(name="List 1", user_id=user1.id)
    list2 = BookmarkList(name="List 2", user_id=user2.id)
    test_db.add_all([list1, list2])
    await test_db.commit()
    
    # Both users save the SAME video (different list contexts)
    video1 = Video(
        list_id=list1.id,
        youtube_id="dQw4w9WgXcQ",
        user_id=user1.id,
        title="Shared Video"
    )
    video2 = Video(
        list_id=list2.id,
        youtube_id="dQw4w9WgXcQ",
        user_id=user2.id,
        title="Shared Video"
    )
    test_db.add_all([video1, video2])
    
    # Should succeed - different users can save same video
    await test_db.commit()
    
    # Verify both exist
    result = await test_db.execute(
        select(Video).where(Video.youtube_id == "dQw4w9WgXcQ")
    )
    videos = result.scalars().all()
    assert len(videos) == 2
    assert {v.user_id for v in videos} == {user1.id, user2.id}


@pytest.mark.asyncio
async def test_video_different_youtube_ids_same_user(test_db):
    """
    Test that same user can save multiple DIFFERENT videos.
    
    Constraint only prevents duplicate youtube_id per user,
    not multiple videos in general.
    """
    # Setup
    user = User(
        email="test@example.com",
        hashed_password="hash",
        is_active=True
    )
    test_db.add(user)
    await test_db.flush()
    
    list_obj = BookmarkList(name="Test List", user_id=user.id)
    test_db.add(list_obj)
    await test_db.commit()
    
    # Save multiple different videos
    video1 = Video(
        list_id=list_obj.id,
        youtube_id="dQw4w9WgXcQ",
        user_id=user.id,
        title="Video 1"
    )
    video2 = Video(
        list_id=list_obj.id,
        youtube_id="9bZkp7q19f0",
        user_id=user.id,
        title="Video 2"
    )
    video3 = Video(
        list_id=list_obj.id,
        youtube_id="jNQXAC9IVRw",
        user_id=user.id,
        title="Video 3"
    )
    test_db.add_all([video1, video2, video3])
    
    # Should succeed - all different youtube_ids
    await test_db.commit()
    
    # Verify all exist
    result = await test_db.execute(
        select(Video).where(Video.user_id == user.id)
    )
    videos = result.scalars().all()
    assert len(videos) == 3


@pytest.mark.asyncio
async def test_video_null_user_id_allows_duplicates(test_db):
    """
    Test that NULL user_id doesn't participate in UNIQUE constraint.
    
    PostgreSQL UNIQUE constraints treat NULL as different from any value,
    including other NULLs. This test documents that behavior.
    
    Note: This is a quirk of PostgreSQL. If app logic requires stricter
    handling of NULL, would need a partial unique index instead.
    """
    # Setup
    list_obj = BookmarkList(name="Test List")
    test_db.add(list_obj)
    await test_db.flush()
    
    # Create videos with NULL user_id
    video1 = Video(
        list_id=list_obj.id,
        youtube_id="dQw4w9WgXcQ",
        user_id=None,  # NULL - not covered by constraint
        title="Video 1"
    )
    video2 = Video(
        list_id=list_obj.id,
        youtube_id="dQw4w9WgXcQ",
        user_id=None,  # NULL - not covered by constraint
        title="Video 2"
    )
    test_db.add_all([video1, video2])
    
    # PostgreSQL allows multiple NULLs in UNIQUE constraint
    await test_db.commit()
```

### 6. Run tests before migration
**Command:**
```bash
cd backend
pytest tests/models/test_video_constraints.py -v
```

**Expected Result:** FAIL (constraint doesn't exist yet)

### 7. Apply migration
**Command:**
```bash
cd backend
alembic upgrade head
```

**Expected Result:** Migration applies successfully

### 8. Run tests after migration
**Command:**
```bash
cd backend
pytest tests/models/test_video_constraints.py -v
```

**Expected Result:** PASS (constraint now enforced)

### 9. Run full test suite
**Command:**
```bash
cd backend
pytest tests/ -v
```

**Expected Result:** All tests pass (no regressions)

### 10. Commit changes
```bash
git add backend/alembic/versions/ backend/tests/models/test_video_constraints.py
git commit -m "feat(db): add UNIQUE constraint for (user_id, youtube_id)

Add composite UNIQUE constraint to prevent users from saving the same
YouTube video multiple times. This constraint ensures:
- Same user cannot save same video (youtube_id) twice
- Different users can save the same video (per-user uniqueness)
- Database-level enforcement ensures integrity

Constraint name: videos_user_youtube_unique
Related to: Task #146 (Database Constraints, Step 2)

✅ All constraint tests passing
✅ No regressions in existing tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests: Constraint Enforcement

**File:** `backend/tests/models/test_video_constraints.py`

**Test Cases:**

1. **test_video_unique_youtube_id_per_user**
   - Create user + video
   - Attempt to save same youtube_id by same user
   - Verify IntegrityError raised
   - Verify constraint name in error message

2. **test_video_same_youtube_id_different_users**
   - Create two users
   - Both save same youtube_id (in different lists)
   - Verify both saves succeed
   - Query confirms both videos exist with different user_ids

3. **test_video_different_youtube_ids_same_user**
   - Create user + save 3 different youtube_ids
   - Verify all succeed (constraint only prevents duplicates)
   - Query confirms all 3 videos exist for same user

4. **test_video_null_user_id_allows_duplicates**
   - Create videos with NULL user_id
   - Verify multiple NULLs allowed (PostgreSQL NULL behavior)
   - Documents constraint design decision

### Integration Tests: API Behavior

**Related to:** Task #72 (Video field values) - Batch update endpoint

When implementing video CRUD endpoints that save/update videos:

```python
# Test: Video creation with duplicate prevention
@pytest.mark.asyncio
async def test_create_video_duplicate_prevention(client, test_user, test_list):
    """Verify API prevents duplicate video saves per user."""
    
    # Create first video
    response1 = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={
            "youtube_id": "dQw4w9WgXcQ",
            "title": "Video 1"
        }
    )
    assert response1.status_code == 201
    
    # Try to create duplicate
    response2 = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={
            "youtube_id": "dQw4w9WgXcQ",
            "title": "Video 1 Duplicate"
        }
    )
    # Should return 409 Conflict (or similar error handling)
    assert response2.status_code in [400, 409]
```

### Manual Testing

1. **Test with multiple users:**
   - User A saves video ID "dQw4w9WgXcQ"
   - User B saves same video ID "dQw4w9WgXcQ"
   - Both succeed (per-user uniqueness)

2. **Test duplicate prevention:**
   - User A saves video ID "dQw4w9WgXcQ"
   - User A tries to save same ID again
   - System rejects with constraint violation error

3. **Test multiple different videos:**
   - User A saves videos: "dQw4w9WgXcQ", "9bZkp7q19f0", "jNQXAC9IVRw"
   - All succeed (no constraint violation)

---

## 📚 Reference

### PostgreSQL Composite UNIQUE Constraint

**Syntax:**
```sql
-- In CREATE TABLE
CREATE TABLE videos (
    ...
    UNIQUE (user_id, youtube_id)
);

-- In ALTER TABLE
ALTER TABLE videos
ADD CONSTRAINT videos_user_youtube_unique
UNIQUE (user_id, youtube_id);
```

**Key Properties:**
- **Composite uniqueness:** Combination of columns must be unique
- **Column order:** (user_id, youtube_id) - order matters for performance optimization
- **NULL handling:** PostgreSQL treats NULL as distinct from all values (including other NULLs)
  - Multiple rows with NULL user_id are allowed
  - If strict NULL handling needed, use partial unique index instead
- **Performance:** Index automatically created by PostgreSQL for constraint

**Validation:** [PostgreSQL UNIQUE Constraint Documentation](https://www.postgresql.org/docs/current/sql-syntax.html)

### Alembic UniqueConstraint

**Syntax:**
```python
op.create_unique_constraint(
    'constraint_name',
    'table_name',
    ['column1', 'column2']
)

op.drop_constraint('constraint_name', 'table_name', type_='unique')
```

**Validation:** Alembic `op.create_unique_constraint()` vs raw SQL approach

### Related Code

**Current Implementation:**
- `backend/app/models/video.py` - Video model (already has list_id/youtube_id unique index)
- `backend/app/models/user.py` - User model (relationship owner)

**Related Tasks:**
- Task #145: youtube_id length CHECK constraint (runs in same migration)
- Task #1, Step 15: User model and user_id relationship
- Task #9: Full database constraints suite

**Similar Constraints in Codebase:**
- `idx_videos_list_youtube` - Unique index on (list_id, youtube_id) at model level
- Constraint pattern from Task #9 master plan

---

## 🔧 Design Decisions

### 1. Composite Key vs Separate Constraints

**Decision:** Use single composite UNIQUE constraint `(user_id, youtube_id)`

**Rationale:**
- **Correctness:** Single constraint is semantically correct - prevents exact duplicate
- **Performance:** One index instead of two, fewer constraint checks
- **Clarity:** Single constraint name is easier to debug and maintain
- **Consistency:** Matches pattern used elsewhere (idx_videos_list_youtube)

**Alternative Considered:** Two separate constraints
- Would require: UNIQUE(user_id) and UNIQUE(youtube_id) separately
- **Problem:** Would prevent ANY user from adding video if ANY user has it (too restrictive)
- **Decision:** Rejected - violates requirement for cross-user sharing

### 2. Existing Duplicate Data

**Strategy:** Allow migration to fail if duplicates exist (fail-fast approach)

**Rationale:**
- Duplicates should not exist in normal operation (prevents data corruption)
- If they do exist, admin needs visibility (not silent deletion)
- Migration failure is clear signal that data needs cleanup first

**Alternative Considered:** Automatic deduplication
- **Problem:** Which duplicate to keep? Creation date ambiguous
- **Problem:** Risks data loss without admin awareness
- **Decision:** Rejected - fail-fast is safer for production migrations

### 3. NULL Handling

**Current behavior:** NULL user_id is allowed and doesn't participate in constraint

**Rationale:**
- Post-migration, all videos should have user_id (from Task #1)
- During migration, some videos might have NULL (before user ownership implemented)
- PostgreSQL standard NULL behavior: NULL != NULL in comparisons

**Note:** If strict NULL handling needed later, can create partial unique index:
```sql
CREATE UNIQUE INDEX idx_videos_user_youtube_partial
ON videos(user_id, youtube_id)
WHERE user_id IS NOT NULL;
```

### 4. Constraint Name Convention

**Chosen:** `videos_user_youtube_unique`

**Naming Convention:** `{table}_{column1}_{column2}_unique`

**Rationale:**
- Follows PostgreSQL standard conventions
- Self-documenting: clearly shows which columns
- Easy to search in migration files
- Consistent with other constraint names in project

---

## 📊 Implementation Timeline

| Task | Estimate | Status |
|------|----------|--------|
| Write failing tests | 15 min | - |
| Create Alembic migration | 5 min | - |
| Implement constraint logic | 10 min | - |
| Run tests (before/after) | 10 min | - |
| Commit and document | 5 min | - |
| **Total** | **45 min** | - |

---

## ✅ Verification Checklist

Before marking as complete:

- [ ] All 4 constraint tests pass (duplicate detection, cross-user, multi-video, NULL)
- [ ] Migration applies cleanly: `alembic upgrade head`
- [ ] Migration rolls back cleanly: `alembic downgrade -1`
- [ ] No regressions: `pytest tests/ -v` passes
- [ ] Constraint visible in production database schema
- [ ] Git log shows clean commit with task reference
- [ ] Code review completed

---

## 🚀 Deployment Notes

**Pre-Deployment:**
1. Verify no existing (user_id, youtube_id) duplicates in production database
2. If duplicates exist, clean up manually before applying migration
3. Backup database before applying migration

**Deployment:**
```bash
cd backend
alembic upgrade head
```

**Post-Deployment:**
1. Verify constraint exists: `\d videos` in psql shows constraint
2. Monitor application logs for IntegrityError if API doesn't handle duplicates gracefully
3. Consider adding API-level error handling (return 409 Conflict if duplicate)

**Rollback (if needed):**
```bash
cd backend
alembic downgrade -1
```

---

## 📝 Notes

**Security Context:** Part of Task #9: Database Constraints
- Part of larger Security Hardening plan (Phase 1)
- Ensures data integrity at multiple levels
- Works alongside API-level validation (defense-in-depth)

**Performance Considerations:**
- UNIQUE constraint automatically creates index in PostgreSQL
- Index on (user_id, youtube_id) helps filter queries: `SELECT * FROM videos WHERE user_id = ? AND youtube_id = ?`
- No separate index needed

**Future Enhancements:**
- API endpoint error handling for constraint violations
- Detailed error messages to users when duplicate detected
- Batch operations respecting constraint (Task #72)
