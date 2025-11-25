# Video Enrichment - Codebase Analysis

## Zusammenfassung

Die Smart YouTube Bookmarks App ist eine gut strukturierte Full-Stack-Anwendung mit:
- **Backend:** FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend:** React + TypeScript + Vite + React Query + Zustand
- **Background Jobs:** ARQ (Redis-basiert)
- **Video Player:** Vidstack (bereits mit Text Track Support)

---

## 1. Projekt-Struktur

### Backend (`/backend`)
```
app/
├── api/              # FastAPI Router
│   ├── videos.py     # Video CRUD + Watch Progress
│   ├── processing.py # Job-Koordination
│   └── websocket.py  # Live Progress Updates
├── models/           # SQLAlchemy ORM
│   ├── video.py      # Video Model (60+ Felder)
│   └── job.py        # ProcessingJob Model
├── workers/          # ARQ Background Jobs
│   ├── video_processor.py  # Worker Functions
│   └── settings.py         # ARQ Config
├── services/         # Business Logic
├── clients/          # External APIs (YouTube, Gemini)
└── core/
    ├── database.py   # Async SQLAlchemy Engine
    ├── redis.py      # ARQ Pool Management
    └── config.py     # Environment Config
```

### Frontend (`/frontend`)
```
src/
├── components/
│   └── VideoPlayer.tsx    # Vidstack Player (bereits fertig!)
├── pages/
│   └── VideoDetailsPage.tsx
├── hooks/
│   ├── useVideos.ts       # Video Fetching
│   └── useWatchProgress.ts # Progress Tracking
├── stores/                # Zustand State
└── lib/
    ├── api.ts             # Axios Instance
    └── queryClient.ts     # React Query Config
```

---

## 2. Relevante Dateien für Enrichment

### Backend - Existierende Integration Points

| Datei | Relevanz | Beschreibung |
|-------|----------|--------------|
| `app/models/video.py` | **Hoch** | Video Model - hat bereits `extracted_data` JSONB |
| `app/workers/video_processor.py` | **Hoch** | Bestehender Worker - Pattern für neuen Worker |
| `app/workers/settings.py` | **Hoch** | ARQ Config - neue Worker-Funktion registrieren |
| `app/api/videos.py` | **Mittel** | Video-API - Enrichment-Endpoint hinzufügen |
| `app/core/redis.py` | **Mittel** | ARQ Pool - wird wiederverwendet |
| `app/core/config.py` | **Mittel** | Groq API Key hinzufügen |

### Frontend - Existierende Integration Points

| Datei | Relevanz | Beschreibung |
|-------|----------|--------------|
| `components/VideoPlayer.tsx` | **Hoch** | **Text Tracks bereits implementiert!** |
| `hooks/useVideos.ts` | **Mittel** | Pattern für neuen Hook |
| `pages/VideoDetailsPage.tsx` | **Mittel** | Enrichment-Status anzeigen |
| `lib/api.ts` | **Niedrig** | Axios - wird wiederverwendet |

---

## 3. Video Model - Analyse

**Datei:** `backend/app/models/video.py`

### Relevante bestehende Felder
```python
class Video(Base):
    # Identifiers
    id: UUID
    youtube_id: str              # 11-char YouTube ID

    # Enrichment-ready
    has_captions: bool           # Flag von YouTube
    extracted_data: dict         # JSONB - kann für Enrichment genutzt werden

    # Processing Status
    processing_status: str       # pending/processing/completed/failed
    error_message: str           # Fehlermeldung

    # Metadata
    description: str             # Für Chapter-Parsing aus Beschreibung
    duration: int                # Video-Länge in Sekunden
```

### Empfehlung: Neues Model statt extracted_data

**Problem:** `extracted_data` ist bereits für Gemini-Extraktion genutzt.

**Lösung:** Separates `VideoEnrichment` Model für saubere Trennung:
```python
class VideoEnrichment(Base):
    video_id: UUID (FK → Video)
    status: str  # pending/processing/completed/failed

    # Captions
    captions_vtt: str            # VTT Content
    captions_language: str       # de, en
    captions_source: str         # youtube_manual/youtube_auto/groq_whisper

    # Chapters
    chapters_vtt: str            # VTT Content
    chapters_json: list[dict]    # [{start, end, title}]
    chapters_source: str         # youtube/description_parsed

    # Thumbnails
    thumbnails_vtt_url: str      # Storyboard URL

    # Transcript (für Suche)
    transcript_text: str         # Plain text für Full-Text-Search

    # Processing
    error_message: str
    retry_count: int
    processed_at: datetime
```

---

## 4. Background Job System - ARQ

### Bestehende Worker-Architektur

**Datei:** `backend/app/workers/settings.py`
```python
class WorkerSettings:
    max_jobs = 10
    job_timeout = 300  # 5 Minuten
    functions = [process_video, process_video_list]  # Hier einhängen!
```

**Datei:** `backend/app/workers/video_processor.py`
```python
async def process_video(ctx, video_id, list_id, schema, job_id):
    db = ctx['db']  # Session injected via on_job_start
    # ... processing logic
```

### Pattern für neuen Enrichment-Worker

```python
# Neuer Worker: enrich_video
async def enrich_video(ctx, video_id: str):
    db = ctx['db']

    # 1. Video laden
    video = await db.get(Video, video_id)

    # 2. Enrichment-Record erstellen/laden
    enrichment = await get_or_create_enrichment(db, video_id)

    # 3. Captions holen (YouTube → Groq Fallback)
    captions = await fetch_captions(video.youtube_id)

    # 4. Chapters holen (YouTube → Description Parse)
    chapters = await fetch_chapters(video.youtube_id, video.description)

    # 5. Speichern
    enrichment.captions_vtt = captions.vtt
    enrichment.chapters_json = chapters
    await db.commit()
```

### Trigger-Punkt

**Option A:** Beim Video-Import (automatisch)
```python
# In videos.py create_video()
await arq_pool.enqueue_job('enrich_video', str(video.id))
```

**Option B:** Nach erfolgreicher Video-Verarbeitung
```python
# In video_processor.py process_video()
# Nach completion:
await ctx['arq_pool'].enqueue_job('enrich_video', str(video_id))
```

**Empfehlung:** Option A - sofort nach Import starten, parallel zur YouTube-Metadaten-Verarbeitung.

---

## 5. API-Struktur

### Bestehende Patterns

**Router-Registrierung in `main.py`:**
```python
app.include_router(videos.router)
app.include_router(processing.router)
# → Neuen enrichment.router hinzufügen
```

**Dependency Injection:**
```python
@router.get("/videos/{video_id}/enrichment")
async def get_enrichment(
    video_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    ...
```

### Geplante Enrichment-Endpoints

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/api/videos/{id}/enrichment` | Enrichment-Status + Daten |
| POST | `/api/videos/{id}/enrichment/retry` | Retry bei Fehler |

---

## 6. Frontend - VideoPlayer Integration

### Vidstack bereits vorbereitet!

**Datei:** `frontend/src/components/VideoPlayer.tsx`

```typescript
interface VideoPlayerProps {
  youtubeId: string
  videoId: string
  textTracks?: TextTrackType[]  // ← BEREITS IMPLEMENTIERT!
  thumbnailsVtt?: string | null // ← BEREITS IMPLEMENTIERT!
  // ...
}
```

**Text Track Support:**
```typescript
{textTracks?.map((track, index) => (
  <Track
    key={index}
    src={track.src}
    kind={track.kind}        // 'subtitles' | 'chapters'
    label={track.label}
    language={track.language}
    default={track.default}
  />
))}
```

### Neuer Hook benötigt: `useVideoEnrichment`

```typescript
// hooks/useVideoEnrichment.ts
export function useVideoEnrichment(videoId: string) {
  return useQuery({
    queryKey: ['video-enrichment', videoId],
    queryFn: () => api.get(`/videos/${videoId}/enrichment`),

    // Polling während processing
    refetchInterval: (data) =>
      data?.status === 'processing' ? 3000 : false,
  })
}
```

---

## 7. Naming Conventions & Code Style

### Backend
- **Modelle:** PascalCase (`VideoEnrichment`)
- **Funktionen:** snake_case (`enrich_video`)
- **Dateien:** snake_case (`video_enrichment.py`)
- **Routers:** Plural (`videos.py`, `enrichment.py`)

### Frontend
- **Komponenten:** PascalCase (`VideoPlayer.tsx`)
- **Hooks:** camelCase mit `use` Prefix (`useVideoEnrichment.ts`)
- **Stores:** camelCase mit `Store` Suffix (`playerSettingsStore.ts`)

---

## 8. Ähnliche Features als Referenz

### Watch Progress (gutes Pattern)

**Backend:**
```python
# videos.py
@router.put("/{video_id}/watch-progress")
async def update_watch_progress(video_id: UUID, position: int, db: AsyncSession):
    video = await db.get(Video, video_id)
    video.watch_position = position
    await db.commit()
```

**Frontend:**
```typescript
// useWatchProgress.ts
const mutation = useMutation({
  mutationFn: ({ videoId, position }) =>
    api.put(`/videos/${videoId}/watch-progress`, { position }),
  onSuccess: () => queryClient.invalidateQueries(['videos'])
})
```

### Processing Jobs (komplexeres Pattern)

- `ProcessingJob` Model für Status-Tracking
- `JobProgressEvent` für detaillierte Progress-Updates
- WebSocket für Live-Updates
- React Query Polling als Fallback

**Für Enrichment:** Einfacheres Pattern reicht (Status auf Enrichment-Record selbst)

---

## 9. Offene Technische Fragen

| Frage | Antwort aus Analyse |
|-------|---------------------|
| Gibt es ARQ? | ✅ Ja, bereits konfiguriert |
| PostgreSQL? | ✅ Ja, async mit asyncpg |
| Full-Text-Search? | ❌ Noch nicht implementiert |
| Vidstack Text Tracks? | ✅ Ja, bereits implementiert |
| API für Enrichment? | ❌ Noch nicht vorhanden |

---

## 10. Fazit

### Bereit für Integration
- ✅ ARQ Worker System etabliert
- ✅ Vidstack Player mit Text Track Support
- ✅ React Query Patterns vorhanden
- ✅ PostgreSQL JSONB für flexible Daten

### Muss neu erstellt werden
- VideoEnrichment Model + Migration
- Enrichment Service mit Provider Pattern
- ARQ Worker Funktion `enrich_video`
- API Endpoint `/api/videos/{id}/enrichment`
- Frontend Hook `useVideoEnrichment`

### Komplexe Anforderung
- **Audio-Chunking für lange Videos** - Groq 25MB Limit
- Full-Text-Search über Transkripte (optional zunächst)

---

**Exit Condition:** ✅ Klares Bild wo/wie Feature integriert wird
**Nächste Phase:** Impact Assessment
