# Implementation Plan: Robust Video Import

## Übersicht

Das Feature wird in **5 Phasen** implementiert, um inkrementell Wert zu liefern:

```
Phase 1: Foundation          │ DB + Backend Basics
Phase 2: Rate Limiting       │ Robust Batch Processing
Phase 3: Groq Fallback       │ Caption Resilience
Phase 4: WebSocket Frontend  │ Real-time Progress
Phase 5: Polish & Errors     │ Final UX
```

## Abhängigkeits-Graph

```
                    ┌─────────────────┐
                    │ Phase 1:        │
                    │ Foundation      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ Phase 2:   │ │ Phase 3:   │ │ Phase 4:   │
     │ Rate Limit │ │ Groq       │ │ WebSocket  │
     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │              │              │
           └──────────────┼──────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │ Phase 5:       │
                 │ Polish         │
                 └────────────────┘
```

---

## Phase 1: Foundation (Backend Basics)

**Ziel:** Two-Phase Import + Progress Tracking im Backend

### 1.1 Database Migration

```sql
-- Alembic Migration: add_import_progress_fields.py

ALTER TABLE videos ADD COLUMN import_progress INTEGER DEFAULT 100;
ALTER TABLE videos ADD COLUMN import_stage VARCHAR(20) DEFAULT 'complete';
CREATE INDEX idx_videos_import_stage ON videos(import_stage);
```

**Dateien:**
- `backend/alembic/versions/xxx_add_import_progress.py` (NEU)

### 1.2 Model Updates

```python
# backend/app/models/video.py

class Video(Base):
    # Bestehende Felder...

    # NEU
    import_progress: Mapped[int] = mapped_column(Integer, default=0)
    import_stage: Mapped[str] = mapped_column(String(20), default='created')
```

**Dateien:**
- `backend/app/models/video.py` (EDIT)
- `backend/app/schemas/video.py` (EDIT - Response Schema)

### 1.3 Two-Phase Import Endpoint

```python
# backend/app/api/videos.py

async def create_video(...):
    # Phase 1: Instant Create
    video = Video(
        youtube_id=youtube_id,
        import_stage='created',
        import_progress=0,
        thumbnail_url=f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg"
    )
    db.add(video)
    await db.commit()

    # Phase 2: Background Enrichment
    await arq_pool.enqueue_job('enrich_video_staged', video.id)

    return video  # Sofort zurück!
```

**Dateien:**
- `backend/app/api/videos.py` (EDIT)

### 1.4 Staged Enrichment Worker

```python
# backend/app/workers/video_processor.py

async def enrich_video_staged(ctx, video_id: UUID):
    db = ctx['db']
    redis = ctx['redis']
    video = await get_video(db, video_id)

    # Stage 1: Metadata (25%)
    await update_stage(db, video, 'metadata', 25)
    await publish_progress(redis, video.list.user_id, video.id, 25, 'metadata')
    await fetch_metadata(video)

    # Stage 2: Captions (60%)
    await update_stage(db, video, 'captions', 60)
    await publish_progress(redis, video.list.user_id, video.id, 60, 'captions')
    await fetch_captions(video)

    # Stage 3: Chapters (90%)
    await update_stage(db, video, 'chapters', 90)
    await publish_progress(redis, video.list.user_id, video.id, 90, 'chapters')
    await fetch_chapters(video)

    # Complete (100%)
    await update_stage(db, video, 'complete', 100)
    await publish_progress(redis, video.list.user_id, video.id, 100, 'complete')
```

**Dateien:**
- `backend/app/workers/video_processor.py` (EDIT)

### 1.5 Progress Publishing

```python
# backend/app/workers/video_processor.py

async def publish_progress(redis, user_id, video_id, progress, stage):
    await redis.publish(
        f"progress:user:{user_id}",
        json.dumps({
            "type": "import_progress",
            "video_id": str(video_id),
            "progress": progress,
            "stage": stage
        })
    )
```

**Tests für Phase 1:**
- `test_two_phase_import.py` - Video erscheint sofort mit stage='created'
- `test_staged_enrichment.py` - Progress Updates werden gesendet

---

## Phase 2: Rate Limiting (Robust Batch)

**Ziel:** Batch-Imports überleben Rate Limiting

### 2.1 Rate Limiter Service

```python
# backend/app/services/rate_limiter.py (NEU)

class AdaptiveRateLimiter:
    def __init__(self, max_concurrent=3, base_delay=2.0):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.delay = base_delay
        self.failure_count = 0
        self.circuit_open = False

    async def acquire(self):
        if self.circuit_open:
            await asyncio.sleep(30)
            self.circuit_open = False

        async with self.semaphore:
            await asyncio.sleep(self.delay)
            yield

    def on_success(self):
        self.failure_count = max(0, self.failure_count - 1)
        self.delay = max(2.0, self.delay * 0.9)

    def on_failure(self, is_rate_limit=False):
        self.failure_count += 1
        if is_rate_limit:
            self.delay = min(10.0, self.delay * 1.5)
        if self.failure_count >= 3:
            self.circuit_open = True
            self.failure_count = 0
```

**Dateien:**
- `backend/app/services/rate_limiter.py` (NEU)

### 2.2 Worker Integration

```python
# backend/app/workers/video_processor.py

from app.services.rate_limiter import AdaptiveRateLimiter

rate_limiter = AdaptiveRateLimiter(max_concurrent=3, base_delay=2.0)

async def enrich_video_staged(ctx, video_id):
    async with rate_limiter.acquire():
        try:
            # ... enrichment logic
            rate_limiter.on_success()
        except HTTPError as e:
            if e.status == 429:
                rate_limiter.on_failure(is_rate_limit=True)
            raise
```

**Dateien:**
- `backend/app/workers/video_processor.py` (EDIT)

### 2.3 Exponential Backoff

```python
# backend/app/workers/video_processor.py

async def fetch_with_retry(func, *args, max_retries=3):
    for attempt in range(max_retries + 1):
        try:
            return await func(*args)
        except Exception as e:
            if attempt == max_retries:
                raise
            delay = 2 ** attempt
            await asyncio.sleep(delay)
```

**Tests für Phase 2:**
- `test_rate_limiter.py` - Circuit Breaker öffnet/schließt
- `test_batch_import.py` - 50 Videos ohne Fehler
- `test_rate_limit_recovery.py` - Recovery nach 429

---

## Phase 3: Groq Whisper Fallback

**Ziel:** Captions auch bei YouTube-Problemen

### 3.1 Groq Transcriber Service

```python
# backend/app/services/enrichment/groq_transcriber.py (NEU)

class GroqTranscriber:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.client = httpx.AsyncClient()

    async def transcribe(self, youtube_id: str) -> str:
        # 1. Audio extrahieren
        audio_path = await self.extract_audio(youtube_id)

        # 2. An Groq senden
        async with aiofiles.open(audio_path, 'rb') as f:
            response = await self.client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files={"file": await f.read()},
                data={"model": "whisper-large-v3"}
            )

        # 3. Cleanup
        await aiofiles.os.remove(audio_path)

        return response.json()["text"]

    async def extract_audio(self, youtube_id: str) -> str:
        # yt-dlp audio-only download
        ...
```

**Dateien:**
- `backend/app/services/enrichment/groq_transcriber.py` (NEU)
- `backend/app/core/settings.py` (EDIT - GROQ_API_KEY)

### 3.2 Fallback Integration

```python
# backend/app/services/enrichment/enrichment_service.py

async def get_captions(self, youtube_id: str) -> tuple[str, str]:
    """Returns (captions_text, source)"""

    # Versuch 1-3: YouTube
    for attempt in range(3):
        try:
            captions = await self.youtube_provider.get_captions(youtube_id)
            return (captions, "youtube")
        except Exception:
            await asyncio.sleep(2 ** attempt)

    # Fallback: Groq Whisper
    try:
        transcript = await self.groq_transcriber.transcribe(youtube_id)
        return (transcript, "whisper")
    except Exception as e:
        # Beide fehlgeschlagen - Video ohne Captions
        return (None, "none")
```

**Dateien:**
- `backend/app/services/enrichment/enrichment_service.py` (EDIT)

### 3.3 Source Tracking

```python
# backend/app/models/video_enrichment.py

class VideoEnrichment(Base):
    # Bestehend: captions_source ist bereits vorhanden
    # Werte: "youtube", "whisper", "none"
```

**Tests für Phase 3:**
- `test_groq_transcriber.py` - Transkription funktioniert
- `test_caption_fallback.py` - Fallback wird getriggert
- `test_caption_source.py` - Source wird korrekt gesetzt

---

## Phase 4: WebSocket Frontend

**Ziel:** Real-time Progress im UI

### 4.1 WebSocket Hook

```typescript
// frontend/src/hooks/useWebSocket.ts (NEU)

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const callbacksRef = useRef<Map<string, (data: ProgressEvent) => void>>()

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/api/ws/progress`)

    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => {
      setIsConnected(false)
      // Auto-reconnect nach 3s
      setTimeout(connect, 3000)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'import_progress') {
        callbacksRef.current?.get(data.video_id)?.(data)
      }
    }

    wsRef.current = ws
    return () => ws.close()
  }, [])

  const subscribe = useCallback((videoId: string, cb: Function) => {
    callbacksRef.current?.set(videoId, cb)
    return () => callbacksRef.current?.delete(videoId)
  }, [])

  return { isConnected, subscribe }
}
```

**Dateien:**
- `frontend/src/hooks/useWebSocket.ts` (NEU)

### 4.2 Import Progress Store

```typescript
// frontend/src/stores/importProgressStore.ts (NEU)

interface ImportProgressState {
  progress: Map<string, ProgressData>
  setProgress: (videoId: string, data: ProgressData) => void
  clearProgress: (videoId: string) => void
}

export const useImportProgressStore = create<ImportProgressState>((set) => ({
  progress: new Map(),

  setProgress: (videoId, data) => set((state) => {
    const newProgress = new Map(state.progress)
    newProgress.set(videoId, data)
    return { progress: newProgress }
  }),

  clearProgress: (videoId) => set((state) => {
    const newProgress = new Map(state.progress)
    newProgress.delete(videoId)
    return { progress: newProgress }
  })
}))
```

**Dateien:**
- `frontend/src/stores/importProgressStore.ts` (NEU)

### 4.3 Progress Overlay Component

```typescript
// frontend/src/components/ProgressOverlay.tsx (NEU)

// Wie in ui-integration.md beschrieben
// SVG Circular Progress mit Animation
```

**Dateien:**
- `frontend/src/components/ProgressOverlay.tsx` (NEU)

### 4.4 VideoCard Integration

```typescript
// frontend/src/components/VideoCard.tsx (EDIT)

export function VideoCard({ video }: VideoCardProps) {
  const progress = useImportProgressStore(
    (state) => state.progress.get(video.id)
  )

  const isImporting = progress && progress.progress < 100

  return (
    <div className={cn(
      "video-card",
      isImporting && "grayscale opacity-70"
    )}>
      <img src={video.thumbnail_url} />

      {isImporting && (
        <ProgressOverlay
          progress={progress.progress}
          stage={progress.stage}
        />
      )}

      {!isImporting && <VideoCardContent video={video} />}
    </div>
  )
}
```

**Dateien:**
- `frontend/src/components/VideoCard.tsx` (EDIT)

### 4.5 WebSocket Provider

```typescript
// frontend/src/components/WebSocketProvider.tsx (NEU)

export function WebSocketProvider({ children }) {
  const { subscribe } = useWebSocket()
  const { setProgress, clearProgress } = useImportProgressStore()

  // Global listener für alle Progress Updates
  useEffect(() => {
    // Setup...
  }, [])

  return <>{children}</>
}
```

**Dateien:**
- `frontend/src/components/WebSocketProvider.tsx` (NEU)
- `frontend/src/App.tsx` (EDIT - Provider einbinden)

**Tests für Phase 4:**
- `useWebSocket.test.ts` - Hook funktioniert
- `ProgressOverlay.test.tsx` - Rendering korrekt
- `VideoCard.test.tsx` - Importing State

---

## Phase 5: Polish & Error Handling

**Ziel:** Finale UX, Error States, Edge Cases

### 5.1 Error Classification

```python
# backend/app/services/error_classifier.py (NEU)

def classify_error(error: Exception) -> tuple[str | None, bool]:
    """Returns (user_message, should_retry)"""

    if isinstance(error, HTTPError):
        if error.status == 403:
            return ("Video nicht verfügbar", False)
        if error.status == 404:
            return ("Video nicht gefunden", False)
        if error.status == 429:
            return (None, True)  # Silent retry

    if isinstance(error, TimeoutError):
        return (None, True)

    return ("Verarbeitung fehlgeschlagen", False)
```

**Dateien:**
- `backend/app/services/error_classifier.py` (NEU)

### 5.2 Error State in Frontend

```typescript
// frontend/src/components/VideoCard.tsx

// Error State Rendering
if (video.import_stage === 'error') {
  return (
    <div className="video-card opacity-80">
      <img src={video.thumbnail_url} className="saturate-50" />
      <Tooltip content={<ErrorTooltip video={video} />}>
        <WarningIcon className="absolute bottom-2 right-2" />
      </Tooltip>
    </div>
  )
}
```

**Dateien:**
- `frontend/src/components/VideoCard.tsx` (EDIT)
- `frontend/src/components/ErrorTooltip.tsx` (NEU)

### 5.3 Import Summary Toast

```typescript
// frontend/src/components/ImportSummaryToast.tsx (NEU)

export function ImportSummaryToast({ result }: Props) {
  return (
    <Toast>
      <ToastTitle>
        {result.failed === 0 ? '✅' : '⚠️'} Import abgeschlossen
      </ToastTitle>
      <ToastDescription>
        {result.success} Videos importiert
        {result.noCaptions > 0 && `, ${result.noCaptions} ohne Untertitel`}
        {result.failed > 0 && `, ${result.failed} fehlgeschlagen`}
      </ToastDescription>
    </Toast>
  )
}
```

**Dateien:**
- `frontend/src/components/ImportSummaryToast.tsx` (NEU)

### 5.4 Batch Progress Banner

```typescript
// frontend/src/components/BatchProgressBanner.tsx (NEU)

// Zeigt "50 Videos werden importiert... 24%"
// Wird bei Batch-Imports eingeblendet
```

**Dateien:**
- `frontend/src/components/BatchProgressBanner.tsx` (NEU)

### 5.5 Final Testing & Polish

- E2E Tests für alle User Stories
- Performance-Optimierung (60fps Animationen)
- Accessibility Review
- Mobile Testing

**Tests für Phase 5:**
- `e2e/single-video-import.spec.ts`
- `e2e/batch-import.spec.ts`
- `e2e/error-handling.spec.ts`

---

## Zusammenfassung

| Phase | Neue Dateien | Geänderte Dateien | Tests |
|-------|--------------|-------------------|-------|
| 1. Foundation | 1 | 4 | 2 |
| 2. Rate Limiting | 1 | 1 | 3 |
| 3. Groq Fallback | 1 | 2 | 3 |
| 4. WebSocket FE | 4 | 2 | 3 |
| 5. Polish | 3 | 2 | 3 |
| **Gesamt** | **10** | **11** | **14** |

## Exit Condition ✅

**Actionable Plan mit klaren Phasen?**

> - 5 Phasen mit klaren Abhängigkeiten
> - Jede Phase liefert testbaren Wert
> - ~21 Dateien insgesamt (10 neu, 11 edits)
> - ~14 Test-Dateien
> - Kann parallel entwickelt werden (Phase 2-4)

✅ Implementation Plan fertig, bereit für Phase 9.
