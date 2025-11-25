# Video Enrichment Feature

Automatische Anreicherung von YouTube-Videos mit Untertiteln, Kapiteln und durchsuchbaren Transkripten.

## Feature-Übersicht

Das Video Enrichment Feature reichert YouTube Videos automatisch mit:
- **Untertiteln** (YouTube Captions oder Groq Whisper Transcription)
- **Kapiteln** (YouTube oder aus Beschreibung extrahiert)
- **Durchsuchbaren Transkripten** (Volltextsuche über alle Videos)

### Kern-Architektur

```
Video Import → ARQ Job → EnrichmentService → Provider-Kette → VideoEnrichment
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              YouTube         Groq Whisper    Chapter
              Captions        (Fallback)      Extractor
```

---

## Dokumentations-Übersicht

| Phase | Dokument | Inhalt |
|-------|----------|--------|
| 1 | [understanding.md](./understanding.md) | Feature-Anforderungen, Use Cases, Constraints |
| 2 | [codebase-analysis.md](./codebase-analysis.md) | Bestehende Architektur, Integrationspunkte |
| 3 | [impact.md](./impact.md) | Betroffene Dateien, Risiko-Analyse |
| 4 | [integration.md](./integration.md) | Provider Pattern, Audio-Chunking-Strategie |
| 5 | [compatibility.md](./compatibility.md) | Backward Compatibility, Rollback-Strategie |
| 6 | [stories/](./stories/) | 7 User Stories (45 Story Points) |
| 7 | [ui-integration.md](./ui-integration.md) | Frontend-Komponenten, Hooks |
| 8 | [plan.md](./plan.md) | Implementierungsplan in 4 Phasen |
| 9 | [testing.md](./testing.md) | Unit/Integration/E2E Tests |
| 10 | [atomic-steps.md](./atomic-steps.md) | 30+ atomare Implementierungsschritte |
| 11 | [research.md](./research.md) | Validierte technische Entscheidungen |

---

## Quick Facts

| Aspekt | Wert |
|--------|------|
| Gesamtkomplexität | Hoch |
| Story Points | 45 |
| Neue Backend-Dateien | ~14 |
| Neue Frontend-Dateien | 5 |
| Modifizierte Dateien | 6 |
| Externe Dependencies | yt-dlp, groq, pydub, ffmpeg |

---

## Kritische Entscheidungen

### 1. Audio-Chunking ist MANDATORY

Videos können 4+ Stunden lang sein. Groq hat ein 25 MB Limit.

```
2h Video @ 128kbps = ~115 MB Audio
→ Muss in 10-Minuten Chunks gesplittet werden (~4.6 MB @ 64kbps)
```

### 2. Provider Pattern für Flexibilität

```python
caption_providers = [
    YoutubeCaptionProvider(),  # Erst YouTube versuchen
    GroqWhisperProvider(),     # Dann Groq als Fallback
]
```

### 3. Separate VideoEnrichment Tabelle

Kein Ändern des Video-Models. Additive Migration, einfacher Rollback.

---

## Implementierungs-Reihenfolge

### Sprint 1: Kern-Infrastruktur
1. VideoEnrichment Model + Migration
2. Audio Chunker (pydub + ffmpeg)
3. YouTube Caption Provider (yt-dlp)
4. Groq Transcriber mit Chunk-Merge
5. EnrichmentService

### Sprint 2: API + Worker
6. Enrichment API Endpoints
7. ARQ Worker Function
8. Video Import Hook

### Sprint 3: Frontend
9. useVideoEnrichment Hook
10. EnrichmentStatus Komponente
11. ChapterList Komponente
12. VideoDetailsPage Integration

### Sprint 4: Suche
13. PostgreSQL Full-Text Search
14. Search UI

---

## Voraussetzungen

### System
- FFmpeg installiert (`brew install ffmpeg`)
- Redis für ARQ (bereits vorhanden)

### Environment Variables
```bash
GROQ_API_KEY=gsk_...
ENRICHMENT_ENABLED=true  # Feature Flag
```

### Python Packages
```
yt-dlp
groq
pydub
```

---

## Kosten-Schätzung (Groq)

| Videos/Monat | Durchschnittliche Länge | Kosten |
|--------------|------------------------|--------|
| 50 | 30 min | ~$1.00 |
| 100 | 30 min | ~$2.00 |
| 200 | 30 min | ~$4.00 |

---

## Feature Flag

Das Feature kann jederzeit deaktiviert werden:

```bash
ENRICHMENT_ENABLED=false
```

- Neue Videos bekommen kein Enrichment
- Bestehende Videos funktionieren weiter
- API gibt 503 für Enrichment-Endpoints

---

## Weiterführende Dokumente

- [User Stories](./stories/README.md) - Detaillierte Story-Beschreibungen
- [Atomic Steps](./atomic-steps.md) - Schritt-für-Schritt Implementierung
- [Research](./research.md) - Technische Validierung mit Quellen

---

**Status:** Planung abgeschlossen, bereit für Implementierung
