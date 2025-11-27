# Codebase Analysis: Robust Video Import

## Überblick

Die Codebase ist gut strukturiert und hat bereits **viel relevante Infrastruktur**:
- ~210 Frontend-Komponenten, ~80 Backend-Module
- WebSocket-Backend existiert (muss nur im Frontend integriert werden!)
- VideoEnrichment-Modell mit Status-Tracking vorhanden
- ARQ Worker-System für Background Jobs aktiv

## Bestehende Architektur

### Backend (Python/FastAPI)

```
backend/app/
├── api/                    # Router-basierte API
│   ├── videos.py          # POST /api/lists/{list_id}/videos
│   ├── processing.py      # Job-Verwaltung
│   ├── websocket.py       # WS /api/ws/progress ← EXISTIERT!
│   └── enrichment.py      # GET/POST enrichment
├── models/
│   ├── video.py           # processing_status Feld vorhanden
│   ├── video_enrichment.py # status, progress_message, retry_count
│   └── job.py             # ProcessingJob + JobProgressEvent
├── workers/
│   ├── settings.py        # ARQ Config, max_jobs: 10
│   └── video_processor.py # process_video, enrich_video
└── services/enrichment/
    └── enrichment_service.py # Caption + Chapter Extraction
```

**Wichtige Erkenntnisse:**
| Komponente | Status | Details |
|------------|--------|---------|
| WebSocket Backend | ✅ Existiert | `/api/ws/progress`, Redis Pub/Sub |
| VideoEnrichment Model | ✅ Existiert | status, progress_message, retry_count |
| ARQ Worker | ✅ Aktiv | `process_video`, `enrich_video` Jobs |
| Retry Logic | ⚠️ Teilweise | ARQ built-in, aber kein Groq Fallback |
| Rate Limiting | ❌ Fehlt | Nur ein Semaphore(1) für YouTube API |

### Frontend (React/TypeScript)

```
frontend/src/
├── components/
│   ├── VideoGrid.tsx      # Grid-Ansicht (2-5 Spalten)
│   ├── VideoCard.tsx      # Einzelne Video-Karte
│   ├── JobProgressCard.tsx # Job-Progress Anzeige
│   └── EnrichmentStatus.tsx # Enrichment Status
├── hooks/
│   ├── useVideos.ts       # Video CRUD
│   ├── useVideoEnrichment.ts # Polling alle 2s
│   └── useVideoDropZone.ts # Drag-Drop Import
├── stores/
│   └── importDropStore.ts # Pending Import State
└── lib/
    └── api.ts             # Axios Client
```

**Wichtige Erkenntnisse:**
| Komponente | Status | Details |
|------------|--------|---------|
| WebSocket Frontend | ❌ Fehlt | Muss implementiert werden |
| Progress Overlay | ❌ Fehlt | Tortenoverlay muss gebaut werden |
| Grayscale State | ❌ Fehlt | VideoCard braucht "importing" State |
| Polling | ✅ Existiert | useVideoEnrichment pollt alle 2s |

### Datenbank (PostgreSQL + SQLAlchemy 2.0)

**Relevante Tabellen:**

```sql
-- Videos (existiert)
videos:
  - processing_status: pending/processing/completed/failed
  - error_message: TEXT
  - Indices: list_id, status

-- VideoEnrichments (existiert)
video_enrichments:
  - status: pending/processing/completed/partial/failed
  - progress_message: VARCHAR  ← Kann für Stage genutzt werden
  - retry_count: INTEGER
  - captions_vtt, chapters_json, etc.

-- MUSS HINZUGEFÜGT WERDEN:
videos:
  + import_progress: INTEGER DEFAULT 0
  + import_stage: VARCHAR(20) DEFAULT 'pending'
```

## Bestehende Patterns

### 1. Job-Enqueuing Pattern
```python
# In api/videos.py
await arq_pool.enqueue_job('process_video', video_id, list_id, schema, job_id)
await arq_pool.enqueue_job('enrich_video', video_id)
```

### 2. Worker Context Injection
```python
# In workers/settings.py
async def on_job_start(ctx: dict):
    ctx['db'] = await get_db_session()

async def after_job_end(ctx: dict, ...):
    await ctx['db'].commit()
    await ctx['db'].close()
```

### 3. Progress Publishing (Backend)
```python
# In workers/video_processor.py
async def publish_progress(redis, user_id, data):
    await redis.publish(f"progress:user:{user_id}", json.dumps(data))
```

### 4. React Query + Polling (Frontend)
```typescript
// In useVideoEnrichment.ts
const { data } = useQuery({
  queryKey: ['enrichment', videoId],
  refetchInterval: status === 'processing' ? 2000 : false,
})
```

## Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  VideoGrid.tsx ──► VideoCard.tsx ──► [NEU] ProgressOverlay.tsx  │
│       │                                          ▲               │
│       │                                          │               │
│  useVideos.ts ◄──────── [NEU] useWebSocket.ts ───┘              │
│       │                         │                                │
│       ▼                         │                                │
│  React Query                    │ WebSocket                      │
└───────┬─────────────────────────┼───────────────────────────────┘
        │ HTTP                    │
        ▼                         ▼
┌───────────────────────────────────────────────────────────────┐
│                        BACKEND                                 │
├───────────────────────────────────────────────────────────────┤
│  api/videos.py ──► [NEU] Two-Phase Import                     │
│       │                                                        │
│       ▼                                                        │
│  arq_pool.enqueue_job() ──► workers/video_processor.py        │
│                                   │                            │
│                                   ▼                            │
│                        [NEU] publish_progress()               │
│                                   │                            │
│                                   ▼                            │
│  api/websocket.py ◄────── Redis Pub/Sub                       │
│  (EXISTIERT!)                                                  │
└───────────────────────────────────────────────────────────────┘
```

## Wiederverwendbare Komponenten

### Können direkt genutzt werden:
1. **WebSocket Backend** (`api/websocket.py`) - Nur Frontend-Hook nötig
2. **ARQ Worker System** - Erweiterung für Rate Limiting
3. **VideoEnrichment Model** - Erweiterung um import_stage
4. **JobProgressEvent** - Für granulares Progress-Tracking
5. **useVideoEnrichment** - Als Basis für WebSocket-Migration

### Müssen erweitert werden:
1. **Video Model** - `import_progress`, `import_stage` Felder
2. **enrich_video Worker** - Exponential Backoff + Groq Fallback
3. **VideoCard.tsx** - "Importing" State mit Overlay

### Müssen neu gebaut werden:
1. **useWebSocket Hook** - Frontend WebSocket Client
2. **ProgressOverlay.tsx** - Tortenoverlay Komponente
3. **Groq Whisper Provider** - Fallback für Captions
4. **Circuit Breaker** - Rate Limiting Logik

## Risiken & Abhängigkeiten

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| WebSocket Auth | Hoch | JWT aus existing auth nutzen |
| Groq API Keys | Mittel | Environment Config Pattern folgen |
| DB Migration | Niedrig | Alembic existiert, non-breaking |
| Rate Limiting | Hoch | Circuit Breaker Pattern implementieren |

## Exit Condition ✅

**Klares Bild wo/wie Feature integriert wird?**

> Das Feature integriert sich primär in:
> - `api/videos.py` (Two-Phase Import Logik)
> - `workers/video_processor.py` (Erweitertes Enrichment)
> - `VideoCard.tsx` (Progress Overlay)
> - Neuer `useWebSocket` Hook (Progress Updates)
>
> WebSocket-Backend existiert bereits, Frontend-Integration fehlt.
> VideoEnrichment-Modell kann erweitert werden für Stage-Tracking.

✅ Codebase verstanden, bereit für Phase 3.
