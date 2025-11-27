# Feature Understanding: Robust Video Import

## Feature-Zusammenfassung

Ein komplett überarbeitetes Import-System für YouTube-Videos mit:
- **Instant Visual Feedback**: Videos erscheinen sofort (ausgegraut) im Grid
- **Progress-Tracking**: Tortenoverlay zeigt Enrichment-Fortschritt (iOS-Style)
- **Automatische Fehlerbehandlung**: Retries + Fallbacks ohne User-Interaktion
- **Graceful Degradation**: Videos immer nutzbar, auch ohne Captions

## Warum dieses Feature?

### Aktuelle Probleme (alle bestätigt)
1. **Rate Limiting**: YouTube blockiert bei vielen Anfragen → Import scheitert
2. **UX zu langsam**: User warten ohne Feedback → Frustration
3. **Technische Fehler sichtbar**: Verwirrt nicht-technische User

### Ziel-Zustand
- Import von 100+ Videos ohne einen Fehler
- User sieht NIE technische Fehlermeldungen
- "Feels instant" für 1-5 Videos (< 3 Sekunden bis klickbar)

## Feature-Scope

### In Scope
- Two-Phase Import (instant create → background enrich)
- WebSocket für Real-time Progress (MUSS NEU GEBAUT WERDEN)
- Exponential Backoff + Circuit Breaker
- Groq Whisper Fallback für Captions (KRITISCH, Tag 1)
- Tortenoverlay UI-Komponente
- Rate Limiting für Batch-Imports

### Out of Scope
- Änderungen am Drag & Drop selbst (funktioniert bereits)
- Neue Import-Quellen (nur YouTube)
- Video-Player Änderungen

## User-Flows

### Einzelner Video-Import (1-5 Videos)
```
User droppt Link → Video erscheint sofort grau (0%)
                → Metadata geladen (25%)
                → Captions geladen (60%)
                → Chapters geladen (90%)
                → Video farbig + klickbar (100%)
Gesamt: 2-5 Sekunden
```

### Batch-Import (20-1000 Videos)
```
User droppt viele Links → ALLE Videos erscheinen sofort grau
                       → Torten füllen sich in Wellen
                       → 3-5 Videos parallel verarbeitet
                       → 2 Sek Pause zwischen YouTube-Anfragen
                       → Bei Rate Limit: automatisch langsamer
```

### Fehlerfall
```
yt-dlp schlägt fehl → Retry 1 (nach 2s)
                   → Retry 2 (nach 4s)
                   → Retry 3 (nach 8s)
                   → Groq Whisper Fallback
                   → Falls alles fehlschlägt: Video ohne Captions
User-Kommunikation: "3 Videos konnten keine Untertitel laden"
```

## Kritische Entscheidungen

| Entscheidung | Gewählt | Begründung |
|--------------|---------|------------|
| WebSocket vs Polling | WebSocket | Real-time UX kritisch |
| Groq Whisper Priorität | Tag 1 | Captions sind core feature |
| Progress Granularität | 4 Stages | Balance zwischen Info und Komplexität |
| Fehler-Kommunikation | Nur am Ende | User nicht während Import stören |

## Exit Condition ✅

**Kann ich das Feature in 2-3 Sätzen erklären?**

> Ein Import-System das Videos sofort im Grid anzeigt (ausgegraut) und im Hintergrund
> mit Metadata, Captions und Chapters anreichert. Progress wird live per WebSocket
> gestreamt und als Tortenoverlay visualisiert. Bei Fehlern gibt es automatische
> Retries und Groq Whisper als Fallback - der User sieht nie technische Fehlermeldungen.

✅ Feature verstanden, bereit für Phase 2.
