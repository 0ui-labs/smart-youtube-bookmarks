# Impact Assessment: Robust Video Import

## Übersicht

**Gesamtkomplexität:** HOCH (8/10)
- Neue Infrastruktur (WebSocket Frontend)
- DB-Schema Erweiterungen
- Worker-Logik Änderungen
- UI-Komponenten Updates

## Betroffene Bereiche

### 1. Backend - API Layer

| Datei | Änderungstyp | Beschreibung |
|-------|--------------|--------------|
| `backend/app/api/videos.py` | ERWEITERN | Two-Phase Import: Sofort Video erstellen, dann enrichen |
| `backend/app/api/websocket.py` | ERWEITERN | Progress-Message Format für Import Stages |
| `backend/app/api/enrichment.py` | MINOR | Optional: Manueller Retry Endpoint |

**Neue Dateien:**
- Keine neuen API-Routen nötig (bestehende erweitern)

### 2. Backend - Models & Database

| Datei | Änderungstyp | Beschreibung |
|-------|--------------|--------------|
| `backend/app/models/video.py` | ERWEITERN | `import_progress`, `import_stage` Felder |
| `backend/app/models/video_enrichment.py` | MINOR | `stage` Feld für granulares Tracking |

**Migration erforderlich:**
```sql
-- Neue Felder für Videos
ALTER TABLE videos ADD COLUMN import_progress INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN import_stage VARCHAR(20) DEFAULT 'created';

-- Index für Stage-basierte Queries
CREATE INDEX idx_videos_import_stage ON videos(import_stage);
```

### 3. Backend - Workers & Services

| Datei | Änderungstyp | Beschreibung |
|-------|--------------|--------------|
| `backend/app/workers/video_processor.py` | MAJOR | Rate Limiting, Exponential Backoff, Stage Updates |
| `backend/app/workers/settings.py` | MINOR | Concurrency Settings anpassen |
| `backend/app/services/enrichment/enrichment_service.py` | MAJOR | Groq Whisper Fallback, Circuit Breaker |

**Neue Dateien:**
| Datei | Beschreibung |
|-------|--------------|
| `backend/app/services/enrichment/groq_transcriber.py` | NEU: Whisper Fallback Provider |
| `backend/app/services/rate_limiter.py` | NEU: Circuit Breaker + Rate Limiting |

### 4. Frontend - Hooks

| Datei | Änderungstyp | Beschreibung |
|-------|--------------|--------------|
| `frontend/src/hooks/useVideos.ts` | MINOR | Optimistic UI für neue Videos |
| `frontend/src/hooks/useVideoEnrichment.ts` | ERWEITERN | Von Polling auf WebSocket migrieren |

**Neue Dateien:**
| Datei | Beschreibung |
|-------|--------------|
| `frontend/src/hooks/useWebSocket.ts` | NEU: WebSocket Connection Hook |
| `frontend/src/hooks/useImportProgress.ts` | NEU: Progress State Management |

### 5. Frontend - Components

| Datei | Änderungstyp | Beschreibung |
|-------|--------------|--------------|
| `frontend/src/components/VideoCard.tsx` | MAJOR | Importing State, Grayscale, Overlay |
| `frontend/src/components/VideoGrid.tsx` | MINOR | Neue Videos am Anfang einfügen |
| `frontend/src/components/JobProgressCard.tsx` | ERWEITERN | Import Batch Progress |

**Neue Dateien:**
| Datei | Beschreibung |
|-------|--------------|
| `frontend/src/components/ProgressOverlay.tsx` | NEU: Tortenoverlay (SVG/CSS) |
| `frontend/src/components/ImportSummary.tsx` | NEU: "X Videos importiert" Toast |

### 6. Frontend - Stores

| Datei | Änderungstyp | Beschreibung |
|-------|--------------|--------------|
| `frontend/src/stores/importDropStore.ts` | ERWEITERN | Progress State für laufende Imports |

**Neue Stores:**
| Datei | Beschreibung |
|-------|--------------|
| `frontend/src/stores/importProgressStore.ts` | NEU: Globaler Import-Progress State |

### 7. Tests

| Bereich | Neue Tests |
|---------|------------|
| Backend Unit | `test_two_phase_import.py`, `test_rate_limiter.py`, `test_groq_fallback.py` |
| Backend Integration | `test_websocket_progress.py`, `test_batch_import.py` |
| Frontend Unit | `ProgressOverlay.test.tsx`, `useWebSocket.test.ts` |
| E2E | `import-single-video.spec.ts`, `import-batch.spec.ts`, `import-with-errors.spec.ts` |

## Datei-Änderungen Matrix

```
                    Backend                         Frontend
              ┌─────────────────────────┐    ┌─────────────────────────┐
              │ api/videos.py      [M]  │    │ VideoCard.tsx      [M]  │
              │ api/websocket.py   [E]  │    │ VideoGrid.tsx      [m]  │
              │ workers/processor  [M]  │    │ useVideos.ts       [m]  │
              │ services/enrichment[M]  │    │ useVideoEnrich.ts  [E]  │
              │ models/video.py    [E]  │    │                         │
              │                         │    │ [NEU] useWebSocket.ts   │
              │ [NEU] rate_limiter.py   │    │ [NEU] ProgressOverlay   │
              │ [NEU] groq_transcriber  │    │ [NEU] ImportSummary     │
              └─────────────────────────┘    └─────────────────────────┘

              [M] = Major Change    [E] = Extend    [m] = Minor
```

## Effort Schätzung

| Bereich | Aufwand | Dateien |
|---------|---------|---------|
| Backend API | Mittel | 2-3 |
| Backend Workers | Hoch | 3-4 |
| Backend Services | Hoch | 2-3 (neu) |
| DB Migration | Niedrig | 1 |
| Frontend Hooks | Mittel | 2-3 (neu) |
| Frontend Components | Mittel | 3-4 |
| Tests | Hoch | 6-8 |
| **GESAMT** | **Hoch** | **~20 Dateien** |

## Abhängigkeiten

```
┌──────────────────────────────────────────────────────────────┐
│ 1. DB Migration (import_progress, import_stage)              │
│    └── Muss zuerst                                           │
├──────────────────────────────────────────────────────────────┤
│ 2. Backend: Rate Limiter + Circuit Breaker                   │
│    └── Unabhängig von Migration                              │
├──────────────────────────────────────────────────────────────┤
│ 3. Backend: Groq Whisper Provider                            │
│    └── Benötigt API Key Config                               │
├──────────────────────────────────────────────────────────────┤
│ 4. Backend: Two-Phase Import + Progress Publishing           │
│    └── Benötigt: Migration, Rate Limiter                     │
├──────────────────────────────────────────────────────────────┤
│ 5. Frontend: useWebSocket Hook                               │
│    └── Unabhängig, aber Backend muss publishen               │
├──────────────────────────────────────────────────────────────┤
│ 6. Frontend: ProgressOverlay + VideoCard Update              │
│    └── Benötigt: useWebSocket                                │
└──────────────────────────────────────────────────────────────┘
```

## Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| WebSocket Auth Issues | Mittel | Hoch | Früh testen, JWT reuse |
| Groq Rate Limits | Niedrig | Mittel | Fallback: Video ohne Captions |
| DB Migration Probleme | Niedrig | Hoch | Non-breaking Felder, Defaults |
| Performance bei 1000 Videos | Mittel | Mittel | Batch-Grenzen, Pagination |

## Exit Condition ✅

**Vollständige Liste aller betroffenen Bereiche?**

> - **Backend:** 7-8 Dateien (3 neu)
> - **Frontend:** 6-7 Dateien (4 neu)
> - **Tests:** 6-8 neue Test-Dateien
> - **DB:** 1 Migration
>
> Hauptrisiko: WebSocket-Integration (Auth + State Management)
> Größter Aufwand: Worker-Logik mit Rate Limiting + Fallbacks

✅ Impact vollständig erfasst, bereit für Phase 4.
