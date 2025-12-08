# User Story 04: Data Isolation Between Users

## Story

**As a** user
**I want to** only see my own data
**So that** my bookmarks are private and organized

## UX Flow

```
1. User A logs in
   ↓
2. User A creates bookmark list "Watch Later"
   ↓
3. User A adds 5 videos to the list
   ↓
4. User A logs out
   ↓
5. User B logs in (different account)
   ↓
6. User B sees empty state (no lists)
   ↓
7. User B creates bookmark list "Tutorials"
   ↓
8. User A logs back in
   ↓
9. User A sees only "Watch Later" with 5 videos
   ↓
10. User A does NOT see User B's "Tutorials" list
```

## Acceptance Criteria

- [ ] GET /api/lists returns only current user's lists
- [ ] GET /api/lists/{id}/videos returns only if user owns list
- [ ] GET /api/tags returns only current user's tags
- [ ] GET /api/channels returns only current user's channels
- [ ] Cannot access another user's list by ID (404 or 403)
- [ ] Cannot modify another user's data
- [ ] Cannot delete another user's data
- [ ] Search only searches current user's data

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Guess another user's list UUID | 404 Not Found (not 403 to prevent enumeration) |
| Direct API call without auth | 401 Unauthorized |
| Tampered JWT | 401 Unauthorized |
| Expired token | 401, client refreshes token |
| User ID spoofing in request | Ignored, use token's user |

## Technical Implementation

### Backend Query Pattern

```python
@router.get("/lists")
async def get_lists(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)  # Required!
):
    # ALWAYS filter by authenticated user
    stmt = select(BookmarkList).where(
        BookmarkList.user_id == user.id
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/lists/{list_id}/videos")
async def get_videos(
    list_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Verify user owns the list first
    list_stmt = select(BookmarkList).where(
        BookmarkList.id == list_id,
        BookmarkList.user_id == user.id  # Ownership check!
    )
    bookmark_list = (await db.execute(list_stmt)).scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(404, "List not found")

    # Now fetch videos
    video_stmt = select(Video).where(Video.list_id == list_id)
    # ...
```

### Security Principles

1. **Never trust client-provided user_id** - Always use token's user
2. **Filter at query level** - Not application level
3. **Return 404 for unauthorized** - Don't reveal existence
4. **Log access attempts** - For security auditing
