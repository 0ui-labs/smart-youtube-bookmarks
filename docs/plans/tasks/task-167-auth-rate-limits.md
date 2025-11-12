# Task #167: Apply rate limits to auth endpoints (5/min production)

**Plan Task:** #167
**Wave/Phase:** Security Hardening - Task 4: API Rate Limiting (Step 4)
**Dependencies:** Task #163 (Rate limiting utilities), Task #148 (JWT auth endpoints)

---

## 🎯 Ziel

Apply strict rate limiting to authentication endpoints (login and register) to protect against brute-force password attacks and credential stuffing. Implement OWASP-recommended defense-in-depth by limiting login/register attempts to 5 requests per minute in production (20/min in development) using the slowapi rate limiter with per-IP tracking.

This task directly addresses the security vulnerability identified in the Greptile review: **"Authentication endpoints exposed without rate limiting enable brute-force attacks."**

---

## 📋 Acceptance Criteria

- [ ] `@limiter.limit(AUTH_RATE_LIMIT)` decorator applied to `/api/auth/login` endpoint
- [ ] `@limiter.limit(AUTH_RATE_LIMIT)` decorator applied to `/api/auth/register` endpoint
- [ ] `Request` parameter added to both endpoint function signatures (required for rate limiting)
- [ ] Production rate limit: 5 requests/minute for auth endpoints
- [ ] Development rate limit: 20 requests/minute for auth endpoints
- [ ] Rate limiting tracked per IP address (prevents distributed brute force)
- [ ] 429 responses include `Retry-After` header and `retry_after` in JSON body
- [ ] Integration tests verify rapid login attempts trigger 429
- [ ] Integration tests verify 429 response format (headers + body)
- [ ] Manual testing guide for verifying rate limits work
- [ ] Tests passing (all existing + new rate limit tests)
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### 1. Update login endpoint with rate limiting

**Files:** `backend/app/api/auth.py`

**Action:** Add rate limit decorator and Request parameter to login endpoint

```python
# Add imports at top of file (modify existing import section)
from fastapi import APIRouter, Depends, HTTPException, status, Request  # Add Request
from app.core.rate_limit import limiter, AUTH_RATE_LIMIT  # Add this line

# Existing code...

# Apply rate limiter to login endpoint
@router.post("/login", response_model=Token)
@limiter.limit(AUTH_RATE_LIMIT)  # ADD THIS LINE - must be below @router decorator
async def login(
    request: Request,  # ADD THIS PARAMETER - required for slowapi to extract IP
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
) -> Token:
    """
    OAuth2 compatible login endpoint.

    Authenticates user with email and password, returns JWT access token.

    **Rate Limiting:**
    - Production: 5 requests/minute per IP address
    - Development: 20 requests/minute per IP address
    - Protects against brute-force password attacks

    **Security Notes:**
    - Uses generic error message "Incorrect email or password" for both
      non-existent users and wrong passwords to prevent user enumeration
    - Checks password BEFORE checking is_active to prevent timing attacks
    - Returns 401 for authentication failures, 403 for inactive accounts

    **OAuth2 Compatibility:**
    - Accepts form data (not JSON) per OAuth2 spec
    - Uses `username` field (mapped to email)
    - Returns `access_token` and `token_type`

    Args:
        request: FastAPI request object (required for rate limiting)
        form_data: OAuth2 password form with username (email) and password
        db: Database session

    Returns:
        JWT access token with bearer type

    Raises:
        HTTPException: 401 if credentials are invalid
        HTTPException: 403 if user account is inactive
        HTTPException: 429 if rate limit exceeded
    """
    # ... existing implementation remains unchanged ...
```

**Important Notes:**
- The `@limiter.limit()` decorator **must** be placed **after** the `@router.post()` decorator
- The `Request` parameter **must** be the first parameter in the function signature
- The `request` parameter is used by slowapi to extract the client IP address for rate limiting
- No changes to the actual login logic are needed

---

### 2. Update register endpoint with rate limiting

**Files:** `backend/app/api/auth.py`

**Action:** Add rate limit decorator and Request parameter to register endpoint

```python
# Apply rate limiter to register endpoint
@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)  # ADD THIS LINE - must be below @router decorator
async def register(
    request: Request,  # ADD THIS PARAMETER - required for slowapi to extract IP
    user_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> Token:
    """
    Register a new user account.

    Creates user with hashed password and returns JWT token for immediate login.

    **Rate Limiting:**
    - Production: 5 requests/minute per IP address
    - Development: 20 requests/minute per IP address
    - Protects against account enumeration and registration spam

    **Security Notes:**
    - Password is hashed with bcrypt before storage
    - Email uniqueness is enforced at database level
    - New users are active by default
    - Returns token immediately (no email verification required)

    **Future Enhancement:**
    - Add email verification workflow
    - Add password strength validation

    Args:
        request: FastAPI request object (required for rate limiting)
        user_data: Registration data with email and password
        db: Database session

    Returns:
        JWT access token for the new user

    Raises:
        HTTPException: 400 if email already registered
        HTTPException: 429 if rate limit exceeded
    """
    # ... existing implementation remains unchanged ...
```

**Important Notes:**
- Same decorator placement rules as login endpoint
- Rate limit is shared across login and register (both use `AUTH_RATE_LIMIT`)
- This prevents attackers from bypassing login limits by spamming register endpoint

---

### 3. Create integration tests for auth endpoint rate limiting

**Files:** `backend/tests/integration/test_auth_rate_limit.py`

**Action:** Create comprehensive integration tests that verify rate limiting works

```python
"""
Integration tests for authentication endpoint rate limiting.

Tests that login and register endpoints enforce rate limits and return
proper 429 responses with retry information when limits are exceeded.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch

from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_login_endpoint_rate_limited():
    """
    Test that login endpoint enforces rate limiting.

    Makes rapid login attempts and verifies 429 response is returned
    when rate limit is exceeded.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Determine how many requests to make based on environment
        # Production: 5/min, Dev: 20/min
        # Make (limit + 5) requests to ensure we hit the limit
        if settings.env == "production":
            num_requests = 10  # 5 allowed + 5 extra
        else:
            num_requests = 25  # 20 allowed + 5 extra

        responses = []
        status_codes = []

        # Make rapid login attempts with invalid credentials
        for i in range(num_requests):
            response = await client.post(
                "/api/auth/login",
                data={
                    "username": f"test{i}@example.com",
                    "password": "wrongpassword"
                }
            )
            responses.append(response)
            status_codes.append(response.status_code)

        # Verify that at least one request was rate limited
        assert 429 in status_codes, (
            f"Expected 429 status code in responses after {num_requests} requests. "
            f"Got status codes: {status_codes}"
        )

        # Find the first 429 response
        rate_limited_response = next(r for r in responses if r.status_code == 429)

        # Verify 429 response structure
        assert "Retry-After" in rate_limited_response.headers
        retry_after_header = rate_limited_response.headers["Retry-After"]
        assert retry_after_header.isdigit(), "Retry-After header should be an integer"

        # Verify response body
        body = rate_limited_response.json()
        assert body["error"] == "Rate limit exceeded"
        assert "retry_after" in body
        assert isinstance(body["retry_after"], int)
        assert body["retry_after"] > 0
        assert "Retry after" in body["detail"]


@pytest.mark.asyncio
async def test_register_endpoint_rate_limited():
    """
    Test that register endpoint enforces rate limiting.

    Makes rapid registration attempts and verifies 429 response is returned
    when rate limit is exceeded.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Determine how many requests to make based on environment
        if settings.env == "production":
            num_requests = 10  # 5 allowed + 5 extra
        else:
            num_requests = 25  # 20 allowed + 5 extra

        responses = []
        status_codes = []

        # Make rapid registration attempts
        for i in range(num_requests):
            response = await client.post(
                "/api/auth/register",
                json={
                    "email": f"newuser{i}@example.com",
                    "password": "securepassword123"
                }
            )
            responses.append(response)
            status_codes.append(response.status_code)

        # Verify that at least one request was rate limited
        assert 429 in status_codes, (
            f"Expected 429 status code in responses after {num_requests} requests. "
            f"Got status codes: {status_codes}"
        )

        # Find the first 429 response
        rate_limited_response = next(r for r in responses if r.status_code == 429)

        # Verify 429 response structure
        assert "Retry-After" in rate_limited_response.headers

        # Verify response body
        body = rate_limited_response.json()
        assert body["error"] == "Rate limit exceeded"
        assert "retry_after" in body
        assert isinstance(body["retry_after"], int)


@pytest.mark.asyncio
async def test_auth_rate_limit_is_stricter_than_api_limit():
    """
    Test that AUTH_RATE_LIMIT (5/min prod) is stricter than API_RATE_LIMIT (100/min prod).

    This ensures authentication endpoints have appropriate protection against
    brute-force attacks compared to general API endpoints.
    """
    from app.core.rate_limit import AUTH_RATE_LIMIT, API_RATE_LIMIT

    # Extract numeric limits from strings like "5/minute" and "100/minute"
    def parse_limit(limit_str: str) -> int:
        """Extract numeric value from rate limit string."""
        return int(limit_str.split("/")[0])

    auth_limit = parse_limit(AUTH_RATE_LIMIT)
    api_limit = parse_limit(API_RATE_LIMIT)

    # Auth limit should be significantly stricter
    assert auth_limit < api_limit, (
        f"AUTH_RATE_LIMIT ({AUTH_RATE_LIMIT}) should be stricter than "
        f"API_RATE_LIMIT ({API_RATE_LIMIT})"
    )

    # Verify production values meet OWASP recommendations
    if settings.env == "production":
        assert auth_limit == 5, "Production auth limit should be 5/minute"
        assert api_limit == 100, "Production API limit should be 100/minute"


@pytest.mark.asyncio
async def test_successful_login_within_rate_limit():
    """
    Test that successful logins work normally when within rate limit.

    Verifies rate limiting doesn't break normal authentication flow.
    """
    from app.models.user import User
    from app.core.security import get_password_hash
    from app.core.database import get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a test user first (using database directly to avoid rate limit)
        async for db in get_db():
            # Check if user exists
            from sqlalchemy import select
            stmt = select(User).where(User.email == "ratelimit@example.com")
            result = await db.execute(stmt)
            existing_user = result.scalar_one_or_none()

            if not existing_user:
                test_user = User(
                    email="ratelimit@example.com",
                    hashed_password=get_password_hash("testpassword123"),
                    is_active=True
                )
                db.add(test_user)
                await db.commit()
            break

        # Make a few login requests (below rate limit)
        num_requests = 3  # Well below both prod (5) and dev (20) limits

        for i in range(num_requests):
            response = await client.post(
                "/api/auth/login",
                data={
                    "username": "ratelimit@example.com",
                    "password": "testpassword123"
                }
            )

            # All requests should succeed
            assert response.status_code == 200, (
                f"Request {i+1} failed with status {response.status_code}. "
                f"Rate limiting should not affect normal usage."
            )

            # Verify token is returned
            body = response.json()
            assert "access_token" in body
            assert "token_type" in body
            assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_rate_limit_response_includes_retry_info():
    """
    Test that 429 responses include complete retry information.

    Verifies compliance with HTTP standard for rate limiting responses.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Make enough requests to trigger rate limit
        num_requests = 30  # Enough for both prod and dev

        rate_limited_response = None

        for i in range(num_requests):
            response = await client.post(
                "/api/auth/login",
                data={
                    "username": f"spam{i}@example.com",
                    "password": "wrongpassword"
                }
            )

            if response.status_code == 429:
                rate_limited_response = response
                break

        # Verify we got a rate limited response
        assert rate_limited_response is not None, (
            "Expected to trigger rate limit after 30 rapid requests"
        )

        # Verify HTTP header
        assert "Retry-After" in rate_limited_response.headers
        retry_after_header = int(rate_limited_response.headers["Retry-After"])
        assert retry_after_header > 0
        assert retry_after_header <= 60  # Should be within 1 minute

        # Verify JSON body
        body = rate_limited_response.json()
        assert "error" in body
        assert "detail" in body
        assert "retry_after" in body

        # Verify values match
        assert body["retry_after"] == retry_after_header
        assert body["error"] == "Rate limit exceeded"
        assert f"Retry after {retry_after_header} seconds" in body["detail"]
```

---

## 🧪 Testing Strategy

### Unit Tests

**Not required** - Rate limiting utilities are already tested in Task #163 (`tests/core/test_rate_limit.py`)

This task focuses on **integration tests** to verify decorators are correctly applied to endpoints.

---

### Integration Tests

**File:** `backend/tests/integration/test_auth_rate_limit.py`

**Run:** `cd backend && pytest tests/integration/test_auth_rate_limit.py -v`

**Tests:**

1. **test_login_endpoint_rate_limited** - Verify rapid login attempts trigger 429
   - Makes (limit + 5) requests to login endpoint
   - Asserts that 429 status code appears in responses
   - Validates 429 response structure (headers + body)

2. **test_register_endpoint_rate_limited** - Verify rapid registration attempts trigger 429
   - Makes (limit + 5) requests to register endpoint
   - Asserts that 429 status code appears in responses
   - Validates 429 response structure

3. **test_auth_rate_limit_is_stricter_than_api_limit** - Verify AUTH_RATE_LIMIT < API_RATE_LIMIT
   - Compares numeric values of both constants
   - Ensures auth endpoints have appropriate protection

4. **test_successful_login_within_rate_limit** - Verify normal auth flow still works
   - Makes 3 successful login requests (below limit)
   - Asserts all return 200 with valid tokens
   - Ensures rate limiting doesn't break normal usage

5. **test_rate_limit_response_includes_retry_info** - Verify 429 response format
   - Triggers rate limit
   - Validates `Retry-After` header exists and is numeric
   - Validates JSON body includes `error`, `detail`, `retry_after`
   - Verifies header and body values match

---

### Manual Testing

**Prerequisites:**
1. Backend server running: `cd backend && uvicorn app.main:app --reload`
2. Redis running: `docker-compose up -d redis`

**Test 1: Trigger login rate limit**

```bash
# Set environment to production for stricter limit (5/min)
export ENV=production

# Restart backend to apply environment change
# Ctrl+C and restart: uvicorn app.main:app --reload

# Make 6 rapid login attempts (exceeds 5/min limit)
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST "http://localhost:8000/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=test@example.com&password=wrongpassword" \
    -w "\nHTTP Status: %{http_code}\n\n"
  sleep 0.5
done
```

**Expected Results:**
- Requests 1-5: Return 401 (Unauthorized - wrong credentials)
- Request 6: Returns 429 (Too Many Requests)
- Response 6 includes:
  - Header: `Retry-After: <seconds>`
  - Body: `{"error": "Rate limit exceeded", "detail": "Retry after X seconds", "retry_after": X}`

---

**Test 2: Trigger register rate limit**

```bash
# Make 6 rapid registration attempts
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST "http://localhost:8000/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"user$i@example.com\",\"password\":\"securepass123\"}" \
    -w "\nHTTP Status: %{http_code}\n\n"
  sleep 0.5
done
```

**Expected Results:**
- Requests 1-5: Return 201 (Created - new user registered)
- Request 6: Returns 429 (Too Many Requests)

---

**Test 3: Verify rate limit resets after window**

```bash
# Trigger rate limit
for i in {1..6}; do
  curl -s -X POST "http://localhost:8000/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=test@example.com&password=wrong" > /dev/null
done

# Immediately try again (should be rate limited)
echo "Immediate retry:"
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=wrong" \
  -w "\nHTTP Status: %{http_code}\n\n"

# Wait 60+ seconds for window to reset
echo "Waiting 65 seconds for rate limit to reset..."
sleep 65

# Try again (should succeed - get 401 for wrong password)
echo "After reset:"
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=wrong" \
  -w "\nHTTP Status: %{http_code}\n\n"
```

**Expected Results:**
- Immediate retry: 429 (still rate limited)
- After 65 seconds: 401 (rate limit reset, but credentials still wrong)

---

**Test 4: Verify development vs production limits**

```bash
# Test in development mode (20/min)
export ENV=development
# Restart backend

# Make 21 requests
for i in {1..21}; do
  curl -s -X POST "http://localhost:8000/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=test@example.com&password=wrong" \
    -o /dev/null \
    -w "Request $i: %{http_code}\n"
done
```

**Expected Results:**
- Requests 1-20: 401 (Unauthorized)
- Request 21: 429 (Too Many Requests)

---

## 📚 Reference

### Related Documentation

**Master Plan:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Task 4, Step 4 (lines 1655-1684)

**Related Task Plans:**
- `docs/plans/tasks/task-163-implement-rate-limiting-utilities.md` - Rate limiting infrastructure
- `docs/plans/tasks/task-148-jwt-auth-endpoints.md` - Auth endpoint implementation
- `docs/plans/tasks/task-162-add-slowapi-dependency.md` - slowapi installation

**External Documentation:**
- OWASP Authentication Cheat Sheet - Protect Against Automated Attacks
  - https://github.com/owasp/cheatsheetseries/blob/master/cheatsheets/Authentication_Cheat_Sheet.md#protect-against-automated-attacks
- OWASP Node.js Security - Brute Force Prevention
  - https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/security/login-rate-limit.md
- slowapi Documentation
  - https://github.com/laurents/slowapi
- limits Library Documentation (slowapi backend)
  - https://limits.readthedocs.io/en/stable/

---

### Related Code

**Pattern to follow:**
- `backend/app/core/rate_limit.py` - Rate limiting utilities (Task #163)
- `backend/app/main.py` - Rate limiter integration (Task #163)

**Files to modify:**
- `backend/app/api/auth.py` - Login and register endpoints (Task #148)

---

## 🎨 Design Decisions

### Why 5/minute for authentication vs 100/minute for API?

**Brute-force attack math:**
- 5 attempts/min = 300 attempts/hour = 7,200 attempts/day
- 100 attempts/min = 6,000 attempts/hour = 144,000 attempts/day

**Authentication needs stricter limits because:**
1. **Attack surface:** Login endpoints are the primary target for credential stuffing
2. **Password complexity:** Even strong passwords (8-12 chars) are vulnerable to 7K+ daily attempts
3. **OWASP recommendation:** "Limit login attempts to prevent brute-force attacks" (5-10/min)
4. **User impact:** Legitimate users rarely need >5 login attempts per minute
5. **Defense-in-depth:** Complements other protections (password hashing, account lockout, MFA)

**API endpoints can have higher limits because:**
1. They require valid JWT token (already authenticated)
2. Normal application usage involves many API calls per minute
3. 100/min balances protection vs user experience

---

### Why per-IP rate limiting instead of per-user?

**Per-IP tracking chosen because:**
1. **Pre-authentication:** Login/register happen before user is identified
2. **Simplicity:** No need to parse request body to extract username/email
3. **Broader protection:** Protects against distributed attacks from same IP
4. **OWASP recommended:** IP-based limiting is standard for auth endpoints

**Trade-offs:**
- **Drawback:** Corporate networks/VPNs share IPs (could affect legitimate users)
- **Mitigation:** Development limit is higher (20/min) for testing
- **Future enhancement:** Task #163 implements user-based limiting for authenticated API endpoints

---

### Why fixed-window strategy instead of sliding-window?

**Fixed-window strategy chosen because:**
1. **Simplicity:** Easier to understand and debug
2. **Performance:** Lower Redis overhead (single counter vs multiple timestamps)
3. **Adequate protection:** Burst at window boundary is acceptable for 5/min limit
4. **Standard practice:** Most rate limiting implementations use fixed-window

**Trade-off:**
- **Drawback:** Attacker could make 5 requests at 0:59 and 5 more at 1:00 (10 in 2 seconds)
- **Mitigation:** 5/min limit is strict enough that burst isn't concerning
- **Future enhancement:** Sliding-window could be added if needed

---

### Why shared limit for login + register?

**Current implementation:**
- Both endpoints use `AUTH_RATE_LIMIT` constant
- Same 5/min limit applies to **total** auth requests (login + register combined)

**Rationale:**
1. **Prevents limit bypassing:** Attacker can't spam register to avoid login limit
2. **Simpler to reason about:** One limit for all auth activity
3. **OWASP best practice:** Rate limit the "authentication surface" as a whole

**Alternative considered:**
- Separate limits: `LOGIN_RATE_LIMIT = "5/minute"` and `REGISTER_RATE_LIMIT = "3/minute"`
- **Rejected:** Adds complexity without significant security benefit

---

### Why not implement account lockout in this task?

**Account lockout** (lock account after N failed login attempts) is a **complementary** protection to rate limiting.

**Not included in this task because:**
1. **Scope:** This task focuses on rate limiting infrastructure (Task 4)
2. **Complexity:** Account lockout requires database changes (failed_attempts counter, locked_until timestamp)
3. **Future work:** Planned for separate security hardening task

**Defense-in-depth strategy:**
- **Rate limiting:** Slows down attacks (5 attempts/min from any IP)
- **Account lockout (future):** Stops attacks targeting specific accounts (lock after 10 failed attempts)
- **Generic error messages:** Prevents username enumeration ("Incorrect email or password")
- **Password hashing:** Makes stolen password databases useless (bcrypt with salt)

All layers work together to protect authentication.

---

## ⚠️ Important Notes

### Order of decorators matters

```python
# ✅ CORRECT
@router.post("/login", response_model=Token)
@limiter.limit(AUTH_RATE_LIMIT)
async def login(request: Request, ...):
    pass

# ❌ WRONG - limiter must be AFTER router
@limiter.limit(AUTH_RATE_LIMIT)
@router.post("/login", response_model=Token)
async def login(request: Request, ...):
    pass
```

**Why:** FastAPI processes decorators from bottom to top. The router decorator must be applied first to register the endpoint.

---

### Request parameter is required

```python
# ✅ CORRECT - Request is first parameter
async def login(request: Request, form_data: ..., db: ...):
    pass

# ❌ WRONG - missing Request parameter
async def login(form_data: ..., db: ...):
    pass
```

**Why:** slowapi needs the Request object to extract client IP address for rate limiting. Without it, the decorator will fail.

---

### Rate limits are environment-aware

```python
# Production (.env: ENV=production)
AUTH_RATE_LIMIT = "5/minute"

# Development (.env: ENV=development)
AUTH_RATE_LIMIT = "20/minute"
```

**Why:** Development needs higher limits for testing. Always verify `ENV` environment variable is set correctly.

---

### Redis must be running

Rate limiting uses Redis to store request counters. If Redis is down:
- **Behavior:** Requests will **fail** with 500 Internal Server Error
- **Mitigation:** Ensure `docker-compose up -d redis` before starting backend
- **Production:** Use Redis cluster with high availability

---

### Rate limit keys are per-IP

```
# Redis key format (from slowapi)
LIMITER:127.0.0.1:login:5/minute
```

**Implications:**
- Same IP address shares limit across login and register
- Different IP addresses have separate limits
- Behind proxy: Ensure X-Forwarded-For header is properly configured

---

## 🔗 Related Tasks

**Prerequisites (must be complete):**
- Task #162: Add slowapi dependency - COMPLETE
- Task #163: Implement rate limiting utilities - COMPLETE
- Task #148: JWT auth endpoints - COMPLETE

**Follow-up tasks:**
- Task #151: Protect API endpoints (will use `API_RATE_LIMIT` constant)
- Task #166: Apply rate limits to API endpoints (100/min production)

**Future enhancements:**
- Add account lockout mechanism (lock after N failed attempts)
- Add CAPTCHA for repeated failures
- Add IP blocklist for persistent attackers
- Add monitoring/alerting for rate limit triggers
