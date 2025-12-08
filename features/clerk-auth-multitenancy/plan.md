# Implementation Plan: Clerk Authentication & Multi-Tenancy

## Overview

**Estimated Total Time:** 4-5 Tage
**Risk Level:** Medium (viele Dateien, aber kleine Änderungen)
**Rollback Strategy:** Feature Flag `ENABLE_AUTH`

---

## Implementation Phases

```
Phase 1: Foundation (Backend)
    ↓
Phase 2: Database Migration
    ↓
Phase 3: Backend Auth Endpoints
    ↓
Phase 4: Frontend Auth Setup
    ↓
Phase 5: API Integration
    ↓
Phase 6: Backend Endpoint Updates
    ↓
Phase 7: Testing & Polish
    ↓
Phase 8: Production Readiness
```

---

## Phase 1: Foundation (Backend)
**Duration:** 2-3 hours

### Tasks

#### 1.1 Setup Clerk Account
- [ ] Create Clerk application at clerk.com
- [ ] Configure OAuth providers (Google, GitHub)
- [ ] Get API keys (Publishable Key, Secret Key)
- [ ] Configure allowed origins

#### 1.2 Update Backend Configuration
```
File: backend/app/core/config.py
```
- [ ] Add `clerk_publishable_key` setting
- [ ] Add `clerk_secret_key` setting
- [ ] Add `enable_auth` feature flag (default: False)

#### 1.3 Create Clerk JWT Verification Module
```
New File: backend/app/core/clerk.py
```
- [ ] Implement JWKS fetching from Clerk
- [ ] Implement JWT verification (RS256)
- [ ] Cache JWKS for performance
- [ ] Handle verification errors

#### 1.4 Update Dependencies
```
File: backend/requirements.txt
```
- [ ] Add `PyJWT` with cryptography support
- [ ] Add `httpx` for async JWKS fetch

### Exit Criteria
- [ ] Clerk account configured with OAuth
- [ ] JWT verification works in isolation test
- [ ] Feature flag can enable/disable auth

---

## Phase 2: Database Migration
**Duration:** 1 hour

### Tasks

#### 2.1 Create Alembic Migration
```
New File: backend/alembic/versions/xxxx_add_clerk_id.py
```
- [ ] Add `clerk_id` column to users (VARCHAR, UNIQUE, nullable)
- [ ] Make `hashed_password` nullable
- [ ] Add index on `clerk_id`

#### 2.2 Update User Model
```
File: backend/app/models/user.py
```
- [ ] Add `clerk_id` field
- [ ] Make `hashed_password` optional

#### 2.3 Run Migration
- [ ] `alembic upgrade head`
- [ ] Verify schema changes

### Exit Criteria
- [ ] Migration runs without errors
- [ ] Existing test user still valid
- [ ] New `clerk_id` column exists

---

## Phase 3: Backend Auth Dependencies
**Duration:** 2-3 hours

### Tasks

#### 3.1 Create Auth Dependencies
```
File: backend/app/api/deps.py
```
- [ ] Implement `get_current_user` dependency
- [ ] Implement `get_current_user_optional` (for migration)
- [ ] Implement `get_or_create_user` helper
- [ ] Handle Clerk JWT claims

#### 3.2 Update WebSocket Auth
```
File: backend/app/api/websocket.py
```
- [ ] Switch from custom JWT to Clerk JWT verification
- [ ] Maintain backward compatibility during migration

#### 3.3 Add Auth Exception Handlers
```
File: backend/app/main.py
```
- [ ] Handle 401 Unauthorized consistently
- [ ] Log authentication failures

### Exit Criteria
- [ ] `get_current_user` extracts user from Clerk JWT
- [ ] New user created on first authenticated request
- [ ] Existing user linked on matching email

---

## Phase 4: Frontend Auth Setup
**Duration:** 2-3 hours

### Tasks

#### 4.1 Install Clerk SDK
```bash
cd frontend && npm install @clerk/clerk-react
```

#### 4.2 Update Environment
```
File: frontend/.env
```
- [ ] Add `VITE_CLERK_PUBLISHABLE_KEY`

#### 4.3 Add ClerkProvider
```
File: frontend/src/main.tsx
```
- [ ] Wrap app with `<ClerkProvider>`
- [ ] Configure publishable key

#### 4.4 Create Auth Pages
```
New Files:
- frontend/src/pages/SignIn.tsx
- frontend/src/pages/SignUp.tsx
- frontend/src/components/AuthLoading.tsx
```
- [ ] Sign-in page with Clerk component
- [ ] Sign-up page with Clerk component
- [ ] Loading state component

#### 4.5 Update App Routing
```
File: frontend/src/App.tsx
```
- [ ] Add `<SignedIn>` / `<SignedOut>` wrappers
- [ ] Add auth routes (/sign-in, /sign-up)
- [ ] Redirect unauthenticated users

#### 4.6 Add User Button to Layout
```
File: frontend/src/components/MainLayout.tsx
```
- [ ] Import `<UserButton>` from Clerk
- [ ] Add to header

### Exit Criteria
- [ ] Sign-in page renders
- [ ] Sign-up page renders
- [ ] Can complete sign-up flow
- [ ] Can complete sign-in flow
- [ ] User button shows in header

---

## Phase 5: API Integration
**Duration:** 2 hours

### Tasks

#### 5.1 Create Auth-Aware API Client
```
File: frontend/src/lib/api.ts
```
- [ ] Add request interceptor for Authorization header
- [ ] Get token from Clerk SDK
- [ ] Handle 401 responses (redirect to sign-in)

#### 5.2 Update WebSocket Provider
```
File: frontend/src/components/WebSocketProvider/
```
- [ ] Get Clerk token instead of custom JWT
- [ ] Pass token in WebSocket connection
- [ ] Handle reconnection on token refresh

#### 5.3 Test API Integration
- [ ] Verify token sent with requests
- [ ] Verify 401 redirects to sign-in
- [ ] Verify WebSocket connects with Clerk token

### Exit Criteria
- [ ] All API calls include Authorization header
- [ ] 401 responses trigger sign-out flow
- [ ] WebSocket works with Clerk tokens

---

## Phase 6: Backend Endpoint Updates
**Duration:** 4-6 hours

### Tasks

#### 6.1 Update Lists API
```
File: backend/app/api/lists.py
```
- [ ] Add `current_user` dependency to all endpoints
- [ ] Filter queries by `user_id`
- [ ] Verify ownership before update/delete

#### 6.2 Update Videos API
```
File: backend/app/api/videos.py
```
- [ ] Add `current_user` dependency
- [ ] Verify list ownership before video operations
- [ ] Filter search by user's data

#### 6.3 Update Tags API
```
File: backend/app/api/tags.py
```
- [ ] Replace `get_user_for_testing` with `get_current_user`
- [ ] Filter tags by `user_id`

#### 6.4 Update Channels API
```
File: backend/app/api/channels.py
```
- [ ] Add `current_user` dependency
- [ ] Filter channels by `user_id`

#### 6.5 Update Schemas API
```
File: backend/app/api/schemas.py
```
- [ ] Add `current_user` dependency
- [ ] Verify list ownership

#### 6.6 Update Custom Fields API
```
File: backend/app/api/custom_fields.py
```
- [ ] Add `current_user` dependency
- [ ] Verify list ownership

#### 6.7 Update Schema Fields API
```
File: backend/app/api/schema_fields.py
```
- [ ] Add `current_user` dependency
- [ ] Verify schema ownership

#### 6.8 Update Analytics API
```
File: backend/app/api/analytics.py
```
- [ ] Add `current_user` dependency
- [ ] Verify list ownership

#### 6.9 Update Search API
```
File: backend/app/api/search.py
```
- [ ] Add `current_user` dependency
- [ ] Filter search results by user

#### 6.10 Update Enrichment API
```
File: backend/app/api/enrichment.py
```
- [ ] Add `current_user` dependency
- [ ] Verify video ownership

#### 6.11 Update Processing API
```
File: backend/app/api/processing.py
```
- [ ] Add `current_user` dependency
- [ ] Filter jobs by user

### Exit Criteria
- [ ] All endpoints require authentication
- [ ] All queries filtered by user
- [ ] Cannot access other users' data

---

## Phase 7: Testing & Polish
**Duration:** 4-6 hours

### Tasks

#### 7.1 Backend Unit Tests
- [ ] Test JWT verification
- [ ] Test user creation/linking
- [ ] Test query filtering
- [ ] Test ownership verification

#### 7.2 Backend Integration Tests
- [ ] Test full auth flow
- [ ] Test cross-user isolation
- [ ] Test WebSocket auth

#### 7.3 Frontend Tests
- [ ] Test auth state management
- [ ] Test route protection
- [ ] Test API interceptor

#### 7.4 E2E Tests
- [ ] Test sign-up flow
- [ ] Test sign-in flow
- [ ] Test sign-out flow
- [ ] Test data isolation

#### 7.5 Security Review
- [ ] Check for auth bypasses
- [ ] Verify no data leakage
- [ ] Review error messages (no info disclosure)

### Exit Criteria
- [ ] All tests pass
- [ ] No security issues found
- [ ] Manual testing complete

---

## Phase 8: Production Readiness
**Duration:** 2-3 hours

### Tasks

#### 8.1 Environment Configuration
- [ ] Set production Clerk keys
- [ ] Configure allowed origins for production
- [ ] Enable `ENABLE_AUTH=true`

#### 8.2 Remove Development Artifacts
- [ ] Remove `get_user_for_testing` helper
- [ ] Remove test user creation fallback
- [ ] Clean up debug logging

#### 8.3 Documentation
- [ ] Update README with auth setup
- [ ] Document environment variables
- [ ] Add deployment notes

#### 8.4 Monitoring
- [ ] Add auth failure logging
- [ ] Monitor 401 error rates
- [ ] Set up Clerk webhook (optional)

### Exit Criteria
- [ ] Production deployment works
- [ ] Feature flag removed or set to always-on
- [ ] Documentation complete

---

## Dependencies Between Phases

```
     ┌─────────────────────────────────────────────────────┐
     │                                                     │
     ▼                                                     │
┌─────────┐     ┌─────────┐     ┌─────────┐              │
│ Phase 1 │────▶│ Phase 2 │────▶│ Phase 3 │──────┐       │
│ Found.  │     │ DB Migr │     │ BE Auth │      │       │
└─────────┘     └─────────┘     └─────────┘      │       │
                                                  │       │
                                                  ▼       │
                                            ┌─────────┐  │
                                            │ Phase 5 │  │
                                            │ API Int │  │
                                            └────┬────┘  │
                                                 │       │
┌─────────┐                                      │       │
│ Phase 4 │──────────────────────────────────────┤       │
│ FE Auth │                                      │       │
└─────────┘                                      │       │
                                                 ▼       │
                                            ┌─────────┐  │
                                            │ Phase 6 │  │
                                            │ Endpts  │  │
                                            └────┬────┘  │
                                                 │       │
                                                 ▼       │
                                            ┌─────────┐  │
                                            │ Phase 7 │  │
                                            │ Testing │  │
                                            └────┬────┘  │
                                                 │       │
                                                 ▼       │
                                            ┌─────────┐  │
                                            │ Phase 8 │◀─┘
                                            │ Prod    │
                                            └─────────┘

Phase 1 → 2 → 3: Sequential (dependencies)
Phase 4: Can run parallel to 1-3
Phase 5: Needs 3 + 4
Phase 6: Needs 3
Phase 7: Needs all above
Phase 8: Final
```

---

## Parallel Work Opportunities

| Phase | Can Parallelize With |
|-------|---------------------|
| Phase 1 (Backend Foundation) | Phase 4 (Frontend Setup) |
| Phase 3 (Backend Auth) | Phase 4 (Frontend Setup) |
| Phase 6 (Endpoint Updates) | Phase 5 (API Integration) |

---

## Rollback Checkpoints

| After Phase | Rollback Action |
|-------------|-----------------|
| Phase 2 | Revert migration (schema backward compatible) |
| Phase 3 | Set `ENABLE_AUTH=false` |
| Phase 4 | Remove ClerkProvider from main.tsx |
| Phase 6 | Revert endpoint changes, `ENABLE_AUTH=false` |
| Phase 8 | Full revert possible via git |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Sign-up completion rate | > 80% |
| Sign-in success rate | > 95% |
| Auth-related 500 errors | 0 |
| Cross-user data access | 0 incidents |
| Session persistence | Works across refresh |
| WebSocket reconnection | < 3 seconds |

**Exit Condition:** ✅ Vollständiger, phasenweise umsetzbarer Implementierungsplan
