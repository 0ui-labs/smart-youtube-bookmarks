# Video Enrichment - Integration Strategy

## Grundprinzipien

1. **Lose Kopplung:** Enrichment ist unabhängig vom Video-Import
2. **Fehlertoleranz:** Video funktioniert auch ohne Enrichment
3. **Erweiterbarkeit:** Provider-Pattern für einfachen Austausch
4. **Minimaler Code-Churn:** Bestehende Dateien minimal ändern

---

## Architektur-Entscheidung

### Provider Pattern für Datenquellen

```
                    ┌─────────────────────────────────┐
                    │     EnrichmentService           │
                    │  (Orchestriert alle Provider)   │
                    └─────────────┬───────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ CaptionProvider │    │ ChapterProvider │    │ ThumbnailProvider│
│                 │    │                 │    │                 │
│ - YouTube       │    │ - YouTube       │    │ - YouTube       │
│ - GroqWhisper   │    │ - DescParser    │    │   Storyboard    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Warum Provider Pattern?

| Vorteil | Beschreibung |
|---------|--------------|
| **Austauschbar** | Groq kann durch OpenAI Whisper ersetzt werden |
| **Testbar** | Jeder Provider einzeln testbar mit Mocks |
| **Fallback-fähig** | Provider-Kette: YouTube → Groq → Fehler |
| **Erweiterbar** | Neue Provider ohne Code-Änderung hinzufügbar |

---

## Integration Points

### 1. Trigger: Wann wird Enrichment gestartet?

**Option A: Beim Video-Import (gewählt)**
```python
# In app/api/videos.py → create_video()

# Nach Video-Erstellung:
video = Video(...)
db.add(video)
await db.commit()

# Enrichment-Job enqueuen (fire-and-forget)
arq_pool = await get_arq_pool()
await arq_pool.enqueue_job('enrich_video', str(video.id))
```

**Begründung:**
- Automatisch für alle Videos
- Parallel zur UI (User merkt nichts)
- Retry bei Fehler jederzeit möglich

### 2. Datenbank-Integration

**Separate Tabelle statt erweitertes Video-Model:**

```python
# app/models/video_enrichment.py

class VideoEnrichment(Base):
    __tablename__ = 'video_enrichments'

    id = Column(UUID, primary_key=True, default=uuid4)
    video_id = Column(UUID, ForeignKey('videos.id', ondelete='CASCADE'), unique=True)

    # Relationship
    video = relationship('Video', backref=backref('enrichment', uselist=False, lazy='joined'))
```

**Vorteile:**
- Video-Model bleibt unverändert
- Lazy Loading möglich (Enrichment nur wenn gebraucht)
- Saubere Trennung der Concerns

### 3. Worker-Integration

**Neue Worker-Datei statt Erweiterung von video_processor.py:**

```
app/workers/
├── video_processor.py      # Existierend - nicht ändern
├── enrichment_worker.py    # NEU - Enrichment-spezifisch
└── settings.py             # Nur: neue Funktion registrieren
```

**In settings.py:**
```python
from app.workers.enrichment_worker import enrich_video

class WorkerSettings:
    functions = [
        process_video,
        process_video_list,
        enrich_video,  # NEU - einzige Änderung
    ]
```

### 4. API-Integration

**Neuer Router statt Erweiterung von videos.py:**

```python
# app/api/enrichment.py

router = APIRouter(prefix="/api/videos", tags=["enrichment"])

@router.get("/{video_id}/enrichment")
async def get_enrichment(video_id: UUID, db: AsyncSession = Depends(get_db)):
    ...

@router.post("/{video_id}/enrichment/retry")
async def retry_enrichment(video_id: UUID, db: AsyncSession = Depends(get_db)):
    ...
```

**In main.py:**
```python
from app.api import enrichment

app.include_router(enrichment.router)  # NEU - eine Zeile
```

### 5. Frontend-Integration

**Neuer Hook + Modifikation VideoDetailsPage:**

```typescript
// hooks/useVideoEnrichment.ts (NEU)
export function useVideoEnrichment(videoId: string | undefined) { ... }

// pages/VideoDetailsPage.tsx (MODIFIZIERT)
const { data: enrichment, isLoading: enrichmentLoading } = useVideoEnrichment(videoId)

// Enrichment-Daten an VideoPlayer übergeben
<VideoPlayer
  textTracks={enrichment?.textTracks}  // Von Hook transformiert
  thumbnailsVtt={enrichment?.thumbnails?.vtt_url}
/>
```

---

## Service-Struktur

### EnrichmentService (Orchestrierung)

```python
# app/services/enrichment/enrichment_service.py

class EnrichmentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.caption_providers = [
            YoutubeCaptionProvider(),
            GroqWhisperProvider(),
        ]
        self.chapter_providers = [
            YoutubeChapterProvider(),
            DescriptionChapterProvider(),
        ]

    async def enrich_video(self, video_id: UUID) -> VideoEnrichment:
        video = await self.db.get(Video, video_id)
        enrichment = await self._get_or_create_enrichment(video_id)

        # 1. Captions (mit Fallback-Kette)
        for provider in self.caption_providers:
            try:
                result = await provider.fetch(video.youtube_id, video.duration)
                if result:
                    enrichment.captions_vtt = result.vtt
                    enrichment.captions_source = provider.name
                    break
            except ProviderError as e:
                logger.warning(f"Provider {provider.name} failed: {e}")
                continue

        # 2. Chapters (analog)
        ...

        # 3. Speichern
        enrichment.status = 'completed'
        enrichment.processed_at = datetime.utcnow()
        await self.db.commit()

        return enrichment
```

### Provider Interface

```python
# app/services/enrichment/providers/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class CaptionResult:
    vtt: str
    language: str
    source: str

class CaptionProvider(ABC):
    name: str

    @abstractmethod
    async def fetch(self, youtube_id: str, duration_seconds: int) -> CaptionResult | None:
        """
        Fetch captions for a video.
        Returns None if not available from this provider.
        Raises ProviderError on failures.
        """
        pass

    @abstractmethod
    async def is_available(self, youtube_id: str) -> bool:
        """Check if this provider can handle this video."""
        pass
```

---

## Audio-Chunking-Strategie (Kritisch!)

### Das Problem
- Groq Whisper: 25 MB Dateilimit
- 2-Stunden Video @ 128kbps = ~115 MB Audio
- **Muss in Chunks verarbeitet werden**

### Die Lösung: AudioChunker

```python
# app/services/enrichment/providers/audio_chunker.py

class AudioChunker:
    CHUNK_DURATION = 10 * 60  # 10 Minuten pro Chunk
    MAX_CHUNK_SIZE_MB = 20    # Sicherheitspuffer unter 25 MB

    async def split_audio(self, youtube_id: str) -> list[AudioChunk]:
        """
        1. Audio von YouTube downloaden (yt-dlp)
        2. In 10-Minuten Chunks splitten (pydub/ffmpeg)
        3. Chunks als temporäre Dateien speichern
        4. Liste von AudioChunk-Objekten zurückgeben
        """

    async def merge_transcripts(self, chunks: list[TranscriptChunk]) -> str:
        """
        Transcripts zusammenführen mit korrekten Timestamps.
        Chunk 1: 00:00 - 10:00
        Chunk 2: 10:00 - 20:00 (Timestamps um 10:00 verschieben)
        ...
        """
```

### Chunking-Flow

```
Video (2h)
    │
    ▼
┌─────────────────┐
│ Audio Download  │ ← yt-dlp (bestaudio)
│ (temp file)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Split into      │ ← pydub/ffmpeg
│ 10-min chunks   │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
  Chunk 1   Chunk 2  Chunk 3  ...Chunk 12
    │         │        │        │
    ▼         ▼        ▼        ▼
  Groq      Groq     Groq     Groq    ← Parallel (mit Rate-Limiting)
    │         │        │        │
    └────┬────┴────────┴────────┘
         │
         ▼
┌─────────────────┐
│ Merge with      │ ← Timestamp-Korrektur
│ correct times   │
└────────┬────────┘
         │
         ▼
    Final VTT
```

### Parallelisierung mit Rate-Limiting

```python
# Groq: 20 Requests/Minute
MAX_CONCURRENT = 3  # Konservativ
DELAY_BETWEEN = 3   # Sekunden

async def transcribe_chunks(chunks: list[AudioChunk]) -> list[TranscriptChunk]:
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    results = []

    async def transcribe_with_limit(chunk):
        async with semaphore:
            result = await groq_transcribe(chunk)
            await asyncio.sleep(DELAY_BETWEEN)  # Rate-Limiting
            return result

    tasks = [transcribe_with_limit(c) for c in chunks]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return results
```

---

## Fehlerbehandlung

### Graceful Degradation

```python
class EnrichmentService:
    async def enrich_video(self, video_id: UUID):
        enrichment = await self._get_or_create_enrichment(video_id)

        try:
            # Captions sind am wichtigsten
            await self._fetch_captions(enrichment)
        except Exception as e:
            logger.error(f"Caption fetch failed: {e}")
            enrichment.error_message = f"Captions failed: {e}"
            # Weitermachen mit Chapters!

        try:
            # Chapters sind optional
            await self._fetch_chapters(enrichment)
        except Exception as e:
            logger.warning(f"Chapter fetch failed: {e}")
            # Kein Fehler setzen - Captions sind wichtiger

        # Status bestimmen
        if enrichment.captions_vtt:
            enrichment.status = 'completed'
        elif enrichment.chapters_vtt:
            enrichment.status = 'partial'  # Nur Chapters
        else:
            enrichment.status = 'failed'

        return enrichment
```

### Retry-Mechanismus

```python
MAX_RETRIES = 3

async def enrich_with_retry(video_id: UUID):
    enrichment = await get_enrichment(video_id)

    if enrichment.retry_count >= MAX_RETRIES:
        enrichment.status = 'failed'
        enrichment.error_message = 'Max retries exceeded'
        return

    try:
        await enrich_video(video_id)
    except Exception as e:
        enrichment.retry_count += 1
        enrichment.error_message = str(e)

        # Exponential backoff: 5min, 15min, 45min
        delay = 5 * 60 * (3 ** enrichment.retry_count)
        await arq_pool.enqueue_job('enrich_video', video_id, _defer_by=delay)
```

---

## Konfiguration

### Environment Variables

```python
# app/core/config.py

class Settings(BaseSettings):
    # Bestehend...

    # NEU: Enrichment
    groq_api_key: str = ""
    enrichment_chunk_duration: int = 600  # 10 Minuten
    enrichment_max_concurrent: int = 3
    enrichment_enabled: bool = True

    class Config:
        env_file = ".env"
```

### Feature Flag

```python
# Einfaches Feature-Flag für Rollout
if settings.enrichment_enabled:
    await arq_pool.enqueue_job('enrich_video', video_id)
```

---

## Zusammenfassung Integration Points

| Komponente | Integrations-Art | Änderungsumfang |
|------------|-----------------|-----------------|
| Video-Import | Hook nach create | 3 Zeilen |
| Worker System | Neue Funktion registrieren | 1 Zeile |
| API | Neuer Router | 1 include |
| Database | Neues Model + Migration | Additiv |
| Frontend | Neuer Hook + Props | ~20 Zeilen |
| Config | Neue Env-Vars | 5 Zeilen |

**Gesamte Änderungen an bestehenden Dateien: ~30 Zeilen**

---

**Exit Condition:** ✅ Klare Integration-Strategie die bestehenden Code minimal ändert
**Nächste Phase:** Backward Compatibility
