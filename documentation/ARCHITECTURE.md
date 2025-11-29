# Architecture Overview

This document describes the system architecture of Smart YouTube Bookmarks.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  Frontend                                    │
│                           React + TypeScript + Vite                          │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Pages     │  │ Components  │  │   Stores    │  │   Hooks (TanStack)  │ │
│  │  (Routes)   │  │  (Radix UI) │  │  (Zustand)  │  │   Query + Table     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                    HTTP REST   │   WebSocket
                                │
┌───────────────────────────────▼─────────────────────────────────────────────┐
│                                  Backend                                     │
│                              FastAPI (Python)                                │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  API Layer  │  │  Services   │  │   Models    │  │   External Clients  │ │
│  │  (Routers)  │  │  (Business) │  │ (SQLAlchemy)│  │  (YouTube, Gemini)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└──────────┬──────────────────────────────┬───────────────────────────────────┘
           │                              │
           │                              │
┌──────────▼──────────┐       ┌───────────▼───────────┐       ┌───────────────┐
│     PostgreSQL      │       │        Redis          │       │  ARQ Worker   │
│    (Primary DB)     │       │   (Pub/Sub + Queue)   │◄──────│  (Background) │
└─────────────────────┘       └───────────────────────┘       └───────────────┘
```

---

## Component Overview

### Frontend (React)

| Layer | Purpose | Technologies |
|-------|---------|--------------|
| **Pages** | Route components, full views | React Router |
| **Components** | Reusable UI elements | Radix UI, Tailwind CSS |
| **Stores** | Client-side state | Zustand |
| **Hooks** | Data fetching, server state | TanStack Query |
| **Types** | Type definitions | TypeScript |

**Key Pages:**
- `ListsPage` – Home, manage video lists
- `VideosPage` – Video table with filtering/sorting
- `VideoDetailsPage` – Single video view, field editing
- `ChannelsPage` – Channel management
- `SettingsPage` – Schema and field configuration
- `Dashboard` – Real-time job monitoring

### Backend (FastAPI)

| Layer | Purpose | Location |
|-------|---------|----------|
| **API Routers** | HTTP endpoints | `app/api/` |
| **Schemas** | Request/Response validation | `app/schemas/` |
| **Models** | Database ORM models | `app/models/` |
| **Services** | Business logic | `app/services/` |
| **Workers** | Background job processing | `app/workers/` |
| **Clients** | External API integration | `app/clients/` |
| **Core** | Config, database, Redis | `app/core/` |

---

## Data Flow

### 1. Video Import (CSV)

```
User uploads CSV
       │
       ▼
┌─────────────────┐
│  POST /videos/  │
│     bulk        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Create Video   │────▶│  Create Job     │
│  records        │     │  record         │
│  (pending)      │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Enqueue ARQ    │
                        │  task           │
                        └────────┬────────┘
                                 │
         ┌───────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ARQ Worker    │────▶│  YouTube API    │────▶│  Update Video   │
│   processes     │     │  fetch metadata │     │  + Progress     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        │
                        ▼
┌─────────────────┐     ┌─────────────────┐
│  Redis Pub/Sub  │────▶│  WebSocket      │────▶  Frontend
│  publish event  │     │  broadcast      │       Progress Bar
└─────────────────┘     └─────────────────┘
```

### 2. Custom Field Update

```
User edits field value
       │
       ▼
┌─────────────────┐
│  PUT /videos/   │
│  {id}/fields    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Validate per   │────▶│  Upsert         │
│  field type     │     │  VideoFieldValue│
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Return updated │────▶  TanStack Query
                        │  video          │       invalidates cache
                        └─────────────────┘
```

---

## Database Schema

### Core Entities

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │  BookmarkList   │       │     Video       │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──1:N──│ id (PK)         │──1:N──│ id (PK)         │
│ email           │       │ user_id (FK)    │       │ list_id (FK)    │
│ hashed_password │       │ name            │       │ youtube_id      │
│ is_active       │       │ description     │       │ title           │
└─────────────────┘       │ default_schema  │       │ channel_id (FK) │
                          └─────────────────┘       │ status          │
                                                    │ metadata...     │
                                                    └─────────────────┘
```

### Custom Fields System

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   CustomField   │       │   FieldSchema   │       │   SchemaField   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ schema_id (FK)  │
│ list_id (FK)    │       │ list_id (FK)    │◄──────│ field_id (FK)   │
│ name            │       │ name            │       │ display_order   │
│ field_type      │       │ description     │       │ show_on_card    │
│ config (JSONB)  │       └─────────────────┘       └─────────────────┘
└────────┬────────┘
         │
         │
         ▼
┌─────────────────┐
│ VideoFieldValue │
├─────────────────┤
│ video_id (FK)   │
│ field_id (FK)   │
│ value_text      │
│ value_numeric   │
│ value_boolean   │
└─────────────────┘
```

### Supporting Entities

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Channel     │       │       Tag       │       │ VideoEnrichment │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ user_id (FK)    │       │ list_id (FK)    │       │ video_id (FK)   │
│ youtube_channel │       │ name            │       │ status          │
│ name            │       │ color           │       │ transcript      │
│ thumbnail_url   │       └────────┬────────┘       │ chapters        │
│ is_hidden       │                │                │ captions_vtt    │
└─────────────────┘                │                └─────────────────┘
                                   │
                          ┌────────▼────────┐
                          │   video_tags    │
                          │  (many-to-many) │
                          └─────────────────┘
```

---

## State Management

### Frontend State Layers

| Layer | Tool | Purpose | Example |
|-------|------|---------|---------|
| **Server State** | TanStack Query | API data, caching | Videos, Lists, Fields |
| **UI State** | Zustand | Local preferences | Table settings, filters |
| **Form State** | React Hook Form | Input handling | Edit dialogs |
| **URL State** | React Router | Navigation | Current list, video |

### Zustand Stores

| Store | Purpose |
|-------|---------|
| `tableSettingsStore` | Column visibility, sorting, pagination |
| `fieldFilterStore` | Active field filters |
| `importProgressStore` | CSV import progress (WebSocket) |
| `playerSettingsStore` | Video player preferences |
| `tagStore` | Tag selection state |

---

## Real-Time Communication

### WebSocket Architecture

```
┌─────────────┐                    ┌─────────────┐
│   Browser   │◄───── WebSocket ───│   FastAPI   │
│   Tab 1     │        /ws/progress│   Backend   │
└─────────────┘                    └──────┬──────┘
                                          │
┌─────────────┐                           │ Subscribe
│   Browser   │◄── WebSocket ─────────────┤
│   Tab 2     │                           │
└─────────────┘                    ┌──────▼──────┐
                                   │    Redis    │
                                   │   Pub/Sub   │
                                   └──────▲──────┘
                                          │ Publish
                                   ┌──────┴──────┐
                                   │ ARQ Worker  │
                                   └─────────────┘
```

### Message Flow

1. ARQ Worker processes video → publishes progress to Redis
2. FastAPI subscribes to Redis channel
3. FastAPI broadcasts to all connected WebSocket clients
4. Frontend updates progress bar in real-time

### Reconnection Handling

- Frontend detects disconnect → shows reconnecting state
- On reconnect → calls `/api/jobs/{id}/progress-history`
- History API returns missed events from PostgreSQL
- Frontend syncs state and continues showing progress

---

## External Services

| Service | Purpose | Used In |
|---------|---------|---------|
| **YouTube Data API** | Video metadata (title, duration, thumbnails) | `app/clients/youtube.py` |
| **Google Gemini** | AI-powered metadata enrichment | `app/clients/gemini.py` |
| **Groq Whisper** | Audio transcription | `app/services/enrichment/` |
| **yt-dlp** | Audio downloading for transcription | `app/services/enrichment/` |

---

## Security Considerations

### Current State (Development)

- Hardcoded `user_id` for development
- No JWT authentication implemented
- CORS allows localhost origins only

### Production Requirements

- [ ] JWT-based authentication
- [ ] Password hashing with bcrypt (already in requirements)
- [ ] Rate limiting on API endpoints
- [ ] Input sanitization (SQL injection protected by ORM)
- [ ] HTTPS enforcement

---

## Deployment Architecture

### Development

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Vite Dev   │  │   Uvicorn   │  │  PostgreSQL │  │    Redis    │
│  :5173      │  │   :8000     │  │   :5432     │  │   :6379     │
│  (Frontend) │  │  (Backend)  │  │  (Docker)   │  │  (Docker)   │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
                 └─────────────┐
                 │ ARQ Worker  │
                 │ (separate)  │
                 └─────────────┘
```

### Production (Planned)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│   Gunicorn  │────▶│  PostgreSQL │
│  (Reverse   │     │  + Uvicorn  │     │  (Managed)  │
│   Proxy)    │     │   Workers   │     └─────────────┘
└─────────────┘     └──────┬──────┘
       │                   │            ┌─────────────┐
       │ Static            │            │    Redis    │
       │ Files             └───────────▶│  (Managed)  │
       ▼                                └─────────────┘
┌─────────────┐                         ┌─────────────┐
│  Frontend   │                         │ ARQ Workers │
│  (Built)    │                         │ (Scaled)    │
└─────────────┘                         └─────────────┘
```

---

## Key Design Decisions

### 1. Custom Fields as JSONB Config

**Decision:** Store field configuration (options, max_rating, etc.) in JSONB column instead of separate tables.

**Rationale:**
- Flexible schema per field type
- No migrations needed for new field types
- Easy to extend configuration

### 2. Dual-Write for Progress Events

**Decision:** Write progress events to both Redis (real-time) and PostgreSQL (persistence).

**Rationale:**
- Redis pub/sub for instant delivery
- PostgreSQL for history recovery after disconnect
- Graceful degradation if Redis unavailable

### 3. Field Schemas as Templates

**Decision:** FieldSchema groups fields but doesn't own them – fields belong to lists.

**Rationale:**
- Same field can be in multiple schemas
- Reusable templates without data duplication
- Flexible field composition

### 4. Per-User Channels

**Decision:** Channels are user-scoped, not global.

**Rationale:**
- Users can hide channels without affecting others
- Future: per-user channel annotations
- Simplifies permission model

---

## Performance Considerations

### Database

- Indexes on `list_id`, `user_id`, `youtube_id`, `status`
- `pg_trgm` extension for fuzzy text search
- Connection pooling via SQLAlchemy

### Caching

- TanStack Query caches API responses
- Stale-while-revalidate pattern
- Automatic cache invalidation on mutations

### Background Processing

- ARQ workers process videos in parallel
- Configurable concurrency (`max_jobs`)
- Progress throttling (5% steps) to reduce WebSocket load

---

## Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| **Backend Unit** | pytest | Models, Services |
| **Backend Integration** | pytest + httpx | API Endpoints |
| **Frontend Unit** | Vitest | Components, Hooks |
| **Frontend Integration** | Testing Library | User Flows |
| **API Mocking** | MSW | External Services |
