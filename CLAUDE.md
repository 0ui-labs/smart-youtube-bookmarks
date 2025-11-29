# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart YouTube Bookmarks is a full-stack application for organizing YouTube video collections with custom fields, real-time processing, and video enrichment. It uses a FastAPI backend with PostgreSQL/Redis and a React frontend.

## Development Commands

### Infrastructure
```bash
docker-compose up -d                    # Start PostgreSQL and Redis
```

### Backend (FastAPI)
```bash
cd backend
source .venv/bin/activate               # Activate virtual environment
pip install -r requirements.txt         # Install dependencies
alembic upgrade head                    # Apply database migrations
uvicorn app.main:app --reload           # Start dev server (port 8000)
arq app.workers.video_processor.WorkerSettings  # Start background worker
```

### Frontend (React + Vite)
```bash
cd frontend
npm install                             # Install dependencies
npm run dev                             # Start dev server (port 5173)
npm run build                           # Production build (runs tsc first)
npm run generate-api                    # Regenerate API client from OpenAPI spec
```

### Testing
```bash
# Backend
cd backend && source .venv/bin/activate
pytest                                  # All tests
pytest -v -k "test_name"               # Run specific test
mypy app/                              # Type checking (strict mode)

# Frontend
cd frontend
npm test                               # Run Vitest tests
npm run test:coverage                  # Tests with coverage
npx tsc --noEmit                       # Type checking
```

### Linting & Formatting
```bash
cd frontend
npm run lint                           # Biome linting
npm run lint:fix                       # Biome auto-fix
npm run format                         # Biome formatting
```

## Architecture

### Data Flow
```
Frontend (React) ──HTTP/WS──▶ FastAPI ──▶ PostgreSQL
       │                         │
       │ WebSocket               │ Pub/Sub
       ▼                         ▼
  Real-time UI ◀──────────── Redis ◀──── ARQ Worker
```

### Backend Structure (`backend/app/`)
- **`api/`** - FastAPI routers (lists, videos, tags, custom_fields, schemas, channels, enrichment, search, websocket)
- **`models/`** - SQLAlchemy ORM models (async, PostgreSQL)
- **`schemas/`** - Pydantic request/response schemas
- **`services/`** - Business logic (enrichment, duplicate detection, rate limiting)
- **`workers/`** - ARQ background jobs (video_processor, enrichment_worker)
- **`clients/`** - External API clients (YouTube, Gemini)
- **`core/`** - Config, database, Redis connections

### Frontend Structure (`frontend/src/`)
- **`components/`** - React components (VideosPage, VideoCard, CustomFieldsSection, etc.)
- **`pages/`** - Route-level components (Dashboard, ChannelsPage, SettingsPage)
- **`hooks/`** - TanStack Query hooks (useVideos, useLists, useCustomFields, useWebSocket)
- **`stores/`** - Zustand state stores (importProgressStore, tableSettingsStore, tagStore)
- **`api/generated/`** - Orval-generated types and hooks from OpenAPI spec (don't edit manually)
- **`api/`** - Manual API client code (customFields.ts)
- **`lib/`** - Utilities (axios-instance.ts)

### Key Patterns
- **API Client Generation**: Orval generates TypeScript types from FastAPI's OpenAPI spec
  - Run `npm run generate-api` when backend API changes (new endpoints, changed response types)
  - Generated files: `src/api/generated/` (180+ TypeScript files)
  - **Hybrid approach**: Use generated types for new features, keep manual hooks in `src/hooks/` for optimistic updates and custom query keys
- **Real-time Updates**: WebSocket connection for CSV import progress with Redis pub/sub
- **Custom Fields System**: Dynamic fields (rating, select, text, boolean) attached to videos via field schemas
- **Path Alias**: `@/` maps to `frontend/src/` (configured in vite.config.ts)

## Commit Convention

Uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by Commitlint:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructuring
- `perf:` - Performance
- `test:` - Tests
- `chore:` - Maintenance

Pre-commit hooks run Biome linting via Husky.

## Code Style

### Frontend (Biome)
- Extends `ultracite/core` and `ultracite/react` presets
- Key disabled rules: `noNestedTernary` (JSX conditionals), `noForEach`, `noExplicitAny`
- Test files have relaxed linting (see `biome.jsonc` overrides)
- Uses `dangerouslySetInnerHTML` with DOMPurify for sanitized HTML

### Backend (Python)
- Python 3.11+ with strict mypy type checking
- Async everywhere (SQLAlchemy async, asyncpg, httpx)
- pytest with `asyncio_mode = "auto"`

## Database Migrations

```bash
cd backend && source .venv/bin/activate
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head                               # Apply migrations
alembic downgrade -1                               # Rollback one
```

## Environment Variables

### Backend (`backend/.env`)
```env
YOUTUBE_API_KEY=...          # Required
GEMINI_API_KEY=...           # Optional (AI enrichment)
GROQ_API_KEY=...             # Optional (Whisper transcription)
```

### Docker (`.env` at root)
```env
POSTGRES_DB=youtube_bookmarks
POSTGRES_USER=user
POSTGRES_PASSWORD=changeme
```
