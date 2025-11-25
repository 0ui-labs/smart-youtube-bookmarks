# US-001: Automatische Video-Anreicherung

## User Story

**Als** Benutzer der Smart YouTube Bookmarks App
**möchte ich**, dass neue Videos automatisch mit Untertiteln und Kapiteln angereichert werden
**damit** ich später bessere Such- und Navigationsmöglichkeiten habe

---

## Akzeptanzkriterien

| # | Kriterium | Testbar |
|---|-----------|---------|
| 1 | Beim Import eines Videos wird automatisch ein Enrichment-Job gestartet | ✅ |
| 2 | Der Enrichment-Prozess läuft im Hintergrund ohne UI-Blockierung | ✅ |
| 3 | Videos bis 4+ Stunden Länge werden erfolgreich verarbeitet | ✅ |
| 4 | YouTube-Captions werden bevorzugt (wenn verfügbar) | ✅ |
| 5 | Fehlt YouTube-Untertitel, wird Groq Whisper verwendet | ✅ |
| 6 | Bei Fehlern wird der Job bis zu 3x wiederholt | ✅ |

---

## UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    VIDEO IMPORT FLOW                        │
└─────────────────────────────────────────────────────────────┘

1. User fügt YouTube-URL hinzu
   │
   ▼
2. Video wird in Liste gespeichert
   │
   ├──────────────────────────┐
   │                          │
   ▼                          ▼
3. YouTube-Metadaten         4. Enrichment-Job gestartet
   werden geholt                (parallel, im Hintergrund)
   │                          │
   ▼                          ▼
5. Video sofort              6. Enrichment läuft:
   sichtbar in Liste            - YouTube Captions prüfen
                                - Falls nötig: Audio → Groq
                                - Chapters extrahieren
                                │
                                ▼
                             7. Enrichment abgeschlossen
                                - Status: completed/failed
                                - Daten verfügbar
```

---

## Daten-Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   YouTube    │────▶│   Backend    │────▶│   Database   │
│   Video URL  │     │   API        │     │   (Video)    │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                            │ enqueue_job('enrich_video')
                            ▼
                     ┌──────────────┐
                     │   ARQ Queue  │
                     │   (Redis)    │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐     ┌──────────────┐
                     │   Worker     │────▶│   Database   │
                     │   Process    │     │ (Enrichment) │
                     └──────────────┘     └──────────────┘
                            │
                   ┌────────┴────────┐
                   ▼                 ▼
            ┌──────────────┐  ┌──────────────┐
            │   YouTube    │  │   Groq API   │
            │   (yt-dlp)   │  │   (Whisper)  │
            └──────────────┘  └──────────────┘
```

---

## Edge Cases

| # | Szenario | Erwartetes Verhalten |
|---|----------|----------------------|
| 1 | Video bereits enriched | Kein neuer Job, bestehende Daten behalten |
| 2 | YouTube nicht erreichbar | Retry nach Backoff, dann Fehler-Status |
| 3 | Groq Rate Limit erreicht | Job wird verzögert wiederholt |
| 4 | Video ist privat/gelöscht | Fehler-Status mit Meldung |
| 5 | Sehr langes Video (4h+) | Audio-Chunking, korrekte Timestamps |
| 6 | Video ohne Audio | Fehler-Status "Kein Audio verfügbar" |
| 7 | Worker-Absturz während Job | Job bleibt "processing", Timeout → Retry |

---

## Technische Details

### Trigger-Punkt

```python
# app/api/videos.py - Nach Video-Erstellung

video = Video(...)
db.add(video)
await db.commit()

# Enrichment-Job starten (fire-and-forget)
if settings.enrichment_enabled:
    arq_pool = await get_arq_pool()
    await arq_pool.enqueue_job('enrich_video', str(video.id))
```

### Job-Konfiguration

```python
# Enrichment-spezifische Timeouts
JOB_TIMEOUT = 30 * 60  # 30 Minuten für lange Videos
MAX_RETRIES = 3
RETRY_DELAYS = [5*60, 15*60, 45*60]  # 5min, 15min, 45min
```

---

## Definition of Done

- [ ] Enrichment-Job wird bei Video-Import automatisch gestartet
- [ ] Worker-Funktion `enrich_video` implementiert
- [ ] YouTube-Captions werden korrekt extrahiert
- [ ] Groq-Transcription funktioniert als Fallback
- [ ] Audio-Chunking für lange Videos implementiert
- [ ] Retry-Logik mit exponential Backoff
- [ ] Unit Tests für EnrichmentService
- [ ] Integration Tests für Worker

---

**Story Points:** 8
**Priorität:** Must Have
**Abhängigkeiten:** Keine (erste Story)
