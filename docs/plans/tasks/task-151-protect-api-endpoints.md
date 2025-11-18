# Task #151: Protect All API Endpoints with Authentication

**Status:** 📋 Ready for Implementation  
**Estimated Time:** 3-4 hours  
**Priority:** High (Security Critical)  
**Dependencies:** Task #149 (Security Utilities), Task #150 (Authentication Dependencies)

---

## 🎯 Goal

Protect all API endpoints with JWT authentication to ensure only authenticated users can access their own data. The health check endpoint remains public for monitoring purposes.

---

## 📋 Acceptance Criteria

- [ ] All REST endpoints (except `/api/health`) require authentication via `current_user` dependency
- [ ] WebSocket endpoint already uses `get_current_ws_user` (no changes needed)
- [ ] All endpoints verify user ownership before allowing access to resources
- [ ] Tests verify 401 Unauthorized without valid JWT token
- [ ] Tests verify 403 Forbidden when accessing another user's resources
- [ ] Tests verify 200 OK with valid token and proper ownership
- [ ] Health endpoint remains public (no authentication required)
- [ ] All existing functionality continues to work with authenticated users

---

## 🔍 Current State Analysis

### Endpoint Inventory

**Total Endpoints:** 38 across 7 router files + 1 health check

| Router File | Endpoints | Current Auth Status |
|------------|-----------|---------------------|
| `lists.py` | 4 | ❌ No auth (hardcoded test user) |
| `videos.py` | 11 | ❌ No auth |
| `tags.py` | 5 | ❌ No auth |
| `processing.py` | 4 | ⚠️ Partial (progress-history has mock auth) |
| `custom_fields.py` | 5 | ❌ No auth |
| `schemas.py` | 5 | ❌ No auth |
| `schema_fields.py` | 4 | ❌ No auth |
| `websocket.py` | 1 | ✅ Already authenticated (`get_current_ws_user`) |
| `main.py` | 1 | ✅ Public (health check - stays public) |

### Files Requiring Changes

1. **backend/app/api/lists.py** (4 endpoints)
   - `GET /api/lists` - Get all lists for user
   - `POST /api/lists` - Create list for user
   - `GET /api/lists/{list_id}` - Get specific list (verify ownership)
   - `DELETE /api/lists/{list_id}` - Delete list (verify ownership)

2. **backend/app/api/videos.py** (11 endpoints)
   - `POST /lists/{list_id}/videos/bulk` - Bulk upload
   - `GET /lists/{list_id}/videos` - Get videos for list
   - `GET /videos` - Get all videos for user
   - `DELETE /videos/{video_id}` - Delete video
   - `POST /lists/{list_id}/videos/csv` - CSV upload
   - `GET /lists/{list_id}/export/csv` - Export CSV
   - `POST /videos/bulk/tags` - Bulk tag assignment
   - `POST /videos/{video_id}/tags` - Add tags to video
   - `DELETE /videos/{video_id}/tags/{tag_id}` - Remove tag from video
   - `GET /videos/{video_id}/tags` - Get video tags
   - `PUT /videos/{video_id}/fields` - Batch update field values

3. **backend/app/api/tags.py** (5 endpoints)
   - `POST /tags` - Create tag
   - `GET /tags` - Get all tags
   - `GET /tags/{tag_id}` - Get specific tag
   - `PUT /tags/{tag_id}` - Update tag
   - `DELETE /tags/{tag_id}` - Delete tag

4. **backend/app/api/processing.py** (4 endpoints)
   - `POST /api/lists/{list_id}/process` - Start processing
   - `GET /api/jobs/{job_id}` - Get job status
   - `POST /api/jobs/{job_id}/pause` - Pause job
   - `GET /api/jobs/{job_id}/progress-history` - Get progress (already has mock auth)

5. **backend/app/api/custom_fields.py** (5 endpoints)
   - `GET /api/custom-fields` - List fields
   - `POST /api/custom-fields` - Create field
   - `PUT /api/custom-fields/{field_id}` - Update field
   - `DELETE /api/custom-fields/{field_id}` - Delete field
   - `POST /api/custom-fields/check-duplicate` - Check duplicate name

6. **backend/app/api/schemas.py** (5 endpoints)
   - `GET /api/schemas` - List schemas
   - `GET /api/schemas/{schema_id}` - Get schema
   - `POST /api/schemas` - Create schema
   - `PUT /api/schemas/{schema_id}` - Update schema
   - `DELETE /api/schemas/{schema_id}` - Delete schema

7. **backend/app/api/schema_fields.py** (4 endpoints)
   - `GET /api/schemas/{schema_id}/fields` - List fields
   - `POST /api/schemas/{schema_id}/fields` - Add field
   - `PUT /api/schemas/{schema_id}/fields/{field_id}` - Update field
   - `DELETE /api/schemas/{schema_id}/fields/{field_id}` - Remove field

---

## 📚 REF MCP Validation

### FastAPI Security Patterns (Validated ✅)

**Source:** [FastAPI Security Tutorial - Get Current User](https://fastapi.tiangolo.com/tutorial/security/get-current-user/)

**Key Findings:**
- ✅ **Annotated Type Hints:** FastAPI officially recommends `Annotated[User, Depends(get_current_active_user)]` pattern
- ✅ **Master Plan Pattern is Current:** Matches 2024 FastAPI best practices
- ✅ **Dependency Injection:** Sub-dependencies (get_current_user → oauth2_scheme) are properly supported
- ✅ **Reusability:** Define once, use everywhere - no duplication needed

**Pattern Confirmation:**
```python
# Official FastAPI Pattern (Python 3.10+)
from typing import Annotated
from fastapi import Depends

@router.get("/items")
async def read_items(
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    # Automatically authenticated, type-safe, documented in OpenAPI
    return current_user.items
```

**Why Annotated over bare Depends:**
1. **Type Safety:** Editor autocomplete works correctly
2. **OpenAPI Documentation:** Better Swagger UI integration
3. **Python 3.10+ Standard:** Follows PEP 593 metadata standard
4. **Recommended by FastAPI:** Official docs prefer Annotated since v0.95.0

### SQLAlchemy User-Scoped Queries (Validated ✅)

**Source:** [SQLAlchemy FAQ - Filtered Queries](https://docs.sqlalchemy.org/en/20/faq/sessions.html#how-do-i-make-a-query-that-always-adds-a-certain-filter-to-every-query)

**Best Practice for User Scoping:**
```python
# Explicit ownership verification (recommended for security)
list_obj = await db.execute(
    select(BookmarkList)
    .where(BookmarkList.id == list_id)
    .where(BookmarkList.user_id == current_user.id)
)
if not list_obj.scalar_one_or_none():
    raise HTTPException(status_code=404, detail="List not found")
```

**Alternative: Global Filters (Not Recommended for This Project)**
- SQLAlchemy supports global filters via custom session classes
- **Rejected:** Adds complexity, harder to debug, implicit behavior
- **Preferred:** Explicit `where(user_id == current_user.id)` - clear security intent

---

## 🛠️ Implementation Steps

### Phase 1: Lists Router (TDD Foundation)

**Step 1.1: Write Failing Tests for Lists Endpoints**

**File:** `backend/tests/api/test_lists.py` (add tests)

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta

from app.main import app
from app.models.user import User
from app.models.list import BookmarkList
from app.core.security import get_password_hash, create_access_token


@pytest.fixture
async def test_user(async_session: AsyncSession):
    """Create a test user for authentication tests."""
    user = User(
        email="auth_test@example.com",
        hashed_password=get_password_hash("testpass"),
        is_active=True
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User) -> dict:
    """Generate authentication headers with valid JWT token."""
    token = create_access_token(
        data={"sub": str(test_user.id)},
        expires_delta=timedelta(minutes=15)
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_list_requires_authentication():
    """Test that creating a list requires authentication."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/lists",
            json={"name": "Test List"}
        )
    
    assert response.status_code == 401  # Unauthorized
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_create_list_with_valid_token(test_user: User, auth_headers: dict):
    """Test creating a list with valid authentication."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/lists",
            json={"name": "My Authenticated List"},
            headers=auth_headers
        )
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Authenticated List"
    assert data["user_id"] == str(test_user.id)


@pytest.mark.asyncio
async def test_get_lists_requires_authentication():
    """Test that listing lists requires authentication."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/lists")
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_lists_returns_only_user_lists(
    async_session: AsyncSession,
    test_user: User,
    auth_headers: dict
):
    """Test that users only see their own lists."""
    # Create another user with a list
    other_user = User(
        email="other@example.com",
        hashed_password=get_password_hash("otherpass"),
        is_active=True
    )
    async_session.add(other_user)
    await async_session.flush()
    
    # Create list for other user
    other_list = BookmarkList(name="Other User List", user_id=other_user.id)
    async_session.add(other_list)
    
    # Create list for test user
    my_list = BookmarkList(name="My List", user_id=test_user.id)
    async_session.add(my_list)
    await async_session.commit()
    
    # Fetch lists as test_user
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/lists", headers=auth_headers)
    
    assert response.status_code == 200
    lists = response.json()
    assert len(lists) == 1  # Only my_list, not other_list
    assert lists[0]["name"] == "My List"


@pytest.mark.asyncio
async def test_get_list_by_id_requires_ownership(
    async_session: AsyncSession,
    test_user: User,
    auth_headers: dict
):
    """Test that users cannot access other users' lists."""
    # Create another user's list
    other_user = User(
        email="other2@example.com",
        hashed_password=get_password_hash("otherpass"),
        is_active=True
    )
    async_session.add(other_user)
    await async_session.flush()
    
    other_list = BookmarkList(name="Private List", user_id=other_user.id)
    async_session.add(other_list)
    await async_session.commit()
    await async_session.refresh(other_list)
    
    # Try to access other user's list
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            f"/api/lists/{other_list.id}",
            headers=auth_headers
        )
    
    assert response.status_code == 404  # Not found (don't reveal existence)


@pytest.mark.asyncio
async def test_delete_list_requires_ownership(
    async_session: AsyncSession,
    test_user: User,
    auth_headers: dict
):
    """Test that users cannot delete other users' lists."""
    # Create another user's list
    other_user = User(
        email="other3@example.com",
        hashed_password=get_password_hash("otherpass"),
        is_active=True
    )
    async_session.add(other_user)
    await async_session.flush()
    
    other_list = BookmarkList(name="Undeletable List", user_id=other_user.id)
    async_session.add(other_list)
    await async_session.commit()
    await async_session.refresh(other_list)
    
    # Try to delete other user's list
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.delete(
            f"/api/lists/{other_list.id}",
            headers=auth_headers
        )
    
    assert response.status_code == 404  # Not found (don't reveal existence)
```

**Run:** 
```bash
cd backend
pytest tests/api/test_lists.py::test_create_list_requires_authentication -v
pytest tests/api/test_lists.py -k "auth" -v
```

**Expected:** All tests FAIL (endpoints not protected yet)

---

**Step 1.2: Protect Lists Endpoints with Authentication**

**File:** `backend/app/api/lists.py`

```python
from uuid import UUID
from typing import List, Annotated  # Add Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import BookmarkList, Video, User
from app.schemas.list import ListCreate, ListResponse
from app.api.deps import get_current_active_user  # Add import

router = APIRouter(prefix="/api/lists", tags=["lists"])


@router.get("", response_model=List[ListResponse])
async def get_lists(
    current_user: Annotated[User, Depends(get_current_active_user)],  # Add dependency
    db: AsyncSession = Depends(get_db)
):
    """Get all lists for the authenticated user."""
    # Filter by current_user.id (user scoping)
    result = await db.execute(
        select(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.user_id,
            BookmarkList.schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at,
            func.count(Video.id).label("video_count")
        )
        .outerjoin(Video, BookmarkList.id == Video.list_id)
        .where(BookmarkList.user_id == current_user.id)  # Add user filter
        .group_by(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.user_id,
            BookmarkList.schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at
        )
    )

    lists = []
    for row in result:
        lists.append(
            ListResponse(
                id=row.id,
                name=row.name,
                description=row.description,
                user_id=row.user_id,
                schema_id=row.schema_id,
                video_count=row.video_count,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )

    return lists


@router.post("", response_model=ListResponse, status_code=201)
async def create_list(
    list_data: ListCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],  # Add dependency
    db: AsyncSession = Depends(get_db)
):
    """Create a new list for the authenticated user."""
    # Remove hardcoded user logic, use current_user
    new_list = BookmarkList(
        name=list_data.name,
        description=list_data.description,
        user_id=current_user.id  # Use authenticated user
    )
    db.add(new_list)
    await db.flush()
    await db.refresh(new_list)
    await db.commit()

    return ListResponse(
        id=new_list.id,
        name=new_list.name,
        description=new_list.description,
        user_id=new_list.user_id,
        schema_id=new_list.schema_id,
        video_count=0,
        created_at=new_list.created_at,
        updated_at=new_list.updated_at,
    )


@router.get("/{list_id}", response_model=ListResponse)
async def get_list(
    list_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],  # Add dependency
    db: AsyncSession = Depends(get_db)
):
    """Get a specific list by ID (ownership verified)."""
    result = await db.execute(
        select(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.user_id,
            BookmarkList.schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at,
            func.count(Video.id).label("video_count")
        )
        .outerjoin(Video, BookmarkList.id == Video.list_id)
        .where(BookmarkList.id == list_id)
        .where(BookmarkList.user_id == current_user.id)  # Add ownership check
        .group_by(
            BookmarkList.id,
            BookmarkList.name,
            BookmarkList.description,
            BookmarkList.user_id,
            BookmarkList.schema_id,
            BookmarkList.created_at,
            BookmarkList.updated_at
        )
    )

    row = result.first()
    if not row:
        # Return 404 for both non-existent and unauthorized (don't leak existence)
        raise HTTPException(status_code=404, detail="List not found")

    return ListResponse(
        id=row.id,
        name=row.name,
        description=row.description,
        user_id=row.user_id,
        schema_id=row.schema_id,
        video_count=row.video_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.delete("/{list_id}", status_code=204)
async def delete_list(
    list_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],  # Add dependency
    db: AsyncSession = Depends(get_db)
):
    """Delete a list (ownership verified)."""
    result = await db.execute(
        select(BookmarkList)
        .where(BookmarkList.id == list_id)
        .where(BookmarkList.user_id == current_user.id)  # Add ownership check
    )
    list_obj = result.scalar_one_or_none()

    if not list_obj:
        # Return 404 for both non-existent and unauthorized
        raise HTTPException(status_code=404, detail="List not found")

    await db.delete(list_obj)
    await db.commit()
    return None
```

**Key Changes:**
1. ✅ Add `Annotated[User, Depends(get_current_active_user)]` to all endpoints
2. ✅ Remove hardcoded test user logic from `create_list`
3. ✅ Add `.where(BookmarkList.user_id == current_user.id)` to all queries
4. ✅ Return 404 (not 403) for unauthorized access to prevent information leakage

**Run Tests:**
```bash
cd backend
pytest tests/api/test_lists.py -v
```

**Expected:** All tests PASS ✅

---

### Phase 2: Videos Router

**Step 2.1: Write Failing Tests for Videos Endpoints**

**File:** `backend/tests/api/test_videos.py` (add new tests or update existing)

```python
# Similar pattern to lists tests - add auth fixtures and test cases
# Focus on:
# - Bulk upload requires auth
# - Users can only access videos in their own lists
# - Cannot delete other users' videos
# - CSV export requires auth and ownership
```

**Step 2.2: Protect Videos Endpoints**

**File:** `backend/app/api/videos.py`

**Pattern for each endpoint:**
```python
@router.get("/lists/{list_id}/videos", response_model=List[VideoResponse])
async def get_videos(
    list_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],  # Add
    tag_ids: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    # Verify list ownership first
    list_result = await db.execute(
        select(BookmarkList)
        .where(BookmarkList.id == list_id)
        .where(BookmarkList.user_id == current_user.id)  # Add
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="List not found")
    
    # Proceed with existing logic (list ownership already verified)
    # ...
```

**Apply to all 11 endpoints:**
1. Add `current_user` dependency
2. Verify ownership of parent resource (list/video)
3. No changes to core business logic

**Run Tests:**
```bash
pytest tests/api/test_videos.py -v
```

---

### Phase 3: Tags Router

**Step 3.1: Write Failing Tests**

**File:** `backend/tests/api/test_tags.py`

```python
# Test that tags are user-scoped
# Users can only see/modify tags in their own lists
```

**Step 3.2: Protect Tags Endpoints**

**File:** `backend/app/api/tags.py`

**Key Challenge:** Tags are scoped by list, so verify list ownership:

```python
@router.get("", response_model=list[TagResponse])
async def get_tags(
    list_id: UUID = Query(...),
    current_user: Annotated[User, Depends(get_current_active_user)],  # Add
    db: AsyncSession = Depends(get_db)
):
    # Verify list ownership
    list_result = await db.execute(
        select(BookmarkList)
        .where(BookmarkList.id == list_id)
        .where(BookmarkList.user_id == current_user.id)
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="List not found")
    
    # Existing tag query logic...
```

**Apply to all 5 endpoints**

**Run Tests:**
```bash
pytest tests/api/test_tags.py -v
```

---

### Phase 4: Processing Router

**Step 4.1: Write Failing Tests**

**File:** `backend/tests/api/test_processing.py`

```python
# Test job endpoints require auth
# Test progress-history endpoint (already has mock auth, replace with real)
```

**Step 4.2: Protect Processing Endpoints**

**File:** `backend/app/api/processing.py`

**Changes:**
1. Add `current_user` dependency to all 4 endpoints
2. Replace mock `user_id` query param in `get_progress_history` with real auth:

```python
@router.get("/jobs/{job_id}/progress-history", response_model=List[JobProgressEventRead])
async def get_progress_history(
    job_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],  # Replace mock auth
    since: Optional[datetime] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, gt=0, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Get progress history for a job with pagination and filtering.
    
    Authorization: user can only access their own jobs.
    """
    # Verify job exists and load list relationship
    stmt = select(ProcessingJob).where(
        ProcessingJob.id == job_id
    ).options(selectinload(ProcessingJob.list))

    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Authorization: Check ownership via job -> list -> user relationship
    if job.list.user_id != current_user.id:  # Use current_user, not query param
        raise HTTPException(status_code=403, detail="Not authorized to access this job")

    # Rest of implementation...
```

**Run Tests:**
```bash
pytest tests/api/test_processing.py -v
```

---

### Phase 5: Custom Fields Router

**Step 5.1: Write Failing Tests**

**File:** `backend/tests/api/test_custom_fields.py`

```python
# Test field endpoints require auth
# Test users only see their own fields
```

**Step 5.2: Protect Custom Fields Endpoints**

**File:** `backend/app/api/custom_fields.py`

**Pattern:** Add `current_user` dependency to all 5 endpoints

**Run Tests:**
```bash
pytest tests/api/test_custom_fields.py -v
```

---

### Phase 6: Schemas Router

**Step 6.1: Write Failing Tests**

**File:** `backend/tests/api/test_schemas.py`

**Step 6.2: Protect Schemas Endpoints**

**File:** `backend/app/api/schemas.py`

**Pattern:** Add `current_user` dependency to all 5 endpoints

**Run Tests:**
```bash
pytest tests/api/test_schemas.py -v
```

---

### Phase 7: Schema Fields Router

**Step 7.1: Write Failing Tests**

**File:** `backend/tests/api/test_schema_fields.py`

**Step 7.2: Protect Schema Fields Endpoints**

**File:** `backend/app/api/schema_fields.py`

**Pattern:** Add `current_user` dependency to all 4 endpoints, verify schema ownership

**Run Tests:**
```bash
pytest tests/api/test_schema_fields.py -v
```

---

### Phase 8: Integration Testing & Verification

**Step 8.1: Run All Tests**

```bash
cd backend
pytest tests/api/ -v --cov=app/api
```

**Expected:** All tests pass, 100% coverage for auth dependencies

---

**Step 8.2: Manual Testing with Frontend**

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Test flow:
   - Login with test user
   - Create list
   - Upload videos
   - Verify WebSocket progress updates work
   - Logout and verify 401 errors

---

**Step 8.3: Swagger UI Verification**

1. Open http://localhost:8000/docs
2. Verify all endpoints (except `/api/health`) show lock icon 🔒
3. Click "Authorize" button
4. Test authentication flow in Swagger UI
5. Verify 401 without token, 200 with token

---

### Phase 9: Documentation & Commit

**Step 9.1: Update CLAUDE.md**

**File:** `CLAUDE.md` (update "Security Notes" section)

```markdown
## Security Notes

**Current Status:**
- ✅ JWT authentication implemented on all endpoints
- ✅ User-scoped data access (users only see their own resources)
- ✅ WebSocket authentication with post-connection JWT validation
- ✅ Health check endpoint remains public for monitoring
- ⚠️ Rate limiting not yet implemented (planned)

**Authentication Flow:**
1. User logs in via `/api/auth/login` (Task #148)
2. Receives JWT access token
3. Includes token in `Authorization: Bearer <token>` header
4. `get_current_active_user` dependency validates token
5. Endpoints verify resource ownership before access

**Testing with Authentication:**
- Use `auth_headers` fixture in tests
- Create test user with `test_user` fixture
- Example:
  ```python
  async def test_endpoint(test_user, auth_headers):
      response = await client.get("/api/lists", headers=auth_headers)
      assert response.status_code == 200
  ```
```

---

**Step 9.2: Commit Changes**

```bash
cd backend
git add app/api/*.py tests/api/*.py CLAUDE.md
git commit -m "feat(auth): protect all API endpoints with JWT authentication

- Add current_user dependency to all 38 endpoints across 7 routers
- Implement user-scoped queries for resource ownership verification
- Replace mock auth in progress-history endpoint with real JWT
- Add comprehensive auth tests (401, 403, ownership checks)
- Update CLAUDE.md with authentication flow documentation
- Health check endpoint remains public for monitoring

🔒 Security: All endpoints now require valid JWT token
✅ Tests: 100% auth coverage with fixtures and ownership tests
📚 Docs: Updated developer guide with auth patterns

Refs: Task #151
🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (Per-Endpoint)

**For each endpoint, test:**
1. **401 Unauthorized** - No Authorization header
2. **401 Unauthorized** - Invalid/expired token
3. **403 Forbidden** - Valid token, accessing another user's resource
4. **200 OK** - Valid token, accessing own resource
5. **Functionality** - Core business logic still works

**Test Pattern:**
```python
# 1. No auth
async def test_endpoint_requires_auth():
    response = await client.get("/api/endpoint")
    assert response.status_code == 401

# 2. Invalid token
async def test_endpoint_invalid_token():
    response = await client.get(
        "/api/endpoint",
        headers={"Authorization": "Bearer invalid"}
    )
    assert response.status_code == 401

# 3. Unauthorized access
async def test_endpoint_unauthorized_access(other_user_resource, auth_headers):
    response = await client.get(
        f"/api/endpoint/{other_user_resource.id}",
        headers=auth_headers
    )
    assert response.status_code == 404  # Don't leak existence

# 4. Authorized access
async def test_endpoint_authorized(my_resource, auth_headers):
    response = await client.get(
        f"/api/endpoint/{my_resource.id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(my_resource.id)

# 5. Functionality
async def test_endpoint_logic_works(auth_headers):
    # Test business logic remains unchanged
    pass
```

### Integration Tests

**Full Flow Tests:**
1. Login → Get Token → Create List → Upload Videos → Get Videos
2. User A cannot access User B's resources
3. WebSocket authentication works end-to-end
4. CSV upload/export with authentication

---

## 🎨 Design Decisions

### 1. Why Annotated over bare Depends?

**Rationale:**
- **Type Safety:** Enables editor autocomplete and static type checking
- **FastAPI Best Practice:** Official recommendation since v0.95.0 (2023)
- **OpenAPI Integration:** Better Swagger UI documentation
- **Python 3.10+ Standard:** Follows PEP 593 metadata annotations

**Example:**
```python
# ❌ Old way (still works, but not recommended)
async def endpoint(user: User = Depends(get_current_active_user)):
    pass

# ✅ New way (type-safe, recommended)
async def endpoint(user: Annotated[User, Depends(get_current_active_user)]):
    pass
```

---

### 2. Which Endpoints Remain Public?

**Public Endpoints:**
- `/api/health` - Health check for monitoring (no sensitive data)

**Protected Endpoints:**
- All 38 REST endpoints (require JWT)
- WebSocket endpoint (already requires JWT via `get_current_ws_user`)

**Rationale:**
- Health checks are used by load balancers, monitoring tools (no auth possible)
- All user data endpoints must be protected (security requirement)
- No "public read" endpoints (all data is user-specific)

---

### 3. 404 vs 403 for Unauthorized Access

**Decision:** Return 404 for unauthorized access to resources

**Rationale:**
- **Information Leakage Prevention:** 403 confirms resource exists (security risk)
- **User Experience:** "Not found" is clearer than "Forbidden" for missing ownership
- **Industry Standard:** GitHub, AWS, Stripe use 404 for non-owned resources

**Example:**
```python
# User A tries to access User B's list
result = await db.execute(
    select(BookmarkList)
    .where(BookmarkList.id == list_id)
    .where(BookmarkList.user_id == current_user.id)
)
if not result.scalar_one_or_none():
    raise HTTPException(status_code=404, detail="List not found")
    # NOT 403 - don't reveal existence
```

---

### 4. Testing Approach: Per-File vs Integration?

**Decision:** Both (layered testing strategy)

**Per-File Unit Tests:**
- Fast execution (no external dependencies)
- Test each router independently
- Catch auth bugs early

**Integration Tests:**
- Test full authentication flow
- Verify WebSocket + REST interaction
- Catch cross-router bugs

**Rationale:** Unit tests provide speed and isolation, integration tests provide confidence

---

### 5. Breaking Change Communication

**Impact:** This is a **breaking change** for existing API consumers

**Migration Required:**
1. Update all API calls to include `Authorization: Bearer <token>` header
2. Implement login flow to obtain JWT token
3. Handle 401 errors (token expired, logout user)

**Frontend Changes Needed (Separate Task):**
- Task #152: Update frontend to use JWT authentication
- Add `Authorization` header to all API calls
- Implement token refresh logic
- Handle logout on 401 errors

**Rollback Plan:**
- If issues arise, temporarily add `dependencies=[]` override to problematic endpoints
- NOT recommended for production (security risk)

---

## 📊 Progress Tracking

**Endpoint Protection Checklist:**

- [ ] **lists.py** (4 endpoints)
  - [ ] GET /api/lists
  - [ ] POST /api/lists
  - [ ] GET /api/lists/{list_id}
  - [ ] DELETE /api/lists/{list_id}

- [ ] **videos.py** (11 endpoints)
  - [ ] POST /lists/{list_id}/videos/bulk
  - [ ] GET /lists/{list_id}/videos
  - [ ] GET /videos
  - [ ] DELETE /videos/{video_id}
  - [ ] POST /lists/{list_id}/videos/csv
  - [ ] GET /lists/{list_id}/export/csv
  - [ ] POST /videos/bulk/tags
  - [ ] POST /videos/{video_id}/tags
  - [ ] DELETE /videos/{video_id}/tags/{tag_id}
  - [ ] GET /videos/{video_id}/tags
  - [ ] PUT /videos/{video_id}/fields

- [ ] **tags.py** (5 endpoints)
  - [ ] POST /tags
  - [ ] GET /tags
  - [ ] GET /tags/{tag_id}
  - [ ] PUT /tags/{tag_id}
  - [ ] DELETE /tags/{tag_id}

- [ ] **processing.py** (4 endpoints)
  - [ ] POST /api/lists/{list_id}/process
  - [ ] GET /api/jobs/{job_id}
  - [ ] POST /api/jobs/{job_id}/pause
  - [ ] GET /api/jobs/{job_id}/progress-history

- [ ] **custom_fields.py** (5 endpoints)
  - [ ] GET /api/custom-fields
  - [ ] POST /api/custom-fields
  - [ ] PUT /api/custom-fields/{field_id}
  - [ ] DELETE /api/custom-fields/{field_id}
  - [ ] POST /api/custom-fields/check-duplicate

- [ ] **schemas.py** (5 endpoints)
  - [ ] GET /api/schemas
  - [ ] GET /api/schemas/{schema_id}
  - [ ] POST /api/schemas
  - [ ] PUT /api/schemas/{schema_id}
  - [ ] DELETE /api/schemas/{schema_id}

- [ ] **schema_fields.py** (4 endpoints)
  - [ ] GET /api/schemas/{schema_id}/fields
  - [ ] POST /api/schemas/{schema_id}/fields
  - [ ] PUT /api/schemas/{schema_id}/fields/{field_id}
  - [ ] DELETE /api/schemas/{schema_id}/fields/{field_id}

- [ ] **websocket.py** (1 endpoint)
  - [x] /ws/progress (already protected with `get_current_ws_user`)

- [ ] **main.py** (1 endpoint)
  - [x] /api/health (remains public)

---

## 📚 Reference

### Related Tasks
- **Task #149:** Security Utilities (JWT creation/validation)
- **Task #150:** Authentication Dependencies (`get_current_user`, `get_current_active_user`)
- **Task #152:** Frontend Authentication Integration (upcoming)

### Documentation
- [FastAPI Security Tutorial](https://fastapi.tiangolo.com/tutorial/security/)
- [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [SQLAlchemy User-Scoped Queries](https://docs.sqlalchemy.org/en/20/faq/sessions.html)
- Master Plan: `docs/plans/2025-11-02-security-hardening-implementation.md` (lines 663-745)

### Code Patterns
```python
# Standard endpoint protection pattern
from typing import Annotated
from fastapi import Depends
from app.api.deps import get_current_active_user
from app.models.user import User

@router.get("/resource")
async def get_resource(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    # Verify ownership
    result = await db.execute(
        select(Resource)
        .where(Resource.id == resource_id)
        .where(Resource.user_id == current_user.id)
    )
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    return resource
```

---

## ⚠️ Important Notes

1. **Backward Compatibility:** This is a **breaking change** - all API consumers must update
2. **Health Endpoint:** Must remain public for load balancer health checks
3. **WebSocket:** Already protected (no changes needed)
4. **Test Coverage:** Aim for 100% auth coverage (401, 403, 200 tests for each endpoint)
5. **Security First:** Always return 404 (not 403) for unauthorized resource access
6. **Frontend Impact:** Requires corresponding frontend changes (Task #152)

---

**Estimated Implementation Time:** 3-4 hours
- Phase 1 (Lists): 30 min
- Phase 2 (Videos): 60 min (most endpoints)
- Phase 3 (Tags): 30 min
- Phase 4 (Processing): 20 min
- Phase 5-7 (Fields/Schemas): 45 min
- Phase 8 (Testing): 30 min
- Phase 9 (Docs): 15 min

**Ready for Implementation:** Yes ✅
