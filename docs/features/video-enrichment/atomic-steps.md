# Video Enrichment - Atomic Implementation Steps

Jeder Schritt ist:
- ✅ In max. 30 Minuten abschließbar
- ✅ Unabhängig testbar
- ✅ Hat klare Erfolgskriterien

---

## Sprint 1: Backend-Infrastruktur

### Step 1.1: VideoEnrichment Model

**Datei:** `backend/app/models/video_enrichment.py`

**Aktion:**
1. Neue Datei erstellen
2. VideoEnrichment Klasse mit allen Feldern
3. EnrichmentStatus Enum
4. Relationship zu Video

**Erfolgskriterium:**
```bash
python -c "from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus; print('OK')"
```

---

### Step 1.2: Alembic Migration

**Datei:** `backend/alembic/versions/xxx_add_video_enrichments.py`

**Aktion:**
1. `alembic revision --autogenerate -m "add_video_enrichments"`
2. Migration Review
3. `alembic upgrade head`
4. `alembic downgrade -1` zum Testen
5. `alembic upgrade head` final

**Erfolgskriterium:**
```bash
alembic current  # Zeigt neue Migration
psql -c "\d video_enrichments"  # Tabelle existiert
```

---

### Step 1.3: Exception Classes

**Datei:** `backend/app/services/enrichment/exceptions.py`

**Aktion:**
1. Verzeichnis `app/services/enrichment/` erstellen
2. `__init__.py` erstellen
3. Exception-Klassen definieren

```python
class EnrichmentError(Exception): pass
class TemporaryError(EnrichmentError): pass
class PermanentError(EnrichmentError): pass
class RateLimitError(TemporaryError): pass
class VideoNotFoundError(PermanentError): pass
```

**Erfolgskriterium:**
```bash
python -c "from app.services.enrichment.exceptions import TemporaryError; print('OK')"
```

---

### Step 1.4: VTT Parser Utils

**Datei:** `backend/app/services/enrichment/utils/vtt_parser.py`

**Aktion:**
1. `utils/` Verzeichnis erstellen
2. `parse_vtt()` Funktion
3. `generate_vtt()` Funktion
4. `vtt_to_text()` Funktion

**Erfolgskriterium:**
```python
# Test in REPL
from app.services.enrichment.utils.vtt_parser import parse_vtt
segments = parse_vtt("WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello")
assert len(segments) == 1
```

---

### Step 1.5: Timestamp Utils

**Datei:** `backend/app/services/enrichment/utils/timestamp_utils.py`

**Aktion:**
1. `seconds_to_vtt_time()` Funktion
2. `vtt_time_to_seconds()` Funktion
3. `offset_timestamps()` Funktion
4. `parse_description_timestamp()` Funktion

**Erfolgskriterium:**
```python
from app.services.enrichment.utils.timestamp_utils import seconds_to_vtt_time
assert seconds_to_vtt_time(65.5) == "00:01:05.500"
```

---

### Step 1.6: Provider Base Class

**Datei:** `backend/app/services/enrichment/providers/base.py`

**Aktion:**
1. `providers/` Verzeichnis erstellen
2. Abstract Base Class für Caption Provider
3. CaptionResult Dataclass

```python
@dataclass
class CaptionResult:
    vtt: str
    language: str
    source: str

class CaptionProvider(ABC):
    name: str

    @abstractmethod
    async def fetch(self, youtube_id: str, duration: int) -> CaptionResult | None: pass
```

**Erfolgskriterium:**
```bash
python -c "from app.services.enrichment.providers.base import CaptionProvider; print('OK')"
```

---

### Step 1.7: YouTube Caption Provider

**Datei:** `backend/app/services/enrichment/providers/youtube_captions.py`

**Aktion:**
1. yt-dlp Integration
2. Captions extrahieren (manual + auto)
3. VTT konvertieren
4. Sprache erkennen

**Erfolgskriterium:**
```python
# Test mit echtem YouTube Video
provider = YoutubeCaptionProvider()
result = await provider.fetch("dQw4w9WgXcQ", 212)
assert result is not None
assert "WEBVTT" in result.vtt
```

---

### Step 1.8: Audio Chunker - Download

**Datei:** `backend/app/services/enrichment/providers/audio_chunker.py`

**Aktion:**
1. AudioChunk Dataclass
2. `download_audio()` mit yt-dlp
3. Temp-Datei Management

**Erfolgskriterium:**
```python
chunker = AudioChunker()
path = await chunker.download_audio("dQw4w9WgXcQ")
assert path.exists()
assert path.suffix == ".mp3"
chunker.cleanup()
```

---

### Step 1.9: Audio Chunker - Split

**Datei:** `backend/app/services/enrichment/providers/audio_chunker.py`

**Aktion:**
1. `split_audio()` mit pydub
2. Chunk-Größe validieren (< 20 MB)
3. Timestamps berechnen

**Erfolgskriterium:**
```python
chunks = chunker.split_audio(audio_path)
assert all(chunk.path.stat().st_size < 20 * 1024 * 1024 for chunk in chunks)
assert chunks[0].start_time == 0
assert chunks[1].start_time == 600  # 10 min
```

---

### Step 1.10: Groq Transcriber - Single

**Datei:** `backend/app/services/enrichment/providers/groq_transcriber.py`

**Aktion:**
1. Groq SDK Setup
2. `_transcribe_single()` Funktion
3. Response zu Segments parsen

**Erfolgskriterium:**
```python
transcriber = GroqTranscriber(api_key="...")
result = await transcriber._transcribe_single(chunk)
assert result.text is not None
assert len(result.segments) > 0
```

---

### Step 1.11: Groq Transcriber - Parallel

**Datei:** `backend/app/services/enrichment/providers/groq_transcriber.py`

**Aktion:**
1. `transcribe_chunks()` mit Semaphore
2. Rate-Limiting (3 concurrent, 3s delay)
3. Ergebnisse sortieren

**Erfolgskriterium:**
```python
results = await transcriber.transcribe_chunks(chunks)
assert len(results) == len(chunks)
# Timestamps korrekt sortiert
assert results[0].chunk_index < results[1].chunk_index
```

---

### Step 1.12: VTT Merger

**Datei:** `backend/app/services/enrichment/utils/vtt_merger.py`

**Aktion:**
1. `merge_transcripts()` Funktion
2. Timestamp-Offset berechnen
3. VTT-Format generieren

**Erfolgskriterium:**
```python
vtt = merge_transcripts(transcript_chunks)
assert "WEBVTT" in vtt
# Chunk 2 hat Offset von 10:00
assert "00:10:" in vtt  # Timestamps >= 10 min
```

---

### Step 1.13: Chapter Extractor - YouTube

**Datei:** `backend/app/services/enrichment/providers/chapter_extractor.py`

**Aktion:**
1. `fetch_youtube_chapters()` mit yt-dlp
2. Chapter Dataclass
3. VTT-Generierung

**Erfolgskriterium:**
```python
extractor = ChapterExtractor()
chapters = await extractor.fetch_youtube_chapters("VIDEO_WITH_CHAPTERS")
assert len(chapters) > 0
assert chapters[0].title is not None
```

---

### Step 1.14: Chapter Extractor - Description

**Datei:** `backend/app/services/enrichment/providers/chapter_extractor.py`

**Aktion:**
1. `parse_description_chapters()` mit Regex
2. Verschiedene Timestamp-Formate
3. End-Time Berechnung

**Erfolgskriterium:**
```python
description = "0:00 Intro\n2:30 Setup\n10:15 Demo"
chapters = extractor.parse_description_chapters(description, 1200)
assert len(chapters) == 3
assert chapters[0].title == "Intro"
assert chapters[1].start == 150
```

---

### Step 1.15: EnrichmentService Skeleton

**Datei:** `backend/app/services/enrichment/enrichment_service.py`

**Aktion:**
1. Klasse mit DB Session
2. Provider-Listen initialisieren
3. `_get_or_create_enrichment()` Methode

**Erfolgskriterium:**
```python
service = EnrichmentService(db)
enrichment = await service._get_or_create_enrichment(video_id)
assert enrichment.status == "pending"
```

---

### Step 1.16: EnrichmentService - Captions

**Datei:** `backend/app/services/enrichment/enrichment_service.py`

**Aktion:**
1. `_fetch_captions()` mit Provider-Kette
2. YouTube first, dann Groq Fallback
3. Ergebnis speichern

**Erfolgskriterium:**
```python
await service._fetch_captions(enrichment, video)
assert enrichment.captions_vtt is not None
```

---

### Step 1.17: EnrichmentService - Chapters

**Datei:** `backend/app/services/enrichment/enrichment_service.py`

**Aktion:**
1. `_fetch_chapters()` Methode
2. YouTube first, dann Description Parse

**Erfolgskriterium:**
```python
await service._fetch_chapters(enrichment, video)
# Chapters können None sein - das ist OK
```

---

### Step 1.18: EnrichmentService - Full Flow

**Datei:** `backend/app/services/enrichment/enrichment_service.py`

**Aktion:**
1. `enrich_video()` Hauptmethode
2. Status-Management
3. Error Handling

**Erfolgskriterium:**
```python
result = await service.enrich_video(video_id)
assert result.status in ["completed", "partial", "failed"]
```

---

### Step 1.19: Config Settings

**Datei:** `backend/app/core/config.py`

**Aktion:**
1. `groq_api_key` hinzufügen
2. `enrichment_enabled` Flag
3. Enrichment-Einstellungen

**Erfolgskriterium:**
```python
from app.core.config import settings
assert hasattr(settings, 'groq_api_key')
assert hasattr(settings, 'enrichment_enabled')
```

---

## Sprint 2: API + Worker

### Step 2.1: Enrichment Schemas

**Datei:** `backend/app/schemas/enrichment.py`

**Aktion:**
1. Response Schemas definieren
2. Captions/Chapters Sub-Schemas

**Erfolgskriterium:**
```python
from app.schemas.enrichment import EnrichmentResponse
schema = EnrichmentResponse(status="completed", ...)
```

---

### Step 2.2: Enrichment API - GET

**Datei:** `backend/app/api/enrichment.py`

**Aktion:**
1. Router erstellen
2. GET Endpoint implementieren
3. 404 bei fehlendem Enrichment

**Erfolgskriterium:**
```bash
curl http://localhost:8000/api/videos/{id}/enrichment
# 200 mit Daten oder 404
```

---

### Step 2.3: Enrichment API - Retry

**Datei:** `backend/app/api/enrichment.py`

**Aktion:**
1. POST /retry Endpoint
2. Job enqueueing
3. 409 bei laufendem Job

**Erfolgskriterium:**
```bash
curl -X POST http://localhost:8000/api/videos/{id}/enrichment/retry
# 200 mit neuem Status
```

---

### Step 2.4: Register API Router

**Datei:** `backend/app/main.py`

**Aktion:**
1. Enrichment Router importieren
2. `app.include_router()` hinzufügen

**Erfolgskriterium:**
```bash
# API Docs zeigen /videos/{id}/enrichment Endpoints
curl http://localhost:8000/docs | grep enrichment
```

---

### Step 2.5: Enrichment Worker

**Datei:** `backend/app/workers/enrichment_worker.py`

**Aktion:**
1. `enrich_video` Worker-Funktion
2. EnrichmentService aufrufen
3. Error Handling

**Erfolgskriterium:**
```python
# Manueller Worker-Test
result = await enrich_video(ctx, str(video_id))
assert result["status"] in ["completed", "partial", "failed"]
```

---

### Step 2.6: Register Worker

**Datei:** `backend/app/workers/settings.py`

**Aktion:**
1. Import hinzufügen
2. `functions` Liste erweitern

**Erfolgskriterium:**
```bash
# Worker startet ohne Fehler
arq app.workers.settings.WorkerSettings --check
```

---

### Step 2.7: Video Import Hook

**Datei:** `backend/app/api/videos.py`

**Aktion:**
1. Job nach Video-Erstellung starten
2. Feature Flag beachten

**Erfolgskriterium:**
```bash
# Video importieren → Job in Redis Queue
redis-cli KEYS "arq:*"
# Zeigt enrich_video Job
```

---

### Step 2.8: Dependencies

**Datei:** `backend/requirements.txt`

**Aktion:**
1. `yt-dlp` hinzufügen
2. `groq` hinzufügen
3. `pydub` hinzufügen

**Erfolgskriterium:**
```bash
pip install -r requirements.txt
python -c "import yt_dlp, groq, pydub; print('OK')"
```

---

## Sprint 3: Frontend

### Step 3.1: TypeScript Types

**Datei:** `frontend/src/types/enrichment.ts`

**Aktion:**
1. EnrichmentStatus Type
2. EnrichmentData Interface
3. Sub-Interfaces

**Erfolgskriterium:**
```bash
# TypeScript kompiliert ohne Fehler
npm run type-check
```

---

### Step 3.2: Utility Functions

**Datei:** `frontend/src/lib/enrichmentUtils.ts`

**Aktion:**
1. `getLanguageLabel()` Funktion
2. `formatChapterTime()` Funktion

**Erfolgskriterium:**
```typescript
import { getLanguageLabel } from '@/lib/enrichmentUtils'
getLanguageLabel('de', 'youtube_auto') // "Deutsch (Auto)"
```

---

### Step 3.3: useVideoEnrichment Hook

**Datei:** `frontend/src/hooks/useVideoEnrichment.ts`

**Aktion:**
1. React Query Hook
2. Polling während processing
3. 404 Handling

**Erfolgskriterium:**
```typescript
// In React DevTools: Query wird korrekt gecached
const { data } = useVideoEnrichment(videoId)
```

---

### Step 3.4: useRetryEnrichment Mutation

**Datei:** `frontend/src/hooks/useVideoEnrichment.ts`

**Aktion:**
1. useMutation Hook
2. Cache Invalidation

**Erfolgskriterium:**
```typescript
const retry = useRetryEnrichment()
retry.mutate(videoId)
// Query wird invalidiert
```

---

### Step 3.5: EnrichmentStatus Component

**Datei:** `frontend/src/components/EnrichmentStatus.tsx`

**Aktion:**
1. Komponente erstellen
2. Status-Varianten stylen
3. Retry Button

**Erfolgskriterium:**
```bash
# Storybook oder direkter Test
npm run dev
# Komponente rendert korrekt
```

---

### Step 3.6: ChapterList Component

**Datei:** `frontend/src/components/ChapterList.tsx`

**Aktion:**
1. Komponente erstellen
2. Aktives Kapitel hervorheben
3. Click Handler

**Erfolgskriterium:**
```bash
# Visueller Test
# Kapitel-Liste rendert, Klick loggt Timestamp
```

---

### Step 3.7: VideoDetailsPage Integration

**Datei:** `frontend/src/pages/VideoDetailsPage.tsx`

**Aktion:**
1. useVideoEnrichment einbinden
2. textTracks an VideoPlayer
3. EnrichmentStatus anzeigen
4. ChapterList einbinden

**Erfolgskriterium:**
```bash
# E2E Test
# Video-Details öffnen → Untertitel werden angezeigt
```

---

## Sprint 4: Suche + Polish

### Step 4.1: Search API

**Datei:** `backend/app/api/search.py`

**Aktion:**
1. `/api/search` Endpoint
2. PostgreSQL Full-Text Search
3. Pagination

**Erfolgskriterium:**
```bash
curl "http://localhost:8000/api/search?q=test"
# 200 mit Ergebnissen
```

---

### Step 4.2: Search Hook

**Datei:** `frontend/src/hooks/useTranscriptSearch.ts`

**Aktion:**
1. React Query Hook
2. Debounced Search

**Erfolgskriterium:**
```typescript
const { data } = useTranscriptSearch("test query")
// Ergebnisse werden angezeigt
```

---

### Step 4.3: Search UI

**Datei:** `frontend/src/components/TranscriptSearch.tsx`

**Aktion:**
1. Search Input
2. Ergebnis-Liste
3. Klick → Video öffnen

**Erfolgskriterium:**
```bash
# E2E Test
# Suchen → Klick auf Ergebnis → Video öffnet an Position
```

---

## Checkliste nach Abschluss

### Backend ✅
- [ ] Step 1.1-1.19: Infrastruktur
- [ ] Step 2.1-2.8: API + Worker

### Frontend ✅
- [ ] Step 3.1-3.7: UI Integration

### Suche ✅
- [ ] Step 4.1-4.3: Volltextsuche

### Qualität ✅
- [ ] Unit Tests geschrieben
- [ ] Integration Tests geschrieben
- [ ] Manuelle E2E Tests bestanden
- [ ] Code Review durchgeführt

---

**Exit Condition:** ✅ Alle Steps in max. 30 min umsetzbar
**Nächste Phase:** Research & Validation
