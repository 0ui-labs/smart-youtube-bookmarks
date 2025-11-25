# User Story 02: Fortschritt speichern & fortsetzen

**Als** Benutzer
**Möchte ich** dass mein Wiedergabe-Fortschritt automatisch gespeichert wird
**Damit** ich später an derselben Stelle weiterschauen kann

## UX Flow

1. User startet Video-Wiedergabe
   → Player beginnt bei gespeicherter Position (oder 0:00 wenn neu)

2. User schaut Video
   → Fortschritt wird alle 10 Sekunden im Backend gespeichert
   → Fortschritt wird auch bei Pause gespeichert

3. User schließt App oder navigiert weg
   → Letzter Fortschritt ist im Backend gespeichert

4. User öffnet dasselbe Video später
   → Player lädt mit gespeicherter Position
   → User kann sofort weiterschauen

5. User schaut Video zu Ende
   → Fortschritt wird auf 0 zurückgesetzt (optional: als "gesehen" markieren)

## Akzeptanzkriterien

- [ ] Fortschritt wird automatisch gespeichert (debounced, alle 10s)
- [ ] Fortschritt wird bei Pause sofort gespeichert
- [ ] Video startet an gespeicherter Position
- [ ] Position wird in VideoResponse zurückgegeben
- [ ] API: PATCH /videos/{id}/progress funktioniert

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Video < 30 Sekunden | Kein Fortschritt speichern |
| Video zu 95%+ geschaut | Position auf 0 setzen (fertig geschaut) |
| Backend nicht erreichbar | Lokaler Fallback (localStorage) |
| Mehrere Tabs offen | Letzter Tab gewinnt |
| Offline-Modus | Lokaler Fallback, Sync bei Reconnect |

## API-Spezifikation

```
PATCH /api/videos/{video_id}/progress
Request:
{
  "position": 125  // Sekunden
}

Response:
{
  "video_id": "uuid",
  "watch_position": 125,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

## Technische Notizen

- Plyr `timeupdate` Event für Position
- Debounce mit 10 Sekunden Interval
- `beforeunload` Event für finalen Sync
- React Query Mutation für API-Call
