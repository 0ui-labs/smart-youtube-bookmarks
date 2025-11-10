# Task #144: Create Alembic Migration for Database Constraints

**Plan Task:** #144
**Wave/Phase:** Security Hardening P2 - Operational Excellence (Task #9: Database Constraints)
**Dependencies:** Task #143 (User Ownership Models) - requires user_id column on videos table

---

## 🎯 Ziel

Create Alembic migration adding database-level constraints for data integrity and security. Constraints enforce YouTube ID format validation (11 alphanumeric characters), prevent duplicate video saves per user, and ensure non-empty names for critical entities. This provides defense-in-depth by complementing application-level validation with database-enforced rules that cannot be bypassed.

**Security Benefits:**
- **Data Integrity:** Invalid YouTube IDs rejected at database level
- **Duplicate Prevention:** Users cannot accidentally save same video twice
- **Attack Surface Reduction:** Malformed data cannot enter system even if application validation bypassed
- **Performance:** Constraints checked by PostgreSQL engine (faster than application code)

---

## 📋 Acceptance Criteria

- [ ] Alembic migration file created with descriptive name following naming convention
- [ ] CHECK constraint: `youtube_id` exactly 11 characters (`LENGTH(youtube_id) = 11`)
- [ ] CHECK constraint: `youtube_id` format matches `^[a-zA-Z0-9_-]{11}$` (alphanumeric, dash, underscore)
- [ ] CHECK constraint: `youtube_url` not empty (`LENGTH(youtube_url) > 0`)
- [ ] UNIQUE constraint: `(user_id, youtube_id)` prevents duplicate video saves per user
- [ ] CHECK constraint: `video_lists.name` not empty (`LENGTH(name) > 0`)
- [ ] CHECK constraint: `tags.name` not empty (`LENGTH(name) > 0`)
- [ ] Migration upgrade function complete and tested
- [ ] Migration downgrade function complete and tested
- [ ] Migration idempotency verified (can run upgrade twice safely)
- [ ] Unit tests (8+): Each constraint violation scenario + valid data scenarios
- [ ] Integration test: Full constraint enforcement with real database
- [ ] Manual testing completed with checklist (10 scenarios)
- [ ] CLAUDE.md updated with migration documentation

---

## 🛠️ Implementation Steps

### Step 1: Create Test File with Failing Constraint Tests (TDD)

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/models/test_video_constraints.py`

**Action:** Write comprehensive test suite for all 6 database constraints BEFORE implementing migration. Tests will fail initially (TDD red phase), then pass after migration applied (green phase).

**Code:**

```python
"""Tests for database-level constraints on videos, lists, and tags.

This test suite verifies that PostgreSQL CHECK and UNIQUE constraints
are properly enforced at the database level, providing defense-in-depth
beyond application-level validation.

Test Categories:
    1. YouTube ID Length Constraint (11 characters exactly)
    2. YouTube ID Format Constraint (alphanumeric + dash/underscore)
    3. YouTube URL Not Empty Constraint
    4. Unique (user_id, youtube_id) Constraint
    5. List Name Not Empty Constraint
    6. Tag Name Not Empty Constraint
"""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.video import Video
from app.models.list import BookmarkList
from app.models.tag import Tag
from app.models.user import User


# ==================== YouTube ID Length Constraint ====================

@pytest.mark.asyncio
async def test_video_youtube_id_too_short_fails(test_db, test_list):
    """Test that youtube_id shorter than 11 characters is rejected."""
    video = Video(
        list_id=test_list.id,
        youtube_url="https://youtube.com/watch?v=short",
        youtube_id="short",  # Only 5 chars - should fail
        processing_status="pending"
    )
    test_db.add(video)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    # Verify it's the length constraint that failed
    assert "videos_youtube_id_length_check" in str(exc_info.value)


@pytest.mark.asyncio
async def test_video_youtube_id_too_long_fails(test_db, test_list):
    """Test that youtube_id longer than 11 characters is rejected."""
    video = Video(
        list_id=test_list.id,
        youtube_url="https://youtube.com/watch?v=toolongvideoidentifier",
        youtube_id="toolongvideoidentifier",  # 24 chars - should fail
        processing_status="pending"
    )
    test_db.add(video)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    assert "videos_youtube_id_length_check" in str(exc_info.value)


@pytest.mark.asyncio
async def test_video_youtube_id_empty_fails(test_db, test_list):
    """Test that empty youtube_id is rejected by length constraint."""
    video = Video(
        list_id=test_list.id,
        youtube_url="https://youtube.com/watch",
        youtube_id="",  # Empty - should fail
        processing_status="pending"
    )
    test_db.add(video)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    assert "videos_youtube_id_length_check" in str(exc_info.value)


# ==================== YouTube ID Format Constraint ====================

@pytest.mark.asyncio
async def test_video_youtube_id_invalid_characters_fails(test_db, test_list):
    """Test that youtube_id with invalid characters is rejected."""
    video = Video(
        list_id=test_list.id,
        youtube_url="https://youtube.com/watch?v=invalid@id",
        youtube_id="invalid@id!",  # Contains @ and ! - should fail
        processing_status="pending"
    )
    test_db.add(video)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    # Could fail on either length or format, but should fail
    assert "videos_youtube_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_video_youtube_id_with_spaces_fails(test_db, test_list):
    """Test that youtube_id with spaces is rejected."""
    video = Video(
        list_id=test_list.id,
        youtube_url="https://youtube.com/watch?v=dQw4w 9WgXc",
        youtube_id="dQw4w 9WgXc",  # Contains space - should fail
        processing_status="pending"
    )
    test_db.add(video)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    assert "videos_youtube_id_format_check" in str(exc_info.value)


@pytest.mark.asyncio
async def test_video_youtube_id_valid_format_succeeds(test_db, test_list):
    """Test that valid youtube_id formats are accepted."""
    # Test valid IDs: alphanumeric, dash, underscore
    valid_ids = [
        "dQw4w9WgXcQ",  # Standard alphanumeric
        "abc-DEF_123",  # Mix with dash and underscore
        "___________",  # All underscores
        "-----------",  # All dashes
        "00000000000",  # All numbers
    ]

    for youtube_id in valid_ids:
        video = Video(
            list_id=test_list.id,
            youtube_url=f"https://youtube.com/watch?v={youtube_id}",
            youtube_id=youtube_id,
            processing_status="pending"
        )
        test_db.add(video)
        await test_db.commit()
        await test_db.refresh(video)
        
        # Cleanup for next iteration
        await test_db.delete(video)
        await test_db.commit()


# ==================== YouTube URL Not Empty Constraint ====================

@pytest.mark.asyncio
async def test_video_youtube_url_empty_fails(test_db, test_list):
    """Test that empty youtube_url is rejected."""
    video = Video(
        list_id=test_list.id,
        youtube_url="",  # Empty - should fail
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending"
    )
    test_db.add(video)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    assert "videos_youtube_url_not_empty_check" in str(exc_info.value)


# ==================== Unique (user_id, youtube_id) Constraint ====================

@pytest.mark.asyncio
async def test_video_duplicate_youtube_id_per_user_fails(test_db, test_user):
    """Test that user cannot save same video twice."""
    # Create first video
    list1 = BookmarkList(
        name="List 1",
        user_id=test_user.id
    )
    test_db.add(list1)
    await test_db.commit()
    await test_db.refresh(list1)

    video1 = Video(
        list_id=list1.id,
        youtube_url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending"
    )
    test_db.add(video1)
    await test_db.commit()

    # Try to create duplicate in different list (same user)
    list2 = BookmarkList(
        name="List 2",
        user_id=test_user.id
    )
    test_db.add(list2)
    await test_db.commit()
    await test_db.refresh(list2)

    video2 = Video(
        list_id=list2.id,
        youtube_url="https://youtu.be/dQw4w9WgXcQ",  # Different URL format
        youtube_id="dQw4w9WgXcQ",  # Same ID - should fail
        processing_status="pending"
    )
    test_db.add(video2)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    assert "videos_user_youtube_unique" in str(exc_info.value)


@pytest.mark.asyncio
async def test_video_duplicate_youtube_id_different_users_succeeds(test_db, user_factory):
    """Test that different users CAN save the same video."""
    # Create two users
    user1 = await user_factory("user1")
    user2 = await user_factory("user2")

    # User 1 saves video
    list1 = BookmarkList(name="User 1 List", user_id=user1.id)
    test_db.add(list1)
    await test_db.commit()
    await test_db.refresh(list1)

    video1 = Video(
        list_id=list1.id,
        youtube_url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending"
    )
    test_db.add(video1)
    await test_db.commit()

    # User 2 saves SAME video - should succeed
    list2 = BookmarkList(name="User 2 List", user_id=user2.id)
    test_db.add(list2)
    await test_db.commit()
    await test_db.refresh(list2)

    video2 = Video(
        list_id=list2.id,
        youtube_url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_id="dQw4w9WgXcQ",  # Same ID, different user - should succeed
        processing_status="pending"
    )
    test_db.add(video2)
    await test_db.commit()  # Should NOT raise


# ==================== List Name Not Empty Constraint ====================

@pytest.mark.asyncio
async def test_list_empty_name_fails(test_db, test_user):
    """Test that bookmark list with empty name is rejected."""
    bookmark_list = BookmarkList(
        name="",  # Empty - should fail
        user_id=test_user.id
    )
    test_db.add(bookmark_list)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    assert "lists_name_not_empty_check" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_whitespace_only_name_fails(test_db, test_user):
    """Test that list with whitespace-only name is rejected.
    
    Note: This test may PASS because LENGTH('   ') = 3, which is > 0.
    If we want to prevent whitespace-only names, we need additional
    application-level validation with TRIM() check.
    """
    bookmark_list = BookmarkList(
        name="   ",  # Whitespace only
        user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()  # Will succeed - LENGTH('   ') > 0
    
    # This test documents current behavior, not expected failure


# ==================== Tag Name Not Empty Constraint ====================

@pytest.mark.asyncio
async def test_tag_empty_name_fails(test_db, test_user):
    """Test that tag with empty name is rejected."""
    tag = Tag(
        name="",  # Empty - should fail
        user_id=test_user.id
    )
    test_db.add(tag)

    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    
    assert "tags_name_not_empty_check" in str(exc_info.value)


# ==================== Integration Test: All Constraints ====================

@pytest.mark.asyncio
async def test_all_constraints_enforced_integration(test_db, test_user):
    """Integration test verifying all constraints work together."""
    # Valid list
    valid_list = BookmarkList(
        name="Valid List",
        user_id=test_user.id
    )
    test_db.add(valid_list)
    await test_db.commit()
    await test_db.refresh(valid_list)

    # Valid video
    valid_video = Video(
        list_id=valid_list.id,
        youtube_url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending"
    )
    test_db.add(valid_video)
    await test_db.commit()
    await test_db.refresh(valid_video)

    # Valid tag
    valid_tag = Tag(
        name="Valid Tag",
        user_id=test_user.id
    )
    test_db.add(valid_tag)
    await test_db.commit()

    # All should succeed
    assert valid_list.id is not None
    assert valid_video.id is not None
    assert valid_tag.id is not None
```

**Why:** TDD approach ensures migration actually works. Writing tests first forces us to think about edge cases and constraint behavior before implementation. Tests serve as living documentation of constraint behavior.

**Run:** `cd backend && pytest tests/models/test_video_constraints.py -v`

**Expected:** ALL TESTS FAIL (constraints not yet implemented)

---

### Step 2: Generate Alembic Migration Skeleton

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Create new Alembic migration file using descriptive name following project naming convention (lowercase with underscores).

**Code:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
alembic revision -m "add database constraints for data integrity"
```

**Why:** Alembic auto-generates revision ID and sets up migration structure. Manual revision (not autogenerate) because Alembic doesn't detect CHECK constraints from models.

**Expected Output:** Creates file like `XXXX_add_database_constraints_for_data_integrity.py` where XXXX is generated revision ID.

---

### Step 3: Implement CHECK Constraint - YouTube ID Length

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Add CHECK constraint enforcing youtube_id must be exactly 11 characters. This is YouTube's standard video ID length.

**Code:** (Add to upgrade() function)

```python
def upgrade() -> None:
    """Add database constraints for data integrity and security."""
    
    # Constraint 1: YouTube ID must be exactly 11 characters
    # YouTube video IDs are always 11 characters (base64-like encoding)
    # Example: "dQw4w9WgXcQ" (Rick Astley - Never Gonna Give You Up)
    op.create_check_constraint(
        'videos_youtube_id_length_check',
        'videos',
        'LENGTH(youtube_id) = 11'
    )
```

**Why:** 
- **Security:** Prevents malformed IDs from entering system
- **Data Quality:** YouTube IDs are ALWAYS 11 characters (documented standard)
- **Performance:** Simple length check is extremely fast (no regex parsing)
- **Defense-in-depth:** Complements application validation with database enforcement

**REF:** PostgreSQL `LENGTH()` function returns character count. This is faster than regex for simple length validation (REF MCP: "Simple length checks using char_length() have minimal overhead - just a few extra CPU cycles").

---

### Step 4: Implement CHECK Constraint - YouTube ID Format

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Add CHECK constraint enforcing youtube_id format must match alphanumeric + dash/underscore pattern using PostgreSQL regex operator.

**Code:** (Add to upgrade() function)

```python
    # Constraint 2: YouTube ID format must be alphanumeric + dash/underscore
    # Pattern: [a-zA-Z0-9_-]{11}
    # Valid examples: "dQw4w9WgXcQ", "abc-DEF_123"
    # Invalid examples: "invalid@id!", "has spaces"
    op.create_check_constraint(
        'videos_youtube_id_format_check',
        'videos',
        "youtube_id ~ '^[a-zA-Z0-9_-]{11}$'"
    )
```

**Why:**
- **Security:** Prevents SQL injection attempts via malformed IDs
- **Data Integrity:** Ensures only valid YouTube ID characters are stored
- **Compatibility:** YouTube uses base64url-like encoding (A-Z, a-z, 0-9, dash, underscore)
- **Regex Performance:** Pattern is anchored (^ and $) and simple - minimal performance impact

**REF:** 
- PostgreSQL regex operator `~` for case-sensitive matching (REF MCP: "Use anchored patterns with ^ and $ to ensure exact matches")
- Performance consideration: Regex constraints "can slow down write operations significantly" but this pattern is simple enough to have minimal impact (REF MCP performance findings)

---

### Step 5: Implement CHECK Constraint - YouTube URL Not Empty

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Add CHECK constraint preventing empty youtube_url strings. URL is required for video playback and external links.

**Code:** (Add to upgrade() function)

```python
    # Constraint 3: YouTube URL cannot be empty
    # The URL is required for playback and linking to original video
    # We allow any non-empty string (format validation handled by application)
    op.create_check_constraint(
        'videos_youtube_url_not_empty_check',
        'videos',
        'LENGTH(youtube_url) > 0'
    )
```

**Why:**
- **Functional Requirement:** Video URLs are required for playback functionality
- **User Experience:** Empty URLs would break "Watch on YouTube" links
- **Simplicity:** We only check non-empty (not URL format) because URLs have many valid formats (youtube.com/watch?v=, youtu.be/, m.youtube.com/, etc.)
- **Performance:** Length check is extremely fast

**Design Decision:** We don't validate URL format at database level because:
1. YouTube URL formats vary (multiple valid domains and paths)
2. Regex for full URL validation would be complex and slow
3. Application-level validation can handle format checking with better error messages

---

### Step 6: Implement UNIQUE Constraint - User + YouTube ID

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Add composite UNIQUE constraint on (user_id, youtube_id) to prevent duplicate video saves per user. Note: This REPLACES existing `idx_videos_list_youtube` unique index.

**Code:** (Add to upgrade() function)

```python
    # Constraint 4: User cannot save same video twice (across all lists)
    # Composite UNIQUE on (user_id, youtube_id)
    # Allows: Different users saving same video
    # Prevents: Same user saving video in multiple lists
    
    # First, drop the OLD unique index on (list_id, youtube_id)
    # This was too restrictive - users should be able to save same video only once total
    op.drop_index('idx_videos_list_youtube', table_name='videos')
    
    # Create NEW unique constraint on (user_id, youtube_id)
    op.create_unique_constraint(
        'videos_user_youtube_unique',
        'videos',
        ['user_id', 'youtube_id']
    )
```

**Why:**
- **User Experience:** Prevents accidental duplicate saves
- **Data Integrity:** One video = one bookmark per user (regardless of which list)
- **Storage Efficiency:** Prevents duplicate metadata storage
- **Security:** Prevents duplicate-based attacks or data pollution

**Design Decision - Scope Change:**
- **OLD behavior:** User could save same video in multiple lists (unique per list)
- **NEW behavior:** User can save each video only ONCE total (unique per user)
- **Rationale:** This matches typical bookmark manager behavior - you bookmark a URL once, then organize with tags/lists

**Migration Safety:** Dropping old index is safe because we're replacing it with a constraint that serves similar purpose (uniqueness enforcement).

---

### Step 7: Implement CHECK Constraint - List Name Not Empty

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Add CHECK constraint preventing empty bookmark list names. Lists are core organizational unit and must have identifiable names.

**Code:** (Add to upgrade() function)

```python
    # Constraint 5: Bookmark list name cannot be empty
    # Lists are primary organizational unit - they must have names
    op.create_check_constraint(
        'lists_name_not_empty_check',
        'bookmarks_lists',
        'LENGTH(name) > 0'
    )
```

**Why:**
- **User Experience:** Empty list names would be confusing in UI
- **Data Integrity:** Lists without names violate core business logic
- **Accessibility:** Screen readers and assistive tech need non-empty labels

**Note:** This constraint allows whitespace-only names (e.g., "   ") because `LENGTH('   ') = 3`. Application-level validation should use `TRIM()` to catch this edge case.

---

### Step 8: Implement CHECK Constraint - Tag Name Not Empty

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Add CHECK constraint preventing empty tag names. Tags are used for filtering and organization - empty names would be meaningless.

**Code:** (Add to upgrade() function)

```python
    # Constraint 6: Tag name cannot be empty
    # Tags are used for filtering and organization - they must have names
    op.create_check_constraint(
        'tags_name_not_empty_check',
        'tags',
        'LENGTH(name) > 0'
    )
```

**Why:**
- **User Experience:** Empty tags would appear as blank chips in UI
- **Filtering Logic:** Tag filters require identifiable tag names
- **Data Quality:** Unnamed tags have no semantic meaning

---

### Step 9: Implement Downgrade Function

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Implement downgrade() function to cleanly remove all constraints in reverse order. Critical for migration rollback capability.

**Code:**

```python
def downgrade() -> None:
    """Remove database constraints."""
    
    # Remove constraints in REVERSE order
    # Order matters to avoid foreign key conflicts
    
    # Remove tag constraint
    op.drop_constraint('tags_name_not_empty_check', 'tags', type_='check')
    
    # Remove list constraint
    op.drop_constraint('lists_name_not_empty_check', 'bookmarks_lists', type_='check')
    
    # Remove video unique constraint and restore old index
    op.drop_constraint('videos_user_youtube_unique', 'videos', type_='unique')
    
    # Restore the OLD unique index on (list_id, youtube_id)
    # This ensures clean rollback to previous behavior
    op.create_index(
        'idx_videos_list_youtube',
        'videos',
        ['list_id', 'youtube_id'],
        unique=True
    )
    
    # Remove video CHECK constraints
    op.drop_constraint('videos_youtube_url_not_empty_check', 'videos', type_='check')
    op.drop_constraint('videos_youtube_id_format_check', 'videos', type_='check')
    op.drop_constraint('videos_youtube_id_length_check', 'videos', type_='check')
```

**Why:**
- **Rollback Safety:** Enables clean migration rollback if issues discovered
- **Order Matters:** Dropping constraints before recreating old index prevents conflicts
- **Complete Restoration:** Recreates old unique index to restore exact previous behavior
- **Testing:** Downgrade should be tested to ensure it actually works

**REF:** Following pattern from existing migration `1a6e18578c31_add_custom_fields_system.py` which implements thorough downgrade in reverse order.

---

### Step 10: Complete Migration File with Metadata

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/alembic/versions/XXXX_add_database_constraints.py`

**Action:** Complete migration file with proper imports, docstring, and revision metadata. This is the final migration file.

**Code:** (COMPLETE FILE)

```python
"""add database constraints for data integrity

Revision ID: [generated_by_alembic]
Revises: [previous_revision]
Create Date: 2025-11-10

This migration adds database-level constraints for data integrity and security:
    1. CHECK constraint: youtube_id must be exactly 11 characters
    2. CHECK constraint: youtube_id must match format [a-zA-Z0-9_-]{11}
    3. CHECK constraint: youtube_url cannot be empty
    4. UNIQUE constraint: (user_id, youtube_id) prevents duplicate saves per user
    5. CHECK constraint: list names cannot be empty
    6. CHECK constraint: tag names cannot be empty

Security Benefits:
    - Prevents malformed YouTube IDs from entering system
    - Blocks SQL injection attempts via video IDs
    - Prevents duplicate video saves (storage efficiency)
    - Enforces non-empty names for critical entities

Migration Safety:
    - Replaces old (list_id, youtube_id) unique index with (user_id, youtube_id)
    - Downgrade function restores previous behavior completely
    - All constraints are backward-compatible with valid existing data
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '[generated_by_alembic]'
down_revision: Union[str, None] = '[previous_revision]'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add database constraints for data integrity and security."""
    
    # Constraint 1: YouTube ID must be exactly 11 characters
    # YouTube video IDs are always 11 characters (base64-like encoding)
    # Example: "dQw4w9WgXcQ" (Rick Astley - Never Gonna Give You Up)
    op.create_check_constraint(
        'videos_youtube_id_length_check',
        'videos',
        'LENGTH(youtube_id) = 11'
    )
    
    # Constraint 2: YouTube ID format must be alphanumeric + dash/underscore
    # Pattern: [a-zA-Z0-9_-]{11}
    # Valid examples: "dQw4w9WgXcQ", "abc-DEF_123"
    # Invalid examples: "invalid@id!", "has spaces"
    op.create_check_constraint(
        'videos_youtube_id_format_check',
        'videos',
        "youtube_id ~ '^[a-zA-Z0-9_-]{11}$'"
    )
    
    # Constraint 3: YouTube URL cannot be empty
    # The URL is required for playback and linking to original video
    # We allow any non-empty string (format validation handled by application)
    op.create_check_constraint(
        'videos_youtube_url_not_empty_check',
        'videos',
        'LENGTH(youtube_url) > 0'
    )
    
    # Constraint 4: User cannot save same video twice (across all lists)
    # Composite UNIQUE on (user_id, youtube_id)
    # Allows: Different users saving same video
    # Prevents: Same user saving video in multiple lists
    
    # First, drop the OLD unique index on (list_id, youtube_id)
    # This was too restrictive - users should be able to save same video only once total
    op.drop_index('idx_videos_list_youtube', table_name='videos')
    
    # Create NEW unique constraint on (user_id, youtube_id)
    op.create_unique_constraint(
        'videos_user_youtube_unique',
        'videos',
        ['user_id', 'youtube_id']
    )
    
    # Constraint 5: Bookmark list name cannot be empty
    # Lists are primary organizational unit - they must have names
    op.create_check_constraint(
        'lists_name_not_empty_check',
        'bookmarks_lists',
        'LENGTH(name) > 0'
    )
    
    # Constraint 6: Tag name cannot be empty
    # Tags are used for filtering and organization - they must have names
    op.create_check_constraint(
        'tags_name_not_empty_check',
        'tags',
        'LENGTH(name) > 0'
    )


def downgrade() -> None:
    """Remove database constraints."""
    
    # Remove constraints in REVERSE order
    # Order matters to avoid foreign key conflicts
    
    # Remove tag constraint
    op.drop_constraint('tags_name_not_empty_check', 'tags', type_='check')
    
    # Remove list constraint
    op.drop_constraint('lists_name_not_empty_check', 'bookmarks_lists', type_='check')
    
    # Remove video unique constraint and restore old index
    op.drop_constraint('videos_user_youtube_unique', 'videos', type_='unique')
    
    # Restore the OLD unique index on (list_id, youtube_id)
    # This ensures clean rollback to previous behavior
    op.create_index(
        'idx_videos_list_youtube',
        'videos',
        ['list_id', 'youtube_id'],
        unique=True
    )
    
    # Remove video CHECK constraints
    op.drop_constraint('videos_youtube_url_not_empty_check', 'videos', type_='check')
    op.drop_constraint('videos_youtube_id_format_check', 'videos', type_='check')
    op.drop_constraint('videos_youtube_id_length_check', 'videos', type_='check')
```

**Why:** Comprehensive docstring documents intent, benefits, and safety considerations. Future developers will understand what constraints do and why they exist.

---

### Step 11: Apply Migration (Upgrade)

**Files:** N/A (database operation)

**Action:** Run Alembic upgrade to apply migration to test database. Verify no errors.

**Code:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
alembic upgrade head
```

**Why:** Applying migration creates constraints in database. Should succeed on clean database with no existing data violations.

**Expected Output:**

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade [prev_revision] -> [new_revision], add database constraints for data integrity
```

**Troubleshooting:** If migration fails, likely causes:
1. Existing data violates constraints (check test database for invalid data)
2. Missing user_id column on videos table (verify Task #143 completed first)
3. Syntax error in constraint definition (review migration file)

---

### Step 12: Test Downgrade Migration

**Files:** N/A (database operation)

**Action:** Test that downgrade works correctly by rolling back one migration, then re-applying.

**Code:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend

# Rollback one migration
alembic downgrade -1

# Verify rollback succeeded
alembic current

# Re-apply migration
alembic upgrade head

# Verify upgrade succeeded
alembic current
```

**Why:** 
- **Rollback Safety:** Ensures we can revert migration if issues discovered in production
- **Index Restoration:** Verifies old unique index is properly restored
- **Confidence:** Proves migration is reversible without data loss

**Expected Behavior:**
- Downgrade should drop all 6 constraints
- Downgrade should recreate old `idx_videos_list_youtube` index
- Upgrade should drop old index and create new constraints
- No errors or warnings

---

### Step 13: Run Constraint Tests (Green Phase)

**Files:** N/A (test execution)

**Action:** Run test suite created in Step 1. All tests should now PASS because constraints are enforced at database level.

**Code:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
pytest tests/models/test_video_constraints.py -v
```

**Why:** This is the "green phase" of TDD. Tests that failed in Step 1 should now pass, proving constraints work as expected.

**Expected Output:**

```
tests/models/test_video_constraints.py::test_video_youtube_id_too_short_fails PASSED
tests/models/test_video_constraints.py::test_video_youtube_id_too_long_fails PASSED
tests/models/test_video_constraints.py::test_video_youtube_id_empty_fails PASSED
tests/models/test_video_constraints.py::test_video_youtube_id_invalid_characters_fails PASSED
tests/models/test_video_constraints.py::test_video_youtube_id_with_spaces_fails PASSED
tests/models/test_video_constraints.py::test_video_youtube_id_valid_format_succeeds PASSED
tests/models/test_video_constraints.py::test_video_youtube_url_empty_fails PASSED
tests/models/test_video_constraints.py::test_video_duplicate_youtube_id_per_user_fails PASSED
tests/models/test_video_constraints.py::test_video_duplicate_youtube_id_different_users_succeeds PASSED
tests/models/test_video_constraints.py::test_list_empty_name_fails PASSED
tests/models/test_video_constraints.py::test_tag_empty_name_fails PASSED
tests/models/test_video_constraints.py::test_all_constraints_enforced_integration PASSED

============ 12 passed in 2.5s ============
```

**If Tests Fail:** Debug by:
1. Check migration actually ran: `alembic current`
2. Inspect database constraints: `\d videos` in psql
3. Review test error messages for clues
4. Verify test database is using migrated schema

---

### Step 14: Manual Constraint Violation Testing

**Files:** N/A (manual database testing)

**Action:** Manually test each constraint by attempting to insert invalid data via psql. Verify constraint violations are caught with clear error messages.

**Testing Checklist:**

```sql
-- Connect to test database
psql youtube_bookmarks_test

-- Test 1: YouTube ID too short (should fail)
INSERT INTO videos (id, list_id, youtube_id, youtube_url, processing_status)
VALUES (gen_random_uuid(), '[valid_list_id]', 'short', 'https://youtube.com', 'pending');
-- Expected: ERROR:  check constraint "videos_youtube_id_length_check" violated

-- Test 2: YouTube ID too long (should fail)
INSERT INTO videos (id, list_id, youtube_id, youtube_url, processing_status)
VALUES (gen_random_uuid(), '[valid_list_id]', 'waytooooolong', 'https://youtube.com', 'pending');
-- Expected: ERROR:  check constraint "videos_youtube_id_length_check" violated

-- Test 3: YouTube ID invalid characters (should fail)
INSERT INTO videos (id, list_id, youtube_id, youtube_url, processing_status)
VALUES (gen_random_uuid(), '[valid_list_id]', 'invalid@id!', 'https://youtube.com', 'pending');
-- Expected: ERROR:  check constraint "videos_youtube_id_format_check" violated

-- Test 4: Empty youtube_url (should fail)
INSERT INTO videos (id, list_id, youtube_id, youtube_url, processing_status)
VALUES (gen_random_uuid(), '[valid_list_id]', 'dQw4w9WgXcQ', '', 'pending');
-- Expected: ERROR:  check constraint "videos_youtube_url_not_empty_check" violated

-- Test 5: Valid video (should succeed)
INSERT INTO videos (id, list_id, youtube_id, youtube_url, processing_status)
VALUES (gen_random_uuid(), '[valid_list_id]', 'dQw4w9WgXcQ', 'https://youtube.com/watch?v=dQw4w9WgXcQ', 'pending');
-- Expected: INSERT 0 1

-- Test 6: Duplicate youtube_id for same user (should fail)
INSERT INTO videos (id, list_id, youtube_id, youtube_url, processing_status)
VALUES (gen_random_uuid(), '[another_list_same_user]', 'dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'pending');
-- Expected: ERROR:  duplicate key value violates unique constraint "videos_user_youtube_unique"

-- Test 7: Empty list name (should fail)
INSERT INTO bookmarks_lists (id, name, user_id)
VALUES (gen_random_uuid(), '', '[valid_user_id]');
-- Expected: ERROR:  check constraint "lists_name_not_empty_check" violated

-- Test 8: Empty tag name (should fail)
INSERT INTO tags (id, name, user_id)
VALUES (gen_random_uuid(), '', '[valid_user_id]');
-- Expected: ERROR:  check constraint "tags_name_not_empty_check" violated

-- Test 9: Valid list (should succeed)
INSERT INTO bookmarks_lists (id, name, user_id)
VALUES (gen_random_uuid(), 'Valid List', '[valid_user_id]');
-- Expected: INSERT 0 1

-- Test 10: Valid tag (should succeed)
INSERT INTO tags (id, name, user_id)
VALUES (gen_random_uuid(), 'Valid Tag', '[valid_user_id]');
-- Expected: INSERT 0 1
```

**Why:** Manual testing verifies constraints work at raw SQL level, independent of application code. Ensures database-level enforcement cannot be bypassed.

---

### Step 15: Test Idempotency (Run Upgrade Twice)

**Files:** N/A (database operation)

**Action:** Verify migration is idempotent by attempting to run upgrade twice. Should handle gracefully (either skip or error clearly).

**Code:**

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend

# Migration already applied, try to apply again
alembic upgrade head
```

**Why:** Idempotency testing ensures migration doesn't break if accidentally run multiple times (common in deployment scripts).

**Expected Output:**

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Already at head revision [new_revision]
```

**Note:** Alembic tracks applied migrations in `alembic_version` table. Re-running upgrade should be safe (no-op).

---

### Step 16: Update CLAUDE.md Documentation

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/CLAUDE.md`

**Action:** Document new database constraints in CLAUDE.md under "Database Migrations" section. Include constraint details, behavior changes, and migration ID.

**Code:** (Add to "Database Migrations" section)

```markdown
### Database Constraints (2025-11-10)

Added database-level constraints for data integrity and security:

**Constraints Added:**
1. **CHECK constraint**: `youtube_id` must be exactly 11 characters
2. **CHECK constraint**: `youtube_id` must match format `^[a-zA-Z0-9_-]{11}$`
3. **CHECK constraint**: `youtube_url` cannot be empty
4. **UNIQUE constraint**: `(user_id, youtube_id)` prevents duplicate video saves per user
5. **CHECK constraint**: `bookmarks_lists.name` cannot be empty
6. **CHECK constraint**: `tags.name` cannot be empty

**Behavior Changes:**
- **OLD:** Users could save same video in multiple lists (unique per list)
- **NEW:** Users can save each video only ONCE total (unique per user)
- **Rationale:** Matches typical bookmark manager behavior

**Security Benefits:**
- Prevents malformed YouTube IDs from entering system
- Blocks SQL injection attempts via video IDs
- Prevents duplicate video saves (storage efficiency)
- Enforces non-empty names for critical entities

Migration ID: `[generated_revision_id]_add_database_constraints_for_data_integrity`

To apply:
```bash
cd backend
alembic upgrade head
```

To rollback:
```bash
alembic downgrade -1
```

**Production Note:** This migration modifies uniqueness constraint on videos table. Existing duplicates (if any) must be cleaned up before migration. The migration will fail if duplicate (user_id, youtube_id) pairs exist.

**Testing:** 12 constraint tests verify behavior in `backend/tests/models/test_video_constraints.py`
```

**Why:** Documentation ensures future developers understand constraint behavior, migration safety, and potential gotchas. CLAUDE.md serves as single source of truth for project context.

---

## 🧪 Testing Strategy

### Unit Tests (12 tests in `test_video_constraints.py`)

1. **test_video_youtube_id_too_short_fails** - Verify IDs < 11 chars rejected
2. **test_video_youtube_id_too_long_fails** - Verify IDs > 11 chars rejected
3. **test_video_youtube_id_empty_fails** - Verify empty IDs rejected
4. **test_video_youtube_id_invalid_characters_fails** - Verify special chars rejected
5. **test_video_youtube_id_with_spaces_fails** - Verify spaces rejected
6. **test_video_youtube_id_valid_format_succeeds** - Verify valid formats accepted
7. **test_video_youtube_url_empty_fails** - Verify empty URLs rejected
8. **test_video_duplicate_youtube_id_per_user_fails** - Verify same user can't save video twice
9. **test_video_duplicate_youtube_id_different_users_succeeds** - Verify different users CAN save same video
10. **test_list_empty_name_fails** - Verify empty list names rejected
11. **test_tag_empty_name_fails** - Verify empty tag names rejected
12. **test_all_constraints_enforced_integration** - Verify all constraints work together with valid data

**Run:** `cd backend && pytest tests/models/test_video_constraints.py -v --cov=app/models`

**Expected:** 12/12 passing, 100% coverage on constraint logic

### Integration Test (Included as test #12)

**test_all_constraints_enforced_integration** - Full workflow test:
- Create valid user, list, video, tag
- Verify all entities created successfully
- Proves constraints don't block valid operations

### Manual Testing Checklist (10 scenarios via psql)

1. [ ] YouTube ID too short (5 chars) - should fail with `videos_youtube_id_length_check`
2. [ ] YouTube ID too long (24 chars) - should fail with `videos_youtube_id_length_check`
3. [ ] YouTube ID with special characters (@, !) - should fail with `videos_youtube_id_format_check`
4. [ ] YouTube URL empty string - should fail with `videos_youtube_url_not_empty_check`
5. [ ] Valid video creation - should succeed
6. [ ] Duplicate video for same user - should fail with `videos_user_youtube_unique`
7. [ ] Duplicate video for different user - should succeed
8. [ ] Empty list name - should fail with `lists_name_not_empty_check`
9. [ ] Empty tag name - should fail with `tags_name_not_empty_check`
10. [ ] Valid list and tag creation - should succeed

**Run:** Execute SQL commands from Step 14 in psql

### Migration Testing Checklist

1. [ ] Migration upgrade succeeds without errors
2. [ ] Migration downgrade succeeds without errors
3. [ ] Re-running upgrade is idempotent (no-op)
4. [ ] Old unique index properly restored after downgrade
5. [ ] All 12 pytest tests pass after migration applied
6. [ ] All 12 pytest tests fail before migration applied (TDD verification)

---

## 📚 Reference

### REF MCP Findings

**Finding 1: PostgreSQL CHECK Constraint with NOT VALID (Azure Cosmos DB Docs)**
- URL: https://learn.microsoft.com/en-us/azure/cosmos-db/postgresql/howto-modify-distributed-tables#using-not-valid-constraints
- **Evidence:** "PostgreSQL allows constraints marked NOT VALID - new rows are protected but existing rows can violate constraint"
- **Application:** Could use `postgresql_not_valid=True` flag if we need to apply constraints to production database with existing invalid data
- **Decision:** Not using for initial migration (clean database), but document for future use

**Finding 2: PostgreSQL Regex Pattern Best Practices (Stack Overflow + PostgreSQL Docs)**
- **Evidence:** "Use anchored patterns with ^ and $ to ensure exact matches" and "PostgreSQL regex operator ~ for case-sensitive matching"
- **Application:** Our youtube_id pattern uses `^[a-zA-Z0-9_-]{11}$` with anchors for exact matching
- **Performance Note:** "Regular expressions can take arbitrary amounts of time to process - be wary of patterns from hostile sources"
- **Decision:** Our pattern is simple and safe (no user-provided regex)

**Finding 3: CHECK Constraint Performance Impact (Database Administrators Stack Exchange)**
- **Evidence:** "Simple length checks using char_length() have minimal overhead - just a few extra CPU cycles" vs "Complex regex or custom functions can slow down write operations significantly"
- **Application:** We use both simple length checks (fast) and simple regex (moderate cost)
- **Optimization:** Placed length check BEFORE format check - fails fast on wrong length without regex evaluation
- **Decision:** Performance impact acceptable for security and data integrity benefits

**Finding 4: Testing IntegrityError with pytest-asyncio (CoderPad + Stack Overflow)**
- **Evidence:** "Use pytest.raises(IntegrityError) wrapping the async session - exception raised on session.commit() in __aexit__"
- **Application:** All test cases use `with pytest.raises(IntegrityError): await test_db.commit()` pattern
- **Test Isolation:** "Use NullPool by adding poolclass=NullPool to create_async_engine()" for test isolation
- **Decision:** Already implemented in conftest.py fixture (line 26)

**Finding 5: Alembic Constraint Naming Conventions (Alembic Docs)**
- URL: https://alembic.sqlalchemy.org/en/latest/naming.html
- **Evidence:** "Explicit constraint names are critical for clear error messages and migration management"
- **Application:** All constraints use descriptive names: `videos_youtube_id_length_check`, `videos_user_youtube_unique`, etc.
- **Decision:** Prefixing with table name makes error messages immediately clear to developers

### Related Docs

- **Security Hardening Plan:** `docs/plans/2025-11-02-security-hardening-implementation.md` (Lines 2812-3014)
- **Existing Custom Fields Migration:** `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` (pattern reference)
- **Test Fixtures:** `backend/tests/conftest.py` (async session setup with NullPool)

### Related Models

- **Video Model:** `backend/app/models/video.py` - Will enforce youtube_id and youtube_url constraints
- **BookmarkList Model:** `backend/app/models/list.py` - Will enforce name constraint
- **Tag Model:** `backend/app/models/tag.py` - Will enforce name constraint

### Design Decisions

**Decision 1: Why CHECK constraints over application-only validation?**
- **Rationale:** Defense-in-depth security principle
- **Benefit:** Cannot be bypassed by SQL injection, direct database access, or buggy code
- **Trade-off:** Small performance overhead on INSERT/UPDATE (acceptable)

**Decision 2: Why regex pattern `^[a-zA-Z0-9_-]{11}$`?**
- **Rationale:** YouTube uses base64url-like encoding (documented standard)
- **Characters:** A-Z, a-z, 0-9, dash, underscore only
- **Anchors:** ^ and $ ensure EXACT match (no extra characters)
- **Performance:** Simple pattern minimizes regex overhead

**Decision 3: Why UNIQUE on (user_id, youtube_id) instead of (list_id, youtube_id)?**
- **Rationale:** Matches bookmark manager UX patterns
- **Benefit:** Prevents accidental duplicates across user's lists
- **Storage:** More efficient (no duplicate metadata)
- **Migration:** BREAKING CHANGE - users with duplicates must clean up first

**Decision 4: Why separate length and format constraints?**
- **Rationale:** Performance optimization (fail fast on length)
- **Benefit:** Length check is trivial cost, skips expensive regex on obviously invalid IDs
- **Error Messages:** Clearer - users see "wrong length" vs "wrong format"

**Decision 5: Why only check empty (not whitespace-only) for names?**
- **Rationale:** `LENGTH('   ') = 3` - whitespace has positive length
- **Trade-off:** Allows whitespace-only names at database level
- **Mitigation:** Application validation should use `TRIM()` to catch this
- **Decision:** Keep constraint simple, handle edge case in application

---

## ⏱️ Estimated Time

**Total:** 2-3 hours

**Breakdown:**
- Step 1 (Write tests): 30 minutes
- Steps 2-10 (Migration implementation): 45 minutes
- Steps 11-15 (Testing and verification): 45 minutes
- Step 16 (Documentation): 15 minutes
- Buffer for debugging: 30 minutes

**Dependencies:**
- Requires Task #143 (user_id column on videos) completed first
- Requires clean test database (no existing constraint violations)
- Requires PostgreSQL 12+ (regex operator support)

---

## 🚨 Migration Safety Notes

**Pre-Migration Checklist:**
1. [ ] Verify Task #143 completed (user_id column exists on videos table)
2. [ ] Check for existing duplicate (user_id, youtube_id) pairs:
   ```sql
   SELECT user_id, youtube_id, COUNT(*)
   FROM videos
   GROUP BY user_id, youtube_id
   HAVING COUNT(*) > 1;
   ```
3. [ ] Check for invalid youtube_id values:
   ```sql
   SELECT id, youtube_id, LENGTH(youtube_id)
   FROM videos
   WHERE LENGTH(youtube_id) != 11
      OR youtube_id !~ '^[a-zA-Z0-9_-]{11}$';
   ```
4. [ ] Check for empty youtube_url values:
   ```sql
   SELECT id, youtube_url
   FROM videos
   WHERE youtube_url = '';
   ```
5. [ ] Check for empty list/tag names:
   ```sql
   SELECT id, name FROM bookmarks_lists WHERE name = '';
   SELECT id, name FROM tags WHERE name = '';
   ```

**Migration Failure Scenarios:**
- **Duplicate videos:** If same user has video saved in multiple lists, migration will fail
  - **Solution:** Run cleanup script to consolidate duplicates before migration
- **Invalid youtube_ids:** If database contains malformed IDs, constraint creation will fail
  - **Solution:** Fix invalid IDs before migration (shouldn't exist in clean system)
- **Missing user_id:** If Task #143 not completed, foreign key reference will fail
  - **Solution:** Complete Task #143 first

**Rollback Procedure:**
```bash
# If migration fails or causes issues
cd backend
alembic downgrade -1

# Verify rollback succeeded
alembic current

# Check database state
psql youtube_bookmarks_test -c "\d videos"
```

**Production Deployment:**
1. Test migration on staging database first
2. Run pre-migration checklist queries
3. Backup database before migration
4. Apply migration during low-traffic window
5. Monitor application logs for constraint violations
6. Have rollback plan ready

---

## 📝 Success Criteria Summary

**Technical:**
- [ ] Migration file created with correct naming convention
- [ ] All 6 constraints implemented correctly
- [ ] Upgrade and downgrade functions complete
- [ ] 12/12 pytest tests passing
- [ ] 10/10 manual tests passing
- [ ] Migration idempotency verified

**Documentation:**
- [ ] CLAUDE.md updated with constraint details
- [ ] Migration docstring explains all constraints
- [ ] Code comments explain WHY for each constraint

**Quality:**
- [ ] No breaking changes to valid data workflows
- [ ] Clear error messages for constraint violations
- [ ] Performance impact acceptable (< 10ms overhead per INSERT)
- [ ] Security audit requirements met (defense-in-depth)

**Confidence:**
- [ ] Can rollback cleanly if needed
- [ ] Tests prove constraints work as designed
- [ ] Manual testing confirms database-level enforcement
- [ ] Documentation enables future maintenance
