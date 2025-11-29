# Research & Validation: Clerk Best Practices

## Key Findings

### 🎉 Vereinfachung: Offizielles Clerk Python SDK

**Ursprünglicher Plan:** Eigene JWT-Verifizierung mit PyJWT und JWKS-Fetching

**Besserer Ansatz:** Clerk's offizielles Python SDK `clerk-backend-api`

```python
# Installation
pip install clerk-backend-api
```

```python
# Einfache Authentifizierung
from clerk_backend_api import Clerk
from clerk_backend_api.security import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions

sdk = Clerk(bearer_auth=os.getenv('CLERK_SECRET_KEY'))

request_state = sdk.authenticate_request(
    request,
    AuthenticateRequestOptions(
        authorized_parties=['https://your-app.com']
    )
)

if request_state.is_signed_in:
    user_id = request_state.payload["sub"]  # Clerk User ID
    # ...
```

**Vorteile:**
- ✅ Keine manuelle JWT-Verifizierung
- ✅ JWKS-Caching eingebaut
- ✅ Token-Refresh automatisch
- ✅ Offiziell unterstützt
- ✅ Weniger Code, weniger Fehlerquellen

---

## Updated Integration Strategy

### Backend Dependency (Vereinfacht)

```python
# backend/app/api/deps.py
import os
from fastapi import Request, HTTPException, Depends
from clerk_backend_api import Clerk
from clerk_backend_api.security import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

# Initialize Clerk SDK once
clerk = Clerk(bearer_auth=settings.clerk_secret_key)

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Authenticate request using Clerk SDK.
    Returns database User object.
    """
    # Convert FastAPI request to format Clerk expects
    # Note: May need adapter for FastAPI -> httpx.Request

    request_state = clerk.authenticate_request(
        request,
        AuthenticateRequestOptions(
            authorized_parties=[settings.frontend_url]
        )
    )

    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=401,
            detail=request_state.reason or "Unauthorized"
        )

    # Get Clerk user ID from token payload
    clerk_id = request_state.payload["sub"]
    email = request_state.payload.get("email")

    # Get or create database user
    return await get_or_create_user(clerk_id, email, db)
```

### FastAPI Request Adapter

```python
# backend/app/core/clerk.py
import httpx
from fastapi import Request

def fastapi_to_httpx_request(fastapi_request: Request) -> httpx.Request:
    """Convert FastAPI Request to httpx Request for Clerk SDK."""
    return httpx.Request(
        method=fastapi_request.method,
        url=str(fastapi_request.url),
        headers=dict(fastapi_request.headers),
    )
```

---

## Clerk JWT Token Structure

### Claims Available in `request_state.payload`

```json
{
  "azp": "http://localhost:5173",      // Authorized party (frontend URL)
  "exp": 1687906422,                   // Expiration timestamp
  "iat": 1687906362,                   // Issued at timestamp
  "iss": "https://xxx.clerk.accounts.dev",  // Issuer (Clerk)
  "nbf": 1687906352,                   // Not before timestamp
  "sid": "sess_2Ro7e2...",             // Session ID
  "sub": "user_2RfWKJ..."              // User ID (use this!)
}
```

**Wichtig:** `sub` ist die Clerk User ID, die wir als `clerk_id` in der DB speichern.

---

## Frontend Best Practices

### Token Acquisition

```tsx
import { useAuth } from '@clerk/clerk-react'

function MyComponent() {
  const { getToken } = useAuth()

  const fetchData = async () => {
    // getToken() returns fresh token, handles refresh automatically
    const token = await getToken()

    const response = await fetch('/api/data', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
  }
}
```

### Axios Interceptor Pattern

```tsx
// frontend/src/lib/api.ts
import axios from 'axios'

// Token getter will be set by AuthProvider
let getTokenFn: (() => Promise<string | null>) | null = null

export const setTokenGetter = (fn: () => Promise<string | null>) => {
  getTokenFn = fn
}

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(async (config) => {
  if (getTokenFn) {
    const token = await getTokenFn()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})
```

```tsx
// In App.tsx or AuthProvider
import { useAuth } from '@clerk/clerk-react'
import { setTokenGetter } from './lib/api'

function AuthenticatedApp() {
  const { getToken } = useAuth()

  useEffect(() => {
    setTokenGetter(getToken)
  }, [getToken])

  // ...
}
```

---

## Security Best Practices

### 1. Authorized Parties

```python
AuthenticateRequestOptions(
    authorized_parties=[
        'https://your-production-domain.com',
        'http://localhost:5173'  # Only in development!
    ]
)
```

**Empfehlung:** Authorized Parties aus Environment Variable laden:

```python
# config.py
authorized_parties: list[str] = Field(default_factory=list)

# Usage
AuthenticateRequestOptions(
    authorized_parties=settings.authorized_parties
)
```

### 2. Token in Header, nicht Query

```
✅ Authorization: Bearer <token>
❌ /api/data?token=<token>  (visible in logs!)
```

**Ausnahme:** WebSocket muss Query-Param verwenden (kein Header-Support).

### 3. Fehler-Responses

```python
# DON'T leak information
raise HTTPException(401, detail=str(error))  # ❌ Could expose internals

# DO use generic message
raise HTTPException(401, detail="Unauthorized")  # ✅
```

### 4. CORS Configuration

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "https://your-production-domain.com",
    ],
    allow_credentials=True,  # Important for cookies!
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Validated Approach Updates

### Changes from Original Plan

| Aspect | Original Plan | Updated Plan |
|--------|--------------|--------------|
| JWT Verification | Custom PyJWT + JWKS | Clerk Python SDK |
| Dependencies | PyJWT, httpx | clerk-backend-api |
| Code Complexity | ~100 lines | ~30 lines |
| JWKS Caching | Manual | Built-in |
| Token Refresh | Manual | Automatic |

### Updated requirements.txt

```
# Remove (not needed)
# PyJWT[crypto]>=2.8.0
# httpx>=0.25.0

# Add
clerk-backend-api>=1.0.0
```

### Updated Atomic Steps

**Replace Steps 1.2-1.4 with:**

| Step | Description | Time |
|------|-------------|------|
| 1.2 | Install clerk-backend-api | 5 min |
| 1.3 | Create FastAPI request adapter | 15 min |
| 1.4 | Test authentication with SDK | 20 min |

**Total time saved:** ~60 minutes

---

## WebSocket Authentication

### Clerk Approach for WebSocket

```python
# backend/app/api/websocket.py
from clerk_backend_api import Clerk

@router.websocket("/ws/progress")
async def websocket_progress(
    websocket: WebSocket,
    token: str = Query(...)
):
    """
    WebSocket with Clerk token authentication.
    Token passed as query parameter (WS limitation).
    """
    # Create a mock request for Clerk SDK
    mock_request = httpx.Request(
        method="GET",
        url=str(websocket.url),
        headers={"Authorization": f"Bearer {token}"}
    )

    request_state = clerk.authenticate_request(
        mock_request,
        AuthenticateRequestOptions(
            authorized_parties=settings.authorized_parties
        )
    )

    if not request_state.is_signed_in:
        await websocket.close(code=1008)  # Policy Violation
        return

    await websocket.accept()
    # ... handle WebSocket communication
```

---

## Clerk Dashboard Configuration

### Required Settings

1. **OAuth Providers:**
   - Google: Enable, add Client ID/Secret
   - GitHub: Enable, add Client ID/Secret

2. **Allowed Origins:**
   ```
   http://localhost:5173  (development)
   https://your-app.com   (production)
   ```

3. **Session Settings:**
   - Session lifetime: 7 days (adjustable)
   - Multi-session: Disabled (or enabled if needed)

4. **Environment Variables to Copy:**
   - `CLERK_PUBLISHABLE_KEY` → Frontend
   - `CLERK_SECRET_KEY` → Backend

---

## Performance Considerations

### Token Verification

- **Networkless verification:** Use `jwtKey` if you want to verify without network calls
- **Default:** SDK calls Clerk API (slight latency, but always fresh)

```python
# Optional: Networkless verification
AuthenticateRequestOptions(
    jwt_key=settings.clerk_jwt_key  # From Clerk Dashboard
)
```

### Database Queries

- User lookup by `clerk_id` is indexed (fast)
- Consider caching user object in request state for multiple accesses

---

## Alternative Libraries Considered

| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| **clerk-backend-api** | Official, maintained, simple | Python-specific | ✅ Use this |
| **PyJWT** | Full control | Manual JWKS, more code | ❌ Skip |
| **python-jose** | Popular | Same as PyJWT | ❌ Skip |
| **authlib** | Feature-rich | Overkill for Clerk | ❌ Skip |

---

## Conclusion

### Validated Decisions

1. ✅ **Use Clerk Python SDK** - Much simpler than manual JWT verification
2. ✅ **User-based multi-tenancy** - Schema already supports this
3. ✅ **Feature flag approach** - Safe rollout strategy
4. ✅ **Clerk's built-in components** - Less custom UI code
5. ✅ **Authorization header pattern** - Industry standard

### Risks Mitigated

1. **JWT verification bugs** → Using official SDK
2. **Token refresh issues** → Clerk SDK handles automatically
3. **JWKS caching** → Built into SDK
4. **Security vulnerabilities** → Following Clerk's best practices

### Ready for Implementation

The plan is validated and simplified. Key improvement: **Using `clerk-backend-api` reduces complexity significantly.**

**Exit Condition:** ✅ Approach validated with official documentation and best practices
