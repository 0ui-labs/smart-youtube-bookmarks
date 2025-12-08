# Impact Assessment: Clerk Authentication & Multi-Tenancy

## Complexity Rating: **MEDIUM-HIGH**

- Viele Dateien betroffen (30+)
- Aber Änderungen pro Datei sind klein und repetitiv
- Schema bereits vorbereitet (minimale DB-Änderungen)

---

## Backend Impact

### 🔴 High Priority (Sicherheitskritisch)

#### New Files to Create

| File | Purpose |
|------|---------|
| `backend/app/core/clerk.py` | Clerk JWT verification, JWKS handling |
| `backend/app/api/auth.py` | Optional: Webhook für Clerk events |

#### Files to Modify Significantly

| File | Changes | Lines Affected |
|------|---------|----------------|
| `backend/app/api/deps.py` | Add `get_current_user` dependency | +30-40 lines |
| `backend/app/core/config.py` | Add Clerk environment variables | +5 lines |
| `backend/app/models/user.py` | Add `clerk_id` field, make password nullable | +3 lines |

### 🟡 Medium Priority (All API Endpoints)

Jede API-Datei braucht:
1. Import von `get_current_user`
2. Dependency in jedem Endpoint
3. Query-Filter nach `user_id`

| File | Endpoints | Effort |
|------|-----------|--------|
| `backend/app/api/lists.py` | 5 endpoints | Medium |
| `backend/app/api/videos.py` | 8+ endpoints | Medium |
| `backend/app/api/tags.py` | 4 endpoints | Low (partial exists) |
| `backend/app/api/channels.py` | 4 endpoints | Low |
| `backend/app/api/schemas.py` | 4 endpoints | Low |
| `backend/app/api/custom_fields.py` | 4 endpoints | Low |
| `backend/app/api/schema_fields.py` | 3 endpoints | Low |
| `backend/app/api/analytics.py` | 2 endpoints | Low |
| `backend/app/api/search.py` | 2 endpoints | Low |
| `backend/app/api/enrichment.py` | 2 endpoints | Low |
| `backend/app/api/processing.py` | 3 endpoints | Low |
| `backend/app/api/websocket.py` | 1 endpoint | Medium (already has auth) |

**Total: 14 API files, ~42 endpoints**

### 🟢 Low Priority

| File | Changes |
|------|---------|
| `backend/app/main.py` | Optional: CORS config update |
| `backend/requirements.txt` | Add `clerk-sdk-python` |

---

## Database Impact

### Schema Changes

| Table | Change | Migration Type |
|-------|--------|----------------|
| `users` | Add `clerk_id VARCHAR UNIQUE` | Non-breaking |
| `users` | Make `hashed_password` nullable | Non-breaking |

### Migration Script

```sql
-- Non-breaking migration
ALTER TABLE users ADD COLUMN clerk_id VARCHAR(255) UNIQUE;
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
CREATE INDEX ix_users_clerk_id ON users(clerk_id);
```

### Data Migration

| Scenario | Action |
|----------|--------|
| Existing test user | Keep, assign to first Clerk user on login |
| Test user data | Preserved, ownership transferred |

---

## Frontend Impact

### 🔴 High Priority

#### New Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/components/ProtectedRoute.tsx` | Route guard component |
| `frontend/src/hooks/useAuth.ts` | Auth helper hooks |
| `frontend/src/pages/SignIn.tsx` | Optional: Custom sign-in page |
| `frontend/src/pages/SignUp.tsx` | Optional: Custom sign-up page |

#### Files to Modify Significantly

| File | Changes |
|------|---------|
| `frontend/src/main.tsx` | Wrap with `<ClerkProvider>` |
| `frontend/src/App.tsx` | Wrap routes with `<ProtectedRoute>` |
| `frontend/src/lib/api.ts` | Add request interceptor for token |

### 🟡 Medium Priority

| File | Changes |
|------|---------|
| `frontend/src/components/WebSocketProvider/` | Use Clerk token instead of custom JWT |
| `frontend/src/components/Layout/` | Add user menu, logout button |

### 🟢 Low Priority

| File | Changes |
|------|---------|
| `frontend/package.json` | Add `@clerk/clerk-react` |
| `frontend/.env` | Add `VITE_CLERK_PUBLISHABLE_KEY` |
| `frontend/vite.config.ts` | No changes needed |

---

## Environment & Configuration

### New Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `CLERK_PUBLISHABLE_KEY` | Frontend (.env) | Clerk frontend SDK |
| `CLERK_SECRET_KEY` | Backend (.env) | Clerk backend API |
| `CLERK_WEBHOOK_SECRET` | Backend (.env) | Optional: Webhook verification |

### Clerk Dashboard Setup

- [ ] Create Clerk application
- [ ] Configure OAuth providers (Google, GitHub)
- [ ] Set allowed origins (localhost:5173, production URL)
- [ ] Configure JWT template (optional)
- [ ] Setup webhook endpoint (optional)

---

## Test Impact

### Backend Tests

| Test File | Impact |
|-----------|--------|
| All API tests | Need auth mocking |
| `tests/conftest.py` | Add auth fixtures |

### Frontend Tests

| Area | Impact |
|------|--------|
| Component tests | Mock ClerkProvider |
| E2E tests | Mock or use test accounts |

---

## Impact Summary by Category

### Files Changed

| Category | Count |
|----------|-------|
| Backend - New | 2 |
| Backend - Modified | 17 |
| Frontend - New | 4 |
| Frontend - Modified | 5 |
| Config/Env | 3 |
| **Total** | **31** |

### Effort Breakdown

| Category | Estimated Hours |
|----------|----------------|
| Backend auth core | 4-6h |
| Backend endpoint updates | 4-6h |
| Database migration | 1h |
| Frontend auth setup | 2-3h |
| Frontend route protection | 2h |
| Testing updates | 4-6h |
| **Total** | **17-24h** |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Token refresh issues | Medium | High | Use Clerk SDK's built-in refresh |
| WebSocket auth regression | Medium | Medium | Keep fallback during transition |
| Query performance (user filter) | Low | Low | Indexes already exist |
| CORS issues | Medium | Low | Test early with production config |
| Test user data loss | Low | Medium | Careful migration script |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    CLERK DASHBOARD                          │
│        (OAuth Providers, Keys, Webhook Config)              │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌──────────┐        ┌──────────┐       ┌──────────┐
    │ Frontend │        │ Backend  │       │ Database │
    │ ClerkSDK │◄──────►│ JWT      │◄─────►│ users    │
    └──────────┘        │ Verify   │       │ clerk_id │
          │             └──────────┘       └──────────┘
          │                   │
          ▼                   ▼
    ┌──────────┐        ┌──────────┐
    │ Protected│        │ All API  │
    │ Routes   │        │ Endpoints│
    └──────────┘        └──────────┘
```

**Exit Condition:** ✅ Vollständige Liste aller betroffenen Bereiche
