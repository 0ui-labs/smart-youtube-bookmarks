# US-005: Enrichment-Status anzeigen

## User Story

**Als** Benutzer der Smart YouTube Bookmarks App
**möchte ich** den Verarbeitungsstatus eines Videos sehen
**damit** ich weiß, wann Untertitel und Kapitel verfügbar sind

---

## Akzeptanzkriterien

| # | Kriterium | Testbar |
|---|-----------|---------|
| 1 | Status wird auf Video-Details-Seite angezeigt | ✅ |
| 2 | Status aktualisiert sich automatisch (Polling) | ✅ |
| 3 | Verschiedene Status werden klar unterschieden | ✅ |
| 4 | Bei Fehler wird Fehlermeldung angezeigt | ✅ |
| 5 | Status-Anzeige blockiert nicht die Video-Wiedergabe | ✅ |

---

## Status-Übersicht

| Status | Icon | Farbe | Beschreibung |
|--------|------|-------|--------------|
| `pending` | ⏳ | Grau | Wartet auf Verarbeitung |
| `processing` | 🔄 | Blau | Wird gerade verarbeitet |
| `completed` | ✅ | Grün | Erfolgreich abgeschlossen |
| `partial` | ⚠️ | Gelb | Teilweise erfolgreich |
| `failed` | ❌ | Rot | Fehlgeschlagen |

---

## UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  VIDEO DETAILS PAGE                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │                   VIDEO PLAYER                        │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Video Title                                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📊 Enrichment Status                                │   │
│  │                                                      │   │
│  │ ┌──────────────────────────────────────────────────┐│   │
│  │ │ 🔄 Untertitel werden erstellt...                 ││   │
│  │ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 45%            ││   │
│  │ │                                                  ││   │
│  │ │ Audio wird transkribiert (Chunk 3/8)             ││   │
│  │ └──────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Description...                                             │
└─────────────────────────────────────────────────────────────┘
```

### Status-Varianten

```
PENDING:
┌──────────────────────────────────────────────────────────┐
│ ⏳ Anreicherung ausstehend                               │
│    Untertitel werden in Kürze erstellt...                │
└──────────────────────────────────────────────────────────┘

PROCESSING:
┌──────────────────────────────────────────────────────────┐
│ 🔄 Wird verarbeitet...                                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 45%                │
│ Audio wird transkribiert (Chunk 3/8)                     │
└──────────────────────────────────────────────────────────┘

COMPLETED:
┌──────────────────────────────────────────────────────────┐
│ ✅ Anreicherung abgeschlossen                            │
│    Untertitel: Deutsch (YouTube Auto)                    │
│    Kapitel: 5 Kapitel verfügbar                          │
└──────────────────────────────────────────────────────────┘

PARTIAL:
┌──────────────────────────────────────────────────────────┐
│ ⚠️ Teilweise erfolgreich                                 │
│    Kapitel: 5 Kapitel verfügbar                          │
│    Untertitel: Nicht verfügbar                           │
└──────────────────────────────────────────────────────────┘

FAILED:
┌──────────────────────────────────────────────────────────┐
│ ❌ Anreicherung fehlgeschlagen                           │
│    Fehler: YouTube Video nicht verfügbar                 │
│                                                          │
│    [🔄 Erneut versuchen]                                 │
└──────────────────────────────────────────────────────────┘
```

---

## Komponente: EnrichmentStatus

```tsx
// components/EnrichmentStatus.tsx

interface EnrichmentStatusProps {
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed'
  captions?: { language: string; source: string } | null
  chapters?: { count: number } | null
  error?: string | null
  progress?: { current: number; total: number } | null
  onRetry?: () => void
}

export function EnrichmentStatus({
  status,
  captions,
  chapters,
  error,
  progress,
  onRetry
}: EnrichmentStatusProps) {
  return (
    <div className={`enrichment-status enrichment-status--${status}`}>
      <div className="status-header">
        {statusIcon[status]}
        <span>{statusText[status]}</span>
      </div>

      {status === 'processing' && progress && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
          <span>Chunk {progress.current}/{progress.total}</span>
        </div>
      )}

      {status === 'completed' && (
        <div className="status-details">
          {captions && (
            <div>Untertitel: {getLanguageLabel(captions.language)} ({sourceLabel[captions.source]})</div>
          )}
          {chapters && (
            <div>Kapitel: {chapters.count} Kapitel verfügbar</div>
          )}
        </div>
      )}

      {status === 'failed' && (
        <>
          <div className="error-message">{error}</div>
          <button onClick={onRetry} className="retry-button">
            🔄 Erneut versuchen
          </button>
        </>
      )}
    </div>
  )
}
```

---

## Polling-Logik

```typescript
// hooks/useVideoEnrichment.ts

export function useVideoEnrichment(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-enrichment', videoId],
    queryFn: () => api.get(`/videos/${videoId}/enrichment`),
    enabled: !!videoId,

    // Polling nur während aktiver Verarbeitung
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending') return 10000    // 10s für pending
      if (status === 'processing') return 3000  // 3s während processing
      return false                               // Kein Polling wenn fertig
    },

    // Cache für abgeschlossene Enrichments
    staleTime: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') {
        return 1000 * 60 * 60  // 1 Stunde
      }
      return 0  // Immer frisch während Verarbeitung
    },
  })
}
```

---

## Edge Cases

| # | Szenario | Erwartetes Verhalten |
|---|----------|----------------------|
| 1 | Kein Enrichment-Record | "Ausstehend" anzeigen |
| 2 | Page Refresh während Processing | Polling fortsetzt |
| 3 | Enrichment startet, Tab im Hintergrund | Polling reduziert (Visibility API) |
| 4 | Lange Verarbeitung (30+ min) | Timeout-Warnung nach 15 min |
| 5 | Mehrere Retries gescheitert | "Max Retries erreicht" Meldung |
| 6 | Partial Success (Chapters ja, Captions nein) | Beides anzeigen |

---

## Definition of Done

- [ ] EnrichmentStatus Komponente implementiert
- [ ] Alle 5 Status-Varianten gestylt
- [ ] Polling während pending/processing
- [ ] Progress-Anzeige für Chunks
- [ ] Retry-Button bei failed Status
- [ ] Integration in VideoDetailsPage
- [ ] Visibility API für Tab-Wechsel

---

**Story Points:** 3
**Priorität:** Must Have
**Abhängigkeiten:** US-001, US-002
