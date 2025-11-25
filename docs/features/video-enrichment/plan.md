# Video Enrichment - Implementation Plan

## Übersicht

Der Plan ist in 4 Implementierungs-Phasen unterteilt:

| Phase | Fokus | Dateien | Risiko |
|-------|-------|---------|--------|
| **1** | Backend-Infrastruktur | 8 | Hoch (Audio-Chunking) |
| **2** | API + Worker | 4 | Mittel |
| **3** | Frontend-Integration | 5 | Niedrig |
| **4** | Suche + Polish | 3 | Mittel |

---

## Phase 1: Backend-Infrastruktur

### 1.1 VideoEnrichment Model + Migration

**Dateien:**
- `backend/app/models/video_enrichment.py` (NEU)
- `backend/alembic/versions/xxx_add_video_enrichments.py` (NEU)

**Tasks:**
1. Model-Klasse erstellen mit allen Feldern
2. Relationship zu Video definieren
3. Alembic Migration generieren
4. Migration testen (up + down)

```python
# app/models/video_enrichment.py

from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from app.models.base import Base
import enum

class EnrichmentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    partial = "partial"
    failed = "failed"

class VideoEnrichment(Base):
    __tablename__ = "video_enrichments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), unique=True, nullable=False)

    status = Column(Enum(EnrichmentStatus), default=EnrichmentStatus.pending, nullable=False)

    # Captions
    captions_vtt = Column(Text)
    captions_language = Column(String(10))
    captions_source = Column(String(20))  # youtube_manual, youtube_auto, groq_whisper

    # Transcript (für Suche)
    transcript_text = Column(Text)

    # Chapters
    chapters_vtt = Column(Text)
    chapters_json = Column(JSONB)
    chapters_source = Column(String(20))  # youtube, description_parsed

    # Thumbnails
    thumbnails_vtt_url = Column(Text)

    # Processing
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    progress_message = Column(String(100))
    processed_at = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"))

    # Relationship
    video = relationship("Video", backref=backref("enrichment", uselist=False, lazy="joined"))
```

---

### 1.2 Enrichment Service Struktur

**Dateien:**
```
backend/app/services/enrichment/
├── __init__.py
├── enrichment_service.py      # Orchestrierung
├── exceptions.py              # Fehler-Klassen
├── providers/
│   ├── __init__.py
│   ├── base.py               # Abstract Provider
│   ├── youtube_captions.py   # yt-dlp Captions
│   ├── groq_transcriber.py   # Groq Whisper API
│   ├── chapter_extractor.py  # YouTube + Description
│   └── audio_chunker.py      # FFmpeg Audio Splitting
└── utils/
    ├── __init__.py
    ├── vtt_parser.py         # VTT Parsing/Generation
    └── timestamp_utils.py    # Timestamp Konvertierung
```

**Tasks:**
1. Verzeichnisstruktur erstellen
2. Exception-Klassen definieren (TemporaryError, PermanentError)
3. Provider-Basis-Klasse mit Interface
4. VTT Parser Utilities

---

### 1.3 Audio Chunker (KRITISCH)

**Datei:** `backend/app/services/enrichment/providers/audio_chunker.py`

**Tasks:**
1. Audio-Download mit yt-dlp implementieren
2. Audio-Splitting mit pydub/ffmpeg
3. Temporäre Datei-Verwaltung (Context Manager)
4. Cleanup auch bei Fehlern sicherstellen

```python
# Kern-Logik
class AudioChunker:
    CHUNK_DURATION_MS = 10 * 60 * 1000  # 10 Minuten
    AUDIO_BITRATE = '64k'

    async def download_audio(self, youtube_id: str) -> Path
    def split_audio(self, audio_path: Path) -> list[AudioChunk]
    def cleanup(self) -> None
```

**Abhängigkeiten:**
- `yt-dlp` (pip)
- `pydub` (pip)
- `ffmpeg` (System)

---

### 1.4 YouTube Caption Provider

**Datei:** `backend/app/services/enrichment/providers/youtube_captions.py`

**Tasks:**
1. Captions mit yt-dlp extrahieren
2. VTT-Format konvertieren
3. Sprache erkennen
4. Manual vs Auto-Generated unterscheiden

```python
class YoutubeCaptionProvider:
    name = "youtube"

    async def fetch(self, youtube_id: str) -> CaptionResult | None:
        """
        1. yt-dlp --write-subs --skip-download
        2. VTT laden und parsen
        3. Sprache und Typ bestimmen
        """
```

---

### 1.5 Groq Whisper Provider

**Datei:** `backend/app/services/enrichment/providers/groq_transcriber.py`

**Tasks:**
1. Groq SDK Integration
2. Chunk-weise Transcription mit Rate-Limiting
3. Timestamp-Korrektur beim Merge
4. VTT-Generierung aus Segments

```python
class GroqTranscriber:
    MAX_CONCURRENT = 3
    DELAY_BETWEEN = 3.0

    async def transcribe_chunks(self, chunks: list[AudioChunk]) -> str:
        """
        1. Semaphore für Rate-Limiting
        2. Parallel transcribieren (max 3)
        3. Timestamps korrigieren
        4. Zu VTT mergen
        """
```

**Abhängigkeiten:**
- `groq` (pip)

---

### 1.6 Chapter Extractor

**Datei:** `backend/app/services/enrichment/providers/chapter_extractor.py`

**Tasks:**
1. YouTube Chapters via yt-dlp
2. Description Parsing (Regex)
3. VTT-Generierung für Chapters
4. JSON-Format für API

```python
class ChapterExtractor:
    CHAPTER_PATTERN = r'(?:^|\n)(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+?)(?=\n|$)'

    async def fetch_youtube_chapters(self, youtube_id: str) -> list[Chapter] | None
    def parse_description_chapters(self, description: str, duration: int) -> list[Chapter]
    def chapters_to_vtt(self, chapters: list[Chapter]) -> str
```

---

### 1.7 EnrichmentService (Orchestrierung)

**Datei:** `backend/app/services/enrichment/enrichment_service.py`

**Tasks:**
1. Provider-Kette für Captions (YouTube → Groq)
2. Provider-Kette für Chapters (YouTube → Description)
3. Status-Tracking
4. Fehlerbehandlung mit Graceful Degradation
5. Progress-Updates

```python
class EnrichmentService:
    def __init__(self, db: AsyncSession):
        self.caption_providers = [YoutubeCaptionProvider(), GroqTranscriber()]
        self.chapter_extractor = ChapterExtractor()

    async def enrich_video(self, video_id: UUID) -> VideoEnrichment:
        """
        1. Enrichment-Record erstellen/laden
        2. YouTube Captions versuchen
        3. Falls nötig: Audio → Groq
        4. Chapters extrahieren
        5. Status setzen + speichern
        """
```

---

### 1.8 Konfiguration

**Datei:** `backend/app/core/config.py` (MODIFIZIEREN)

**Tasks:**
1. Groq API Key hinzufügen
2. Enrichment-Einstellungen
3. Feature Flag

```python
class Settings(BaseSettings):
    # ... bestehend ...

    # Enrichment
    groq_api_key: str = ""
    enrichment_enabled: bool = True
    enrichment_chunk_duration: int = 600  # 10 Minuten
    enrichment_max_concurrent: int = 3
```

---

## Phase 2: API + Worker

### 2.1 Enrichment Worker

**Datei:** `backend/app/workers/enrichment_worker.py` (NEU)

**Tasks:**
1. Worker-Funktion `enrich_video`
2. Retry-Logik mit exponential Backoff
3. Timeout-Handling (30 min)
4. Progress-Tracking

```python
async def enrich_video(ctx, video_id: str) -> dict:
    """
    ARQ Worker-Funktion für Video-Enrichment.
    """
    db = ctx['db']
    service = EnrichmentService(db)

    try:
        result = await service.enrich_video(UUID(video_id))
        return {"status": result.status, "video_id": video_id}
    except TemporaryError as e:
        # Retry schedulen
        ...
    except PermanentError as e:
        # Fehler speichern, kein Retry
        ...
```

---

### 2.2 Worker Settings

**Datei:** `backend/app/workers/settings.py` (MODIFIZIEREN)

**Tasks:**
1. `enrich_video` Funktion registrieren
2. Timeout anpassen (30 min für Enrichment)

```python
from app.workers.enrichment_worker import enrich_video

class WorkerSettings:
    functions = [
        process_video,
        process_video_list,
        enrich_video,  # NEU
    ]
    job_timeout = 1800  # 30 Minuten
```

---

### 2.3 Enrichment API Router

**Datei:** `backend/app/api/enrichment.py` (NEU)

**Tasks:**
1. GET `/videos/{id}/enrichment` - Status + Daten
2. POST `/videos/{id}/enrichment/retry` - Retry starten
3. Response Schemas

```python
router = APIRouter(prefix="/api/videos", tags=["enrichment"])

@router.get("/{video_id}/enrichment")
async def get_enrichment(
    video_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> EnrichmentResponse:
    """Enrichment-Daten für ein Video abrufen."""

@router.post("/{video_id}/enrichment/retry")
async def retry_enrichment(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    arq_pool = Depends(get_arq_pool)
) -> EnrichmentResponse:
    """Enrichment erneut starten."""
```

---

### 2.4 Enrichment Schemas

**Datei:** `backend/app/schemas/enrichment.py` (NEU)

**Tasks:**
1. Request/Response Schemas mit Pydantic
2. Captions/Chapters Sub-Schemas

```python
class EnrichmentCaptionsResponse(BaseModel):
    vtt: str
    language: str
    source: str

class EnrichmentChaptersResponse(BaseModel):
    vtt: str
    items: list[ChapterItem]
    source: str

class EnrichmentResponse(BaseModel):
    status: EnrichmentStatus
    captions: EnrichmentCaptionsResponse | None
    chapters: EnrichmentChaptersResponse | None
    thumbnails: EnrichmentThumbnailsResponse | None
    error: str | None
    processed_at: datetime | None
```

---

### 2.5 Video Import Hook

**Datei:** `backend/app/api/videos.py` (MODIFIZIEREN)

**Tasks:**
1. Nach Video-Erstellung Enrichment-Job starten
2. Feature Flag beachten

```python
# In create_video() nach db.commit():

if settings.enrichment_enabled:
    arq_pool = await get_arq_pool()
    await arq_pool.enqueue_job('enrich_video', str(video.id))
```

---

### 2.6 Main App Router

**Datei:** `backend/app/main.py` (MODIFIZIEREN)

**Tasks:**
1. Enrichment Router einbinden

```python
from app.api import enrichment

app.include_router(enrichment.router)
```

---

## Phase 3: Frontend-Integration

### 3.1 Types + Utils

**Dateien:**
- `frontend/src/types/enrichment.ts` (NEU)
- `frontend/src/lib/enrichmentUtils.ts` (NEU)

**Tasks:**
1. TypeScript Types definieren
2. Helper Functions (getLanguageLabel, formatChapterTime)

---

### 3.2 useVideoEnrichment Hook

**Datei:** `frontend/src/hooks/useVideoEnrichment.ts` (NEU)

**Tasks:**
1. React Query Hook mit Polling
2. Retry Mutation
3. Error Handling (404 = kein Enrichment)

---

### 3.3 EnrichmentStatus Komponente

**Datei:** `frontend/src/components/EnrichmentStatus.tsx` (NEU)

**Tasks:**
1. Status-Varianten (pending, processing, completed, partial, failed)
2. Progress-Anzeige
3. Retry-Button
4. Styling mit Tailwind

---

### 3.4 ChapterList Komponente

**Datei:** `frontend/src/components/ChapterList.tsx` (NEU)

**Tasks:**
1. Kapitel-Liste mit Timestamps
2. Aktives Kapitel hervorheben
3. Click-Handler für Seek
4. Styling

---

### 3.5 VideoDetailsPage Integration

**Datei:** `frontend/src/pages/VideoDetailsPage.tsx` (MODIFIZIEREN)

**Tasks:**
1. useVideoEnrichment Hook einbinden
2. TextTracks an VideoPlayer übergeben
3. EnrichmentStatus anzeigen
4. ChapterList einbinden

---

## Phase 4: Suche + Polish

### 4.1 Transcript Search API

**Datei:** `backend/app/api/search.py` (NEU)

**Tasks:**
1. PostgreSQL Full-Text Search
2. Timestamp-Mapping für Treffer
3. Pagination

---

### 4.2 Search UI

**Dateien:**
- `frontend/src/components/TranscriptSearch.tsx` (NEU)
- `frontend/src/hooks/useTranscriptSearch.ts` (NEU)

**Tasks:**
1. Search-Input
2. Ergebnis-Liste mit Highlights
3. Klick → Video an Position öffnen

---

### 4.3 Requirements + Dependencies

**Dateien:**
- `backend/requirements.txt` (MODIFIZIEREN)
- `backend/pyproject.toml` (falls vorhanden)

**Tasks:**
1. `yt-dlp` hinzufügen
2. `groq` hinzufügen
3. `pydub` hinzufügen

---

## Datei-Checkliste

### Backend - NEU (10 Dateien)
- [ ] `app/models/video_enrichment.py`
- [ ] `alembic/versions/xxx_add_video_enrichments.py`
- [ ] `app/services/enrichment/__init__.py`
- [ ] `app/services/enrichment/enrichment_service.py`
- [ ] `app/services/enrichment/exceptions.py`
- [ ] `app/services/enrichment/providers/base.py`
- [ ] `app/services/enrichment/providers/youtube_captions.py`
- [ ] `app/services/enrichment/providers/groq_transcriber.py`
- [ ] `app/services/enrichment/providers/chapter_extractor.py`
- [ ] `app/services/enrichment/providers/audio_chunker.py`
- [ ] `app/services/enrichment/utils/vtt_parser.py`
- [ ] `app/workers/enrichment_worker.py`
- [ ] `app/api/enrichment.py`
- [ ] `app/schemas/enrichment.py`

### Backend - MODIFIZIERT (4 Dateien)
- [ ] `app/core/config.py` - Groq API Key, Settings
- [ ] `app/workers/settings.py` - Worker registrieren
- [ ] `app/api/videos.py` - Enrichment-Job starten
- [ ] `app/main.py` - Router einbinden
- [ ] `requirements.txt` - Dependencies

### Frontend - NEU (5 Dateien)
- [ ] `src/types/enrichment.ts`
- [ ] `src/lib/enrichmentUtils.ts`
- [ ] `src/hooks/useVideoEnrichment.ts`
- [ ] `src/components/EnrichmentStatus.tsx`
- [ ] `src/components/ChapterList.tsx`

### Frontend - MODIFIZIERT (1 Datei)
- [ ] `src/pages/VideoDetailsPage.tsx`

---

## Risiko-Bereiche

| Bereich | Risiko | Mitigation |
|---------|--------|------------|
| Audio-Chunking | Hoch | Intensive Tests mit langen Videos |
| Groq API Limits | Mittel | Rate-Limiting, Retry mit Backoff |
| FFmpeg Installation | Mittel | Klare Docs, Health Check |
| VTT-Parsing | Mittel | Robuste Parser, Fallbacks |
| Memory bei Audio | Mittel | Streaming statt vollständiges Laden |

---

## Meilensteine

| Meilenstein | Kriterium |
|-------------|-----------|
| M1: Infrastruktur | Model + Migration + Service-Struktur |
| M2: YouTube Captions | Videos mit YouTube-Captions zeigen Untertitel |
| M3: Groq Transcription | Videos ohne YouTube-Captions werden transkribiert |
| M4: Lange Videos | 4+ Stunden Videos funktionieren |
| M5: Frontend | Status + Captions + Chapters in UI |
| M6: Suche | Volltextsuche über Transkripte |

---

**Exit Condition:** ✅ Vollständiger Implementation Plan mit allen Dateien
**Nächste Phase:** Testing Strategy
