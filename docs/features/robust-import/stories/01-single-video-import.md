# User Story 01 - Single Video Import

**Als** YouTube-Power-User
**Möchte ich** ein einzelnes Video per Drag & Drop importieren
**Damit** ich sofort sehe dass mein Import läuft und das Video schnell nutzbar ist

## Akzeptanzkriterien

- [ ] Video erscheint SOFORT (< 500ms) im Grid nach Drop
- [ ] Video ist ausgegraut mit Tortenoverlay
- [ ] Tortenoverlay zeigt Fortschritt: 0% → 25% → 60% → 90% → 100%
- [ ] Bei 100%: Video wird farbig und klickbar
- [ ] Gesamtzeit: < 5 Sekunden

## UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  AKTION                           │  UI RESPONSE                │
├─────────────────────────────────────────────────────────────────┤
│  1. User zieht YouTube-Link       │  Drop-Zone erscheint        │
│     auf Video-Grid                │  (bereits implementiert)    │
├─────────────────────────────────────────────────────────────────┤
│  2. User lässt Link los           │  Sofort: Graue Video-Kachel │
│     (Drop)                        │  mit 0% Torte erscheint     │
│                                   │  am Anfang des Grids        │
├─────────────────────────────────────────────────────────────────┤
│  3. Backend holt Metadata         │  Torte: 0% → 25%            │
│     (Titel, Channel, Dauer)       │  (~1 Sekunde)               │
├─────────────────────────────────────────────────────────────────┤
│  4. Backend holt Captions         │  Torte: 25% → 60%           │
│     (Untertitel extrahieren)      │  (~2-3 Sekunden)            │
├─────────────────────────────────────────────────────────────────┤
│  5. Backend extrahiert Chapters   │  Torte: 60% → 90%           │
│     (Kapitel parsen)              │  (~0.5 Sekunden)            │
├─────────────────────────────────────────────────────────────────┤
│  6. Finalisierung                 │  Torte: 90% → 100%          │
│                                   │  Video wird farbig          │
│                                   │  Overlay verschwindet       │
│                                   │  Video ist klickbar         │
└─────────────────────────────────────────────────────────────────┘
```

## Edge Cases

### Video existiert bereits
```
User droppt Link → Backend prüft youtube_id
                → 409 Conflict Response
                → Toast: "Video ist bereits in der Liste"
                → Kein neues Video erstellt
```

### Video ist privat/unavailable
```
User droppt Link → Video erscheint grau (0%)
                → Metadata-Fetch schlägt fehl
                → Retries (3x mit Backoff)
                → Nach Retries: Video wird rot markiert
                → Tooltip: "Video nicht verfügbar"
                → User kann manuell löschen
```

### Netzwerk-Unterbrechung
```
User droppt Link → Video erscheint grau (0%)
                → WebSocket verbindung bricht ab
                → Frontend: Fallback auf Polling
                → Progress Updates via HTTP
                → Video wird trotzdem fertig
```

## Technische Details

### Backend-Flow
```python
POST /videos { url: "https://youtube.com/watch?v=xyz" }
    │
    ├── 1. Parse YouTube ID → "xyz"
    ├── 2. Check Duplicate → 409 wenn existiert
    ├── 3. Create Video Record:
    │      - youtube_id: "xyz"
    │      - import_stage: "created"
    │      - import_progress: 0
    │      - thumbnail_url: "img.youtube.com/vi/xyz/mqdefault.jpg"
    ├── 4. Response → { id, youtube_id, thumbnail_url, import_stage }
    └── 5. Enqueue: enrich_video_with_progress(video_id)

Background Job:
    ├── Stage: metadata (25%) → yt-dlp extract_info
    ├── Stage: captions (60%) → yt-dlp subtitles / Groq fallback
    ├── Stage: chapters (90%) → description parser
    └── Stage: complete (100%) → finalize
```

### Frontend-Flow
```typescript
// 1. Drop Handler
onDrop(url) {
  // Optimistic: Leeres Video sofort anzeigen
  addOptimisticVideo({ youtube_id: extractId(url) })

  // API Call
  const video = await createVideo(url)

  // Replace optimistic mit echtem Video
  replaceOptimisticVideo(video)

  // Subscribe to progress
  subscribeToProgress(video.id)
}

// 2. Progress Updates
onProgressUpdate({ video_id, progress, stage }) {
  updateVideoProgress(video_id, progress, stage)

  if (progress === 100) {
    markVideoComplete(video_id)
    unsubscribeFromProgress(video_id)
  }
}
```

## Metriken

| Metrik | Ziel | Messung |
|--------|------|---------|
| Time to Visibility | < 500ms | Zeitpunkt Drop → Kachel sichtbar |
| Time to Complete | < 5s | Zeitpunkt Drop → Video klickbar |
| Success Rate | > 99% | Erfolgreiche Imports / Versuche |
