# Video Enrichment - Testing Strategy

## Test-Pyramide

```
        ╱╲
       ╱  ╲
      ╱ E2E ╲         2-3 Tests (manuell)
     ╱────────╲
    ╱Integration╲     8-10 Tests
   ╱──────────────╲
  ╱   Unit Tests    ╲  30+ Tests
 ╱────────────────────╲
```

---

## 1. Unit Tests

### 1.1 VTT Parser Tests

**Datei:** `tests/services/enrichment/utils/test_vtt_parser.py`

```python
class TestVttParser:
    def test_parse_valid_vtt(self):
        """Parst gültiges VTT Format korrekt."""

    def test_parse_vtt_with_styling(self):
        """Ignoriert VTT Styling Tags korrekt."""

    def test_parse_empty_vtt(self):
        """Gibt leere Liste für leeres VTT zurück."""

    def test_parse_malformed_vtt(self):
        """Handhabt fehlerhaftes VTT graceful."""

    def test_vtt_to_transcript_text(self):
        """Extrahiert Plain Text aus VTT."""

    def test_generate_vtt_from_segments(self):
        """Generiert gültiges VTT aus Segments."""

    def test_timestamp_format_hours(self):
        """Formatiert Timestamps mit Stunden korrekt."""

    def test_timestamp_format_minutes(self):
        """Formatiert Timestamps ohne Stunden korrekt."""
```

---

### 1.2 Timestamp Utils Tests

**Datei:** `tests/services/enrichment/utils/test_timestamp_utils.py`

```python
class TestTimestampUtils:
    def test_seconds_to_vtt_time(self):
        """Konvertiert Sekunden zu VTT Timestamp."""
        assert seconds_to_vtt_time(0) == "00:00:00.000"
        assert seconds_to_vtt_time(65.5) == "00:01:05.500"
        assert seconds_to_vtt_time(3661.123) == "01:01:01.123"

    def test_vtt_time_to_seconds(self):
        """Konvertiert VTT Timestamp zu Sekunden."""
        assert vtt_time_to_seconds("00:01:05.500") == 65.5

    def test_offset_timestamps(self):
        """Verschiebt Timestamps um Offset."""

    def test_parse_description_timestamp(self):
        """Parst verschiedene Timestamp-Formate aus Beschreibung."""
        assert parse_description_timestamp("1:23") == 83
        assert parse_description_timestamp("01:23") == 83
        assert parse_description_timestamp("1:23:45") == 5025
```

---

### 1.3 Chapter Extractor Tests

**Datei:** `tests/services/enrichment/providers/test_chapter_extractor.py`

```python
class TestChapterExtractor:
    def test_parse_description_with_chapters(self):
        """Parst Kapitel aus Beschreibung mit Timestamps."""
        description = """
        0:00 Intro
        2:30 Setup
        10:15 Demo
        """
        chapters = extractor.parse_description_chapters(description, 1200)
        assert len(chapters) == 3
        assert chapters[0].title == "Intro"
        assert chapters[1].start == 150

    def test_parse_description_no_chapters(self):
        """Gibt leere Liste für Beschreibung ohne Kapitel."""

    def test_parse_description_various_formats(self):
        """Erkennt verschiedene Timestamp-Formate."""
        # 0:00, 00:00, 0:00:00, 00:00:00

    def test_parse_description_with_dashes(self):
        """Erkennt Kapitel mit Bindestrich."""
        # 0:00 - Intro

    def test_chapters_to_vtt(self):
        """Generiert gültiges VTT für Chapters."""

    def test_chapters_end_calculation(self):
        """Berechnet Chapter-Ende korrekt."""
```

---

### 1.4 Audio Chunker Tests

**Datei:** `tests/services/enrichment/providers/test_audio_chunker.py`

```python
class TestAudioChunker:
    def test_calculate_chunk_count(self):
        """Berechnet korrekte Anzahl Chunks."""
        # 30 min Video → 3 Chunks à 10 min

    def test_chunk_size_under_limit(self):
        """Alle Chunks sind unter 20 MB."""

    def test_cleanup_removes_temp_files(self):
        """Cleanup entfernt temporäre Dateien."""

    def test_cleanup_on_error(self):
        """Cleanup erfolgt auch bei Fehlern."""

    @pytest.fixture
    def mock_audio_file(self, tmp_path):
        """Erstellt Mock-Audiodatei für Tests."""
```

---

### 1.5 Enrichment Service Tests

**Datei:** `tests/services/enrichment/test_enrichment_service.py`

```python
class TestEnrichmentService:
    @pytest.fixture
    def mock_youtube_provider(self):
        """Mock für YouTube Caption Provider."""

    @pytest.fixture
    def mock_groq_provider(self):
        """Mock für Groq Transcriber."""

    async def test_uses_youtube_captions_first(self, mock_youtube_provider):
        """Bevorzugt YouTube Captions über Groq."""

    async def test_falls_back_to_groq(self, mock_youtube_provider, mock_groq_provider):
        """Fällt auf Groq zurück wenn YouTube keine Captions hat."""

    async def test_graceful_degradation(self):
        """Kapitel werden auch bei Caption-Fehler verarbeitet."""

    async def test_status_completed_with_captions(self):
        """Status = completed wenn Captions erfolgreich."""

    async def test_status_partial_only_chapters(self):
        """Status = partial wenn nur Chapters aber keine Captions."""

    async def test_status_failed_no_data(self):
        """Status = failed wenn nichts extrahiert werden konnte."""

    async def test_retry_count_increment(self):
        """Retry Count wird bei Fehler erhöht."""

    async def test_max_retries_exceeded(self):
        """Nach max Retries kein weiterer Retry."""
```

---

### 1.6 Exception Tests

**Datei:** `tests/services/enrichment/test_exceptions.py`

```python
class TestExceptions:
    def test_temporary_error_triggers_retry(self):
        """TemporaryError führt zu Retry."""

    def test_permanent_error_no_retry(self):
        """PermanentError führt nicht zu Retry."""

    def test_rate_limit_is_temporary(self):
        """RateLimitError ist TemporaryError."""

    def test_video_not_found_is_permanent(self):
        """VideoNotFoundError ist PermanentError."""
```

---

## 2. Integration Tests

### 2.1 API Endpoint Tests

**Datei:** `tests/api/test_enrichment.py`

```python
class TestEnrichmentAPI:
    @pytest.fixture
    async def video_with_enrichment(self, db):
        """Video mit abgeschlossenem Enrichment."""

    @pytest.fixture
    async def video_without_enrichment(self, db):
        """Video ohne Enrichment-Record."""

    async def test_get_enrichment_completed(self, client, video_with_enrichment):
        """GET /videos/{id}/enrichment gibt vollständige Daten."""
        response = await client.get(f"/api/videos/{video_id}/enrichment")
        assert response.status_code == 200
        assert response.json()["status"] == "completed"
        assert "captions" in response.json()

    async def test_get_enrichment_processing(self, client, video_processing):
        """GET während processing gibt Status."""

    async def test_get_enrichment_not_found(self, client, video_without_enrichment):
        """GET für Video ohne Enrichment gibt 404."""

    async def test_retry_enrichment(self, client, video_failed):
        """POST /retry startet neuen Job."""

    async def test_retry_during_processing_conflict(self, client, video_processing):
        """POST /retry während processing gibt 409."""
```

---

### 2.2 Worker Integration Tests

**Datei:** `tests/workers/test_enrichment_worker.py`

```python
class TestEnrichmentWorker:
    @pytest.fixture
    def mock_arq_context(self, db):
        """Mock ARQ Context mit DB Session."""

    async def test_worker_creates_enrichment_record(self, mock_arq_context):
        """Worker erstellt Enrichment-Record wenn nicht vorhanden."""

    async def test_worker_updates_status(self, mock_arq_context):
        """Worker aktualisiert Status während Verarbeitung."""

    async def test_worker_handles_temporary_error(self, mock_arq_context):
        """Worker scheduled Retry bei TemporaryError."""

    async def test_worker_handles_permanent_error(self, mock_arq_context):
        """Worker setzt failed bei PermanentError."""

    async def test_worker_respects_timeout(self, mock_arq_context):
        """Worker bricht bei Timeout ab."""
```

---

### 2.3 Database Integration Tests

**Datei:** `tests/models/test_video_enrichment.py`

```python
class TestVideoEnrichmentModel:
    async def test_create_enrichment(self, db):
        """Enrichment kann erstellt werden."""

    async def test_video_relationship(self, db):
        """video.enrichment Relationship funktioniert."""

    async def test_cascade_delete(self, db):
        """Enrichment wird mit Video gelöscht."""

    async def test_unique_constraint(self, db):
        """Ein Video kann nur ein Enrichment haben."""
```

---

## 3. End-to-End Tests (Manuell)

### 3.1 Happy Path

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 1 | Video mit YouTube-Captions importieren | Video erscheint in Liste |
| 2 | Video-Details öffnen | Status: "Wird verarbeitet..." |
| 3 | Warten (~30s) | Status: "Untertitel verfügbar" |
| 4 | Video abspielen | Untertitel werden angezeigt |
| 5 | CC-Button klicken | Untertitel ein/aus toggle |

### 3.2 Groq Fallback

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 1 | Video OHNE YouTube-Captions importieren | Video erscheint in Liste |
| 2 | Video-Details öffnen | Status: "Wird verarbeitet..." |
| 3 | Warten (~2-5 min für 10 min Video) | Status: "Untertitel verfügbar (Transkribiert)" |
| 4 | Video abspielen | Untertitel werden angezeigt |

### 3.3 Langes Video (4+ Stunden)

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 1 | 4+ Stunden Video importieren | Video erscheint in Liste |
| 2 | Video-Details öffnen | Status: "Wird verarbeitet..." |
| 3 | Warten (10-20 min) | Status: "Untertitel verfügbar" |
| 4 | Zu Position 3:45:00 springen | Untertitel korrekt synchronisiert |

### 3.4 Fehler-Szenario

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 1 | Privates Video importieren | Video erscheint in Liste |
| 2 | Video-Details öffnen | Status: "Fehler: Video nicht verfügbar" |
| 3 | Retry klicken | Status: "Wird verarbeitet..." |
| 4 | Warten | Status: "Fehler..." (erneut) |

---

## 4. Test-Fixtures

### 4.1 VTT Samples

**Datei:** `tests/fixtures/sample_captions.vtt`

```vtt
WEBVTT

00:00:00.000 --> 00:00:05.000
Hallo und willkommen zu diesem Video.

00:00:05.000 --> 00:00:10.000
Heute zeige ich euch wie das funktioniert.

00:00:10.000 --> 00:00:15.000
Lasst uns direkt anfangen.
```

### 4.2 Chapter Samples

**Datei:** `tests/fixtures/sample_chapters.vtt`

```vtt
WEBVTT

chapter-1
00:00:00.000 --> 00:02:30.000
Intro

chapter-2
00:02:30.000 --> 00:10:15.000
Setup & Installation

chapter-3
00:10:15.000 --> 00:25:00.000
Demo
```

### 4.3 Mock Responses

**Datei:** `tests/fixtures/groq_response.json`

```json
{
  "text": "Hallo und willkommen...",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 5.0,
      "text": "Hallo und willkommen."
    }
  ],
  "language": "de"
}
```

---

## 5. Mocking-Strategie

### 5.1 Externe APIs Mocken

```python
# YouTube (yt-dlp)
@pytest.fixture
def mock_ytdlp(monkeypatch):
    def mock_extract_info(*args, **kwargs):
        return {
            "chapters": [...],
            "subtitles": {"de": [...]},
            "automatic_captions": {"de": [...]},
        }
    monkeypatch.setattr("yt_dlp.YoutubeDL.extract_info", mock_extract_info)


# Groq API
@pytest.fixture
def mock_groq(monkeypatch):
    mock_client = MagicMock()
    mock_client.audio.transcriptions.create.return_value = GroqResponse(...)
    monkeypatch.setattr("groq.Groq", lambda: mock_client)
```

### 5.2 Filesystem Mocken

```python
@pytest.fixture
def mock_audio_download(tmp_path):
    """Erstellt temporäre Audiodatei statt Download."""
    audio_file = tmp_path / "test_audio.mp3"
    # Erstelle kleine Test-Audiodatei
    ...
    return audio_file
```

---

## 6. Test-Datenbank

### 6.1 Pytest Fixtures

```python
# conftest.py

@pytest.fixture
async def db():
    """Async DB Session für Tests."""
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def video_factory(db):
    """Factory für Test-Videos."""
    async def create_video(**kwargs):
        video = Video(
            youtube_id=kwargs.get("youtube_id", "test123"),
            title=kwargs.get("title", "Test Video"),
            ...
        )
        db.add(video)
        await db.commit()
        return video
    return create_video


@pytest.fixture
async def enrichment_factory(db, video_factory):
    """Factory für Test-Enrichments."""
    async def create_enrichment(video=None, **kwargs):
        if not video:
            video = await video_factory()
        enrichment = VideoEnrichment(
            video_id=video.id,
            status=kwargs.get("status", "completed"),
            ...
        )
        db.add(enrichment)
        await db.commit()
        return enrichment
    return create_enrichment
```

---

## 7. CI/CD Integration

### 7.1 Test-Befehle

```bash
# Unit Tests (schnell, keine externen Dependencies)
pytest tests/services/enrichment/ -v --cov=app/services/enrichment

# Integration Tests (mit Test-DB)
pytest tests/api/test_enrichment.py tests/workers/test_enrichment.py -v

# Alle Tests
pytest tests/ -v --cov=app --cov-report=html
```

### 7.2 GitHub Actions

```yaml
# .github/workflows/test.yml

jobs:
  test:
    steps:
      - name: Run Unit Tests
        run: pytest tests/services/ -v

      - name: Run Integration Tests
        env:
          DATABASE_URL: postgresql://test@localhost/test_db
        run: pytest tests/api/ tests/workers/ -v
```

---

## 8. Coverage-Ziele

| Bereich | Ziel | Priorität |
|---------|------|-----------|
| VTT Parser | 95%+ | Hoch |
| Enrichment Service | 90%+ | Hoch |
| Audio Chunker | 80%+ | Hoch |
| API Endpoints | 85%+ | Mittel |
| Worker Functions | 80%+ | Mittel |
| Exceptions | 100% | Niedrig |

---

## 9. Test-Datei-Struktur

```
tests/
├── fixtures/
│   ├── sample_captions.vtt
│   ├── sample_chapters.vtt
│   └── groq_response.json
├── services/
│   └── enrichment/
│       ├── providers/
│       │   ├── test_audio_chunker.py
│       │   ├── test_chapter_extractor.py
│       │   ├── test_groq_transcriber.py
│       │   └── test_youtube_captions.py
│       ├── utils/
│       │   ├── test_vtt_parser.py
│       │   └── test_timestamp_utils.py
│       ├── test_enrichment_service.py
│       └── test_exceptions.py
├── api/
│   └── test_enrichment.py
├── workers/
│   └── test_enrichment_worker.py
└── models/
    └── test_video_enrichment.py
```

---

**Exit Condition:** ✅ Vollständige Testing-Strategie mit allen Test-Kategorien
**Nächste Phase:** Atomic Steps
