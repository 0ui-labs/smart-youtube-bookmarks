# Integration Strategy: Robust Video Import

## Integrations-Philosophie

**Prinzip:** Bestehende Patterns erweitern, nicht ersetzen.

Das Projekt hat bereits:
- ARQ Worker System → Erweitern mit Rate Limiting
- WebSocket Backend → Frontend-Hook hinzufügen
- VideoEnrichment Model → Felder hinzufügen
- VideoCard Component → States hinzufügen

## Integration Points

### 1. Backend: Two-Phase Import

**Aktueller Flow:**
```
POST /videos → Create Video → Enqueue process_video → Enqueue enrich_video
                    ↓
              Video mit processing_status='pending'
```

**Neuer Flow:**
```
POST /videos → Create Video (sofort) → Response mit Video
                    ↓
              Video mit import_stage='created', import_progress=0
              Thumbnail sofort verfügbar (YouTube CDN)
                    ↓
              Enqueue enrich_video (async)
                    ↓
              Progress Updates via WebSocket
```

**Integration in `api/videos.py`:**
```python
# Bestehende create_video Funktion erweitern
async def create_video(list_id: UUID, video_data: VideoCreate, ...):
    # Phase 1: Instant Create (SYNCHRON)
    video = Video(
        list_id=list_id,
        youtube_id=extract_youtube_id(video_data.url),
        import_stage='created',
        import_progress=0,
        # Thumbnail URL generieren (kein API call nötig)
        thumbnail_url=f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg"
    )
    db.add(video)
    await db.commit()

    # Phase 2: Background Enrichment (ASYNC)
    await arq_pool.enqueue_job('enrich_video_with_progress', video.id)

    return video  # Sofort zurück, nicht warten!
```

### 2. Backend: Progress-Publishing Pattern

**Bestehender Pattern (in video_processor.py):**
```python
async def publish_progress(redis, user_id, data):
    await redis.publish(f"progress:user:{user_id}", json.dumps(data))
```

**Erweiterung für Import Stages:**
```python
# Neues Progress-Format
progress_data = {
    "type": "import_progress",
    "video_id": str(video.id),
    "youtube_id": video.youtube_id,
    "stage": "metadata",  # created → metadata → captions → chapters → complete
    "progress": 25,
    "message": None  # Nur bei Fehler
}
```

**Integration in `workers/video_processor.py`:**
```python
async def enrich_video_with_progress(ctx: dict, video_id: UUID):
    db = ctx['db']
    redis = ctx['redis']
    video = await get_video(db, video_id)

    # Stage 1: Metadata (25%)
    await update_stage(db, video, 'metadata', 25)
    await publish_progress(redis, video.list.user_id, {...})
    metadata = await fetch_metadata(video.youtube_id)

    # Stage 2: Captions (60%)
    await update_stage(db, video, 'captions', 60)
    await publish_progress(redis, video.list.user_id, {...})
    captions = await fetch_captions_with_fallback(video.youtube_id)

    # ... weitere Stages
```

### 3. Backend: Rate Limiter Integration

**Neuer Service: `services/rate_limiter.py`**

```python
class RateLimiter:
    """
    Circuit Breaker + Rate Limiting für YouTube API
    """
    def __init__(self, max_concurrent: int = 3, delay: float = 2.0):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.delay = delay
        self.failure_count = 0
        self.circuit_open = False

    async def acquire(self):
        if self.circuit_open:
            await asyncio.sleep(30)  # Cool-down
            self.circuit_open = False

        async with self.semaphore:
            await asyncio.sleep(self.delay)
            yield

    def record_failure(self):
        self.failure_count += 1
        if self.failure_count >= 3:
            self.circuit_open = True
            self.failure_count = 0
```

**Integration in Workers:**
```python
# Global Rate Limiter
rate_limiter = RateLimiter(max_concurrent=3, delay=2.0)

async def enrich_video_with_progress(ctx, video_id):
    async with rate_limiter.acquire():
        try:
            result = await enrichment_service.enrich(video_id)
        except RateLimitError:
            rate_limiter.record_failure()
            raise  # ARQ retry
```

### 4. Backend: Groq Whisper Fallback

**Neuer Provider: `services/enrichment/groq_transcriber.py`**

```python
class GroqTranscriber:
    """Fallback wenn YouTube Captions nicht verfügbar"""

    async def transcribe(self, youtube_id: str) -> str:
        # 1. Audio extrahieren via yt-dlp
        audio_path = await extract_audio(youtube_id)

        # 2. An Groq Whisper senden
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                files={"file": open(audio_path, "rb")},
                data={"model": "whisper-large-v3"}
            )

        return response.json()["text"]
```

**Integration in EnrichmentService:**
```python
class EnrichmentService:
    async def get_captions(self, youtube_id: str) -> str:
        # Versuch 1-3: YouTube
        for attempt in range(3):
            try:
                return await self.youtube_provider.get_captions(youtube_id)
            except Exception:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

        # Fallback: Groq Whisper
        return await self.groq_transcriber.transcribe(youtube_id)
```

### 5. Frontend: WebSocket Hook

**Neuer Hook: `hooks/useWebSocket.ts`**

```typescript
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const callbacks = useRef<Map<string, (data: any) => void>>(new Map())

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/api/ws/progress`)

    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => setIsConnected(false)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'import_progress') {
        callbacks.current.get(data.video_id)?.(data)
      }
    }

    return () => ws.close()
  }, [])

  const subscribe = (videoId: string, callback: (data: any) => void) => {
    callbacks.current.set(videoId, callback)
    return () => callbacks.current.delete(videoId)
  }

  return { isConnected, subscribe }
}
```

**Integration in App-Root:**
```typescript
// App.tsx oder VideosPage.tsx
const { subscribe } = useWebSocket()

// In VideoCard oder importProgressStore
useEffect(() => {
  return subscribe(video.id, (progress) => {
    setImportProgress(progress)
  })
}, [video.id])
```

### 6. Frontend: VideoCard States

**Erweiterung von `VideoCard.tsx`:**

```typescript
interface VideoCardProps {
  video: Video
  importProgress?: ImportProgress  // NEU
}

export function VideoCard({ video, importProgress }: VideoCardProps) {
  const isImporting = importProgress && importProgress.progress < 100

  return (
    <div className={cn(
      "relative rounded-lg overflow-hidden",
      isImporting && "grayscale opacity-70"  // NEU
    )}>
      <img src={video.thumbnail_url} />

      {/* NEU: Progress Overlay */}
      {isImporting && (
        <ProgressOverlay
          progress={importProgress.progress}
          stage={importProgress.stage}
        />
      )}

      {/* Bestehender Content */}
      {!isImporting && (
        <VideoCardContent video={video} />
      )}
    </div>
  )
}
```

### 7. Frontend: ProgressOverlay Component

**Neuer Component: `components/ProgressOverlay.tsx`**

```typescript
export function ProgressOverlay({ progress, stage }: Props) {
  // SVG Circle Progress (iOS-Style)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
      <svg className="w-24 h-24 transform -rotate-90">
        {/* Background Circle */}
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="8"
        />
        {/* Progress Circle */}
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke="white" strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-white font-medium">
        {progress}%
      </span>
    </div>
  )
}
```

## Extension Points (keine Breaking Changes)

| Komponente | Extension Point | Typ |
|------------|-----------------|-----|
| Video Model | Neue optionale Felder | Additiv |
| VideoEnrichment | Neue optionale Felder | Additiv |
| api/videos.py | Neue Response-Felder | Additiv |
| VideoCard | Neue optionale Props | Additiv |
| ARQ Worker | Neue Job-Funktion | Additiv |

## Rollback-Strategie

Falls Feature-Probleme auftreten:

1. **Frontend:** ProgressOverlay via Feature Flag ausblenden
2. **Backend:** Alte `enrich_video` Funktion weiter nutzen
3. **DB:** Migration rückgängig (Felder nullable, nicht genutzt)

```typescript
// Feature Flag (Frontend)
const ENABLE_IMPORT_PROGRESS = process.env.VITE_ENABLE_IMPORT_PROGRESS === 'true'

{ENABLE_IMPORT_PROGRESS && importProgress && (
  <ProgressOverlay progress={importProgress.progress} />
)}
```

## Exit Condition ✅

**Klare Integration die minimale Disruption verursacht?**

> - Alle neuen Felder sind optional/haben Defaults
> - Bestehende Endpoints werden erweitert, nicht ersetzt
> - Neue Komponenten sind additiv (Props optional)
> - Feature Flag ermöglicht sofortiges Rollback
> - Keine Breaking Changes an bestehenden APIs

✅ Integration klar definiert, bereit für Phase 5.
