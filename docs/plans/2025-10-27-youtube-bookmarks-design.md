# Smart YouTube Bookmarks - Design Document

**Date:** 2025-10-27
**Status:** Approved
**Version:** 1.0

## Executive Summary

Smart YouTube Bookmarks is a local web application for intelligent management and AI-powered analysis of YouTube video collections. Users can create multiple bookmark lists, add videos via CSV upload or drag-and-drop, and automatically enrich each video with structured metadata extracted via AI. The application features a flexible schema system configured through natural language AI chat, enabling users to define custom fields (categories, difficulty, tags, etc.) without code changes.

**Key Design Principle:** Snappy, responsive UI with optimistic updates and real-time progress tracking.

## Table of Contents

1. [Goals & Non-Goals](#goals--non-goals)
2. [Technical Stack](#technical-stack)
3. [High-Level Architecture](#high-level-architecture)
4. [Data Model](#data-model)
5. [API Design](#api-design)
6. [Frontend Architecture](#frontend-architecture)
7. [Background Processing](#background-processing)
8. [Error Handling](#error-handling)
9. [Schema Builder](#schema-builder)
10. [Performance Optimizations](#performance-optimizations)
11. [Deployment](#deployment)
12. [Security](#security)
13. [Testing Strategy](#testing-strategy)
14. [Future Considerations](#future-considerations)

---

## Goals & Non-Goals

### Goals
- **Intuitive UI:** Average users can start without documentation
- **Robust Processing:** API errors don't cause data loss, automatic retries
- **Snappy Performance:** Sub-100ms interactions, no perceived lag
- **Flexible Schema:** User-configurable extraction fields via AI chat
- **Real-time Updates:** Live progress tracking during video processing
- **Local Installation:** Single-command Docker Compose deployment
- **Open Source Ready:** Clean codebase suitable for public release

### Non-Goals
- Multi-user authentication (single-user, local-only)
- Cloud deployment in initial version
- Mobile app (responsive web only)
- Video playback/hosting (links to YouTube)
- Collaborative features (future SaaS version)

---

## Technical Stack

### Backend
- **Framework:** FastAPI (async-native, WebSocket support, auto-docs)
- **Language:** Python 3.11+
- **Task Queue:** ARQ (async-first, elegant FastAPI integration)
- **Database:** PostgreSQL 16 (robust JSON support, full-text search)
- **Cache/Queue:** Redis 7 (ARQ broker + pub/sub for progress updates)
- **ORM:** SQLAlchemy 2.0 (async)
- **Validation:** Pydantic v2

### Frontend
- **Framework:** React 18 (concurrent features)
- **Language:** TypeScript (strict mode enabled)
- **Build Tool:** Vite
- **State Management:**
  - TanStack Query v5 (server state, caching)
  - Zustand (client state, WebSocket status)
- **UI Components:** shadcn/ui (headless, accessible)
- **Tables:** TanStack Table (virtualization for 1000+ rows)
- **Styling:** Tailwind CSS
- **Validation:** Zod (runtime validation of API responses)

### External APIs
- **YouTube Data API v3:** Video metadata (quota: 10,000 units/day free)
- **Google Gemini 2.0 Flash:** AI-powered data extraction from transcripts

### Deployment
- **Containerization:** Docker + Docker Compose
- **Single Container:** FastAPI serves both API and built React SPA
- **Development:** Vite dev server (port 5173) proxies to FastAPI (port 8000)

---

## High-Level Architecture

### Modular Monolith Pattern

```
┌─────────────────────────────────────┐
│   Frontend (React + TypeScript)     │
│   - TanStack Query (Data Fetching)  │
│   - TanStack Table (Virtualized UI) │
│   - Zustand (Local State)           │
│   - WebSocket Client                │
└──────────┬──────────────────────────┘
           │ REST API + WebSocket
┌──────────▼──────────────────────────┐
│   FastAPI Backend                    │
│   ├─ API Layer (Routes)             │
│   ├─ Service Layer (Business Logic) │
│   ├─ Repository Layer (Data Access) │
│   └─ Domain Models                   │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────────────────────┐
│   Background Processing (ARQ)       │
│   - Video Processor Workers         │
│   - YouTube API Client              │
│   - Gemini API Client               │
│   - Progress Publisher (Redis)      │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────────────────────┐
│   Data Layer                        │
│   ├─ PostgreSQL (Structured Data)   │
│   ├─ Redis (Queue + Pub/Sub)        │
│   └─ File System (Checkpoints)      │
└─────────────────────────────────────┘
```

### Backend Module Structure

```
app/
├── api/                 # FastAPI routes
│   ├── lists.py        # Bookmarklists CRUD
│   ├── videos.py       # Video management, CSV import
│   ├── schema.py       # Schema management + AI chat
│   ├── processing.py   # Job control (start/pause/resume)
│   └── websocket.py    # WebSocket progress endpoint
├── services/           # Business logic
│   ├── list_service.py
│   ├── video_service.py
│   ├── schema_service.py
│   └── ai_service.py   # Gemini integration
├── repositories/       # Data access
│   ├── list_repo.py
│   ├── video_repo.py
│   └── schema_repo.py
├── workers/            # ARQ background tasks
│   ├── video_processor.py
│   ├── youtube_client.py
│   ├── gemini_client.py
│   └── progress_publisher.py
├── models/             # SQLAlchemy models
│   ├── list.py
│   ├── video.py
│   ├── schema.py
│   └── job.py
└── core/               # Shared utilities
    ├── config.py
    ├── database.py
    └── errors.py
```

---

## Data Model

### PostgreSQL Schema

```sql
-- Bookmarklists
CREATE TABLE bookmarks_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schema_id UUID REFERENCES schemas(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Flexible Schemas (AI-generated)
CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    fields JSONB NOT NULL,  -- Array of field definitions
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Videos
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES bookmarks_lists(id) ON DELETE CASCADE,
    youtube_id VARCHAR(50) NOT NULL,
    title VARCHAR(500),
    channel VARCHAR(255),
    duration INTEGER,  -- seconds
    published_at TIMESTAMP,
    thumbnail_url VARCHAR(500),
    extracted_data JSONB,  -- Gemini-extracted fields
    processing_status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(list_id, youtube_id)
);

-- Processing Jobs (for resume capability)
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES bookmarks_lists(id) ON DELETE CASCADE,
    total_videos INTEGER NOT NULL,
    processed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running',  -- running, paused, completed, failed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_videos_list_id ON videos(list_id);
CREATE INDEX idx_videos_status ON videos(processing_status);
CREATE INDEX idx_jobs_list_id ON processing_jobs(list_id);
CREATE INDEX idx_jobs_status ON processing_jobs(status);
```

### Schema Field Definition (JSONB)

```json
{
  "fields": [
    {
      "name": "difficulty",
      "label": "Schwierigkeitsgrad",
      "type": "select",
      "options": ["Anfänger", "Fortgeschritten", "Experte"],
      "required": false
    },
    {
      "name": "category",
      "label": "Kategorie",
      "type": "select",
      "options": ["Tutorial", "Dokumentation", "Live-Coding"],
      "required": true
    },
    {
      "name": "tags",
      "label": "Tags",
      "type": "multi-select",
      "options": []
    },
    {
      "name": "prerequisites",
      "label": "Vorkenntnisse",
      "type": "text",
      "required": false
    },
    {
      "name": "estimated_duration",
      "label": "Geschätzte Lernzeit",
      "type": "duration",
      "unit": "minutes"
    }
  ]
}
```

**Supported Field Types:**
- `text`: Free-form text
- `select`: Single-choice dropdown
- `multi-select`: Multiple-choice tags
- `number`: Numeric value
- `duration`: Time in minutes
- `boolean`: Yes/No checkbox

---

## API Design

### REST Endpoints

```typescript
// Bookmarklists
GET    /api/lists                          // List all bookmark lists
POST   /api/lists                          // Create new list
GET    /api/lists/{id}                     // Get list with videos
PUT    /api/lists/{id}                     // Update list metadata
DELETE /api/lists/{id}                     // Delete list

// Videos
POST   /api/lists/{id}/videos              // Add single video (URL)
POST   /api/lists/{id}/videos/bulk         // Bulk upload (CSV)
DELETE /api/videos/{id}                    // Delete video
PATCH  /api/videos/{id}                    // Update video extracted_data

// Schema Management
POST   /api/schema/chat                    // AI chat for schema definition
GET    /api/schemas/{id}                   // Get schema definition
PUT    /api/schemas/{id}                   // Update schema
GET    /api/lists/{id}/schema              // Get schema for list

// Processing
POST   /api/lists/{id}/process             // Start processing job
POST   /api/jobs/{id}/pause                // Pause running job
POST   /api/jobs/{id}/resume               // Resume paused job
GET    /api/jobs/{id}                      // Get job status

// Export
GET    /api/lists/{id}/export/csv          // Export to CSV
GET    /api/lists/{id}/export/json         // Export to JSON

// System
GET    /api/health                         // Health check
GET    /api/quota                          // YouTube API quota status
```

### WebSocket Endpoint

```typescript
WS /api/ws/progress/{job_id}

// Server -> Client messages
{
  "type": "progress",
  "job_id": "uuid",
  "video_id": "uuid",
  "status": "processing" | "completed" | "failed",
  "processed": 45,
  "total": 100,
  "current_video": {
    "title": "...",
    "youtube_id": "..."
  }
}

{
  "type": "error",
  "job_id": "uuid",
  "error": {
    "code": "youtube_quota_exceeded",
    "title": "Tägliches YouTube-Limit erreicht",
    "message": "...",
    "actions": ["...", "..."],
    "severity": "warning"
  }
}

{
  "type": "completed",
  "job_id": "uuid",
  "processed": 100,
  "failed": 3,
  "duration_seconds": 320
}
```

### Request/Response Types (TypeScript)

```typescript
// POST /api/lists
interface CreateListRequest {
  name: string
  description?: string
  schema_id?: string
}

interface ListResponse {
  id: string
  name: string
  description: string | null
  schema_id: string | null
  video_count: number
  created_at: string
}

// POST /api/lists/{id}/videos/bulk
interface BulkUploadRequest {
  urls: string[]  // or CSV file upload
}

interface BulkUploadResponse {
  job_id: string
  video_count: number
  estimated_duration_seconds: number
}

// POST /api/schema/chat
interface SchemaChatRequest {
  message: string
  schema_id?: string  // For continuing conversation
  conversation_history?: ChatMessage[]
}

interface SchemaChatResponse {
  message: string
  schema: SchemaDefinition | null  // If schema is ready
  conversation_id: string
}
```

---

## Frontend Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── VideoTable/
│   │   ├── SchemaChat/
│   │   └── ErrorDisplay/
│   ├── features/        # Feature-based modules
│   │   ├── lists/
│   │   ├── videos/
│   │   ├── schema/
│   │   └── processing/
│   ├── hooks/           # Custom React hooks
│   │   ├── useWebSocket.ts
│   │   ├── useVideoQuery.ts
│   │   └── useOptimisticUpdate.ts
│   ├── lib/             # Utilities
│   │   ├── api.ts       # API client (Axios/Fetch)
│   │   ├── validation.ts # Zod schemas
│   │   └── utils.ts
│   ├── stores/          # Zustand stores
│   │   └── websocketStore.ts
│   ├── types/           # TypeScript types
│   └── App.tsx
```

### State Management Strategy

**TanStack Query (Server State):**
- All API data fetching
- Automatic background refetching
- Optimistic updates for mutations
- Cache invalidation on WebSocket events

**Zustand (Client State):**
- WebSocket connection status
- UI state (modals, sidebars)
- User preferences (table columns, filters)

**Example: Optimistic Video Add**

```typescript
const useAddVideo = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (url: string) => api.addVideo(listId, url),

    onMutate: async (url) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['videos', listId])

      // Optimistically add video to cache
      const previousVideos = queryClient.getQueryData(['videos', listId])

      queryClient.setQueryData(['videos', listId], (old: Video[]) => [
        ...old,
        {
          id: `temp-${Date.now()}`,
          youtube_id: extractYoutubeId(url),
          status: 'pending',
          title: 'Loading...'
        }
      ])

      return { previousVideos }
    },

    onError: (err, url, context) => {
      // Rollback on error
      queryClient.setQueryData(['videos', listId], context.previousVideos)
    },

    onSuccess: () => {
      // Refetch to get actual data
      queryClient.invalidateQueries(['videos', listId])
    }
  })
}
```

### Performance Optimizations

1. **Virtualized Table:**
```typescript
// TanStack Table + @tanstack/react-virtual
// Only renders visible rows (e.g., 50 out of 10,000)
const table = useReactTable({
  data: videos,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

const { rows } = table.getRowModel()
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50, // Row height
  overscan: 10
})
```

2. **Code Splitting:**
```typescript
// Lazy load heavy components
const SchemaChat = lazy(() => import('./components/SchemaChat'))
const VideoTable = lazy(() => import('./components/VideoTable'))

// Route-based splitting
const routes = [
  { path: '/', element: <Suspense><ListsPage /></Suspense> },
  { path: '/list/:id', element: <Suspense><VideoTable /></Suspense> },
]
```

3. **Aggressive Caching:**
```typescript
// TanStack Query default config
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30s fresh
      cacheTime: 5 * 60_000,  // 5min in cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
```

4. **WebSocket Auto-Reconnect:**
```typescript
const useWebSocket = (jobId: string) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/api/ws/progress/${jobId}`)

    ws.onopen = () => setStatus('connected')
    ws.onclose = () => {
      setStatus('disconnected')
      // Auto-reconnect after 2s
      setTimeout(() => {
        // Retry connection
      }, 2000)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      // Invalidate relevant queries
      queryClient.invalidateQueries(['videos', data.list_id])
    }

    return () => ws.close()
  }, [jobId])

  return status
}
```

---

## Background Processing

### ARQ Worker Architecture

**Worker Configuration:**

```python
# app/workers/settings.py
from arq import create_pool
from arq.connections import RedisSettings

class WorkerSettings:
    redis_settings = RedisSettings(host='redis', port=6379)

    functions = [
        process_video,
        process_bulk_videos,
    ]

    # Concurrency
    max_jobs = 10  # Process up to 10 videos in parallel

    # Retry configuration
    job_timeout = 300  # 5 minutes per video
    keep_result = 3600  # Keep results for 1 hour
```

**Main Processing Task:**

```python
# app/workers/video_processor.py
from arq import Job

@arq.job(max_tries=3, keep_result=3600)
async def process_video(
    ctx: dict,
    video_id: str,
    list_id: str,
    schema: dict
) -> dict:
    """
    Process single video:
    1. Fetch YouTube metadata
    2. Get transcript
    3. Extract data via Gemini
    4. Update database
    5. Publish progress
    """

    try:
        # 1. Fetch YouTube metadata
        youtube_data = await fetch_youtube_metadata(video_id)

        # Update DB with basic info
        await update_video(video_id, {
            'title': youtube_data['title'],
            'channel': youtube_data['channel'],
            'duration': youtube_data['duration'],
            'status': 'processing'
        })

        # Publish progress
        await publish_progress(list_id, video_id, 'processing')

        # 2. Get transcript
        transcript = await fetch_transcript(video_id)

        # 3. Extract data via Gemini
        extracted = await gemini_extract(
            transcript=transcript,
            schema=schema,
            video_metadata=youtube_data
        )

        # 4. Update with extracted data
        await update_video(video_id, {
            'extracted_data': extracted,
            'status': 'completed'
        })

        # 5. Publish completion
        await publish_progress(list_id, video_id, 'completed')

        return {'status': 'success', 'video_id': video_id}

    except QuotaExceededError as e:
        # Pause job, notify user
        await pause_job(list_id)
        await publish_error(list_id, 'youtube_quota_exceeded')
        raise  # Will retry after quota resets

    except VideoNotFoundError as e:
        # Mark as failed, continue with other videos
        await update_video(video_id, {
            'status': 'failed',
            'error_message': 'Video not found'
        })
        await publish_progress(list_id, video_id, 'failed')
        return {'status': 'failed', 'reason': 'not_found'}

    except Exception as e:
        # Generic error: retry with exponential backoff
        await update_video(video_id, {'status': 'failed'})
        await publish_error(list_id, 'processing_error', str(e))
        raise  # ARQ will retry
```

### YouTube API Client

```python
# app/workers/youtube_client.py
class YouTubeClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.quota_tracker = QuotaTracker()

    async def fetch_metadata(self, video_id: str) -> dict:
        # Check quota before calling
        if not await self.quota_tracker.has_quota(100):
            raise QuotaExceededError()

        # Call YouTube API
        response = await self.http_client.get(
            f"https://www.googleapis.com/youtube/v3/videos",
            params={
                'id': video_id,
                'part': 'snippet,contentDetails,statistics',
                'key': self.api_key
            }
        )

        # Track quota usage
        await self.quota_tracker.consume(100)

        if response.status_code == 404:
            raise VideoNotFoundError()
        elif response.status_code == 403:
            raise QuotaExceededError()

        return self._parse_response(response.json())
```

### Gemini AI Client

```python
# app/workers/gemini_client.py
class GeminiClient:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.model = 'gemini-2.0-flash'

    async def extract_data(
        self,
        transcript: str,
        schema: dict,
        metadata: dict
    ) -> dict:
        """
        Extract structured data from video transcript.
        """

        prompt = self._build_extraction_prompt(schema, metadata, transcript)

        try:
            response = await self.client.generate_content(
                model=self.model,
                contents=prompt,
                generation_config={
                    'temperature': 0.1,  # More deterministic
                    'response_mime_type': 'application/json'
                }
            )

            # Parse JSON response
            extracted = json.loads(response.text)

            # Validate against schema
            validated = self._validate_extracted_data(extracted, schema)

            return validated

        except RateLimitError:
            await asyncio.sleep(2)  # Wait 2s
            return await self.extract_data(transcript, schema, metadata)

    def _build_extraction_prompt(self, schema: dict, metadata: dict, transcript: str) -> str:
        field_descriptions = []
        for field in schema['fields']:
            desc = f"- {field['label']} ({field['type']})"
            if field['type'] in ['select', 'multi-select']:
                desc += f": Options are {field['options']}"
            field_descriptions.append(desc)

        return f"""
        Extract the following information from this YouTube video:

        Video Title: {metadata['title']}
        Channel: {metadata['channel']}

        Fields to extract:
        {chr(10).join(field_descriptions)}

        Transcript:
        {transcript[:10000]}  # Limit to 10k chars

        Return ONLY valid JSON matching this structure:
        {json.dumps({f['name']: 'value' for f in schema['fields']}, indent=2)}
        """
```

### Progress Publishing

```python
# app/workers/progress_publisher.py
class ProgressPublisher:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def publish_progress(
        self,
        job_id: str,
        video_id: str,
        status: str,
        processed: int,
        total: int
    ):
        """
        Publish progress update to Redis pub/sub.
        WebSocket manager subscribes and forwards to clients.
        """
        message = {
            'type': 'progress',
            'job_id': job_id,
            'video_id': video_id,
            'status': status,
            'processed': processed,
            'total': total,
            'timestamp': datetime.utcnow().isoformat()
        }

        await self.redis.publish(
            f'progress:{job_id}',
            json.dumps(message)
        )
```

---

## Error Handling

### User-Friendly Error Messages

**Backend Error Mapper:**

```python
# app/core/errors.py
ERROR_MESSAGES = {
    'youtube_quota_exceeded': {
        'title': 'Tägliches YouTube-Limit erreicht',
        'message': 'YouTube erlaubt nur 100 kostenlose Video-Analysen pro Tag. Sie haben heute bereits alle verfügbaren Analysen aufgebraucht.',
        'actions': [
            'Warten Sie bis morgen um 00:00 Uhr (Pacific Time), dann können Sie weitermachen',
            'Oder: Pausieren Sie den Job jetzt und setzen Sie ihn morgen fort (Ihr Fortschritt bleibt gespeichert)',
            'Für mehr als 100 Videos/Tag: Aktivieren Sie YouTube API Billing in der Google Cloud Console'
        ],
        'severity': 'warning',
        'docs_link': 'https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas'
    },

    'video_not_found': {
        'title': 'Video nicht verfügbar',
        'message': 'Das Video "{video_title}" wurde gelöscht, ist privat oder wurde von YouTube entfernt.',
        'actions': [
            'Entfernen Sie dieses Video aus Ihrer Liste',
            'Die Verarbeitung läuft automatisch mit den anderen Videos weiter'
        ],
        'severity': 'info'
    },

    'gemini_rate_limit': {
        'title': 'KI-Analyse vorübergehend verlangsamt',
        'message': 'Die KI-Analyse läuft etwas langsamer, weil zu viele Anfragen gleichzeitig verarbeitet wurden. Das System versucht es automatisch erneut.',
        'actions': [
            'Keine Aktion nötig - die Verarbeitung läuft weiter',
            'Bei großen Listen (>100 Videos): Planen Sie ca. 30-60 Minuten Gesamtzeit ein'
        ],
        'severity': 'info'
    },

    'network_error': {
        'title': 'Netzwerkfehler',
        'message': 'Die Verbindung zu YouTube oder der KI-Analyse wurde unterbrochen. Das System versucht es automatisch noch {retry_count} mal.',
        'actions': [
            'Prüfen Sie Ihre Internetverbindung',
            'Der Job läuft automatisch weiter, sobald die Verbindung wieder steht'
        ],
        'severity': 'warning'
    }
}

def get_user_friendly_error(error_code: str, **context) -> dict:
    """
    Get user-friendly error message with context interpolation.
    """
    template = ERROR_MESSAGES.get(error_code, {
        'title': 'Ein Fehler ist aufgetreten',
        'message': 'Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
        'actions': [],
        'severity': 'error'
    })

    # Interpolate context variables
    message = template['message'].format(**context)

    return {
        **template,
        'message': message,
        'error_code': error_code
    }
```

### Frontend Error Display

```typescript
// components/ErrorDisplay/ErrorModal.tsx
interface ErrorModalProps {
  error: UserFriendlyError
  onClose: () => void
}

const ErrorModal: React.FC<ErrorModalProps> = ({ error, onClose }) => {
  const severityIcon = {
    info: <InfoIcon />,
    warning: <AlertTriangleIcon />,
    error: <XCircleIcon />
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {severityIcon[error.severity]}
            <DialogTitle>{error.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message}
          </p>

          {error.actions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Was können Sie tun?</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {error.actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {error.docs_link && (
            <Button variant="link" asChild>
              <a href={error.docs_link} target="_blank">
                Anleitung anzeigen →
              </a>
            </Button>
          )}
        </div>

        <DialogFooter>
          {error.severity === 'warning' && (
            <Button variant="outline" onClick={handlePauseJob}>
              Job pausieren
            </Button>
          )}
          <Button onClick={onClose}>Verstanden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Retry Strategy

**ARQ Retry Configuration:**

```python
@arq.job(
    max_tries=3,
    retry_backoff=True,  # Exponential backoff: 1min, 5min, 15min
    keep_result=3600
)
async def process_video(ctx, video_id: str):
    pass
```

**Custom Retry Logic for API Calls:**

```python
async def fetch_with_retry(url: str, max_retries: int = 3) -> dict:
    for attempt in range(max_retries):
        try:
            response = await http_client.get(url, timeout=30)
            return response.json()

        except asyncio.TimeoutError:
            if attempt == max_retries - 1:
                raise
            wait_time = 2 ** attempt  # 1s, 2s, 4s
            await asyncio.sleep(wait_time)

        except aiohttp.ClientError as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)
```

### Checkpoint/Resume System

```python
# app/services/job_service.py
class JobService:
    async def resume_job(self, job_id: str):
        """
        Resume a paused or failed job.
        Re-enqueues only pending/failed videos.
        """
        job = await self.repo.get_job(job_id)

        # Find videos that need processing
        pending_videos = await self.repo.get_videos_by_status(
            list_id=job.list_id,
            statuses=['pending', 'failed']
        )

        # Re-enqueue each video
        for video in pending_videos:
            await arq_client.enqueue_job(
                'process_video',
                video_id=video.id,
                list_id=job.list_id,
                schema=job.schema
            )

        # Update job status
        await self.repo.update_job(job_id, {'status': 'running'})
```

---

## Schema Builder

### AI-Powered Schema Definition

**Chat Interface Flow:**

```
User: "Ich möchte Schwierigkeitsgrad, Kategorie und Tags tracken"

AI: Schlägt Schema vor
{
  "fields": [
    {"name": "difficulty", "type": "select", "options": ["Anfänger", ...]},
    {"name": "category", "type": "select", "options": [...]},
    {"name": "tags", "type": "multi-select"}
  ]
}

User: "Kannst du noch geschätzte Lernzeit hinzufügen?"

AI: Fügt Feld hinzu
{
  "fields": [...previous, {"name": "estimated_duration", "type": "duration"}]
}

User: "Perfekt, übernehmen"

System: Speichert Schema in DB, verknüpft mit Liste
```

**Gemini System Prompt:**

```python
SCHEMA_BUILDER_PROMPT = """
Du bist ein Schema-Designer für YouTube-Video-Metadaten.

Der Nutzer beschreibt in natürlicher Sprache, welche Informationen er aus
YouTube-Videos extrahieren möchte. Deine Aufgabe ist es, ein strukturiertes
JSON-Schema zu generieren, das diese Anforderungen abbildet.

Verfügbare Feldtypen:
- text: Freitext (für Beschreibungen, Notizen)
- select: Einfachauswahl mit vordefinierten Optionen
- multi-select: Mehrfachauswahl (z.B. Tags, Kategorien)
- number: Numerischer Wert
- duration: Zeitangabe in Minuten
- boolean: Ja/Nein-Auswahl

Richtlinien:
1. Schlage sinnvolle Optionen für select/multi-select vor
2. Nutze englische Feldnamen (snake_case), aber deutsche Labels
3. Markiere wichtige Felder als required: true
4. Halte die Anzahl der Felder überschaubar (max 8-10)
5. Antworte IMMER mit validem JSON im folgenden Format:

{
  "fields": [
    {
      "name": "field_name",
      "label": "Deutsches Label",
      "type": "select|text|...",
      "options": ["Option 1", "Option 2"],  // Nur bei select/multi-select
      "required": false
    }
  ]
}

Wenn der Nutzer Änderungen wünscht, modifiziere das bestehende Schema
(füge hinzu, entferne oder ändere Felder).
"""
```

**Backend Implementation:**

```python
# app/api/schema.py
@router.post("/schema/chat")
async def schema_chat(
    request: SchemaChatRequest,
    ai_service: AIService = Depends()
):
    """
    Chat with AI to define/refine schema.
    """

    # Build conversation context
    messages = [
        {"role": "system", "content": SCHEMA_BUILDER_PROMPT},
        *request.conversation_history,
        {"role": "user", "content": request.message}
    ]

    # Call Gemini
    response = await ai_service.chat(messages)

    # Try to parse schema from response
    schema = None
    try:
        # Extract JSON from response (might be wrapped in markdown)
        json_match = re.search(r'```json\n(.*?)\n```', response, re.DOTALL)
        if json_match:
            schema_data = json.loads(json_match.group(1))
            schema = SchemaDefinition(**schema_data)
    except Exception:
        pass  # Schema not ready yet

    return {
        "message": response,
        "schema": schema,
        "conversation_id": request.conversation_id or str(uuid4())
    }
```

### Dynamic Form Generation

**Frontend Schema Renderer:**

```typescript
// components/DynamicForm.tsx
interface DynamicFormProps {
  schema: SchemaDefinition
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
}

const DynamicForm: React.FC<DynamicFormProps> = ({ schema, values, onChange }) => {
  return (
    <Form>
      {schema.fields.map((field) => {
        switch (field.type) {
          case 'text':
            return (
              <FormField key={field.name}>
                <FormLabel>{field.label}</FormLabel>
                <Input
                  value={values[field.name] || ''}
                  onChange={(e) => onChange({ ...values, [field.name]: e.target.value })}
                />
              </FormField>
            )

          case 'select':
            return (
              <FormField key={field.name}>
                <FormLabel>{field.label}</FormLabel>
                <Select
                  value={values[field.name]}
                  onValueChange={(val) => onChange({ ...values, [field.name]: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )

          case 'multi-select':
            return (
              <FormField key={field.name}>
                <FormLabel>{field.label}</FormLabel>
                <MultiSelect
                  options={field.options}
                  value={values[field.name] || []}
                  onChange={(val) => onChange({ ...values, [field.name]: val })}
                />
              </FormField>
            )

          case 'duration':
            return (
              <FormField key={field.name}>
                <FormLabel>{field.label} (Minuten)</FormLabel>
                <Input
                  type="number"
                  value={values[field.name] || ''}
                  onChange={(e) => onChange({ ...values, [field.name]: parseInt(e.target.value) })}
                />
              </FormField>
            )

          // ... other field types
        }
      })}
    </Form>
  )
}
```

---

## Performance Optimizations

### Guaranteed Response Times

| Operation | Target | Implementation |
|-----------|--------|----------------|
| Button click → UI feedback | <16ms | Optimistic updates, Zustand |
| API call (localhost) | <50ms | FastAPI async, no blocking |
| WebSocket update | <10ms | Redis pub/sub, direct push |
| Table scroll (1000+ rows) | 60fps | TanStack Table virtualization |
| CSV import (100 videos) | <1s | Streaming parser, background job |
| Schema form render | <100ms | Dynamic rendering, no re-renders |

### Backend Performance

**Database Indexing:**
- B-tree indexes on FK columns (list_id, schema_id)
- GIN index on JSONB columns for fast filtering
- Partial indexes on status columns

**Query Optimization:**
```python
# Efficient video loading with pagination
async def get_videos_paginated(
    list_id: str,
    limit: int = 100,
    offset: int = 0,
    filters: dict = None
) -> list[Video]:
    query = select(Video).where(Video.list_id == list_id)

    # Apply filters on JSONB fields
    if filters:
        for key, value in filters.items():
            query = query.where(
                Video.extracted_data[key].as_string() == value
            )

    query = query.limit(limit).offset(offset)
    return await session.execute(query)
```

**Caching Strategy:**
- Redis cache for quota status (TTL: 5 minutes)
- Redis cache for schema definitions (TTL: 1 hour)
- SQLAlchemy query result cache

### Frontend Performance

**Bundle Size Optimization:**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'tanstack': ['@tanstack/react-query', '@tanstack/react-table'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-select'],
        }
      }
    }
  }
})

// Target bundle sizes:
// - Initial load: ~150kb (gzipped)
// - React vendor: ~130kb
// - TanStack: ~50kb
// - UI components: ~40kb
```

**Lazy Loading:**
```typescript
// Routes with Suspense
const SchemaChat = lazy(() => import('./features/schema/SchemaChat'))
const VideoTable = lazy(() => import('./features/videos/VideoTable'))

// Load only when navigating to route
<Route path="/schema" element={
  <Suspense fallback={<LoadingSpinner />}>
    <SchemaChat />
  </Suspense>
} />
```

---

## Deployment

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: youtube-bookmarks-db
    environment:
      POSTGRES_DB: youtube_bookmarks
      POSTGRES_USER: user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: youtube-bookmarks-redis
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: youtube-bookmarks-app
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://user:${POSTGRES_PASSWORD:-changeme}@postgres/youtube_bookmarks
      REDIS_URL: redis://redis:6379
      YOUTUBE_API_KEY: ${YOUTUBE_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      ENV: production
    volumes:
      - ./data:/app/data  # Checkpoints, logs

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: youtube-bookmarks-worker
    command: arq app.workers.settings.WorkerSettings
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://user:${POSTGRES_PASSWORD:-changeme}@postgres/youtube_bookmarks
      REDIS_URL: redis://redis:6379
      YOUTUBE_API_KEY: ${YOUTUBE_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      ENV: production
    volumes:
      - ./data:/app/data

volumes:
  postgres_data:
```

### Dockerfile (Multi-Stage Build)

```dockerfile
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build  # Output: dist/

# Stage 2: Build Backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY app/ ./app/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./app/static

# Expose port
EXPOSE 8000

# Run migrations and start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

### Installation Instructions

**User-Facing README:**

```markdown
# Smart YouTube Bookmarks - Installation

## Prerequisites
- Docker Desktop installed ([Download](https://www.docker.com/products/docker-desktop))
- YouTube Data API key ([Get one](https://console.cloud.google.com/apis/api/youtube.googleapis.com))
- Google Gemini API key ([Get one](https://aistudio.google.com/app/apikey))

## Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/smart-youtube-bookmarks.git
   cd smart-youtube-bookmarks
   ```

2. **Configure API keys:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:
   ```
   YOUTUBE_API_KEY=your_youtube_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Start the application:**
   ```bash
   docker-compose up
   ```

   First start will take 2-3 minutes (building images, database setup).

4. **Open in browser:**
   ```
   http://localhost:8000
   ```

## Stopping the Application

```bash
docker-compose down
```

## Updating

```bash
git pull
docker-compose up --build
```

## Troubleshooting

### Port 8000 already in use
Edit `docker-compose.yml` and change `"8000:8000"` to `"8080:8000"`,
then access at `http://localhost:8080`.

### API key errors
Verify your keys are correct in `.env` file. Restart with `docker-compose restart`.
```

### First-Run Setup Wizard

**Backend Check:**

```python
# app/api/setup.py
@router.get("/setup/status")
async def get_setup_status():
    """
    Check if application is properly configured.
    """
    return {
        "youtube_api_configured": bool(os.getenv('YOUTUBE_API_KEY')),
        "gemini_api_configured": bool(os.getenv('GEMINI_API_KEY')),
        "database_connected": await check_db_connection(),
        "redis_connected": await check_redis_connection()
    }

@router.post("/setup/validate-keys")
async def validate_api_keys(keys: APIKeysRequest):
    """
    Test API keys before saving.
    """
    youtube_valid = await test_youtube_key(keys.youtube_api_key)
    gemini_valid = await test_gemini_key(keys.gemini_api_key)

    return {
        "youtube_valid": youtube_valid,
        "gemini_valid": gemini_valid
    }
```

**Frontend Setup Wizard:**

```typescript
// components/SetupWizard.tsx
const SetupWizard = () => {
  const { data: status } = useQuery(['setup-status'], fetchSetupStatus)

  if (!status) return <LoadingSpinner />

  if (!status.youtube_api_configured || !status.gemini_api_configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Willkommen! Lassen Sie uns beginnen.</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Bitte konfigurieren Sie Ihre API-Keys, um fortzufahren.</p>

          <div className="space-y-4 mt-4">
            <FormField>
              <FormLabel>YouTube API Key</FormLabel>
              <Input type="password" placeholder="AIza..." />
              <FormDescription>
                <a href="https://console.cloud.google.com/apis/api/youtube.googleapis.com" target="_blank">
                  API-Key erstellen →
                </a>
              </FormDescription>
            </FormField>

            <FormField>
              <FormLabel>Gemini API Key</FormLabel>
              <Input type="password" placeholder="AIza..." />
              <FormDescription>
                <a href="https://aistudio.google.com/app/apikey" target="_blank">
                  API-Key erstellen →
                </a>
              </FormDescription>
            </FormField>

            <Button onClick={handleValidateKeys}>Keys validieren</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Keys configured, show main app
  return <MainApp />
}
```

---

## Security

### Local-Only Security

**No Authentication Required:**
- App runs on localhost only
- Single-user by design
- No network exposure

**API Key Protection:**
- Stored in `.env` (gitignored)
- Never exposed to frontend
- Backend-only access

**Input Validation:**

```python
# Backend: Pydantic models
class CreateListRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()
```

```typescript
// Frontend: Zod schemas
const createListSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(255),
  description: z.string().max(1000).optional()
})

// Validate before API call
const validated = createListSchema.parse(formData)
```

**SQL Injection Prevention:**
- SQLAlchemy ORM (parameterized queries)
- No raw SQL queries

**XSS Prevention:**
- React escapes by default
- DOMPurify for any user-generated HTML (if needed)

**CORS Configuration:**

```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Testing Strategy

### Backend Tests

**Unit Tests (Pytest):**

```python
# tests/services/test_video_service.py
import pytest
from app.services.video_service import VideoService

@pytest.mark.asyncio
async def test_add_video_extracts_youtube_id(video_service):
    """Test that YouTube ID is correctly extracted from URL."""
    result = await video_service.add_video(
        list_id="123",
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    )

    assert result.youtube_id == "dQw4w9WgXcQ"

@pytest.mark.asyncio
async def test_add_duplicate_video_raises_error(video_service):
    """Test that adding duplicate video raises error."""
    await video_service.add_video(list_id="123", url="https://youtube.com/watch?v=abc")

    with pytest.raises(DuplicateVideoError):
        await video_service.add_video(list_id="123", url="https://youtube.com/watch?v=abc")
```

**Integration Tests:**

```python
# tests/integration/test_processing_flow.py
@pytest.mark.asyncio
async def test_video_processing_end_to_end(client, db_session):
    """Test complete video processing flow."""

    # 1. Create list
    response = await client.post("/api/lists", json={"name": "Test List"})
    list_id = response.json()["id"]

    # 2. Add video
    response = await client.post(
        f"/api/lists/{list_id}/videos",
        json={"url": "https://youtube.com/watch?v=test"}
    )
    video_id = response.json()["id"]

    # 3. Process video (mock ARQ worker)
    await process_video_mock(video_id, list_id, schema={})

    # 4. Verify video updated
    video = await db_session.get(Video, video_id)
    assert video.processing_status == "completed"
    assert video.extracted_data is not None
```

**Worker Tests:**

```python
# tests/workers/test_video_processor.py
@pytest.mark.asyncio
async def test_process_video_handles_quota_exceeded(mocker):
    """Test that quota exceeded error is handled correctly."""

    mocker.patch('app.workers.youtube_client.fetch_metadata',
                 side_effect=QuotaExceededError())

    with pytest.raises(QuotaExceededError):
        await process_video(ctx={}, video_id="123", list_id="456", schema={})

    # Verify job was paused
    job = await get_job("456")
    assert job.status == "paused"
```

### Frontend Tests

**Component Tests (Vitest + Testing Library):**

```typescript
// tests/components/VideoTable.test.tsx
import { render, screen } from '@testing-library/react'
import { VideoTable } from '@/components/VideoTable'

describe('VideoTable', () => {
  it('renders videos correctly', () => {
    const videos = [
      { id: '1', title: 'Test Video', status: 'completed' },
      { id: '2', title: 'Processing Video', status: 'processing' }
    ]

    render(<VideoTable videos={videos} />)

    expect(screen.getByText('Test Video')).toBeInTheDocument()
    expect(screen.getByText('Processing Video')).toBeInTheDocument()
  })

  it('shows loading state when data is pending', () => {
    render(<VideoTable videos={[]} isLoading />)

    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
  })
})
```

**Hook Tests:**

```typescript
// tests/hooks/useWebSocket.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useWebSocket } from '@/hooks/useWebSocket'

describe('useWebSocket', () => {
  it('connects to WebSocket on mount', async () => {
    const { result } = renderHook(() => useWebSocket('job-123'))

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })
  })

  it('auto-reconnects on disconnect', async () => {
    const { result } = renderHook(() => useWebSocket('job-123'))

    // Simulate disconnect
    act(() => {
      mockWebSocket.close()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('connecting')
    }, { timeout: 3000 })
  })
})
```

**E2E Tests (Playwright):**

```typescript
// tests/e2e/video-workflow.spec.ts
import { test, expect } from '@playwright/test'

test('complete video import workflow', async ({ page }) => {
  // 1. Navigate to app
  await page.goto('http://localhost:8000')

  // 2. Create new list
  await page.click('[data-testid="create-list-button"]')
  await page.fill('[data-testid="list-name-input"]', 'My Test List')
  await page.click('[data-testid="save-list-button"]')

  // 3. Add video
  await page.fill('[data-testid="video-url-input"]', 'https://youtube.com/watch?v=test')
  await page.click('[data-testid="add-video-button"]')

  // 4. Verify video appears in table
  await expect(page.locator('[data-testid="video-row"]')).toBeVisible()

  // 5. Start processing
  await page.click('[data-testid="process-button"]')

  // 6. Wait for completion (WebSocket updates)
  await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 30000 })
})
```

### Test Coverage Goals

- Backend: >80% coverage (pytest-cov)
- Frontend: >70% coverage (Vitest coverage)
- E2E: Critical user paths covered

---

## Future Considerations

### Out of Scope (v1.0) but Prepared For

**Browser Extension:**
- 1-click bookmarking from YouTube
- Right-click context menu: "Add to Smart Bookmarks"
- Architecture supports: POST /api/lists/{id}/videos accepts single URL

**Playlist Import:**
- Import entire YouTube playlists at once
- Backend: YouTube API playlist.items endpoint
- Frontend: Playlist URL input field

**Collaborative Features (SaaS Version):**
- Multi-user authentication (add later)
- Shared bookmark lists
- Permission system (view/edit)
- Current schema design supports: Add user_id FK to lists table

**Advanced Filtering:**
- Combine multiple filters (AND/OR logic)
- Save filter presets
- Full-text search across transcript (requires transcript storage)

**Video Annotations:**
- User notes on videos
- Timestamp-based bookmarks within videos
- Schema: Add annotations table with video_id FK

**Analytics Dashboard:**
- Most watched categories
- Average difficulty distribution
- Learning progress tracking

---

## Appendix

### Tech Stack Summary

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Backend Framework | FastAPI | Latest | Async-native, WebSocket support, auto-docs |
| Backend Language | Python | 3.11+ | Excellent AI/ML library support |
| Task Queue | ARQ | Latest | FastAPI-native, elegant async integration |
| Database | PostgreSQL | 16 | Robust JSONB support, full-text search |
| Cache/Queue | Redis | 7 | ARQ broker, pub/sub for WebSocket |
| Frontend Framework | React | 18 | Concurrent features, large ecosystem |
| Frontend Language | TypeScript | 5+ | Type safety, strict mode |
| Build Tool | Vite | Latest | Fast HMR, optimal bundling |
| State Management | TanStack Query | v5 | Server state, caching |
| UI Components | shadcn/ui | Latest | Headless, accessible, type-safe |
| Tables | TanStack Table | Latest | Virtualization, sorting, filtering |
| Deployment | Docker Compose | Latest | Simple local deployment |

### API Quota Limits

**YouTube Data API v3:**
- Free tier: 10,000 units/day
- Cost per video: ~100 units
- Maximum free videos/day: ~100
- Reset time: Daily at 00:00 Pacific Time

**Google Gemini API:**
- Free tier: 1,500 requests/minute
- Flash model: Very generous limits
- Unlikely to be bottleneck for typical usage

### Performance Benchmarks (Target)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial page load | <2s | Lighthouse Performance Score >90 |
| API response (GET) | <50ms | p95 latency |
| API response (POST) | <100ms | p95 latency |
| WebSocket latency | <10ms | Message delivery time |
| Table scroll (1000 rows) | 60fps | Frame rate monitoring |
| Video processing | 2-5min/video | Including API calls |

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-27 | 1.0 | Initial design document | Claude + User |

---

## Approval

**Status:** ✅ Approved
**Date:** 2025-10-27
**Next Steps:**
1. Set up git worktree
2. Create implementation plan
3. Begin development
