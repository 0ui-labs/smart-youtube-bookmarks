# US-002: Untertitel im Video-Player anzeigen

## User Story

**Als** Benutzer der Smart YouTube Bookmarks App
**möchte ich** Untertitel im Video-Player sehen können
**damit** ich den Video-Inhalt besser verstehen kann (z.B. bei schlechter Audio-Qualität oder Fremdsprache)

---

## Akzeptanzkriterien

| # | Kriterium | Testbar |
|---|-----------|---------|
| 1 | Untertitel werden im Vidstack-Player angezeigt | ✅ |
| 2 | Untertitel können ein-/ausgeschaltet werden | ✅ |
| 3 | Untertitel sind mit dem Video synchronisiert (±2s) | ✅ |
| 4 | Untertitel-Quelle wird angezeigt (YouTube/Transcription) | ✅ |
| 5 | Video spielt auch ohne Untertitel problemlos | ✅ |

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
│  │    ┌─────────────────────────────────────────────┐   │  │
│  │    │  "Das ist ein Beispiel für Untertitel"      │   │  │
│  │    └─────────────────────────────────────────────┘   │  │
│  │                                                       │  │
│  │  ▶ ━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━  12:34 / 45:00    │  │
│  │  🔊  [CC ▼]  ⚙️                                      │  │
│  │       └── Captions Menu                              │  │
│  │           ├─ ○ Aus                                   │  │
│  │           ├─ ● Deutsch (YouTube)                     │  │
│  │           └─ ○ English (Transcription)               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Video Title                                                │
│  ───────────────────────────────────────────────────────    │
│  Description...                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Komponenten-Interaktion

```
┌─────────────────┐
│ VideoDetailsPage│
└────────┬────────┘
         │
         │ useVideo(videoId)
         │ useVideoEnrichment(videoId)
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│    VideoPlayer  │◀────│   Enrichment    │
│    (Vidstack)   │     │   Data          │
└────────┬────────┘     └─────────────────┘
         │
         │ textTracks prop
         │
         ▼
┌─────────────────┐
│   <Track />     │
│   Components    │
│   (VTT)         │
└─────────────────┘
```

---

## Daten-Struktur

### API Response

```json
{
  "status": "completed",
  "captions": {
    "vtt": "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHallo und willkommen...",
    "language": "de",
    "source": "youtube_auto",
    "label": "Deutsch (Auto)"
  }
}
```

### TextTrack Format (Vidstack)

```typescript
interface TextTrack {
  src: string        // data:text/vtt;base64,... oder URL
  kind: 'subtitles' | 'captions'
  language: string   // 'de', 'en'
  label: string      // 'Deutsch', 'English'
  default?: boolean
}
```

---

## Edge Cases

| # | Szenario | Erwartetes Verhalten |
|---|----------|----------------------|
| 1 | Enrichment noch "pending" | Player ohne Untertitel, kein Fehler |
| 2 | Enrichment "processing" | "Untertitel werden erstellt..." Info |
| 3 | Enrichment "failed" | Kein Untertitel-Button, optional Retry |
| 4 | Mehrere Sprachen verfügbar | Dropdown mit allen Optionen |
| 5 | VTT-Datei korrupt | Graceful fallback, kein Crash |
| 6 | Sehr lange Untertitel-Zeilen | CSS word-wrap, max-width |

---

## Technische Implementation

### Hook: useVideoEnrichment

```typescript
// hooks/useVideoEnrichment.ts

export function useVideoEnrichment(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-enrichment', videoId],
    queryFn: async () => {
      if (!videoId) return null

      try {
        const { data } = await api.get(`/videos/${videoId}/enrichment`)
        return data
      } catch (error) {
        if (error.response?.status === 404) {
          return null  // Kein Enrichment = OK
        }
        throw error
      }
    },
    enabled: !!videoId,
    staleTime: 1000 * 60 * 60,  // 1 Stunde Cache
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending' || status === 'processing') {
        return 5000  // Polling alle 5s während Processing
      }
      return false
    },
  })
}
```

### VideoDetailsPage Integration

```tsx
// pages/VideoDetailsPage.tsx

const { data: video } = useVideo(videoId)
const { data: enrichment } = useVideoEnrichment(videoId)

// TextTracks aus Enrichment bauen
const textTracks = useMemo(() => {
  if (!enrichment?.captions?.vtt) return []

  return [{
    src: `data:text/vtt;base64,${btoa(enrichment.captions.vtt)}`,
    kind: 'subtitles' as const,
    language: enrichment.captions.language,
    label: getLanguageLabel(enrichment.captions.language, enrichment.captions.source),
    default: true,
  }]
}, [enrichment])

<VideoPlayer
  youtubeId={video.youtubeId}
  videoId={video.id}
  textTracks={textTracks}
/>
```

---

## Definition of Done

- [ ] `useVideoEnrichment` Hook implementiert
- [ ] TextTracks an VideoPlayer übergeben
- [ ] Untertitel werden im Player angezeigt
- [ ] CC-Button im Player funktioniert
- [ ] Polling während "processing" Status
- [ ] Graceful handling bei fehlenden Untertiteln
- [ ] E2E Test: Video mit Untertiteln abspielen

---

**Story Points:** 3
**Priorität:** Must Have
**Abhängigkeiten:** US-001 (Enrichment muss existieren)
