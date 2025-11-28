# Atomic Steps: Robust Video Import

## Übersicht

Jeder Step ist:
- ✅ In 15-60 Minuten machbar
- ✅ Ändert 1-3 Dateien
- ✅ Hat klaren Pass/Fail Test
- ✅ Unabhängig committable

**Gesamt:** 28 Steps in 5 Phasen

---

## Phase 1: Foundation (8 Steps)

### Step 1.1: DB Migration erstellen
**Dateien:** `backend/alembic/versions/xxx_add_import_progress.py`
**Dauer:** 15 min

```bash
# Test
alembic upgrade head
psql -c "SELECT import_progress, import_stage FROM videos LIMIT 1"
# Erwartung: Spalten existieren, Default-Werte
```

**Commit:** `feat(db): add import_progress and import_stage columns`

---

### Step 1.2: Video Model erweitern
**Dateien:** `backend/app/models/video.py`
**Dauer:** 15 min

```python
# Hinzufügen:
import_progress: Mapped[int] = mapped_column(Integer, default=0)
import_stage: Mapped[str] = mapped_column(String(20), default='created')
```

```bash
# Test
python -c "from app.models.video import Video; print(Video.__table__.columns.keys())"
# Erwartung: import_progress, import_stage in Liste
```

**Commit:** `feat(model): add import_progress and import_stage to Video`

---

### Step 1.3: Video Response Schema erweitern
**Dateien:** `backend/app/schemas/video.py`
**Dauer:** 15 min

```python
# Hinzufügen zu VideoResponse:
import_progress: int = 0
import_stage: str = 'created'
```

```bash
# Test
pytest backend/tests/test_schemas.py -k video
```

**Commit:** `feat(schema): add import fields to VideoResponse`

---

### Step 1.4: Instant-Create in videos.py
**Dateien:** `backend/app/api/videos.py`
**Dauer:** 30 min

```python
# Ändern: Video sofort erstellen mit stage='created'
video = Video(
    youtube_id=youtube_id,
    import_stage='created',
    import_progress=0,
    thumbnail_url=f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg"
)
```

```bash
# Test
curl -X POST http://localhost:8000/api/lists/xxx/videos -d '{"url":"..."}'
# Erwartung: import_stage="created", import_progress=0
```

**Commit:** `feat(api): implement instant video creation with progress fields`

---

### Step 1.5: Test für Two-Phase Import
**Dateien:** `backend/tests/test_two_phase_import.py`
**Dauer:** 30 min

```bash
# Test
pytest backend/tests/test_two_phase_import.py -v
# Erwartung: 3 Tests grün
```

**Commit:** `test: add two-phase import tests`

---

### Step 1.6: update_stage Helper Funktion
**Dateien:** `backend/app/workers/video_processor.py`
**Dauer:** 20 min

```python
async def update_stage(db: AsyncSession, video: Video, stage: str, progress: int):
    video.import_stage = stage
    video.import_progress = progress
    await db.commit()
```

```bash
# Test
pytest backend/tests/test_staged_enrichment.py::test_stage_saved_to_db
```

**Commit:** `feat(worker): add update_stage helper function`

---

### Step 1.7: publish_progress Funktion
**Dateien:** `backend/app/workers/video_processor.py`
**Dauer:** 20 min

```python
async def publish_progress(redis, user_id: str, video_id: str, progress: int, stage: str):
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

```bash
# Test
pytest backend/tests/test_staged_enrichment.py::test_progress_updates_published
```

**Commit:** `feat(worker): add publish_progress function`

---

### Step 1.8: enrich_video_staged Worker
**Dateien:** `backend/app/workers/video_processor.py`, `backend/app/workers/settings.py`
**Dauer:** 45 min

```python
async def enrich_video_staged(ctx: dict, video_id: UUID):
    # Staged enrichment mit Progress Updates
    ...
```

```bash
# Test
pytest backend/tests/test_staged_enrichment.py -v
# Erwartung: Alle Tests grün
```

**Commit:** `feat(worker): implement staged enrichment with progress`

---

## Phase 2: Rate Limiting (5 Steps)

### Step 2.1: RateLimiter Klasse (Basic)
**Dateien:** `backend/app/services/rate_limiter.py`
**Dauer:** 30 min

```python
class AdaptiveRateLimiter:
    def __init__(self, max_concurrent=3, base_delay=2.0):
        ...

    async def acquire(self):
        ...
```

```bash
# Test
pytest backend/tests/test_rate_limiter.py::test_max_concurrent_enforced
```

**Commit:** `feat(service): add basic AdaptiveRateLimiter`

---

### Step 2.2: Circuit Breaker Logic
**Dateien:** `backend/app/services/rate_limiter.py`
**Dauer:** 30 min

```python
# Hinzufügen:
def on_failure(self, is_rate_limit=False):
    ...

def on_success(self):
    ...
```

```bash
# Test
pytest backend/tests/test_rate_limiter.py -v
# Erwartung: Alle Circuit Breaker Tests grün
```

**Commit:** `feat(service): add circuit breaker to rate limiter`

---

### Step 2.3: Rate Limiter Tests
**Dateien:** `backend/tests/test_rate_limiter.py`
**Dauer:** 30 min

```bash
# Test
pytest backend/tests/test_rate_limiter.py -v
# Erwartung: 5+ Tests grün
```

**Commit:** `test: add rate limiter tests`

---

### Step 2.4: Rate Limiter in Worker integrieren
**Dateien:** `backend/app/workers/video_processor.py`
**Dauer:** 30 min

```python
rate_limiter = AdaptiveRateLimiter(max_concurrent=3, base_delay=2.0)

async def enrich_video_staged(ctx, video_id):
    async with rate_limiter.acquire():
        ...
```

```bash
# Test
pytest backend/tests/integration/test_batch_import.py -v
```

**Commit:** `feat(worker): integrate rate limiter into enrichment`

---

### Step 2.5: fetch_with_retry Helper
**Dateien:** `backend/app/workers/video_processor.py`
**Dauer:** 20 min

```python
async def fetch_with_retry(func, *args, max_retries=3):
    for attempt in range(max_retries + 1):
        try:
            return await func(*args)
        except Exception:
            if attempt == max_retries:
                raise
            await asyncio.sleep(2 ** attempt)
```

```bash
# Test
pytest backend/tests/test_retry_logic.py -v
```

**Commit:** `feat(worker): add fetch_with_retry helper`

---

## Phase 3: Groq Fallback (4 Steps)

### Step 3.1: Groq Settings
**Dateien:** `backend/app/core/settings.py`, `.env.example`
**Dauer:** 15 min

```python
# settings.py
GROQ_API_KEY: str = ""
```

```bash
# Test
python -c "from app.core.settings import settings; print(settings.GROQ_API_KEY)"
```

**Commit:** `feat(config): add GROQ_API_KEY setting`

---

### Step 3.2: GroqTranscriber Klasse
**Dateien:** `backend/app/services/enrichment/groq_transcriber.py`
**Dauer:** 45 min

```python
class GroqTranscriber:
    async def transcribe(self, youtube_id: str) -> str:
        ...

    async def extract_audio(self, youtube_id: str) -> str:
        ...
```

```bash
# Test (mit Mock)
pytest backend/tests/test_groq_transcriber.py -v
```

**Commit:** `feat(service): add GroqTranscriber for Whisper fallback`

---

### Step 3.3: Fallback in EnrichmentService
**Dateien:** `backend/app/services/enrichment/enrichment_service.py`
**Dauer:** 30 min

```python
async def get_captions(self, youtube_id: str) -> tuple[str, str]:
    # Try YouTube first, then Groq
    ...
```

```bash
# Test
pytest backend/tests/integration/test_caption_fallback.py -v
```

**Commit:** `feat(enrichment): add Groq Whisper fallback for captions`

---

### Step 3.4: Fallback Integration Tests
**Dateien:** `backend/tests/integration/test_caption_fallback.py`
**Dauer:** 30 min

```bash
# Test
pytest backend/tests/integration/test_caption_fallback.py -v
# Erwartung: Fallback wird korrekt getriggert
```

**Commit:** `test: add caption fallback integration tests`

---

## Phase 4: WebSocket Frontend (7 Steps)

### Step 4.1: useWebSocket Hook (Basic)
**Dateien:** `frontend/src/hooks/useWebSocket.ts`
**Dauer:** 45 min

```typescript
export function useWebSocket() {
    // Connect, isConnected state
}
```

```bash
# Test
npm test -- useWebSocket.test.ts
```

**Commit:** `feat(hook): add basic useWebSocket hook`

---

### Step 4.2: useWebSocket Subscribe/Unsubscribe
**Dateien:** `frontend/src/hooks/useWebSocket.ts`
**Dauer:** 30 min

```typescript
const subscribe = (videoId: string, callback: Function) => {
    ...
}
```

```bash
# Test
npm test -- useWebSocket.test.ts
# Erwartung: Subscribe Tests grün
```

**Commit:** `feat(hook): add subscribe/unsubscribe to useWebSocket`

---

### Step 4.3: importProgressStore
**Dateien:** `frontend/src/stores/importProgressStore.ts`
**Dauer:** 20 min

```typescript
export const useImportProgressStore = create<ImportProgressState>((set) => ({
    progress: new Map(),
    setProgress: ...,
    clearProgress: ...
}))
```

```bash
# Test
npm test -- importProgressStore.test.ts
```

**Commit:** `feat(store): add importProgressStore`

---

### Step 4.4: ProgressOverlay Component
**Dateien:** `frontend/src/components/ProgressOverlay.tsx`
**Dauer:** 45 min

```tsx
export function ProgressOverlay({ progress, stage }: Props) {
    // SVG Circular Progress
}
```

```bash
# Test
npm test -- ProgressOverlay.test.tsx
```

**Commit:** `feat(component): add ProgressOverlay with circular progress`

---

### Step 4.5: VideoCard Importing State
**Dateien:** `frontend/src/components/VideoCard.tsx`
**Dauer:** 30 min

```tsx
// Add grayscale + overlay for importing videos
const isImporting = importProgress?.progress < 100
```

```bash
# Test
npm test -- VideoCard.test.tsx -t "importing"
```

**Commit:** `feat(component): add importing state to VideoCard`

---

### Step 4.6: WebSocketProvider
**Dateien:** `frontend/src/components/WebSocketProvider.tsx`, `frontend/src/App.tsx`
**Dauer:** 30 min

```tsx
export function WebSocketProvider({ children }) {
    // Global WebSocket listener
}
```

```bash
# Test
npm test -- WebSocketProvider.test.tsx
```

**Commit:** `feat(component): add WebSocketProvider`

---

### Step 4.7: Frontend Integration Test
**Dateien:** `frontend/src/__tests__/integration/websocket-integration.test.tsx`
**Dauer:** 45 min

```bash
# Test
npm test -- websocket-integration.test.tsx
# Erwartung: Full flow test grün
```

**Commit:** `test: add WebSocket integration tests`

---

## Phase 5: Polish (4 Steps)

### Step 5.1: Error Classifier
**Dateien:** `backend/app/services/error_classifier.py`
**Dauer:** 30 min

```python
def classify_error(error: Exception) -> tuple[str | None, bool]:
    ...
```

```bash
# Test
pytest backend/tests/test_error_classifier.py -v
```

**Commit:** `feat(service): add error classifier for user-friendly messages`

---

### Step 5.2: Error State in VideoCard
**Dateien:** `frontend/src/components/VideoCard.tsx`, `frontend/src/components/ErrorTooltip.tsx`
**Dauer:** 30 min

```tsx
if (video.import_stage === 'error') {
    // Render error state with tooltip
}
```

```bash
# Test
npm test -- VideoCard.test.tsx -t "error"
```

**Commit:** `feat(component): add error state to VideoCard`

---

### Step 5.3: ImportSummaryToast
**Dateien:** `frontend/src/components/ImportSummaryToast.tsx`
**Dauer:** 30 min

```tsx
export function ImportSummaryToast({ result }: Props) {
    // "47 Videos importiert, 3 ohne Untertitel"
}
```

```bash
# Test
npm test -- ImportSummaryToast.test.tsx
```

**Commit:** `feat(component): add ImportSummaryToast`

---

### Step 5.4: E2E Tests
**Dateien:** `e2e/*.spec.ts`
**Dauer:** 60 min

```bash
# Test
npm run test:e2e
# Erwartung: Alle E2E Tests grün
```

**Commit:** `test: add E2E tests for robust import`

---

## Step-Zusammenfassung

| Phase | Steps | Geschätzt |
|-------|-------|-----------|
| 1. Foundation | 8 | ~3.5h |
| 2. Rate Limiting | 5 | ~2.5h |
| 3. Groq Fallback | 4 | ~2h |
| 4. WebSocket FE | 7 | ~4h |
| 5. Polish | 4 | ~2.5h |
| **Gesamt** | **28** | **~14.5h** |

## Parallelisierung

```
Week 1:
├── Dev A: Phase 1 (Foundation) - 8 Steps
└── Dev B: Phase 4.1-4.4 (WebSocket Hook + Store + Overlay)

Week 2:
├── Dev A: Phase 2 (Rate Limiting) - 5 Steps
└── Dev B: Phase 4.5-4.7 (VideoCard + Provider + Tests)

Week 3:
├── Dev A: Phase 3 (Groq Fallback) - 4 Steps
└── Dev B: Phase 5 (Polish) - 4 Steps
```

## Exit Condition ✅

**Granulare, testbare Schritte?**

> - 28 Steps, jeder 15-60 Minuten
> - Jeder Step ändert 1-3 Dateien
> - Jeder Step hat klaren Test
> - Jeder Step ist unabhängig committable
> - Parallelisierung möglich

✅ Atomic Steps fertig, bereit für Phase 11.
