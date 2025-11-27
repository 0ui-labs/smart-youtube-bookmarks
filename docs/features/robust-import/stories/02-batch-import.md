# User Story 02 - Batch Import (20-1000 Videos)

**Als** Researcher/Content-Curator
**Möchte ich** viele Videos auf einmal importieren (CSV oder Multi-Link)
**Damit** ich meine Video-Sammlung schnell aufbauen kann ohne einzeln zu importieren

## Akzeptanzkriterien

- [ ] ALLE Videos erscheinen SOFORT als graue Kacheln
- [ ] Jedes Video hat eigenen Tortenoverlay
- [ ] Videos werden in Wellen verarbeitet (nicht alle gleichzeitig)
- [ ] Max 3-5 Videos parallel (Rate Limiting)
- [ ] Bei Rate Limit: Automatische Pause, keine User-Aktion nötig
- [ ] 100 Videos ohne Fehler importierbar

## UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  AKTION                           │  UI RESPONSE                │
├─────────────────────────────────────────────────────────────────┤
│  1. User droppt CSV mit           │  Import-Preview Modal       │
│     50 YouTube-Links              │  zeigt: "50 Videos gefunden"│
├─────────────────────────────────────────────────────────────────┤
│  2. User klickt "Importieren"     │  Modal schließt             │
│                                   │  50 graue Kacheln erscheinen│
│                                   │  alle mit 0% Torte          │
├─────────────────────────────────────────────────────────────────┤
│  3. Backend startet Batch         │  Erste 3 Videos: 0% → 25%   │
│     (3 parallel)                  │  Restliche: bleiben bei 0%  │
├─────────────────────────────────────────────────────────────────┤
│  4. Erste Welle fertig            │  Videos 1-3: 100% (farbig)  │
│     (nach ~5 Sekunden)            │  Videos 4-6: 0% → 25%       │
├─────────────────────────────────────────────────────────────────┤
│  5. YouTube Rate Limit            │  Videos 7-9: pausieren      │
│     (429 Response)                │  Banner: "Kurze Pause..."   │
│                                   │  (verschwindet nach 30s)    │
├─────────────────────────────────────────────────────────────────┤
│  6. Import komplett               │  Alle Videos farbig         │
│     (~2-3 Minuten für 50)         │  Toast: "50 Videos import." │
└─────────────────────────────────────────────────────────────────┘
```

## Wellenverarbeitung

```
Zeit    │  Video 1-3   │  Video 4-6   │  Video 7-9   │  ...
────────┼──────────────┼──────────────┼──────────────┼────────
0s      │  Start (0%)  │  Warten      │  Warten      │
2s      │  Metadata    │  Warten      │  Warten      │
5s      │  Captions    │  Warten      │  Warten      │
8s      │  Complete ✓  │  Start (0%)  │  Warten      │
10s     │  ✓           │  Metadata    │  Warten      │
13s     │  ✓           │  Captions    │  Warten      │
16s     │  ✓           │  Complete ✓  │  Start (0%)  │
...
```

## Edge Cases

### YouTube Rate Limiting (429)
```
Videos 1-20 importiert → YouTube gibt 429 zurück
                       → Circuit Breaker öffnet
                       → UI: "Kurze Pause wegen YouTube-Limits"
                       → 30 Sekunden Cooldown
                       → Circuit Breaker schließt
                       → Import setzt fort
                       → Kein manuelles Eingreifen nötig
```

### Einige Videos nicht verfügbar
```
50 Videos im Batch → 47 erfolgreich
                   → 3 Videos nicht verfügbar/privat
                   → Diese 3: rot markiert im Grid
                   → Am Ende Toast: "47 Videos importiert, 3 nicht verfügbar"
                   → User kann rote Videos manuell entfernen
```

### User schließt Browser während Import
```
User startet 100er-Import → 30 Videos fertig
                         → User schließt Tab
                         → Backend: Jobs laufen weiter
                         → User öffnet Tab wieder
                         → WebSocket reconnect
                         → UI synct: 30 fertig, 70 in Progress
                         → Import setzt fort
```

### Duplicates im Batch
```
CSV enthält 50 Links → 10 davon existieren bereits
                    → Backend: 10x 409 Conflict
                    → UI: Diese 10 werden nicht angezeigt
                    → Toast: "40 neue Videos, 10 bereits vorhanden"
```

## Technische Details

### Backend-Flow
```python
POST /videos/batch { urls: ["url1", "url2", ..., "url50"] }
    │
    ├── 1. Parse alle YouTube IDs
    ├── 2. Filter Duplicates (bereits in Liste)
    ├── 3. Bulk Insert Video Records:
    │      - Alle mit import_stage="created"
    │      - Alle mit import_progress=0
    ├── 4. Response → { created: 40, duplicates: 10, videos: [...] }
    └── 5. Enqueue Batch-Job:
           enqueue_job('process_batch', video_ids, rate_limit=True)

Batch-Job mit Rate Limiting:
    rate_limiter = RateLimiter(max_concurrent=3, delay=2.0)

    for video_id in video_ids:
        async with rate_limiter.acquire():
            await enrich_video_with_progress(video_id)
```

### Rate Limiter Logic
```python
class BatchRateLimiter:
    def __init__(self):
        self.semaphore = asyncio.Semaphore(3)  # Max 3 parallel
        self.delay = 2.0  # 2s zwischen Anfragen
        self.failure_count = 0
        self.circuit_open = False

    async def acquire(self):
        # Circuit Breaker Check
        if self.circuit_open:
            await asyncio.sleep(30)  # 30s Cooldown
            self.circuit_open = False

        async with self.semaphore:
            await asyncio.sleep(self.delay)
            yield

    def record_failure(self):
        self.failure_count += 1
        if self.failure_count >= 3:
            self.circuit_open = True
            self.failure_count = 0

    def record_success(self):
        self.failure_count = 0
```

### Frontend-Flow
```typescript
// 1. Batch Import starten
async function startBatchImport(urls: string[]) {
  // Sofort: Optimistic Videos erstellen
  const optimisticVideos = urls.map(url => ({
    id: `temp-${uuid()}`,
    youtube_id: extractId(url),
    import_progress: 0,
    import_stage: 'pending'
  }))
  addVideosToGrid(optimisticVideos)

  // API Call
  const { videos, duplicates } = await api.batchImport(urls)

  // Ersetze optimistic mit echten Videos
  replaceOptimisticVideos(videos)

  // Subscribe zu allen Videos
  videos.forEach(v => subscribeToProgress(v.id))

  // Info über Duplicates
  if (duplicates > 0) {
    showToast(`${duplicates} Videos bereits vorhanden`)
  }
}

// 2. Batch-Progress Aggregation
function useBatchProgress(videoIds: string[]) {
  const progress = useVideoProgress(videoIds)

  const completed = progress.filter(p => p.progress === 100).length
  const failed = progress.filter(p => p.stage === 'error').length
  const total = videoIds.length

  return {
    completed,
    failed,
    pending: total - completed - failed,
    percent: Math.round((completed / total) * 100)
  }
}
```

## Metriken

| Metrik | Ziel | Messung |
|--------|------|---------|
| Time to All Visible | < 2s | Zeitpunkt Confirm → alle Kacheln sichtbar |
| Throughput | ~10 Videos/min | Fertige Videos / Zeit |
| Rate Limit Recovery | < 60s | Zeit bis Import fortsetzt |
| Success Rate (100 Videos) | > 95% | Erfolgreiche / Gesamt |
