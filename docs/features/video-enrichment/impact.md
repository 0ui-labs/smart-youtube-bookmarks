# Video Enrichment - Impact Assessment

## Komplexitäts-Einschätzung

| Aspekt | Bewertung | Begründung |
|--------|-----------|------------|
| **Gesamtkomplexität** | **Hoch** | Audio-Chunking, externe APIs, async Processing |
| Backend-Änderungen | Mittel | Neues Model, neuer Worker, neue API |
| Frontend-Änderungen | Niedrig | Player bereits vorbereitet, nur Hook + UI |
| Datenbank-Änderungen | Niedrig | Ein neues Model, eine Migration |
| Externe Abhängigkeiten | **Hoch** | yt-dlp, Groq API, FFmpeg |

---

## Betroffene Dateien - Übersicht

### Backend (12 Dateien)

| Datei | Änderung | Priorität |
|-------|----------|-----------|
| `app/models/video_enrichment.py` | **NEU** | P0 |
| `app/services/enrichment/` | **NEU** (ganzer Ordner) | P0 |
| `app/api/enrichment.py` | **NEU** | P0 |
| `app/schemas/enrichment.py` | **NEU** | P0 |
| `app/workers/enrichment_worker.py` | **NEU** | P0 |
| `app/workers/settings.py` | Modifizieren | P0 |
| `app/core/config.py` | Modifizieren | P1 |
| `app/main.py` | Modifizieren | P1 |
| `app/api/videos.py` | Modifizieren | P2 |
| `alembic/versions/xxx_add_enrichment.py` | **NEU** | P0 |
| `requirements.txt` | Modifizieren | P1 |
| `tests/services/test_enrichment.py` | **NEU** | P2 |

### Frontend (5 Dateien)

| Datei | Änderung | Priorität |
|-------|----------|-----------|
| `hooks/useVideoEnrichment.ts` | **NEU** | P0 |
| `types/enrichment.ts` | **NEU** | P1 |
| `pages/VideoDetailsPage.tsx` | Modifizieren | P1 |
| `components/VideoPlayer.tsx` | Modifizieren (minor) | P2 |
| `components/EnrichmentStatus.tsx` | **NEU** | P2 |

---

## Impact nach Bereich

### 1. Datenbank

#### Neues Model: `video_enrichments`

```sql
CREATE TABLE video_enrichments (
    id UUID PRIMARY KEY,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',

    -- Captions
    captions_vtt TEXT,
    captions_language VARCHAR(10),
    captions_source VARCHAR(20),  -- youtube_manual/youtube_auto/groq_whisper
    transcript_text TEXT,          -- Plain text für Suche

    -- Chapters
    chapters_vtt TEXT,
    chapters_json JSONB,
    chapters_source VARCHAR(20),   -- youtube/description_parsed

    -- Thumbnails
    thumbnails_vtt_url TEXT,

    -- Processing
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    processed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(video_id)
);

CREATE INDEX idx_enrichments_status ON video_enrichments(status);
CREATE INDEX idx_enrichments_video_id ON video_enrichments(video_id);
```

**Migration-Risiko:** Niedrig (additive Änderung, keine Datenmanipulation)

---

### 2. Backend Services

#### Neuer Service-Ordner: `app/services/enrichment/`

```
app/services/enrichment/
├── __init__.py
├── enrichment_service.py      # Orchestrierung
├── providers/
│   ├── __init__.py
│   ├── base.py                # Abstract Provider
│   ├── youtube_captions.py    # yt-dlp Captions
│   ├── groq_transcriber.py    # Groq Whisper
│   ├── chapter_extractor.py   # YouTube + Description Parse
│   └── audio_chunker.py       # FFmpeg Audio Splitting
└── utils/
    ├── vtt_parser.py          # VTT Format Handling
    └── timestamp_utils.py     # Timestamp Conversion
```

#### Neue Abhängigkeiten

| Package | Version | Zweck |
|---------|---------|-------|
| `yt-dlp` | latest | YouTube Captions + Audio Download |
| `groq` | ^0.4.0 | Groq Whisper API Client |
| `pydub` | ^0.25.0 | Audio Chunking (FFmpeg wrapper) |

**System-Abhängigkeit:** FFmpeg muss installiert sein

---

### 3. Background Worker

#### Neue Worker-Funktion: `enrich_video`

```python
# In app/workers/enrichment_worker.py

async def enrich_video(ctx, video_id: str) -> dict:
    """
    Enrichment Pipeline:
    1. Check existing enrichment status
    2. Fetch YouTube captions (yt-dlp)
    3. If no captions: Extract audio → Chunk → Transcribe (Groq)
    4. Fetch chapters (YouTube + Description parse)
    5. Save results
    """
```

**Registrierung in `settings.py`:**
```python
class WorkerSettings:
    functions = [
        process_video,
        process_video_list,
        enrich_video,           # NEU
        enrich_video_audio,     # NEU (für Audio-Chunks)
    ]
```

**Timeout-Anpassung:**
- Standard-Jobs: 5 Minuten
- Enrichment-Jobs: **30 Minuten** (lange Videos + Transcription)

---

### 4. API Endpoints

#### Neuer Router: `app/api/enrichment.py`

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/videos/{id}/enrichment` | GET | Enrichment-Status + Daten |
| `/api/videos/{id}/enrichment/retry` | POST | Retry bei Fehler |

**Response Schema:**
```json
{
  "status": "completed",
  "captions": {
    "vtt": "WEBVTT\n\n00:00:00.000 --> ...",
    "language": "de",
    "source": "youtube_auto"
  },
  "chapters": {
    "vtt": "WEBVTT\n\n...",
    "items": [
      {"start": 0, "end": 120, "title": "Intro"}
    ],
    "source": "youtube"
  },
  "thumbnails": {
    "vtt_url": "https://..."
  },
  "error": null,
  "processed_at": "2024-01-15T12:00:00Z"
}
```

---

### 5. Frontend Components

#### Neuer Hook: `useVideoEnrichment`

```typescript
// hooks/useVideoEnrichment.ts
export function useVideoEnrichment(videoId: string) {
  return useQuery({
    queryKey: ['video-enrichment', videoId],
    queryFn: () => api.get(`/videos/${videoId}/enrichment`),
    refetchInterval: (query) => {
      const status = query.data?.status
      if (status === 'processing') return 3000  // Poll while processing
      return false  // Stop polling when done
    },
    staleTime: 1000 * 60 * 60,  // 1 hour cache when completed
  })
}
```

#### Modifikation: `VideoDetailsPage.tsx`

```tsx
// Enrichment-Daten laden
const { data: enrichment } = useVideoEnrichment(videoId)

// An VideoPlayer übergeben
<VideoPlayer
  textTracks={enrichment?.captions ? [{
    src: `data:text/vtt;base64,${btoa(enrichment.captions.vtt)}`,
    kind: 'subtitles',
    language: enrichment.captions.language,
    label: enrichment.captions.language === 'de' ? 'Deutsch' : 'English',
    default: true
  }] : []}
  // + Chapters analog
/>
```

#### Neue Komponente: `EnrichmentStatus.tsx`

Zeigt Processing-Status an:
- ⏳ "Wird angereichert..."
- ✅ "Untertitel verfügbar"
- ❌ "Fehler" + Retry-Button

---

## Risiko-Analyse

### Hohe Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Groq API Timeout bei großen Files | Hoch | Hoch | **Audio-Chunking** implementieren |
| YouTube Rate Limiting | Mittel | Mittel | Exponential Backoff + Caching |
| FFmpeg nicht installiert | Niedrig | Hoch | Klare Docs + Health Check |

### Mittlere Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Lange Verarbeitungszeiten | Hoch | Mittel | Progress-Feedback, Background Processing |
| Inkonsistente VTT-Formate | Mittel | Mittel | Robuste Parser mit Fallbacks |
| Memory-Probleme bei Audio | Mittel | Mittel | Streaming statt vollständiges Laden |

### Niedrige Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| API-Änderungen bei YouTube | Niedrig | Mittel | yt-dlp regelmäßig updaten |
| Groq Preisänderungen | Niedrig | Niedrig | Provider-Pattern für Wechsel |

---

## Betroffene Test-Bereiche

| Bereich | Neue Tests | Modifizierte Tests |
|---------|------------|-------------------|
| Unit Tests | EnrichmentService, Providers, VTT Parser | - |
| Integration Tests | API Endpoints, Worker | - |
| E2E Tests | - | VideoDetailsPage (Enrichment-Status) |

---

## Externe System-Abhängigkeiten

| System | Art | Kritisch? |
|--------|-----|-----------|
| YouTube | Captions + Chapters via yt-dlp | Ja |
| Groq API | Transcription | Ja (für Videos ohne Captions) |
| FFmpeg | Audio Extraction + Chunking | Ja |
| Redis | ARQ Job Queue | Ja (bereits vorhanden) |

---

## Ressourcen-Impact

### Speicher
- VTT-Dateien: ~10-50 KB pro Video
- Audio-Chunks temporär: ~5-25 MB pro Chunk (gelöscht nach Processing)
- Transcript Text: ~1-10 KB pro Video

### CPU/Zeit
- YouTube Captions: ~2-5 Sekunden
- Audio Download: ~10-30 Sekunden
- Audio Chunking: ~5-10 Sekunden
- Groq Transcription: ~30-120 Sekunden pro 10-Min-Chunk

### Kosten (Groq)
- Free Tier: 7.200 Audio-Sekunden/Stunde
- ~12 kurze Videos (10 min) oder ~6 lange Videos (20 min) pro Stunde

---

## Zusammenfassung

### Neue Dateien (17)
- Backend: 12 Dateien
- Frontend: 5 Dateien

### Modifizierte Dateien (6)
- `app/workers/settings.py`
- `app/core/config.py`
- `app/main.py`
- `app/api/videos.py`
- `requirements.txt`
- `pages/VideoDetailsPage.tsx`

### Kritische Abhängigkeiten
1. **FFmpeg** muss installiert sein
2. **Groq API Key** muss konfiguriert sein
3. **Audio-Chunking** ist mandatory für Videos > 25 MB Audio

---

**Exit Condition:** ✅ Vollständige Liste aller betroffenen Bereiche
**Nächste Phase:** Integration Strategy
