# Robust Video Import - Design Document

## Ziel

Ein Import-System das "wie ein Schweizer Uhrwerk" läuft:
- 100% zuverlässig
- Sofortiges visuelles Feedback
- Automatische Fehlerbehandlung
- Keine technischen Fragen an User

## User Experience

### Einzelne Videos (1-5)
- Videos erscheinen **instant** im Grid (ausgegraut)
- Tortenoverlay zeigt Fortschritt
- Nach 2-5 Sekunden: farbig + klickbar
- Fühlt sich "instant" an

### Batch-Import (20-1000)
- ALLE Videos erscheinen **sofort** als graue Kacheln
- Tortenoverlay pro Video (iOS App-Update Style)
- Torten füllen sich in Wellen (nicht alle gleichzeitig)
- Erst bei 100%: farbig + klickbar

### Fehlerfall
- User sieht NIE technische Fehlermeldungen während Import
- Automatische Retries im Hintergrund
- Nur am Ende, falls nötig: verständliche Info
  - "3 Videos konnten keine Untertitel laden - du kannst sie trotzdem ansehen"

## Technische Architektur

### Import-Phasen (aus User-Sicht: EIN Prozess)

```
Sekunde 0 - Instant Visibility:
├── YouTube-IDs aus Links extrahieren (regex, lokal)
├── Video-Records in DB erstellen (status: "importing")
├── Thumbnail-URL generieren (YouTube CDN, immer verfügbar)
└── → Video erscheint ausgegraut im Grid (0%)

Sekunde 1-5 - Background Enrichment:
├── Metadata holen (Titel, Channel, Dauer)      → 25%
├── Captions holen (Untertitel)                 → 60%
├── Chapters extrahieren (Kapitel)              → 90%
├── Finalisieren                                → 100%
└── → Video wird farbig + klickbar
```

### Progress-Stages

| Stage | Progress | Beschreibung |
|-------|----------|--------------|
| Created | 0% | Video im Grid sichtbar (grau) |
| Metadata | 25% | Titel, Channel, Dauer geholt |
| Captions | 60% | Untertitel extrahiert |
| Chapters | 90% | Kapitel geparst |
| Complete | 100% | Farbig, klickbar |

### Methoden-Stack

| Methode | Zweck | Zuverlässigkeit |
|---------|-------|-----------------|
| **YouTube CDN** | Thumbnails | 100% (direkter CDN-Zugriff) |
| **yt-dlp extract_info** | Metadata | 99% (kein API-Key nötig) |
| **yt-dlp subtitles** | Captions primär | 95% (Rate Limiting möglich) |
| **Groq Whisper** | Captions Fallback | 99% (kostenpflichtig, ~$0.01/Video) |
| **Description Parser** | Chapters Fallback | 100% (lokale Regex) |

### Fehlerbehandlung (Retry-Strategie)

```
Versuch 1: yt-dlp
    ↓ Fehler?
Warte 2 Sekunden
    ↓
Versuch 2: yt-dlp
    ↓ Fehler?
Warte 4 Sekunden
    ↓
Versuch 3: yt-dlp
    ↓ Fehler?
Fallback: Groq Whisper (für Captions)
    ↓ Fehler?
Import ohne Captions (Video trotzdem nutzbar)
```

### Rate Limiting (Batch-Import)

```
Bei 4+ Videos:
├── Max 3-5 Videos parallel verarbeiten
├── 2 Sekunden Pause zwischen YouTube-Anfragen
├── Circuit Breaker: Bei 3 Fehlern → längere Pause
└── Adaptive: Bei 429-Response → automatisch langsamer
```

### WebSocket Progress-Updates

```typescript
// Frontend erhält Live-Updates
{
  video_id: "abc123",
  progress: 60,
  stage: "captions",
  message: null  // Nur bei Fehler am Ende
}
```

### Datenbank-Schema Erweiterungen

```sql
-- Videos Tabelle: Neues Feld
ALTER TABLE videos ADD COLUMN import_progress INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN import_stage VARCHAR(20) DEFAULT 'pending';

-- Import Stages: pending → metadata → captions → chapters → complete → error
```

## UI-Komponenten

### Tortenoverlay (iOS-Style)

```
┌─────────────────┐
│  ▓▓▓▓▓▓░░░░░░  │  ← Grauer Kreis, füllt sich
│    Thumbnail    │
│   (ausgegraut)  │
│                 │
│      60%        │  ← Optional: Prozent-Zahl
└─────────────────┘
```

### Zustände

| Zustand | Visuell | Interaktiv |
|---------|---------|------------|
| Importing | Grau + Tortenoverlay | Nicht klickbar |
| Complete | Farbig, kein Overlay | Klickbar |
| Error | Farbig + kleines Warn-Icon | Klickbar (mit Info) |

## Implementierungs-Reihenfolge

1. **Backend: Two-Phase Import**
   - Sofortige Video-Erstellung mit Thumbnail
   - Background-Job für Enrichment
   - Progress-Tracking in DB

2. **Backend: Retry-Logik**
   - Exponential Backoff
   - Groq Whisper Fallback
   - Circuit Breaker

3. **Backend: WebSocket Progress**
   - Real-time Updates pro Video
   - Batch-Progress-Aggregation

4. **Frontend: Tortenoverlay**
   - CSS/SVG Animation
   - Ausgegraut/Farbig States

5. **Frontend: Progress-Integration**
   - WebSocket Listener
   - Optimistic UI Updates

## Erfolgskriterien

- [ ] 1-3 Videos fühlen sich "instant" an (< 3s bis klickbar)
- [ ] 100 Videos importieren ohne einen einzigen Fehler
- [ ] Bei YouTube Rate-Limiting: automatisches Recovery
- [ ] User sieht NIE technische Fehlermeldungen
- [ ] Tortenoverlay ist smooth (60fps)
