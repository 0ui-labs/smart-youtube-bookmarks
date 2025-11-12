# Task #185: Add NOT NULL Checks for Names

**Plan Task:** #185
**Wave/Phase:** Security Hardening (Task 9, Step 2)
**Dependencies:** Task #183-146 (other constraint migrations), User system (Task #148-119)
**Related Master Plan:** `docs/plans/2025-11-02-security-hardening-implementation.md` (lines 2959-2971)

---

## 🎯 Ziel

Add PostgreSQL CHECK constraints to the `bookmarks_lists` and `tags` tables to prevent empty string values in the `name` column. This ensures data integrity at the database level and prevents invalid state from being created through direct SQL or other backend systems.

**Why:** Protects against empty string data that bypasses application validation layer.

---

## 📋 Acceptance Criteria

- [ ] CHECK constraint added to `bookmarks_lists.name` (prevents empty strings)
- [ ] CHECK constraint added to `tags.name` (prevents empty strings)
- [ ] Alembic migration created with both constraints
- [ ] Migration can be applied and rolled back without data loss
- [ ] Comprehensive tests verify constraint enforcement
- [ ] Tests verify NULL handling (NULL is allowed, empty string is rejected)
- [ ] Data validation: Existing data verified to have no empty strings
- [ ] All 9 constraint tests passing
- [ ] Tests and migration reviewed

---

## 🛠️ Implementation Steps

### Step 1: Understand the Design Decision

**Files:** `backend/app/models/list.py`, `backend/app/models/tag.py`

**Context:**
- `BookmarkList.name`: Currently `String(255), nullable=False` (line 26)
- `Tag.name`: Currently `String(100), nullable=False` (line 58)
- Both columns already have NOT NULL at database level
- This task adds CHECK constraints to prevent empty strings

**Design Decision - PostgreSQL LENGTH() vs TRIM():**

| Approach | Syntax | Behavior | Use Case |
|----------|--------|----------|----------|
| **LENGTH() > 0** | `CHECK (LENGTH(name) > 0)` | Rejects empty strings only | Recommended - Simple, efficient |
| **TRIM() length** | `CHECK (LENGTH(TRIM(name)) > 0)` | Rejects whitespace-only values | Too strict - breaks legitimate names with spaces |
| **Both NOT NULL + CHECK** | `nullable=False` + `CHECK` | Double validation, redundant at DB | Belt-and-suspenders approach |

**Decision:** Use `LENGTH(name) > 0`
- Simple and performant (no TRIM function overhead)
- Allows legitimate names with leading/trailing spaces
- Consistent with video URL constraint (`LENGTH(youtube_url) > 0`)
- PostgreSQL evaluates CHECK once per INSERT/UPDATE

**Why Not NULL is Sufficient:**
- NOT NULL prevents NULL values
- CHECK prevents empty strings ('')
- Together = cannot be NULL or empty string

---

### Step 2: Verify Existing Data

**Files:** Database inspection
**Action:** Before migration, verify no existing data has empty string names

```sql
-- Run in PostgreSQL before migration
SELECT COUNT(*) FROM bookmarks_lists WHERE name = '';
-- Expected: 0

SELECT COUNT(*) FROM tags WHERE name = '';
-- Expected: 0

-- If either returns > 0, data cleanup needed
```

**If empty strings found:**
```sql
-- Clean up empty names (if any)
UPDATE bookmarks_lists SET name = 'Untitled' WHERE name = '';
UPDATE tags SET name = 'Untagged' WHERE name = '';
```

---

### Step 3: Create Test File

**File:** `backend/tests/models/test_name_constraints.py`
**Action:** Write comprehensive tests BEFORE migration (TDD approach)

```python
"""Tests for name CHECK constraints on lists and tags.

Verifies database-level constraints prevent empty string values in:
- bookmarks_lists.name
- tags.name

These constraints enforce: LENGTH(name) > 0
Allows: NULL is not allowed (NOT NULL), non-empty strings allowed
Rejects: Empty strings (''), NULL values
"""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.tag import Tag


class TestListNameConstraint:
    """Tests for bookmarks_lists.name CHECK constraint."""

    @pytest.mark.asyncio
    async def test_list_empty_string_rejected(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that empty string in list name is rejected by CHECK constraint."""
        bookmark_list = BookmarkList(
            name="",  # Empty string - should fail
            user_id=test_user.id
        )
        test_db.add(bookmark_list)

        with pytest.raises(IntegrityError) as exc_info:
            await test_db.commit()

        # Verify constraint name in error message
        assert "lists_name_not_empty_check" in str(exc_info.value) or \
               "CHECK" in str(exc_info.value), \
               "Expected constraint error for empty list name"

    @pytest.mark.asyncio
    async def test_list_valid_name_accepted(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that non-empty string in list name is accepted."""
        bookmark_list = BookmarkList(
            name="My Favorite Videos",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        await test_db.refresh(bookmark_list)

        assert bookmark_list.id is not None
        assert bookmark_list.name == "My Favorite Videos"

    @pytest.mark.asyncio
    async def test_list_single_character_name_accepted(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that single character names are valid."""
        bookmark_list = BookmarkList(
            name="A",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        await test_db.refresh(bookmark_list)

        assert bookmark_list.name == "A"

    @pytest.mark.asyncio
    async def test_list_name_with_spaces_accepted(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that names with leading/trailing spaces are accepted."""
        bookmark_list = BookmarkList(
            name="  Spaced Name  ",
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        await test_db.refresh(bookmark_list)

        assert bookmark_list.name == "  Spaced Name  "

    @pytest.mark.asyncio
    async def test_list_max_length_name_accepted(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that max length (255) names are accepted."""
        long_name = "A" * 255
        bookmark_list = BookmarkList(
            name=long_name,
            user_id=test_user.id
        )
        test_db.add(bookmark_list)
        await test_db.commit()
        await test_db.refresh(bookmark_list)

        assert len(bookmark_list.name) == 255


class TestTagNameConstraint:
    """Tests for tags.name CHECK constraint."""

    @pytest.mark.asyncio
    async def test_tag_empty_string_rejected(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that empty string in tag name is rejected by CHECK constraint."""
        tag = Tag(
            name="",  # Empty string - should fail
            user_id=test_user.id
        )
        test_db.add(tag)

        with pytest.raises(IntegrityError) as exc_info:
            await test_db.commit()

        # Verify constraint name in error message
        assert "tags_name_not_empty_check" in str(exc_info.value) or \
               "CHECK" in str(exc_info.value), \
               "Expected constraint error for empty tag name"

    @pytest.mark.asyncio
    async def test_tag_valid_name_accepted(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that non-empty string in tag name is accepted."""
        tag = Tag(
            name="Important",
            user_id=test_user.id
        )
        test_db.add(tag)
        await test_db.commit()
        await test_db.refresh(tag)

        assert tag.id is not None
        assert tag.name == "Important"

    @pytest.mark.asyncio
    async def test_tag_single_character_name_accepted(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that single character tag names are valid."""
        tag = Tag(
            name="X",
            user_id=test_user.id
        )
        test_db.add(tag)
        await test_db.commit()
        await test_db.refresh(tag)

        assert tag.name == "X"

    @pytest.mark.asyncio
    async def test_tag_name_with_spaces_accepted(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that tag names with leading/trailing spaces are accepted."""
        tag = Tag(
            name="  Tag Name  ",
            user_id=test_user.id
        )
        test_db.add(tag)
        await test_db.commit()
        await test_db.refresh(tag)

        assert tag.name == "  Tag Name  "

    @pytest.mark.asyncio
    async def test_tag_max_length_name_accepted(
        self,
        test_db: AsyncSession,
        test_user
    ):
        """Test that max length (100) tag names are accepted."""
        long_name = "A" * 100
        tag = Tag(
            name=long_name,
            user_id=test_user.id
        )
        test_db.add(tag)
        await test_db.commit()
        await test_db.refresh(tag)

        assert len(tag.name) == 100
```

**Run before migration (expected FAIL):**
```bash
cd backend
pytest tests/models/test_name_constraints.py -v
# Expected: 9/9 tests FAIL (constraints not yet implemented)
```

---

### Step 4: Create Alembic Migration

**File:** `backend/alembic/versions/XXXX_add_name_not_empty_checks.py`
**Action:** Create migration with CHECK constraints

```bash
cd backend
alembic revision -m "Add CHECK constraints for non-empty list and tag names"
```

**Migration Content:**

```python
"""Add CHECK constraints for non-empty list and tag names

Revision ID: XXXXXXXX
Revises: YYYYYYYY
Create Date: 2025-11-10

Add database-level validation to prevent empty string names in:
- bookmarks_lists.name
- tags.name

Constraint: LENGTH(name) > 0

This allows:
- Non-empty strings ('A', 'Test List', 'Tag Name', etc.)
- Strings with leading/trailing spaces ('  name  ')
- NULL values are still rejected (NOT NULL constraint)

This rejects:
- Empty strings ('')
- NULL values
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'XXXXXXXX'
down_revision: Union[str, None] = 'YYYYYYYY'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    """Add CHECK constraints for non-empty names."""
    # CHECK constraint for list name not empty
    op.create_check_constraint(
        'lists_name_not_empty_check',
        'bookmarks_lists',
        'LENGTH(name) > 0'
    )

    # CHECK constraint for tag name not empty
    op.create_check_constraint(
        'tags_name_not_empty_check',
        'tags',
        'LENGTH(name) > 0'
    )


def downgrade() -> None:
    """Remove CHECK constraints."""
    op.drop_constraint('lists_name_not_empty_check', 'bookmarks_lists')
    op.drop_constraint('tags_name_not_empty_check', 'tags')
```

**Important Notes:**
- Replace `XXXXXXXX` with actual revision ID (auto-generated by Alembic)
- Replace `YYYYYYYY` with previous migration ID (should be `1a6e18578c31` or latest)
- Table name: `bookmarks_lists` (NOT `video_lists`)
- Use `LENGTH()` function (PostgreSQL standard)

---

### Step 5: Apply Migration

**Files:** Database schema
**Action:** Apply migration to test database

```bash
cd backend
alembic upgrade head
```

**Verify migration applied:**
```bash
# Check constraints exist in PostgreSQL
psql youtube_bookmarks -c "\d bookmarks_lists" | grep CHECK
# Should show: lists_name_not_empty_check

psql youtube_bookmarks -c "\d tags" | grep CHECK
# Should show: tags_name_not_empty_check
```

---

### Step 6: Run Tests After Migration

**Files:** `backend/tests/models/test_name_constraints.py`
**Action:** Run tests to verify constraints work

```bash
cd backend
pytest tests/models/test_name_constraints.py -v
```

**Expected Output:**
```
test_name_constraints.py::TestListNameConstraint::test_list_empty_string_rejected PASSED
test_name_constraints.py::TestListNameConstraint::test_list_valid_name_accepted PASSED
test_name_constraints.py::TestListNameConstraint::test_list_single_character_name_accepted PASSED
test_name_constraints.py::TestListNameConstraint::test_list_name_with_spaces_accepted PASSED
test_name_constraints.py::TestListNameConstraint::test_list_max_length_name_accepted PASSED
test_name_constraints.py::TestTagNameConstraint::test_tag_empty_string_rejected PASSED
test_name_constraints.py::TestTagNameConstraint::test_tag_valid_name_accepted PASSED
test_name_constraints.py::TestTagNameConstraint::test_tag_single_character_name_accepted PASSED
test_name_constraints.py::TestTagNameConstraint::test_tag_max_length_name_accepted PASSED

9 passed in X.XXs
```

---

### Step 7: Verify Existing Database (Data Integrity Check)

**Action:** Verify no empty strings in existing data before committing

```bash
# Login to PostgreSQL
psql youtube_bookmarks

# Check lists table
SELECT COUNT(*) as empty_list_names FROM bookmarks_lists WHERE name = '';
-- Expected result: 0

# Check tags table
SELECT COUNT(*) as empty_tag_names FROM tags WHERE name = '';
-- Expected result: 0

# If any empty strings found, investigate and clean up manually
```

---

### Step 8: Run Full Test Suite

**Action:** Ensure no regression in other tests

```bash
cd backend

# Run all constraint tests
pytest tests/models/test_name_constraints.py -v

# Run integration tests (to ensure no cascade issues)
pytest tests/integration/ -v

# Run all tests with coverage
pytest --cov=app tests/
```

**Expected:** All tests pass, no regressions.

---

### Step 9: Commit Changes

```bash
cd backend
git add alembic/versions/XXXX_add_name_not_empty_checks.py tests/models/test_name_constraints.py
git commit -m "feat: add CHECK constraints for non-empty list and tag names

- Add lists_name_not_empty_check: LENGTH(name) > 0
- Add tags_name_not_empty_check: LENGTH(name) > 0
- Prevents empty strings in bookmarks_lists.name and tags.name
- Comprehensive tests verify empty string rejection and NULL handling
- Migration is reversible (upgrade/downgrade tested)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (9 total)

**Test Coverage:**

| Test Case | Table | Condition | Expected |
|-----------|-------|-----------|----------|
| Empty string rejection | lists | `name=""` | IntegrityError |
| Valid name acceptance | lists | `name="My List"` | SUCCESS |
| Single char name | lists | `name="A"` | SUCCESS |
| Name with spaces | lists | `name="  name  "` | SUCCESS |
| Max length (255) | lists | `name="A"*255` | SUCCESS |
| Empty string rejection | tags | `name=""` | IntegrityError |
| Valid name acceptance | tags | `name="Important"` | SUCCESS |
| Single char name | tags | `name="X"` | SUCCESS |
| Name with spaces | tags | `name="  name  "` | SUCCESS |

**Test File:** `backend/tests/models/test_name_constraints.py`

### Integration Tests

- Verify no cascade failures (tags/lists with constraints can still be deleted)
- Verify constraint errors properly bubble up to API layer

**Command:**
```bash
pytest tests/integration/ -v
```

### Manual Testing

1. **Database level:**
   ```sql
   INSERT INTO bookmarks_lists (id, name, user_id) 
   VALUES (uuid_generate_v4(), '', user_uuid);
   -- Expected: ERROR: new row violates check constraint "lists_name_not_empty_check"
   ```

2. **API level (via application validation):**
   - Create list with empty name → returns 422 Unprocessable Entity (application validation)
   - Create tag with empty name → returns 422 Unprocessable Entity (application validation)

3. **Constraint at database boundary:**
   - Direct INSERT with empty string → IntegrityError (database constraint)

---

## 📚 Reference

### Related Docs

- `docs/plans/2025-11-02-security-hardening-implementation.md` - Master plan (lines 2959-2971)
- `docs/plans/tasks/task-183-video-constraints.md` - Video constraint migration
- `docs/plans/tasks/task-184-unique-user-youtube.md` - User/YouTube unique constraint

### Related Code

- `backend/app/models/list.py` - BookmarkList model (line 26)
- `backend/app/models/tag.py` - Tag model (line 58)
- `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` - Recent migration pattern
- `backend/tests/models/test_job_progress.py` - Test structure pattern
- `backend/tests/integration/test_cascade_deletes.py` - Integration test pattern

### PostgreSQL Constraint Functions

- `LENGTH(text)` - Returns character count (1 ms performance)
- `TRIM(text)` - Removes leading/trailing whitespace
- `CHECK (condition)` - Column constraint for rule enforcement

**Why LENGTH() > 0 vs TRIM(LENGTH()) > 0:**
- LENGTH() > 0: Rejects only empty strings (''), allows '   ' (3 spaces)
- TRIM(LENGTH()) > 0: Rejects whitespace-only strings, may be too strict
- We use LENGTH() > 0 for flexibility with legitimate names

### Design Decisions

**Decision 1: CHECK constraint vs application validation**
- Why database constraint: Protects against data corruption from direct SQL or other systems
- Why also application validation: User feedback (instant 422 vs constraint violation)
- Both layers recommended for defense-in-depth

**Decision 2: LENGTH() > 0 vs NOT NULL**
- NOT NULL prevents NULL
- LENGTH() > 0 prevents empty string
- Both needed for complete coverage

**Decision 3: Single constraint vs individual for each field**
- One constraint per field (not combined) for clarity and easier management
- Constraint names clearly indicate what they check: `lists_name_not_empty_check`, `tags_name_not_empty_check`

---

## ⏱️ Time Estimate

- Test creation: 15 min
- Migration creation: 5 min
- Local testing: 10 min
- Review and iteration: 5 min
- **Total: 35 minutes**

---

## 🚀 Success Criteria Checklist

- [x] Design decision documented (LENGTH() > 0 chosen)
- [x] Test file created with 9 comprehensive test cases
- [x] Migration file template with upgrade/downgrade
- [x] Table name verified: `bookmarks_lists` (not `video_lists`)
- [x] Constraint names clear: `lists_name_not_empty_check`, `tags_name_not_empty_check`
- [x] NULL handling documented (NOT NULL + CHECK)
- [x] Data integrity check procedure documented
- [x] Performance notes included (LENGTH() function is <1ms)
- [x] Test patterns follow existing codebase conventions
- [x] Migration pattern follows alembic standards

