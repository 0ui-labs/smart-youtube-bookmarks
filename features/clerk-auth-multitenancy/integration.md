# Integration Strategy: Clerk Authentication

## Approach: Incremental Integration with Feature Flag

**Strategie:** Auth wird in Phasen eingeführt, wobei jede Phase einzeln testbar ist. Ein `ENABLE_AUTH` Feature Flag ermöglicht parallele Entwicklung ohne Breaking Changes.

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   main.tsx                                                           │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ <ClerkProvider publishableKey={...}>                         │   │
│   │   <QueryClientProvider>                                      │   │
│   │     <BrowserRouter>                                          │   │
│   │       <WebSocketProvider>  ← Token von useAuth()             │   │
│   │         <App />                                              │   │
│   │       </WebSocketProvider>                                   │   │
│   │     </BrowserRouter>                                         │   │
│   │   </QueryClientProvider>                                     │   │
│   │ </ClerkProvider>                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   App.tsx                                                            │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ <SignedIn>           ← Clerk component                       │   │
│   │   <Routes>                                                   │   │
│   │     <Route path="/videos" element={<VideosPage />} />       │   │
│   │     ...                                                      │   │
│   │   </Routes>                                                  │   │
│   │ </SignedIn>                                                  │   │
│   │ <SignedOut>                                                  │   │
│   │   <RedirectToSignIn />                                       │   │
│   │ </SignedOut>                                                 │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   api.ts (Request Interceptor)                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ api.interceptors.request.use(async (config) => {             │   │
│   │   const token = await getToken()  // Clerk token             │   │
│   │   config.headers.Authorization = `Bearer ${token}`           │   │
│   │   return config                                              │   │
│   │ })                                                           │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP + Bearer Token
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Middleware Layer (deps.py)                                         │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ async def get_current_user(                                  │   │
│   │     authorization: str = Header(...)                         │   │
│   │ ) -> User:                                                   │   │
│   │     token = authorization.replace("Bearer ", "")             │   │
│   │     claims = verify_clerk_jwt(token)  ← JWKS verification    │   │
│   │     user = await get_or_create_user(claims)                  │   │
│   │     return user                                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   API Endpoints (all files)                                          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ @router.get("/lists")                                        │   │
│   │ async def get_lists(                                         │   │
│   │     db: AsyncSession = Depends(get_db),                      │   │
│   │     user: User = Depends(get_current_user)  ← NEU            │   │
│   │ ):                                                           │   │
│   │     stmt = select(BookmarkList).where(                       │   │
│   │         BookmarkList.user_id == user.id  ← Filter            │   │
│   │     )                                                        │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DATABASE                                    │
├─────────────────────────────────────────────────────────────────────┤
│   users                                                              │
│   ├── id (UUID, PK)                                                 │
│   ├── clerk_id (VARCHAR, UNIQUE, INDEX)  ← NEU                      │
│   ├── email (VARCHAR, UNIQUE)                                       │
│   ├── hashed_password (VARCHAR, NULLABLE)  ← Geändert               │
│   └── is_active (BOOLEAN)                                           │
│                                                                      │
│   Existing tables unchanged - user_id FK already present            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Extension Points

### 1. Provider Injection (Frontend)

**Location:** `frontend/src/main.tsx`

**Strategy:** Wrap existing providers with ClerkProvider at the outermost level.

```tsx
// BEFORE
<QueryClientProvider>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</QueryClientProvider>

// AFTER
<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
  <QueryClientProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
</ClerkProvider>
```

**Why outermost?** Clerk hooks (`useAuth`, `useUser`) need ClerkProvider context. QueryClient und Router können drinbleiben.

### 2. Route Protection (Frontend)

**Location:** `frontend/src/App.tsx`

**Strategy:** Use Clerk's built-in components for simplicity.

```tsx
// Option A: Clerk Components (Empfohlen - weniger Code)
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'

function App() {
  return (
    <>
      <SignedIn>
        <Routes>
          {/* All existing routes */}
        </Routes>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

// Option B: Custom ProtectedRoute (mehr Kontrolle)
function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <LoadingSpinner />
  if (!isSignedIn) return <Navigate to="/sign-in" />
  return children
}
```

### 3. Token Injection (Frontend)

**Location:** `frontend/src/lib/api.ts`

**Strategy:** Create auth-aware axios instance via React context.

```tsx
// frontend/src/lib/apiWithAuth.tsx
import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'

export function useApiClient() {
  const { getToken } = useAuth()

  const apiClient = useMemo(() => {
    const instance = axios.create({ baseURL: '/api' })

    instance.interceptors.request.use(async (config) => {
      const token = await getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    return instance
  }, [getToken])

  return apiClient
}
```

**Alternative:** Global interceptor mit getToken aus Clerk's window object (weniger sauber, aber einfacher).

### 4. Dependency Injection (Backend)

**Location:** `backend/app/api/deps.py`

**Strategy:** Create parallel auth dependency, then migrate endpoints one by one.

```python
# Phase 1: Create new dependency alongside old one
async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Optional auth - returns None if no token."""
    if not authorization or not settings.enable_auth:
        return None  # Allow unauthenticated during migration
    # ... verify and return user

# Phase 2: Make it required
async def get_current_user(
    authorization: str = Header(...),  # Required!
    db: AsyncSession = Depends(get_db)
) -> User:
    """Required auth - raises 401 if invalid."""
    # ... verify and return user
```

### 5. JWT Verification (Backend)

**Location:** `backend/app/core/clerk.py` (NEW)

**Strategy:** Use Clerk's JWKS endpoint for RS256 verification.

```python
import httpx
from jose import jwt, jwk
from jose.exceptions import JWTError

class ClerkJWTVerifier:
    def __init__(self, clerk_publishable_key: str):
        # Extract issuer from publishable key
        # pk_test_xxx or pk_live_xxx
        self.issuer = f"https://clerk.{clerk_publishable_key.split('_')[1]}.lcl.dev"
        self._jwks_cache = None

    async def get_jwks(self) -> dict:
        """Fetch JWKS from Clerk (cached)."""
        if self._jwks_cache:
            return self._jwks_cache
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.issuer}/.well-known/jwks.json")
            self._jwks_cache = resp.json()
        return self._jwks_cache

    async def verify(self, token: str) -> dict:
        """Verify Clerk JWT and return claims."""
        jwks = await self.get_jwks()
        # ... RS256 verification
        return claims
```

### 6. User Sync (Backend)

**Strategy:** Create/update user on first API call with valid token.

```python
async def get_or_create_user(
    claims: dict,
    db: AsyncSession
) -> User:
    """Sync Clerk user to database."""
    clerk_id = claims["sub"]
    email = claims.get("email") or claims.get("primary_email")

    # Try to find by clerk_id first
    stmt = select(User).where(User.clerk_id == clerk_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        # Update email if changed
        if user.email != email:
            user.email = email
            await db.commit()
        return user

    # Check if email exists (migration case)
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # Link existing user to Clerk
        existing_user.clerk_id = clerk_id
        await db.commit()
        return existing_user

    # Create new user
    new_user = User(
        clerk_id=clerk_id,
        email=email,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    return new_user
```

---

## Feature Flag Strategy

### Configuration

```python
# backend/app/core/config.py
class Settings(BaseSettings):
    enable_auth: bool = False  # Set True when ready

    # Clerk config
    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
```

### Usage in Dependencies

```python
async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not settings.enable_auth:
        # Development fallback
        return await get_test_user(db)

    if not authorization:
        raise HTTPException(401, "Authorization header required")

    # ... normal auth flow
```

### Rollout Plan

1. **Phase A:** Deploy with `ENABLE_AUTH=false` - everything works as before
2. **Phase B:** Test with `ENABLE_AUTH=true` in staging
3. **Phase C:** Enable in production, monitor errors
4. **Phase D:** Remove feature flag, make auth mandatory

---

## Minimal Disruption Patterns

### 1. Additive Changes Only

```python
# DON'T modify existing function signatures
async def get_lists(db: AsyncSession = Depends(get_db)):
    ...

# DO add new parameter with default
async def get_lists(
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)  # Optional!
):
    if user:
        stmt = stmt.where(BookmarkList.user_id == user.id)
    ...
```

### 2. Preserve Existing Behavior

```python
# During migration: Support both authenticated and unauthenticated
async def get_lists(..., user: Optional[User] = ...):
    stmt = select(BookmarkList)

    if user:
        # New behavior: Filter by user
        stmt = stmt.where(BookmarkList.user_id == user.id)
    else:
        # Legacy behavior: Return all (will be removed)
        pass

    return await db.execute(stmt)
```

### 3. Interface Boundaries

```typescript
// Create abstraction for auth token
interface AuthProvider {
  getToken(): Promise<string | null>
  isAuthenticated(): boolean
}

// Clerk implementation
class ClerkAuthProvider implements AuthProvider {
  constructor(private clerk: ReturnType<typeof useAuth>) {}

  async getToken() {
    return this.clerk.getToken()
  }

  isAuthenticated() {
    return this.clerk.isSignedIn ?? false
  }
}
```

---

## Integration Points Summary

| Layer | Extension Point | Integration Method |
|-------|-----------------|-------------------|
| Frontend Entry | `main.tsx` | Wrap with `<ClerkProvider>` |
| Frontend Routes | `App.tsx` | Add `<SignedIn>/<SignedOut>` |
| Frontend API | `api.ts` | Request interceptor |
| Frontend WS | `WebSocketProvider` | Pass Clerk token |
| Backend Entry | `deps.py` | New `get_current_user` dependency |
| Backend JWT | `core/clerk.py` | JWKS verification (new file) |
| Backend Config | `config.py` | Add Clerk settings |
| Database | Migration | Add `clerk_id` column |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Feature flag, optional auth during migration |
| Token refresh during long sessions | Clerk SDK handles automatically |
| CORS issues with Clerk domains | Whitelist Clerk domains in backend |
| WebSocket reconnection on token refresh | Implement reconnect logic |
| Test suite breaks | Auth fixtures, mock ClerkProvider |

**Exit Condition:** ✅ Klare Integration-Strategie die bestehenden Code minimal ändert
