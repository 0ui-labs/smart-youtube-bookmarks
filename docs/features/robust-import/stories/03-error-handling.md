# User Story 03 - Graceful Error Handling

**Als** Non-Technical User
**Möchte ich** bei Import-Problemen keine technischen Fehlermeldungen sehen
**Damit** ich nicht verwirrt werde und trotzdem meine Videos nutzen kann

## Akzeptanzkriterien

- [ ] User sieht NIEMALS: "Error 429", "Rate Limit Exceeded", Stack Traces
- [ ] Automatische Retries ohne User-Aktion
- [ ] Bei permanentem Fehler: Verständliche Nachricht
- [ ] Video ist IMMER nutzbar (auch ohne Captions)
- [ ] Fehler-Info nur am Ende des Imports (nicht während)

## UX Flow - Retry Scenario

```
┌─────────────────────────────────────────────────────────────────┐
│  HINTERGRUND (unsichtbar)         │  UI (was User sieht)        │
├─────────────────────────────────────────────────────────────────┤
│  1. yt-dlp request failed         │  Video bei 25%              │
│     (network timeout)             │  (keine Änderung)           │
├─────────────────────────────────────────────────────────────────┤
│  2. Retry 1 nach 2 Sekunden       │  Video bei 25%              │
│     (auch fehlgeschlagen)         │  (keine Änderung)           │
├─────────────────────────────────────────────────────────────────┤
│  3. Retry 2 nach 4 Sekunden       │  Video bei 25%              │
│     (auch fehlgeschlagen)         │  (keine Änderung)           │
├─────────────────────────────────────────────────────────────────┤
│  4. Retry 3 nach 8 Sekunden       │  Video bei 25%              │
│     (erfolg!)                     │  → 25% → 60% → 100%         │
└─────────────────────────────────────────────────────────────────┘

User Experience: Video brauchte ~20 Sekunden statt ~5 Sekunden.
User hat NICHTS von den Retries mitbekommen.
```

## UX Flow - Fallback Scenario (Captions)

```
┌─────────────────────────────────────────────────────────────────┐
│  HINTERGRUND                      │  UI (was User sieht)        │
├─────────────────────────────────────────────────────────────────┤
│  1. Metadata erfolgreich          │  Video: 0% → 25%            │
├─────────────────────────────────────────────────────────────────┤
│  2. YouTube Captions: 3 Retries   │  Video bleibt bei 25%       │
│     alle fehlgeschlagen           │  (etwas länger als normal)  │
├─────────────────────────────────────────────────────────────────┤
│  3. Fallback: Groq Whisper        │  Video: 25% → 60%           │
│     Audio herunterladen           │  (normal weiter)            │
│     Transkribieren                │                             │
├─────────────────────────────────────────────────────────────────┤
│  4. Captions via Whisper OK       │  Video: 60% → 90% → 100%    │
│                                   │  Video vollständig          │
└─────────────────────────────────────────────────────────────────┘

User Experience: Video brauchte ~15 Sekunden statt ~5 Sekunden.
User hat NICHTS vom Fallback mitbekommen.
Captions sind vorhanden (via Whisper generiert).
```

## UX Flow - Permanent Failure

```
┌─────────────────────────────────────────────────────────────────┐
│  HINTERGRUND                      │  UI (was User sieht)        │
├─────────────────────────────────────────────────────────────────┤
│  1. Metadata: 3 Retries failed    │  Video bei 0% für ~15s      │
│     (Video ist privat)            │                             │
├─────────────────────────────────────────────────────────────────┤
│  2. Backend gibt auf              │  Video wird rot getönt      │
│                                   │  Kleines ⚠️ Icon erscheint  │
├─────────────────────────────────────────────────────────────────┤
│  3. User hovert über Video        │  Tooltip: "Dieses Video     │
│                                   │  konnte nicht geladen       │
│                                   │  werden - eventuell privat  │
│                                   │  oder gelöscht"             │
├─────────────────────────────────────────────────────────────────┤
│  4. User kann Video löschen       │  "Entfernen" Button im      │
│     oder ignorieren               │  Tooltip                    │
└─────────────────────────────────────────────────────────────────┘

User sieht NICHT:
- "Error: Private video"
- "HTTPError 403 Forbidden"
- "yt-dlp extract_info failed"
```

## UX Flow - Captions Unavailable (OK)

```
┌─────────────────────────────────────────────────────────────────┐
│  HINTERGRUND                      │  UI (was User sieht)        │
├─────────────────────────────────────────────────────────────────┤
│  1. Metadata: OK                  │  Video: 0% → 25%            │
├─────────────────────────────────────────────────────────────────┤
│  2. YouTube Captions: failed      │  Video bleibt bei 25%       │
│     Groq Whisper: auch failed     │  (etwas länger)             │
│     (Audio zu lang für Whisper)   │                             │
├─────────────────────────────────────────────────────────────────┤
│  3. Backend: Skip Captions        │  Video: 25% → 90% → 100%    │
│     Chapters: OK                  │  Video wird farbig          │
├─────────────────────────────────────────────────────────────────┤
│  4. Video vollständig             │  Kleines 📝❌ Icon          │
│     (aber ohne Captions)          │  (diskret, nicht rot)       │
├─────────────────────────────────────────────────────────────────┤
│  5. User klickt auf Video         │  Video Player öffnet        │
│                                   │  Hinweis: "Untertitel nicht │
│                                   │  verfügbar für dieses Video"│
└─────────────────────────────────────────────────────────────────┘

User sieht NICHT:
- "Whisper API Error"
- "Audio extraction failed"
- Rote Fehlermeldungen

Video ist VOLL NUTZBAR - nur ohne Captions.
```

## Error Messages (User-Facing)

| Technischer Fehler | User sieht |
|--------------------|------------|
| `403 Forbidden` | "Video nicht verfügbar" |
| `404 Not Found` | "Video nicht gefunden" |
| `429 Rate Limit` | (nichts - automatischer Retry) |
| `Network Timeout` | (nichts - automatischer Retry) |
| `Whisper Failed` | "Untertitel nicht verfügbar" |
| `Private Video` | "Video eventuell privat" |

## Batch Error Summary

Am Ende eines Batch-Imports mit Fehlern:

```
┌────────────────────────────────────────────┐
│  ✅ Import abgeschlossen                   │
│                                            │
│  47 Videos erfolgreich importiert          │
│  2 Videos ohne Untertitel                  │
│  1 Video nicht verfügbar                   │
│                                            │
│  [Details ansehen]  [Schließen]            │
└────────────────────────────────────────────┘
```

**NICHT:**
```
Error: 3 videos failed
- dQw4w9WgXcQ: yt-dlp extract_info failed with code 403
- abc123: Network timeout after 30s
- xyz789: Whisper API returned 500
```

## Technische Details

### Error Classification
```python
class ErrorClassifier:
    @staticmethod
    def classify(error: Exception) -> tuple[str, bool]:
        """Returns (user_message, should_retry)"""

        if isinstance(error, HTTPError):
            if error.status == 403:
                return ("Video nicht verfügbar", False)
            if error.status == 404:
                return ("Video nicht gefunden", False)
            if error.status == 429:
                return (None, True)  # Silent retry

        if isinstance(error, TimeoutError):
            return (None, True)  # Silent retry

        if isinstance(error, WhisperError):
            return ("Untertitel nicht verfügbar", False)

        # Unbekannter Fehler
        return ("Verarbeitung fehlgeschlagen", False)
```

### Retry Strategy
```python
async def enrich_with_retries(video_id: str, max_retries: int = 3):
    for attempt in range(max_retries + 1):
        try:
            return await enrich_video(video_id)
        except Exception as e:
            user_msg, should_retry = ErrorClassifier.classify(e)

            if should_retry and attempt < max_retries:
                delay = 2 ** attempt  # Exponential backoff
                await asyncio.sleep(delay)
                continue

            # Permanent failure
            if user_msg:
                await mark_video_error(video_id, user_msg)
            raise
```

## Metriken

| Metrik | Ziel | Messung |
|--------|------|---------|
| Retry Success Rate | > 80% | Retries die erfolgreich waren |
| User-Visible Errors | < 2% | Fehler die User sieht / Imports |
| Fallback Usage | < 10% | Groq Whisper Calls / Imports |
