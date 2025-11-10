# Task #112: Add get_current_user dependency

**Plan Task:** #112
**Wave/Phase:** Wave 3 Security / JWT Authentication System
**Dependencies:** Task #111 (Security utilities - password hashing, JWT functions)

---

## 🎯 Goal

Implement FastAPI dependency injection functions for JWT-based user authentication that protect API endpoints and WebSocket connections. These dependencies will decode JWT tokens, query users from the database, and enforce authentication/authorization rules.

## 📋 Acceptance Criteria

- [ ] `oauth2_scheme` configured with correct token URL
- [ ] `get_current_user` extracts user from JWT token and validates against database
- [ ] `get_current_active_user` enforces is_active check
- [ ] `get_current_ws_user` authenticates WebSocket connections (BEFORE accept)
- [ ] All dependencies handle errors with appropriate HTTP status codes
- [ ] 100% test coverage with TDD approach
- [ ] No breaking changes to existing WebSocket implementation

---

## 🛠️ Implementation Steps

### Step 1: TDD - Write failing tests for get_current_user

**Files:** `backend/tests/api/test_deps.py` (NEW)

**Action:** Create comprehensive test suite following TDD approach. Tests should fail initially because dependencies don't exist yet.

```python
"""
Tests for authentication dependencies.

Verifies JWT token validation, user retrieval, and error handling.
"""

import pytest
from datetime import timedelta
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_active_user, oauth2_scheme
from app.models.user import User
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_get_current_user_with_valid_token(test_db: AsyncSession, test_user: User):
    """Test get_current_user returns user for valid token"""
    # Create valid JWT token for test user
    token = create_access_token(
        data={"sub": str(test_user.id)},
        expires_delta=timedelta(minutes=30)
    )
    
    # Call dependency with valid token
    user = await get_current_user(token=token, db=test_db)
    
    # Verify correct user returned
    assert user.id == test_user.id
    assert user.email == test_user.email
    assert user.is_active is True


@pytest.mark.asyncio
async def test_get_current_user_with_invalid_token(test_db: AsyncSession):
    """Test get_current_user rejects malformed token"""
    invalid_token = "definitely-not-a-valid-jwt-token"
    
    # Should raise 401 Unauthorized
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token=invalid_token, db=test_db)
    
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc_info.value.detail == "Could not validate credentials"
    assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}


@pytest.mark.asyncio
async def test_get_current_user_with_expired_token(test_db: AsyncSession, test_user: User):
    """Test get_current_user rejects expired token"""
    # Create token that expired 1 hour ago
    token = create_access_token(
        data={"sub": str(test_user.id)},
        expires_delta=timedelta(hours=-1)
    )
    
    # Should raise 401 Unauthorized
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token=token, db=test_db)
    
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_user_with_missing_sub(test_db: AsyncSession):
    """Test get_current_user rejects token without 'sub' claim"""
    # Create token without 'sub' field
    token = create_access_token(
        data={"email": "test@example.com"},  # Missing 'sub'
        expires_delta=timedelta(minutes=30)
    )
    
    # Should raise 401 Unauthorized
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token=token, db=test_db)
    
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_user_with_nonexistent_user_id(test_db: AsyncSession):
    """Test get_current_user rejects token with user ID not in database"""
    import uuid
    
    # Create token for non-existent user
    fake_user_id = str(uuid.uuid4())
    token = create_access_token(
        data={"sub": fake_user_id},
        expires_delta=timedelta(minutes=30)
    )
    
    # Should raise 401 Unauthorized
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token=token, db=test_db)
    
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_user_with_inactive_user(test_db: AsyncSession):
    """Test get_current_user rejects token for inactive user"""
    # Create inactive user
    import uuid
    inactive_user = User(
        email=f"inactive-{uuid.uuid4()}@example.com",
        hashed_password="$2b$12$placeholder",
        is_active=False  # Inactive
    )
    test_db.add(inactive_user)
    await test_db.commit()
    await test_db.refresh(inactive_user)
    
    # Create valid token for inactive user
    token = create_access_token(
        data={"sub": str(inactive_user.id)},
        expires_delta=timedelta(minutes=30)
    )
    
    # Should raise 401 Unauthorized (not 403, per master plan)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token=token, db=test_db)
    
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_current_active_user_with_active_user(test_user: User):
    """Test get_current_active_user allows active user"""
    # Should return user without raising exception
    user = await get_current_active_user(current_user=test_user)
    
    assert user.id == test_user.id
    assert user.is_active is True


@pytest.mark.asyncio
async def test_get_current_active_user_with_inactive_user():
    """Test get_current_active_user rejects inactive user"""
    import uuid
    inactive_user = User(
        id=uuid.uuid4(),
        email="inactive@example.com",
        hashed_password="$2b$12$placeholder",
        is_active=False
    )
    
    # Should raise 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await get_current_active_user(current_user=inactive_user)
    
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc_info.value.detail == "Inactive user"
```

**Run tests to verify they fail:**
```bash
cd backend
pytest tests/api/test_deps.py -v
# Expected: All tests fail with ImportError or AttributeError
```

---

### Step 2: Implement OAuth2PasswordBearer scheme

**Files:** `backend/app/api/deps.py`

**Action:** Add OAuth2PasswordBearer at module level. This provides automatic Swagger UI integration and extracts token from Authorization header.

**BEFORE (current state):**
```python
"""
API dependencies for authentication and database access.

Provides dependency injection functions for FastAPI routes.
"""

from typing import Optional
from fastapi import WebSocket, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user import User


async def get_current_ws_user(
    websocket: WebSocket,
    token: str
) -> User:
    # ... existing implementation ...
```

**AFTER (add OAuth2 scheme):**
```python
"""
API dependencies for authentication and database access.

Provides dependency injection functions for FastAPI routes.
"""

from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status, WebSocket
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.security import ALGORITHM
from app.models.user import User


# OAuth2 scheme for token authentication
# tokenUrl points to the login endpoint that will issue tokens
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ... rest of file ...
```

**Key Points:**
- `tokenUrl="/api/auth/login"` matches the endpoint that will be created in Task #113
- This enables Swagger UI "Authorize" button automatically
- Extracts token from `Authorization: Bearer <token>` header

---

### Step 3: Implement get_current_user dependency

**Files:** `backend/app/api/deps.py`

**Action:** Add `get_current_user` function that validates JWT and queries database.

```python
async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from JWT token.
    
    Dependency chain:
    1. oauth2_scheme extracts token from Authorization header
    2. Decode JWT token and extract user_id from 'sub' claim
    3. Query user from database by ID
    4. Validate user exists and is active
    
    Args:
        token: JWT access token from Authorization header (auto-extracted by oauth2_scheme)
        db: Database session (auto-injected by FastAPI)
    
    Returns:
        Authenticated User object
    
    Raises:
        HTTPException: 401 if token is invalid, expired, or user not found/inactive
    
    Examples:
        >>> @app.get("/protected")
        >>> async def protected_route(user: User = Depends(get_current_user)):
        >>>     return {"user_id": user.id}
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode JWT token
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Query user from database
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    # Validate user exists and is active
    if user is None or not user.is_active:
        raise credentials_exception
    
    return user
```

**Why This Design:**
- **Single responsibility:** Only handles authentication, not authorization
- **Consistent error response:** Always returns 401 for any auth failure (avoids leaking user existence)
- **Database query optimization:** Uses `scalar_one_or_none()` for single-row fetch
- **Annotated syntax:** Modern FastAPI pattern with better IDE support

---

### Step 4: Implement get_current_active_user wrapper

**Files:** `backend/app/api/deps.py`

**Action:** Add lightweight wrapper that depends on `get_current_user` for extra clarity.

```python
async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Verify the current user is active.
    
    This is a convenience wrapper around get_current_user for routes
    that want to be explicit about requiring active users.
    
    NOTE: get_current_user already checks is_active, so this is mostly
    for code clarity. However, it provides a 403 response instead of 401
    if a somehow-authenticated inactive user is detected.
    
    Args:
        current_user: User from get_current_user dependency
    
    Returns:
        Active User object
    
    Raises:
        HTTPException: 403 if user is inactive
    
    Examples:
        >>> @app.post("/create-content")
        >>> async def create(user: User = Depends(get_current_active_user)):
        >>>     # Extra protection for write operations
        >>>     return {"created_by": user.id}
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user
```

**Design Note:**
This might seem redundant since `get_current_user` already checks `is_active`. However:
1. **Defense in depth:** Extra protection if user is deactivated between token issue and request
2. **Clearer semantics:** 403 Forbidden vs 401 Unauthorized
3. **Future-proofing:** Easy to add additional checks (e.g., email verification, subscription status)

---

### Step 5: Update get_current_ws_user for WebSockets

**Files:** `backend/app/api/deps.py`

**Action:** Update existing `get_current_ws_user` to use shared security constants and improve error handling.

**BEFORE (current implementation):**
```python
async def get_current_ws_user(
    websocket: WebSocket,
    token: str
) -> User:
    """Authenticate WebSocket connection via query parameter token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )
    
    try:
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]  # Uses settings.algorithm
        )
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            await websocket.close(code=1008)
            raise credentials_exception
    except JWTError:
        await websocket.close(code=1008)
        raise credentials_exception
    
    # ... rest of function ...
```

**AFTER (use shared ALGORITHM constant):**
```python
async def get_current_ws_user(websocket: WebSocket, token: str) -> User:
    """
    Authenticate WebSocket connection via query parameter token.
    
    SECURITY NOTE: Token validation happens BEFORE accepting the WebSocket
    connection to prevent DoS attacks from unauthenticated clients.
    
    Args:
        websocket: WebSocket connection (not yet accepted)
        token: JWT token from query parameter (?token=xxx)
    
    Returns:
        Authenticated User object
    
    Raises:
        HTTPException: If authentication fails (closes WebSocket with code 1008)
    
    WebSocket Close Codes:
        1008 = Policy Violation (used for auth failures per RFC 6455)
    
    Examples:
        >>> @router.websocket("/ws/progress")
        >>> async def websocket_endpoint(
        >>>     websocket: WebSocket,
        >>>     token: str
        >>> ):
        >>>     user = await get_current_ws_user(websocket, token)
        >>>     await websocket.accept()  # Accept AFTER auth
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )
    
    try:
        # Decode JWT token BEFORE accepting WebSocket
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            await websocket.close(code=1008)  # Policy Violation
            raise credentials_exception
    except JWTError:
        await websocket.close(code=1008)
        raise credentials_exception
    
    # Query user from database using context manager
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user is None or not user.is_active:
            await websocket.close(code=1008)
            raise credentials_exception
        
        return user
```

**Changes:**
- Import `ALGORITHM` from `app.core.security` (created in Task #111)
- Use `ALGORITHM` instead of `settings.algorithm` for consistency
- Enhanced docstring with security rationale and examples
- No functional changes - maintains existing behavior

**Why ALGORITHM from security module:**
Per REF MCP findings and master plan, `ALGORITHM` should be a constant in security utilities, not config. This prevents accidental algorithm changes that could break existing tokens.

---

### Step 6: Run tests to verify implementation

**Files:** N/A (test execution)

**Action:** Run test suite and verify all tests pass.

```bash
cd backend

# Run deps tests specifically
pytest tests/api/test_deps.py -v

# Expected output:
# tests/api/test_deps.py::test_get_current_user_with_valid_token PASSED
# tests/api/test_deps.py::test_get_current_user_with_invalid_token PASSED
# tests/api/test_deps.py::test_get_current_user_with_expired_token PASSED
# tests/api/test_deps.py::test_get_current_user_with_missing_sub PASSED
# tests/api/test_deps.py::test_get_current_user_with_nonexistent_user_id PASSED
# tests/api/test_deps.py::test_get_current_user_with_inactive_user PASSED
# tests/api/test_deps.py::test_get_current_active_user_with_active_user PASSED
# tests/api/test_deps.py::test_get_current_active_user_with_inactive_user PASSED
# 
# ========================= 8 passed in 2.34s =========================

# Run all tests to ensure no regressions
pytest tests/ -v

# Verify WebSocket tests still pass
pytest tests/api/test_websocket.py -v
```

**If tests fail:**
1. Check that Task #111 is complete (`app.core.security` module exists)
2. Verify `create_access_token` and `ALGORITHM` are properly exported
3. Check database connection for integration tests
4. Review error messages and fix implementation

---

### Step 7: Commit dependency functions

**Files:** 
- `backend/app/api/deps.py` (modified)
- `backend/tests/api/test_deps.py` (new)

**Action:** Create git commit with clear message.

```bash
cd backend

# Stage changes
git add app/api/deps.py tests/api/test_deps.py

# Commit with conventional commit format
git commit -m "feat(auth): add get_current_user dependency for JWT authentication

- Add OAuth2PasswordBearer scheme with /api/auth/login tokenUrl
- Implement get_current_user dependency (decodes JWT + DB query)
- Implement get_current_active_user wrapper (explicit is_active check)
- Update get_current_ws_user to use shared ALGORITHM constant
- Add 8 comprehensive tests covering all auth scenarios

Dependencies are ready for use in protected endpoints (Task #114).

Ref: Task #112
Related: Task #111 (security utilities), Task #113 (auth endpoints)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Verify commit
git log -1 --stat
```

---

## 🧪 Testing Strategy

### Unit Tests (100% coverage)

**File:** `backend/tests/api/test_deps.py`

| Test Case | Scenario | Expected Result |
|-----------|----------|-----------------|
| `test_get_current_user_with_valid_token` | Valid JWT with existing active user | Returns User object |
| `test_get_current_user_with_invalid_token` | Malformed JWT string | 401 with "Could not validate credentials" |
| `test_get_current_user_with_expired_token` | JWT with exp in the past | 401 Unauthorized |
| `test_get_current_user_with_missing_sub` | JWT without 'sub' claim | 401 Unauthorized |
| `test_get_current_user_with_nonexistent_user_id` | JWT with user_id not in DB | 401 Unauthorized |
| `test_get_current_user_with_inactive_user` | JWT for user where is_active=False | 401 Unauthorized |
| `test_get_current_active_user_with_active_user` | Active user passed to wrapper | Returns User object |
| `test_get_current_active_user_with_inactive_user` | Inactive user passed to wrapper | 403 Forbidden |

**Test Data Setup:**
- Use `test_user` fixture from `conftest.py` (active user with hashed password)
- Create tokens with `create_access_token` from Task #111
- Use real database (not mocked) for integration testing

**Coverage Goals:**
- 100% line coverage for all dependency functions
- All error paths tested (invalid token, missing sub, user not found, inactive user)
- Both success and failure cases for each dependency

### Integration Tests (verify no regressions)

**Files:** 
- `backend/tests/api/test_websocket.py` - Ensure WebSocket auth still works
- `backend/tests/api/test_lists.py` - Lists API should still work (no auth yet)

**Manual Verification:**
1. Run all existing tests: `pytest tests/ -v`
2. Verify no failures introduced by dependency changes
3. Check that `get_current_ws_user` still works with existing WebSocket implementation

### Manual Testing (optional)

**Test with curl (after Task #113 login endpoint is complete):**

```bash
# 1. Login to get token (requires Task #113)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=password123"

# Response: {"access_token": "eyJ...", "token_type": "bearer"}

# 2. Test protected endpoint (requires Task #114)
curl http://localhost:8000/api/lists \
  -H "Authorization: Bearer eyJ..."

# Should return lists (after endpoints are protected in Task #114)
```

**Test WebSocket (existing endpoint):**

```bash
# Install wscat: npm install -g wscat

# Connect with token
wscat -c "ws://localhost:8000/api/ws/progress?token=eyJ..."

# Should connect successfully and receive progress updates
```

---

## 📚 Reference

### Related Documentation

**Master Plan:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` (lines 480-620)
- Section: "Task 1: JWT Authentication System - Step 8"

**REF MCP Findings:**

✅ **Pattern Validation (Current as of 2024):**

1. **OAuth2PasswordBearer is standard:** FastAPI official docs confirm this is the recommended approach for JWT auth
   - Source: https://fastapi.tiangolo.com/tutorial/security/get-current-user/
   - Quote: "We can use the same `Depends` with our `get_current_user` in the path operation"

2. **Annotated syntax is preferred:** FastAPI now recommends `Annotated` for dependency injection
   - Source: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
   - Quote: "Prefer to use the `Annotated` version if possible"

3. **WebSocket auth BEFORE accept is correct:** Security best practice confirmed
   - Source: https://websocket.org/guides/security#jwt-token-authentication
   - Quote: "Validate during handshake" to prevent DoS attacks
   - Alternative (post-connection auth) has timeout risk

4. **SQLAlchemy async query pattern is optimal:**
   - Using `scalar_one_or_none()` for single-row fetch is recommended
   - No N+1 query issues (single DB call per request)
   - Proper async/await usage with AsyncSession

💡 **REF MCP Improvements Applied:**

1. **Use Annotated syntax:** All dependencies use `Annotated[Type, Depends(dep)]` format
2. **Consistent error responses:** Always 401 for auth failures (don't leak user existence)
3. **WebSocket close code 1008:** "Policy Violation" per RFC 6455 standard
4. **Shared ALGORITHM constant:** Import from `app.core.security` instead of `settings.algorithm`

### Related Code

**Similar Implementations:**
- `backend/app/api/deps.py` - Existing `get_current_ws_user` (WebSocket auth)
- `backend/app/core/database.py` - `get_db()` dependency pattern

**Patterns to Follow:**
- Test fixtures in `backend/tests/conftest.py` - `test_user`, `test_db` fixtures
- Async test patterns in `backend/tests/api/test_websocket.py`

**Dependencies:**
- Task #111: `app.core.security` module with `ALGORITHM` constant and `create_access_token` function
- Task #113: Login endpoint that will use these dependencies
- Task #114: Protect existing endpoints with `get_current_user`

### Design Decisions

**1. Why OAuth2PasswordBearer over custom header extraction?**

**Decision:** Use `OAuth2PasswordBearer(tokenUrl="/api/auth/login")`

**Rationale:**
- **Automatic Swagger UI integration:** Adds "Authorize" button to API docs
- **Standard compliance:** Follows OAuth2 spec (RFC 6749)
- **Better DX:** Developers know to use `Authorization: Bearer <token>` header
- **FastAPI native:** Built-in support with excellent error messages

**Alternative considered:** Custom dependency that extracts from custom header
- **Rejected because:** Non-standard, breaks API docs, poor developer experience

**Evidence:** FastAPI official tutorial recommends OAuth2PasswordBearer
- Source: https://fastapi.tiangolo.com/tutorial/security/first-steps/

---

**2. WebSocket auth timing: BEFORE vs AFTER accept()**

**Decision:** Authenticate BEFORE `await websocket.accept()`

**Rationale:**
- **DoS prevention:** Reject unauthenticated connections immediately (no resource allocation)
- **Security best practice:** Validate during handshake (per WebSocket.org guide)
- **Clearer semantics:** Connection never enters "accepted" state if auth fails

**Alternative considered:** Post-connection auth with timeout
- **Rejected because:** 
  - Opens DoS vector (attacker opens many connections without auth)
  - Requires timeout management (complexity)
  - Resources allocated before validation

**Evidence:** WebSocket Security Hardening Guide recommends pre-connection validation
- Source: https://websocket.org/guides/security#jwt-token-authentication
- Quote: "Validate during handshake" pattern shown in examples

**Implementation detail:** 
- Call `await websocket.close(code=1008)` on auth failure
- Code 1008 = "Policy Violation" per RFC 6455 (correct for auth failures)

---

**3. Active user check placement: get_current_user vs get_current_active_user**

**Decision:** Check `is_active` in BOTH functions (defense in depth)

**Rationale:**
- **get_current_user checks is_active:** Primary defense, always enforced
- **get_current_active_user double-checks:** Secondary defense for critical operations
- **Different error codes:** 401 (not authenticated) vs 403 (authenticated but forbidden)

**Why both?**
- Scenario: User deactivated between token issue and request
- `get_current_user`: Returns 401 (token invalid because user deactivated)
- `get_current_active_user`: Returns 403 (explicitly states user is inactive)

**Alternative considered:** Only check in one place
- **Rejected because:** 
  - Less defense in depth
  - Harder to extend with additional checks (email verification, subscription, etc.)
  - Less clear error semantics

**Master plan alignment:**
- Master plan shows both functions checking `is_active` (lines 547-548, 568)
- Confirms defense-in-depth approach

---

**4. Error response format: Specific vs generic messages**

**Decision:** Always return generic "Could not validate credentials" for auth failures

**Rationale:**
- **Security:** Don't leak user existence (prevents user enumeration)
- **Consistency:** Same error for all auth failures (invalid token, missing user, expired, etc.)
- **Standards compliance:** OAuth2 spec recommends generic errors

**Specific scenarios with SAME generic error:**
- Invalid JWT format → 401 "Could not validate credentials"
- Expired token → 401 "Could not validate credentials"
- User not in DB → 401 "Could not validate credentials"
- Inactive user → 401 "Could not validate credentials"

**Alternative considered:** Specific error messages ("User not found", "Token expired")
- **Rejected because:** 
  - Leaks information to attackers (which users exist, token validity, etc.)
  - OAuth2 spec discourages detailed error messages in auth flows

**Evidence:** FastAPI OAuth2 tutorial uses generic error consistently
- Source: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- All auth failures return same `credentials_exception`

---

**5. Database query optimization: Load relationships or not?**

**Decision:** Use `scalar_one_or_none()` without eager loading (load User only)

**Rationale:**
- **Performance:** Most endpoints don't need User.lists or User.tags relationships
- **Let endpoints decide:** Relationships loaded on-demand if needed
- **Simpler queries:** Single table query (no joins)

**Alternative considered:** Eager load relationships with `selectinload()`
- **Rejected because:** 
  - N+1 risk if not needed
  - Overhead for every authenticated request
  - Breaks single responsibility (dependency only for auth, not data loading)

**Future optimization:** Endpoints needing relationships can query separately
```python
@app.get("/users/me/lists")
async def get_my_lists(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(BookmarkList).where(BookmarkList.user_id == user.id)
    # Load lists explicitly when needed
```

**Evidence:** SQLAlchemy docs recommend lazy loading by default
- Source: https://docs.sqlalchemy.org/en/20/faq/performance.html
- Only eager load when you know you need it

---

## ⏱️ Estimated Time

**Total:** 2-2.5 hours

**Breakdown:**
- Step 1 (TDD tests): 45 minutes
  - Write 8 test cases with fixtures
  - Test token generation, validation, error cases
  
- Step 2-5 (Implementation): 60 minutes
  - Add OAuth2 scheme (5 min)
  - Implement get_current_user (20 min)
  - Implement get_current_active_user (10 min)
  - Update get_current_ws_user (15 min)
  - Run tests and fix issues (10 min)
  
- Step 6 (Verification): 15 minutes
  - Run full test suite
  - Check for regressions
  - Verify WebSocket tests pass
  
- Step 7 (Commit): 10 minutes
  - Stage files
  - Write commit message
  - Verify commit

**Prerequisites:**
- Task #111 must be complete (security utilities with `create_access_token` and `ALGORITHM`)
- Database must be running for integration tests
- Test user fixtures available in `conftest.py`

**Blockers:**
- None (all dependencies from Task #111)

---

## ✅ Definition of Done

- [ ] `oauth2_scheme` configured with tokenUrl="/api/auth/login"
- [ ] `get_current_user` implemented with JWT decode + DB query
- [ ] `get_current_active_user` wrapper implemented
- [ ] `get_current_ws_user` updated to use shared ALGORITHM constant
- [ ] All 8 unit tests passing (100% coverage)
- [ ] No regressions in existing WebSocket tests
- [ ] Code committed with clear message
- [ ] Ready for Task #113 (login endpoint) and Task #114 (protect endpoints)
