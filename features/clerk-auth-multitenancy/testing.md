# Testing Strategy: Clerk Authentication

## Test Pyramid

```
                    ┌─────────┐
                   /   E2E    \         5-10 tests
                  /  (Cypress) \        Full user flows
                 ┌──────────────┐
                /  Integration   \      20-30 tests
               /   (pytest +     \      API + DB + Auth
              /     vitest)       \
             ┌────────────────────┐
            /        Unit          \    50+ tests
           /    (pytest + vitest)   \   Individual functions
          └──────────────────────────┘
```

---

## Backend Testing

### Unit Tests

#### JWT Verification (`backend/tests/unit/test_clerk.py`)

```python
import pytest
from unittest.mock import patch, AsyncMock
from app.core.clerk import ClerkJWTVerifier, InvalidTokenError

class TestClerkJWTVerifier:

    @pytest.fixture
    def verifier(self):
        return ClerkJWTVerifier("pk_test_xxx")

    async def test_verify_valid_token(self, verifier):
        """Valid JWT should return claims."""
        with patch.object(verifier, 'get_jwks', new_callable=AsyncMock) as mock_jwks:
            mock_jwks.return_value = MOCK_JWKS
            claims = await verifier.verify(VALID_TEST_TOKEN)

            assert claims["sub"] == "user_xxx"
            assert claims["email"] == "test@example.com"

    async def test_verify_expired_token(self, verifier):
        """Expired token should raise InvalidTokenError."""
        with pytest.raises(InvalidTokenError, match="expired"):
            await verifier.verify(EXPIRED_TOKEN)

    async def test_verify_invalid_signature(self, verifier):
        """Tampered token should raise InvalidTokenError."""
        with pytest.raises(InvalidTokenError, match="signature"):
            await verifier.verify(TAMPERED_TOKEN)

    async def test_verify_wrong_issuer(self, verifier):
        """Token from wrong issuer should fail."""
        with pytest.raises(InvalidTokenError, match="issuer"):
            await verifier.verify(WRONG_ISSUER_TOKEN)

    async def test_jwks_caching(self, verifier):
        """JWKS should be cached after first fetch."""
        with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value.json.return_value = MOCK_JWKS

            await verifier.get_jwks()
            await verifier.get_jwks()

            assert mock_get.call_count == 1  # Only fetched once
```

#### User Sync (`backend/tests/unit/test_user_sync.py`)

```python
class TestGetOrCreateUser:

    async def test_creates_new_user(self, db_session):
        """New Clerk user should create DB user."""
        claims = {"sub": "user_new", "email": "new@example.com"}

        user = await get_or_create_user(claims, db_session)

        assert user.clerk_id == "user_new"
        assert user.email == "new@example.com"
        assert user.is_active == True

    async def test_links_existing_user_by_email(self, db_session, existing_user):
        """Existing email should link to Clerk ID."""
        claims = {"sub": "user_clerk_123", "email": existing_user.email}

        user = await get_or_create_user(claims, db_session)

        assert user.id == existing_user.id
        assert user.clerk_id == "user_clerk_123"

    async def test_returns_existing_clerk_user(self, db_session, clerk_user):
        """Existing Clerk user should be returned."""
        claims = {"sub": clerk_user.clerk_id, "email": clerk_user.email}

        user = await get_or_create_user(claims, db_session)

        assert user.id == clerk_user.id

    async def test_handles_email_change(self, db_session, clerk_user):
        """Email change in Clerk should update DB."""
        claims = {"sub": clerk_user.clerk_id, "email": "new-email@example.com"}

        user = await get_or_create_user(claims, db_session)

        assert user.email == "new-email@example.com"
```

### Integration Tests

#### Auth Dependencies (`backend/tests/integration/test_auth_deps.py`)

```python
class TestGetCurrentUser:

    async def test_valid_token_returns_user(self, client, valid_token, test_user):
        """Valid token should return authenticated user."""
        response = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {valid_token}"}
        )

        assert response.status_code == 200

    async def test_missing_token_returns_401(self, client):
        """Missing token should return 401."""
        response = await client.get("/api/lists")

        assert response.status_code == 401
        assert response.json()["detail"] == "Authorization header required"

    async def test_invalid_token_returns_401(self, client):
        """Invalid token should return 401."""
        response = await client.get(
            "/api/lists",
            headers={"Authorization": "Bearer invalid_token"}
        )

        assert response.status_code == 401

    async def test_expired_token_returns_401(self, client, expired_token):
        """Expired token should return 401."""
        response = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {expired_token}"}
        )

        assert response.status_code == 401
```

#### Data Isolation (`backend/tests/integration/test_data_isolation.py`)

```python
class TestDataIsolation:

    async def test_user_sees_only_own_lists(
        self, client, user_a_token, user_b_token, user_a_list, user_b_list
    ):
        """User should only see their own lists."""
        # User A sees only their list
        response_a = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        list_ids_a = [l["id"] for l in response_a.json()]
        assert user_a_list.id in list_ids_a
        assert user_b_list.id not in list_ids_a

        # User B sees only their list
        response_b = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {user_b_token}"}
        )
        list_ids_b = [l["id"] for l in response_b.json()]
        assert user_b_list.id in list_ids_b
        assert user_a_list.id not in list_ids_b

    async def test_cannot_access_other_users_list(
        self, client, user_a_token, user_b_list
    ):
        """User should not access other user's list by ID."""
        response = await client.get(
            f"/api/lists/{user_b_list.id}/videos",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )

        assert response.status_code == 404  # Not 403 to prevent enumeration

    async def test_cannot_delete_other_users_list(
        self, client, user_a_token, user_b_list
    ):
        """User should not delete other user's list."""
        response = await client.delete(
            f"/api/lists/{user_b_list.id}",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )

        assert response.status_code == 404

    async def test_cannot_modify_other_users_video(
        self, client, user_a_token, user_b_video
    ):
        """User should not modify other user's video."""
        response = await client.patch(
            f"/api/videos/{user_b_video.id}",
            headers={"Authorization": f"Bearer {user_a_token}"},
            json={"title": "Hacked!"}
        )

        assert response.status_code == 404
```

### Test Fixtures

```python
# backend/tests/conftest.py

@pytest.fixture
def mock_clerk_verifier():
    """Mock Clerk JWT verification."""
    async def verify(token: str) -> dict:
        # Parse test tokens: "test_token_user_xxx" -> user_xxx
        if token.startswith("test_token_"):
            user_id = token.replace("test_token_", "")
            return {
                "sub": f"clerk_{user_id}",
                "email": f"{user_id}@test.com"
            }
        raise InvalidTokenError("Invalid test token")
    return verify


@pytest.fixture
def user_a_token():
    return "test_token_user_a"


@pytest.fixture
def user_b_token():
    return "test_token_user_b"


@pytest.fixture
async def user_a(db_session):
    user = User(clerk_id="clerk_user_a", email="user_a@test.com")
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def user_a_list(db_session, user_a):
    list_ = BookmarkList(name="User A's List", user_id=user_a.id)
    db_session.add(list_)
    await db_session.commit()
    return list_
```

---

## Frontend Testing

### Unit Tests

#### API Client (`frontend/src/lib/__tests__/api.test.ts`)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthenticatedApi } from '../api'

describe('createAuthenticatedApi', () => {
  const mockGetToken = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add Authorization header when token available', async () => {
    mockGetToken.mockResolvedValue('test_token')
    const api = createAuthenticatedApi(mockGetToken)

    // Mock axios request
    const config = await api.interceptors.request.handlers[0].fulfilled({
      headers: {}
    })

    expect(config.headers.Authorization).toBe('Bearer test_token')
  })

  it('should not add header when no token', async () => {
    mockGetToken.mockResolvedValue(null)
    const api = createAuthenticatedApi(mockGetToken)

    const config = await api.interceptors.request.handlers[0].fulfilled({
      headers: {}
    })

    expect(config.headers.Authorization).toBeUndefined()
  })
})
```

#### Auth State (`frontend/src/hooks/__tests__/useAuth.test.tsx`)

```typescript
import { renderHook } from '@testing-library/react'
import { useAuth } from '@clerk/clerk-react'
import { useAuthState } from '../useAuthState'

vi.mock('@clerk/clerk-react')

describe('useAuthState', () => {
  it('should return loading state initially', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: false,
      isSignedIn: undefined,
    } as any)

    const { result } = renderHook(() => useAuthState())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should return authenticated when signed in', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
    } as any)

    const { result } = renderHook(() => useAuthState())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(true)
  })
})
```

### Component Tests

#### ProtectedRoute (`frontend/src/components/__tests__/ProtectedRoute.test.tsx`)

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ProtectedRoute } from '../ProtectedRoute'

vi.mock('@clerk/clerk-react')

describe('ProtectedRoute', () => {
  it('should show loading while auth checking', () => {
    vi.mocked(useAuth).mockReturnValue({ isLoaded: false } as any)

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should show content when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: true,
      isSignedIn: true
    } as any)

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('should redirect when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: true,
      isSignedIn: false
    } as any)

    render(
      <MemoryRouter initialEntries={['/videos']}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    // Check redirect happened
  })
})
```

---

## E2E Tests (Cypress)

### Auth Flow Tests

```typescript
// cypress/e2e/auth.cy.ts

describe('Authentication', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('should redirect to sign-in when not authenticated', () => {
    cy.visit('/videos')
    cy.url().should('include', '/sign-in')
  })

  it('should complete sign-up flow', () => {
    cy.visit('/sign-up')

    // Fill Clerk sign-up form
    cy.get('input[name="emailAddress"]').type('newuser@test.com')
    cy.get('input[name="password"]').type('SecurePassword123!')
    cy.get('button[type="submit"]').click()

    // Should redirect to app after sign-up
    cy.url().should('include', '/videos')
  })

  it('should complete sign-in flow', () => {
    // Seed test user in Clerk (or use existing)
    cy.visit('/sign-in')

    cy.get('input[name="identifier"]').type('testuser@test.com')
    cy.get('button[type="submit"]').click()
    cy.get('input[name="password"]').type('TestPassword123!')
    cy.get('button[type="submit"]').click()

    cy.url().should('include', '/videos')
    cy.get('[data-testid="user-button"]').should('be.visible')
  })

  it('should sign out successfully', () => {
    cy.login('testuser@test.com', 'TestPassword123!')
    cy.visit('/videos')

    cy.get('[data-testid="user-button"]').click()
    cy.get('[data-testid="sign-out"]').click()

    cy.url().should('include', '/sign-in')
  })
})
```

### Data Isolation E2E

```typescript
// cypress/e2e/data-isolation.cy.ts

describe('Data Isolation', () => {
  const userA = { email: 'user-a@test.com', password: 'TestA123!' }
  const userB = { email: 'user-b@test.com', password: 'TestB123!' }

  it('should not show other users data', () => {
    // Login as User A, create list
    cy.login(userA.email, userA.password)
    cy.visit('/videos')
    cy.createList('User A Private List')

    // Logout and login as User B
    cy.logout()
    cy.login(userB.email, userB.password)
    cy.visit('/videos')

    // Should not see User A's list
    cy.contains('User A Private List').should('not.exist')
  })

  it('should not access other users list via URL', () => {
    // Get User A's list ID
    cy.login(userA.email, userA.password)
    let listId: string
    cy.request('/api/lists').then((response) => {
      listId = response.body[0].id
    })

    // Login as User B
    cy.logout()
    cy.login(userB.email, userB.password)

    // Try to access User A's list directly
    cy.request({
      url: `/api/lists/${listId}/videos`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(404)
    })
  })
})
```

---

## Security Tests

### OWASP Top 10 Checklist

| Vulnerability | Test | Status |
|--------------|------|--------|
| **A01 Broken Access Control** | Data isolation tests | ☐ |
| **A02 Cryptographic Failures** | JWT uses RS256, not HS256 | ☐ |
| **A03 Injection** | Parameterized queries (SQLAlchemy) | ☐ |
| **A04 Insecure Design** | Auth required on all endpoints | ☐ |
| **A05 Security Misconfiguration** | No debug mode in prod | ☐ |
| **A06 Vulnerable Components** | Dependency audit | ☐ |
| **A07 Auth Failures** | Token verification tests | ☐ |

### Security Test Suite

```python
# backend/tests/security/test_auth_security.py

class TestAuthSecurity:

    async def test_cannot_forge_jwt(self, client):
        """Forged JWT should be rejected."""
        forged_token = create_forged_jwt({"sub": "user_xxx"})

        response = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {forged_token}"}
        )

        assert response.status_code == 401

    async def test_cannot_use_expired_token(self, client, expired_token):
        """Expired tokens should be rejected."""
        response = await client.get(
            "/api/lists",
            headers={"Authorization": f"Bearer {expired_token}"}
        )

        assert response.status_code == 401

    async def test_error_messages_no_info_leak(self, client):
        """Error messages should not reveal system info."""
        response = await client.get(
            "/api/lists",
            headers={"Authorization": "Bearer invalid"}
        )

        # Should say "Unauthorized", not "JWT decode failed at line..."
        assert "decode" not in response.json()["detail"].lower()
        assert "line" not in response.json()["detail"].lower()

    async def test_cannot_enumerate_user_ids(self, client, user_a_token):
        """Should return 404, not 403, for other users' resources."""
        # Try random UUIDs
        for _ in range(10):
            fake_id = str(uuid.uuid4())
            response = await client.get(
                f"/api/lists/{fake_id}/videos",
                headers={"Authorization": f"Bearer {user_a_token}"}
            )
            # Should be 404, not 403 (prevents ID enumeration)
            assert response.status_code == 404
```

---

## Test Data Management

### Fixtures

```python
# Clerk Test Users (created in Clerk Dashboard)
TEST_USERS = {
    "user_a": {
        "clerk_id": "user_2xxx",
        "email": "test-a@example.com"
    },
    "user_b": {
        "clerk_id": "user_2yyy",
        "email": "test-b@example.com"
    }
}
```

### Database Seeding

```python
# backend/tests/seed_test_data.py

async def seed_test_users(db: AsyncSession):
    """Create test users for integration tests."""
    for name, data in TEST_USERS.items():
        user = User(
            clerk_id=data["clerk_id"],
            email=data["email"],
            is_active=True
        )
        db.add(user)
    await db.commit()
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    env:
      DATABASE_URL: postgresql+asyncpg://postgres:test@localhost/test
      CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_TEST_KEY }}
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: pytest --cov=app

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Cypress
        run: npx cypress run
```

---

## Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| `core/clerk.py` | 100% |
| `api/deps.py` (auth functions) | 100% |
| API endpoints | 80% |
| Frontend auth components | 90% |
| E2E critical paths | All happy paths |

**Exit Condition:** ✅ Vollständige Test-Strategie für Auth und Sicherheit
