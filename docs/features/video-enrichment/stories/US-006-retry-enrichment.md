# US-006: Retry bei fehlgeschlagener Anreicherung

## User Story

**Als** Benutzer der Smart YouTube Bookmarks App
**möchte ich** eine fehlgeschlagene Anreicherung erneut starten können
**damit** ich bei temporären Fehlern eine zweite Chance habe

---

## Akzeptanzkriterien

| # | Kriterium | Testbar |
|---|-----------|---------|
| 1 | Retry-Button wird bei "failed" Status angezeigt | ✅ |
| 2 | Klick startet neuen Enrichment-Job | ✅ |
| 3 | Status wechselt zu "processing" nach Retry | ✅ |
| 4 | Automatische Retries bei temporären Fehlern | ✅ |
| 5 | Max 3 automatische Retries mit Backoff | ✅ |
| 6 | Manuelle Retries immer möglich | ✅ |

---

## UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   FAILED STATE                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ❌ Anreicherung fehlgeschlagen                              │
│                                                             │
│ Fehler: Groq API nicht erreichbar (429 Too Many Requests)  │
│                                                             │
│ Automatische Retries: 3/3 erschöpft                        │
│ Letzer Versuch: vor 2 Stunden                              │
│                                                             │
│ ┌──────────────────────┐                                   │
│ │  🔄 Erneut versuchen │                                   │
│ └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘

                          │
                          │ Klick
                          ▼

┌─────────────────────────────────────────────────────────────┐
│ 🔄 Wird verarbeitet...                                      │
│                                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0%                │
│                                                             │
│ Retry gestartet...                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Fehler-Kategorien

| Kategorie | Beispiele | Auto-Retry | Backoff |
|-----------|-----------|------------|---------|
| **Temporär** | Rate Limit, Timeout, 5xx | Ja | Exponential |
| **Permanent** | Video privat, 404 | Nein | - |
| **Konfiguration** | API Key fehlt | Nein | - |

---

## Automatische Retry-Logik

```python
# services/enrichment/enrichment_service.py

class EnrichmentService:
    MAX_AUTO_RETRIES = 3
    RETRY_DELAYS = [5 * 60, 15 * 60, 45 * 60]  # 5min, 15min, 45min

    async def enrich_with_retry(self, video_id: UUID) -> VideoEnrichment:
        enrichment = await self._get_or_create_enrichment(video_id)

        try:
            return await self._enrich_video(enrichment)
        except TemporaryError as e:
            # Retry bei temporären Fehlern
            if enrichment.retry_count < self.MAX_AUTO_RETRIES:
                enrichment.retry_count += 1
                enrichment.error_message = str(e)
                enrichment.status = 'pending'

                # Nächsten Retry schedulen
                delay = self.RETRY_DELAYS[enrichment.retry_count - 1]
                await self.arq_pool.enqueue_job(
                    'enrich_video',
                    str(video_id),
                    _defer_by=delay
                )
                logger.info(f"Scheduled retry {enrichment.retry_count} in {delay}s")
            else:
                enrichment.status = 'failed'
                enrichment.error_message = f"Max retries exceeded: {e}"

            await self.db.commit()
            return enrichment

        except PermanentError as e:
            # Keine Retries bei permanenten Fehlern
            enrichment.status = 'failed'
            enrichment.error_message = str(e)
            await self.db.commit()
            return enrichment
```

---

## API Endpoint für manuellen Retry

```python
# app/api/enrichment.py

@router.post("/{video_id}/enrichment/retry")
async def retry_enrichment(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    arq_pool = Depends(get_arq_pool),
) -> EnrichmentResponse:
    """
    Startet Enrichment-Prozess erneut.
    Kann auch nach Max Auto-Retries aufgerufen werden.
    """
    enrichment = await db.get(VideoEnrichment, video_id)

    if not enrichment:
        raise HTTPException(404, "Enrichment not found")

    if enrichment.status == 'processing':
        raise HTTPException(409, "Enrichment already in progress")

    # Reset für manuellen Retry
    enrichment.status = 'pending'
    enrichment.error_message = None
    enrichment.retry_count = 0  # Reset nur bei manuellem Retry
    await db.commit()

    # Job starten
    await arq_pool.enqueue_job('enrich_video', str(video_id))

    return EnrichmentResponse.from_model(enrichment)
```

---

## Frontend Retry-Integration

```typescript
// hooks/useVideoEnrichment.ts

export function useRetryEnrichment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoId: string) => {
      const { data } = await api.post(`/videos/${videoId}/enrichment/retry`)
      return data
    },
    onSuccess: (data, videoId) => {
      // Cache invalidieren für sofortiges UI-Update
      queryClient.invalidateQueries(['video-enrichment', videoId])

      // Optional: Toast-Nachricht
      toast.success('Enrichment neu gestartet')
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        toast.info('Enrichment läuft bereits')
      } else {
        toast.error('Retry fehlgeschlagen')
      }
    }
  })
}

// In EnrichmentStatus Komponente
const retryMutation = useRetryEnrichment()

<button
  onClick={() => retryMutation.mutate(videoId)}
  disabled={retryMutation.isLoading}
>
  {retryMutation.isLoading ? '🔄 Starte...' : '🔄 Erneut versuchen'}
</button>
```

---

## Error-Klassen

```python
# services/enrichment/exceptions.py

class EnrichmentError(Exception):
    """Base class für Enrichment-Fehler"""
    pass

class TemporaryError(EnrichmentError):
    """Temporärer Fehler - Retry möglich"""
    pass

class PermanentError(EnrichmentError):
    """Permanenter Fehler - kein automatischer Retry"""
    pass

# Beispiele
class RateLimitError(TemporaryError):
    """API Rate Limit erreicht"""
    pass

class APITimeoutError(TemporaryError):
    """API Timeout"""
    pass

class VideoNotFoundError(PermanentError):
    """Video existiert nicht mehr"""
    pass

class VideoPrivateError(PermanentError):
    """Video ist privat"""
    pass
```

---

## Edge Cases

| # | Szenario | Erwartetes Verhalten |
|---|----------|----------------------|
| 1 | Retry während processing | 409 Conflict |
| 2 | Retry nach Max Retries | Erlaubt, retry_count wird reset |
| 3 | Manueller Retry → Erfolg | Status = completed |
| 4 | Manueller Retry → Gleicher Fehler | Status = failed, neuer Timestamp |
| 5 | Video gelöscht zwischen Retries | "Video nicht gefunden" |
| 6 | Netzwerk-Fehler beim Retry-Request | Toast-Fehler, Button bleibt aktiv |

---

## Definition of Done

- [ ] TemporaryError vs PermanentError Klassifizierung
- [ ] Automatische Retries mit exponential Backoff
- [ ] `POST /videos/{id}/enrichment/retry` Endpoint
- [ ] useRetryEnrichment Hook
- [ ] Retry-Button in EnrichmentStatus
- [ ] retry_count wird bei manuellem Retry reset
- [ ] Unit Tests für Retry-Logik

---

**Story Points:** 5
**Priorität:** Should Have
**Abhängigkeiten:** US-001, US-005
