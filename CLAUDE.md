# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart YouTube Bookmarks is a web application for organizing and managing YouTube video collections with real-time metadata extraction and progress tracking. The architecture uses a FastAPI backend with ARQ workers for async processing, PostgreSQL for persistence, Redis for pub/sub, and a React frontend with WebSocket-based real-time updates.

## Development Commands

### Frontend (React + Vite + TypeScript)

```bash
cd frontend

# Development
npm run dev                    # Start dev server (http://localhost:5173)
npm run build                  # Production build (TypeScript + Vite)

# Testing
npm test                       # Run all tests (Vitest)
npm test -- VideosPage         # Run specific test file
npm run test:coverage          # Run with coverage report

# Code Quality
npx tsc --noEmit              # Type check only
npm run lint                  # ESLint
```

### Backend (FastAPI + Python 3.11)

```bash
cd backend

# Development
uvicorn app.main:app --reload  # Start dev server (http://localhost:8000)

# Testing
pytest                         # All tests
pytest tests/integration/ -v   # Integration tests only
pytest -k "test_name" -v       # Specific test
pytest --cov                   # With coverage

# Database Migrations
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head           # Apply migrations
alembic downgrade -1           # Rollback one migration

# ARQ Worker (required for video processing)
arq app.workers.video_processor.WorkerSettings
```

### Docker Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# View logs
docker-compose logs -f postgres redis
```

## Architecture

### Real-Time Progress System (Core Feature)

**Dual-Write Pattern for Progress Updates:**
- Redis Pub/Sub provides real-time WebSocket broadcasts
- PostgreSQL stores progress history for reconnection recovery
- WebSocket endpoint: `ws://localhost:8000/api/ws/progress`
- History API: `GET /api/jobs/{job_id}/progress-history?since={timestamp}`

**Implementation Files:**
- Backend WebSocket: `backend/app/api/websocket.py`
- ARQ Worker: `backend/app/workers/video_processor.py`
- Frontend Hook: `frontend/src/hooks/useWebSocket.ts`
- Progress Models: `backend/app/models/job_progress.py`

**Important Details:**
- Uses `react-use-websocket` library for connection management (fixes React 18 Strict Mode issues)
- Automatic reconnection with exponential backoff (up to 10 attempts)
- Heartbeat/keep-alive (ping every 25s)
- Post-connection authentication (Option B from security audit)
- Completed jobs auto-cleanup after 5 minutes (TTL)

### Frontend Routing Architecture

**React Router DOM v6:**
- Router configured in `frontend/src/main.tsx` with `<BrowserRouter>`
- Routes defined in `frontend/src/App.tsx`
- Test helper: `frontend/src/test/renderWithRouter.tsx` (use for all component tests that use navigation)

**Current Routes:**
- `/lists` - ListsPage
- `/videos` - VideosPage (single-list MVP with hardcoded first list)
- `/dashboard` - Dashboard (real-time job progress)
- `/` - Redirects to `/videos`

**Testing with React Router:**
- Use `renderWithRouter()` helper instead of `render()` from `@testing-library/react`
- Mock `useNavigate` with `vi.mock('react-router-dom', () => ({ ...vi.importActual('react-router-dom'), useNavigate: vi.fn() }))`

### State Management

**TanStack Query (React Query):**
- Centralized query client: `frontend/src/lib/queryClient.ts`
- Custom hooks: `useLists()`, `useVideos()`, `useTags()` in `frontend/src/hooks/`
- Invalidation after mutations (e.g., `queryClient.invalidateQueries(['videos', listId])`)

**Zustand (Client State):**
- Tag selection state: `frontend/src/stores/tagStore.ts`
- Manages selected tags for filtering across components

**WebSocket State:**
- Custom hook `useWebSocket()` in `frontend/src/hooks/useWebSocket.ts`
- Returns `jobProgress` Map, connection status, auth status

### Backend Structure

**API Routers:**
- `app/api/lists.py` - List CRUD
- `app/api/videos.py` - Video CRUD, CSV upload
- `app/api/tags.py` - Tag management, bulk assignment
- `app/api/processing.py` - Job endpoints
- `app/api/websocket.py` - WebSocket progress endpoint

**Database Models (SQLAlchemy 2.0 async):**
- `app/models/list.py` - VideoList
- `app/models/video.py` - Video
- `app/models/tag.py` - Tag, VideoTag (many-to-many)
- `app/models/job.py` - ProcessingJob
- `app/models/job_progress.py` - JobProgress (for history)
- `app/models/user.py` - User (not yet implemented)

**ARQ Workers:**
- `app/workers/video_processor.py` - Main video processing worker
- `app/workers/db_manager.py` - Database session management
- `app/workers/settings.py` - ARQ configuration

**External API Clients:**
- `app/clients/youtube.py` - YouTube Data API v3
- `app/clients/gemini.py` - Google Gemini API (for transcript analysis)

### Testing Patterns

**Frontend (Vitest):**
- Unit tests: `*.test.tsx` alongside components
- Integration tests: `*.integration.test.tsx` (test full flows with mocked APIs)
- Always use `renderWithRouter()` for components using React Router hooks
- Mock WebSocket: `vi.mock('react-use-websocket')`

**Backend (pytest):**
- Unit tests: `tests/api/`, `tests/models/`, `tests/workers/`
- Integration tests: `tests/integration/` (real database via fixture)
- Fixtures in `tests/conftest.py` (db session, test client, async support)

## Known Patterns & Conventions

### CSV Upload Flow

1. User uploads CSV via `VideosPage` component
2. Frontend POSTs to `/api/lists/{id}/videos/bulk`
3. Backend creates `ProcessingJob` and enqueues ARQ tasks
4. ARQ worker processes videos one-by-one:
   - Fetches YouTube metadata
   - Gets transcript (if available)
   - Extracts custom fields via Gemini
   - Updates database
   - Publishes progress to Redis
5. WebSocket broadcasts progress to all connected clients
6. Frontend displays progress bar with real-time updates

### Tag Filtering System

- Tags stored in `tags` table with `list_id` (scoped to each list)
- Many-to-many relationship via `video_tags` join table
- Filter by tag IDs: `GET /api/lists/{id}/videos?tag_ids=uuid1,uuid2`
- Frontend uses `tagStore` (Zustand) to manage selected tags
- `TagNavigation` component displays all tags with selection state

### Feature Flag Pattern

**Environment Variables (Frontend):**
- `VITE_FEATURE_ADD_SCHEMA_BUTTON` - Shows "Schema hinzufügen" button (default: "true")
- `VITE_FEATURE_EDIT_SCHEMA_BUTTON` - Shows "Schema bearbeiten" button (default: "true")
- Configured in `frontend/src/config/featureFlags.ts`

## Security Notes

**Current Status (Development):**
- No authentication implemented (uses hardcoded user_id)
- CORS allows `localhost:5173` and `localhost:8000`
- WebSocket auth is post-connection (console warning expected)

**Production Roadmap:**
- JWT authentication system (see `docs/plans/2025-11-02-security-hardening-implementation.md`)
- Rate limiting with slowapi
- Environment-aware configuration
- Structured logging with structlog

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/api/health

## Important Files to Review

**For WebSocket/Progress Changes:**
- `backend/app/api/websocket.py` - WebSocket endpoint
- `backend/app/workers/video_processor.py` - Progress publishing
- `frontend/src/hooks/useWebSocket.ts` - WebSocket client logic

**For Routing Changes:**
- `frontend/src/App.tsx` - Route definitions
- `frontend/src/main.tsx` - Router setup
- `frontend/src/test/renderWithRouter.tsx` - Test helper

**For Tag System Changes:**
- `backend/app/api/tags.py` - Tag endpoints
- `frontend/src/stores/tagStore.ts` - Tag state
- `frontend/src/components/TagNavigation.tsx` - Tag UI

## Common Gotchas

1. **React Router in Tests:** Always use `renderWithRouter()` or tests will fail with "useNavigate() may be used only in the context of a <Router> component"
2. **WebSocket Auth Warning:** Console warning about missing auth token is expected in development
3. **ARQ Worker Must Run:** Video processing requires ARQ worker to be running, otherwise jobs will queue but not process
4. **Migration After Model Changes:** Run `alembic revision --autogenerate` after changing SQLAlchemy models
5. **Query Invalidation:** After mutations, invalidate relevant TanStack Query keys to refresh UI
6. **Feature Flags:** Check `frontend/src/config/featureFlags.ts` before showing/hiding UI elements

## Documentation

- Task plans: `docs/plans/tasks/`
- Handoff logs: `docs/handoffs/`
- Implementation reports: `docs/reports/`
- Templates: `docs/templates/`
