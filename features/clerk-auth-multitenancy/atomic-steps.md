# Atomic Implementation Steps

## Criteria for Each Step
- ⏱️ 15-60 minutes
- 📁 1-3 files changed
- ✅ Clear pass/fail test
- 🔀 Independently committable

---

## Phase 1: Foundation (Backend)

### Step 1.1: Add Clerk Settings
**Files:** `backend/app/core/config.py`
**Time:** 15 min

```python
# Add to Settings class:
clerk_publishable_key: str = ""
clerk_secret_key: str = ""
enable_auth: bool = False
```

**Test:** `python -c "from app.core.config import settings; print(settings.enable_auth)"`

---

### Step 1.2: Create Clerk Verification Module
**Files:** `backend/app/core/clerk.py` (NEW)
**Time:** 45 min

```python
# Create ClerkJWTVerifier class with:
# - __init__(publishable_key)
# - async get_jwks() -> dict
# - async verify(token) -> dict
```

**Test:** Unit test with mock JWKS

---

### Step 1.3: Add PyJWT and httpx Dependencies
**Files:** `backend/requirements.txt`
**Time:** 10 min

```
PyJWT[crypto]>=2.8.0
httpx>=0.25.0
```

**Test:** `pip install -r requirements.txt && python -c "import jwt; import httpx"`

---

### Step 1.4: Write Unit Tests for JWT Verification
**Files:** `backend/tests/unit/test_clerk.py` (NEW)
**Time:** 30 min

**Test:** `pytest tests/unit/test_clerk.py -v`

---

## Phase 2: Database Migration

### Step 2.1: Create Alembic Migration for clerk_id
**Files:** `backend/alembic/versions/xxxx_add_clerk_id.py` (NEW)
**Time:** 20 min

```python
def upgrade():
    op.add_column('users', sa.Column('clerk_id', sa.String(255), nullable=True))
    op.create_index('ix_users_clerk_id', 'users', ['clerk_id'], unique=True)
```

**Test:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

---

### Step 2.2: Update User Model
**Files:** `backend/app/models/user.py`
**Time:** 15 min

```python
clerk_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
```

**Test:** `python -c "from app.models.user import User; print(User.__table__.columns)"`

---

### Step 2.3: Make hashed_password Nullable
**Files:** `backend/alembic/versions/xxxx_nullable_password.py` (NEW)
**Time:** 15 min

**Test:** Insert user without password succeeds

---

## Phase 3: Backend Auth Dependencies

### Step 3.1: Create get_or_create_user Helper
**Files:** `backend/app/api/deps.py`
**Time:** 30 min

```python
async def get_or_create_user(claims: dict, db: AsyncSession) -> User:
    # 1. Find by clerk_id
    # 2. Find by email (migration)
    # 3. Create new
```

**Test:** Unit test with mock DB

---

### Step 3.2: Create get_current_user Dependency
**Files:** `backend/app/api/deps.py`
**Time:** 30 min

```python
async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> User:
    # 1. Extract token from header
    # 2. Verify with Clerk
    # 3. Get/create user
```

**Test:** Integration test with mock Clerk

---

### Step 3.3: Create get_current_user_optional Dependency
**Files:** `backend/app/api/deps.py`
**Time:** 15 min

```python
async def get_current_user_optional(...) -> Optional[User]:
    # Same as above but returns None if no token
```

**Test:** Request without header returns None

---

### Step 3.4: Write Integration Tests for Auth
**Files:** `backend/tests/integration/test_auth_deps.py` (NEW)
**Time:** 45 min

**Test:** `pytest tests/integration/test_auth_deps.py -v`

---

## Phase 4: Frontend Auth Setup

### Step 4.1: Install Clerk React SDK
**Files:** `frontend/package.json`
**Time:** 10 min

```bash
npm install @clerk/clerk-react
```

**Test:** `npm ls @clerk/clerk-react`

---

### Step 4.2: Add Environment Variable
**Files:** `frontend/.env`, `frontend/.env.example`
**Time:** 5 min

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

**Test:** `grep CLERK frontend/.env`

---

### Step 4.3: Add ClerkProvider to main.tsx
**Files:** `frontend/src/main.tsx`
**Time:** 15 min

```tsx
import { ClerkProvider } from '@clerk/clerk-react'
// Wrap existing providers
```

**Test:** App starts without errors

---

### Step 4.4: Create AuthLoading Component
**Files:** `frontend/src/components/AuthLoading.tsx` (NEW)
**Time:** 15 min

**Test:** Component renders loading spinner

---

### Step 4.5: Create SignIn Page
**Files:** `frontend/src/pages/SignIn.tsx` (NEW)
**Time:** 20 min

**Test:** Page renders Clerk SignIn component

---

### Step 4.6: Create SignUp Page
**Files:** `frontend/src/pages/SignUp.tsx` (NEW)
**Time:** 20 min

**Test:** Page renders Clerk SignUp component

---

### Step 4.7: Update App.tsx with Auth Routing
**Files:** `frontend/src/App.tsx`
**Time:** 30 min

```tsx
// Add SignedIn/SignedOut wrappers
// Add auth routes
```

**Test:** Unauthenticated user redirected to /sign-in

---

### Step 4.8: Add UserButton to MainLayout
**Files:** `frontend/src/components/MainLayout.tsx`
**Time:** 20 min

**Test:** UserButton visible in header when logged in

---

### Step 4.9: Write Frontend Auth Tests
**Files:** `frontend/src/components/__tests__/*.test.tsx`
**Time:** 45 min

**Test:** `npm test`

---

## Phase 5: API Integration

### Step 5.1: Add Request Interceptor to API Client
**Files:** `frontend/src/lib/api.ts`
**Time:** 30 min

```typescript
// Add interceptor that gets Clerk token
// Add Authorization header
```

**Test:** Network tab shows Authorization header

---

### Step 5.2: Handle 401 in Response Interceptor
**Files:** `frontend/src/lib/api.ts`
**Time:** 20 min

```typescript
// On 401, trigger sign out / redirect
```

**Test:** 401 response redirects to sign-in

---

### Step 5.3: Update WebSocketProvider for Clerk Token
**Files:** `frontend/src/components/WebSocketProvider/`
**Time:** 30 min

```typescript
// Get token from useAuth().getToken()
// Pass to WebSocket connection
```

**Test:** WebSocket connects with Clerk token

---

## Phase 6: Backend Endpoint Updates

### Step 6.1: Update lists.py - GET /lists
**Files:** `backend/app/api/lists.py`
**Time:** 20 min

```python
# Add current_user dependency
# Filter by user_id
```

**Test:** Returns only user's lists

---

### Step 6.2: Update lists.py - POST /lists
**Files:** `backend/app/api/lists.py`
**Time:** 15 min

```python
# Set user_id from current_user
```

**Test:** Created list has correct user_id

---

### Step 6.3: Update lists.py - GET /lists/{id}
**Files:** `backend/app/api/lists.py`
**Time:** 15 min

```python
# Verify user owns list
```

**Test:** 404 for other user's list

---

### Step 6.4: Update lists.py - PUT /lists/{id}
**Files:** `backend/app/api/lists.py`
**Time:** 15 min

**Test:** Cannot update other user's list

---

### Step 6.5: Update lists.py - DELETE /lists/{id}
**Files:** `backend/app/api/lists.py`
**Time:** 15 min

**Test:** Cannot delete other user's list

---

### Step 6.6: Update videos.py - All Endpoints
**Files:** `backend/app/api/videos.py`
**Time:** 45 min

```python
# Verify list ownership for all video operations
```

**Test:** Data isolation tests pass

---

### Step 6.7: Update tags.py - Remove Test Helper
**Files:** `backend/app/api/tags.py`
**Time:** 20 min

```python
# Remove get_user_for_testing
# Use get_current_user instead
```

**Test:** Tags filtered by user

---

### Step 6.8: Update tags.py - All Endpoints
**Files:** `backend/app/api/tags.py`
**Time:** 30 min

**Test:** Tag isolation tests pass

---

### Step 6.9: Update channels.py
**Files:** `backend/app/api/channels.py`
**Time:** 30 min

**Test:** Channel isolation tests pass

---

### Step 6.10: Update schemas.py
**Files:** `backend/app/api/schemas.py`
**Time:** 30 min

**Test:** Schema isolation tests pass

---

### Step 6.11: Update custom_fields.py
**Files:** `backend/app/api/custom_fields.py`
**Time:** 20 min

**Test:** Custom field isolation tests pass

---

### Step 6.12: Update schema_fields.py
**Files:** `backend/app/api/schema_fields.py`
**Time:** 20 min

**Test:** Schema field isolation tests pass

---

### Step 6.13: Update analytics.py
**Files:** `backend/app/api/analytics.py`
**Time:** 15 min

**Test:** Analytics only for owned lists

---

### Step 6.14: Update search.py
**Files:** `backend/app/api/search.py`
**Time:** 20 min

**Test:** Search only returns user's data

---

### Step 6.15: Update enrichment.py
**Files:** `backend/app/api/enrichment.py`
**Time:** 15 min

**Test:** Enrichment only for owned videos

---

### Step 6.16: Update processing.py
**Files:** `backend/app/api/processing.py`
**Time:** 20 min

**Test:** Jobs only for owned lists

---

### Step 6.17: Update websocket.py for Clerk JWT
**Files:** `backend/app/api/websocket.py`
**Time:** 30 min

**Test:** WebSocket rejects invalid Clerk token

---

## Phase 7: Testing & Polish

### Step 7.1: Write Data Isolation Integration Tests
**Files:** `backend/tests/integration/test_data_isolation.py` (NEW)
**Time:** 60 min

**Test:** All isolation scenarios covered

---

### Step 7.2: Write Security Tests
**Files:** `backend/tests/security/test_auth_security.py` (NEW)
**Time:** 45 min

**Test:** Security test suite passes

---

### Step 7.3: Update Existing Tests with Auth Fixtures
**Files:** `backend/tests/conftest.py`, various test files
**Time:** 60 min

**Test:** All existing tests pass with auth

---

### Step 7.4: Write E2E Auth Flow Tests
**Files:** `cypress/e2e/auth.cy.ts` (NEW)
**Time:** 60 min

**Test:** E2E tests pass

---

### Step 7.5: Manual Testing Checklist
**Time:** 60 min

- [ ] Sign up with email
- [ ] Sign up with Google
- [ ] Sign up with GitHub
- [ ] Sign in with email
- [ ] Sign in with Google
- [ ] Sign out
- [ ] Session persists
- [ ] Data isolated between users

---

## Phase 8: Production Readiness

### Step 8.1: Enable Auth Flag in Staging
**Files:** Environment config
**Time:** 15 min

**Test:** Staging requires auth

---

### Step 8.2: Remove Development Fallbacks
**Files:** `backend/app/api/lists.py`, `backend/app/api/tags.py`
**Time:** 30 min

```python
# Remove test user creation
# Remove get_user_for_testing
```

**Test:** No fallback to test user

---

### Step 8.3: Update README
**Files:** `README.md`
**Time:** 30 min

**Test:** Instructions work for new developer

---

### Step 8.4: Configure Production Environment
**Files:** Production env config
**Time:** 30 min

**Test:** Production deployment works

---

## Summary

| Phase | Steps | Total Time |
|-------|-------|------------|
| 1. Foundation | 4 | ~100 min |
| 2. Database | 3 | ~50 min |
| 3. Backend Auth | 4 | ~120 min |
| 4. Frontend Auth | 9 | ~180 min |
| 5. API Integration | 3 | ~80 min |
| 6. Endpoint Updates | 17 | ~340 min |
| 7. Testing | 5 | ~285 min |
| 8. Production | 4 | ~105 min |
| **Total** | **49 steps** | **~21 hours** |

---

## Execution Order (Optimized)

### Day 1: Foundation
1. Step 1.1-1.4 (Backend config & JWT)
2. Step 2.1-2.3 (Database migration)
3. Step 4.1-4.2 (Frontend setup)

### Day 2: Core Auth
1. Step 3.1-3.4 (Backend dependencies)
2. Step 4.3-4.9 (Frontend auth UI)

### Day 3: Integration
1. Step 5.1-5.3 (API integration)
2. Step 6.1-6.5 (Lists API)
3. Step 6.6 (Videos API)

### Day 4: Endpoint Updates
1. Step 6.7-6.17 (Remaining endpoints)

### Day 5: Testing & Polish
1. Step 7.1-7.5 (All testing)
2. Step 8.1-8.4 (Production readiness)

**Exit Condition:** ✅ 49 granulare, einzeln umsetzbare Schritte
