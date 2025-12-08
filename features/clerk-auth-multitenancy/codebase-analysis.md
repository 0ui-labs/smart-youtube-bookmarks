# Codebase Analysis: Authentication & Multi-Tenancy Readiness

## Tech Stack Overview

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| **Backend** | FastAPI | 0.109.0 | Async Python web framework |
| **Database** | PostgreSQL | - | Via asyncpg driver |
| **ORM** | SQLAlchemy | 2.0 | Async ORM with mapped columns |
| **Frontend** | React | 18.2.0 | With TypeScript |
| **Build** | Vite | - | Dev server + bundler |
| **Routing** | React Router | v6 | Client-side routing |
| **State** | TanStack Query + Zustand | - | Server + client state |
| **HTTP Client** | Axios | - | With interceptors |

## Architecture Patterns

### Backend (FastAPI)

```
backend/app/
├── api/                    # Route handlers (14 files)
│   ├── deps.py             # Dependency injection (auth hier!)
│   ├── lists.py            # CRUD for bookmark lists
│   ├── videos.py           # Video management
│   ├── tags.py             # Tag management
│   ├── channels.py         # Channel management
│   ├── schemas.py          # Field schemas
│   ├── custom_fields.py    # Custom field definitions
│   ├── analytics.py        # Usage analytics
│   ├── search.py           # Search functionality
│   ├── enrichment.py       # AI enrichment
│   ├── processing.py       # Background jobs
│   └── websocket.py        # WebSocket für Progress
├── core/
│   ├── config.py           # Settings (Pydantic BaseSettings)
│   └── database.py         # Async DB session factory
├── models/                 # SQLAlchemy models
│   ├── user.py             # User model (existiert!)
│   ├── list.py             # BookmarkList
│   ├── video.py            # Video
│   ├── tag.py              # Tag
│   └── channel.py          # Channel
└── main.py                 # App entry, router registration
```

**Dependency Injection Pattern:**
```python
# Aktuell: Nur DB-Session
async def get_lists(db: AsyncSession = Depends(get_db)):
    ...

# Ziel: DB + authentifizierter User
async def get_lists(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)  # NEU
):
    ...
```

### Frontend (React)

```
frontend/src/
├── components/             # UI Components
│   ├── WebSocketProvider/  # WebSocket context
│   ├── ErrorBoundary/      # Error handling
│   └── ...                 # Feature components
├── hooks/                  # React Query hooks
│   ├── useLists.ts         # List CRUD
│   ├── useVideos.ts        # Video CRUD
│   └── ...
├── lib/
│   ├── api.ts              # Axios instance
│   └── queryClient.ts      # React Query client
├── stores/                 # Zustand stores (UI state)
├── App.tsx                 # Main app + routes
└── main.tsx                # Entry point
```

**Provider Hierarchy (aktuell):**
```tsx
<React.StrictMode>
  <ErrorBoundary>
    <QueryClientProvider>
      <BrowserRouter>
        <WebSocketProvider>
          <App />  {/* Alle Routes ungeschützt! */}
        </WebSocketProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
</React.StrictMode>
```

## Existing User Infrastructure

### User Model (`backend/app/models/user.py`)

```python
class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relationships - BEREITS DEFINIERT!
    lists: Mapped[list["BookmarkList"]] = relationship(...)
    tags: Mapped[list["Tag"]] = relationship(...)
    channels: Mapped[list["Channel"]] = relationship(...)
```

**Fehlende Felder für Clerk:**
- `clerk_id: str` - Clerk's User ID (sub claim)
- `hashed_password` kann nullable werden (Clerk managed passwords)

### Foreign Key Relationships

| Model | FK to User | Cascade | Status |
|-------|------------|---------|--------|
| `BookmarkList` | `user_id` (direct) | ON DELETE CASCADE | ✅ Ready |
| `Tag` | `user_id` (direct) | - | ✅ Ready |
| `Channel` | `user_id` (direct) | ON DELETE CASCADE | ✅ Ready |
| `Video` | via `list_id` | Indirect through List | ✅ Ready |
| `CustomField` | via `list_id` | Indirect through List | ✅ Ready |
| `FieldSchema` | via `list_id` | Indirect through List | ✅ Ready |

## Current Auth Implementation

### WebSocket Auth (`backend/app/api/deps.py`)

```python
async def get_current_ws_user(websocket: WebSocket, token: str) -> User:
    """EINZIGE echte JWT-Verifizierung im System!"""
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    user_id = payload.get("sub")
    # ... query user from DB
```

**Problem:** Nutzt eigenen JWT, nicht Clerk. Muss auf Clerk JWKS umgestellt werden.

### REST API Auth: NICHT VORHANDEN

Alle REST Endpoints haben **keine Authentifizierung**:

```python
# backend/app/api/lists.py - KEIN Auth-Check!
@router.get("", response_model=List[ListResponse])
async def get_lists(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BookmarkList))  # ALLE Listen!
    return lists
```

### Test User Pattern (Sicherheitsrisiko)

```python
# backend/app/api/tags.py
async def get_user_for_testing(db: AsyncSession, user_id: Optional[UUID] = Query(None)):
    """GEFÄHRLICH: Defaults zu erstem User in DB!"""
    if user_id:
        stmt = select(User).where(User.id == user_id)
    else:
        result = await db.execute(select(User))
        user = result.scalars().first()  # ERSTER USER!
```

## API Client Configuration

### Axios Setup (`frontend/src/lib/api.ts`)

```typescript
export const api = axios.create({
  baseURL: '/api',
})

// Response interceptor - 401 handling vorbereitet!
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized - authentication required')
      // TODO: Redirect zu Login
    }
    return Promise.reject(error)
  }
)
```

**Fehlend:**
- Request interceptor für Authorization header
- Clerk token injection

## Database Configuration

### Settings (`backend/app/core/config.py`)

```python
class Settings(BaseSettings):
    env: str = "development"
    database_url: str = "postgresql+asyncpg://..."

    # JWT Settings (eigene Implementation)
    secret_key: str = "your-secret-key-here"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # TODO: Clerk settings
    # clerk_publishable_key: str = ""
    # clerk_secret_key: str = ""
```

## Similar Features / Pattern References

### Existing Patterns to Follow

1. **Dependency Injection:** `Depends(get_db)` pattern well established
2. **Response Models:** Pydantic models for all responses
3. **Error Handling:** HTTPException mit status codes
4. **Async/Await:** Durchgängig async
5. **React Query:** Alle API calls via hooks

### Integration Points

| Component | Integration Point | What to Add |
|-----------|-------------------|-------------|
| `main.tsx` | Provider wrapper | `<ClerkProvider>` |
| `App.tsx` | Route definitions | `<ProtectedRoute>` wrapper |
| `api.ts` | Axios interceptors | Token injection |
| `deps.py` | Dependencies | `get_current_user` |
| Alle API routes | Endpoint functions | User dependency |

## Code Style & Conventions

### Backend
- Snake_case für Variablen/Funktionen
- PascalCase für Klassen
- Type hints überall
- Docstrings für public functions
- Pydantic für Request/Response validation

### Frontend
- camelCase für Variablen/Funktionen
- PascalCase für Components
- TypeScript strict mode
- React Query für server state
- Zustand für UI state

## Summary

| Aspect | Status | Effort |
|--------|--------|--------|
| User model | ✅ Exists | Low (add clerk_id) |
| FK relationships | ✅ Complete | None |
| Dependency pattern | ✅ Established | Low (add auth dep) |
| JWT verification | ⚠️ Exists but wrong | Medium (switch to Clerk) |
| REST auth | ❌ Missing | Medium (14 API files) |
| Frontend providers | ⚠️ Partial | Low (add ClerkProvider) |
| Token injection | ❌ Missing | Low (interceptor) |
| Protected routes | ❌ Missing | Low (wrapper component) |

**Exit Condition:** ✅ Klares Bild wo/wie Integration erfolgt
