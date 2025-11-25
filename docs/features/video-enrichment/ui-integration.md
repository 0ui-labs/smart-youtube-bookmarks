# Video Enrichment - UI Integration

## Bestehende UI-Struktur

### VideoDetailsPage.tsx (Zeile 149-236)
```
┌─────────────────────────────────────────────────────────────┐
│  ← Zurück zur Übersicht                                     │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   VideoPlayer                         │  │
│  │         (youtubeId, videoId, initialPosition)         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Video Title                                                │
│  Channel Name                                               │
│  [Labels als Badges]                                        │
├─────────────────────────────────────────────────────────────┤
│  CategorySelector                                           │
├─────────────────────────────────────────────────────────────┤
│  CustomFieldsSection                                        │
└─────────────────────────────────────────────────────────────┘
```

### VideoPlayer.tsx Props (Zeile 37-60)
```typescript
interface VideoPlayerProps {
  youtubeId: string
  videoId: string
  title?: string
  initialPosition?: number | null
  poster?: string | null
  thumbnailUrl?: string | null
  textTracks?: TextTrackType[]      // ✅ BEREITS VORHANDEN!
  thumbnailsVtt?: string | null     // ✅ BEREITS VORHANDEN!
  onReady?: () => void
  onEnded?: () => void
  onError?: (error: Error) => void
}
```

**Wichtig:** VideoPlayer unterstützt bereits `textTracks` und `thumbnailsVtt`. Die Integration ist minimal.

---

## Geplante UI-Erweiterungen

### 1. VideoDetailsPage - Neue Struktur

```
┌─────────────────────────────────────────────────────────────┐
│  ← Zurück zur Übersicht                                     │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   VideoPlayer                         │  │
│  │    + textTracks (Captions)  ← NEU                     │  │
│  │    + thumbnailsVtt          ← NEU (optional)          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 📊 Enrichment Status                    ← NEU         │  │
│  │ ✅ Untertitel: Deutsch (YouTube Auto)                 │  │
│  │ ✅ Kapitel: 5 verfügbar                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  📑 Chapters (wenn vorhanden)              ← NEU          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 00:00  Intro                                        │   │
│  │ 02:30  Setup                                        │   │
│  │ ▶10:15 Demo (aktuell)                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Video Title                                                │
│  Channel Name                                               │
│  [Labels als Badges]                                        │
├─────────────────────────────────────────────────────────────┤
│  CategorySelector                                           │
├─────────────────────────────────────────────────────────────┤
│  CustomFieldsSection                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Neue Komponenten

### 1. EnrichmentStatus Komponente

**Datei:** `frontend/src/components/EnrichmentStatus.tsx`

```typescript
interface EnrichmentStatusProps {
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed'
  captions?: { language: string; source: string } | null
  chapters?: { count: number } | null
  error?: string | null
  onRetry?: () => void
}
```

**Visuelle Varianten:**

```
PENDING:
┌──────────────────────────────────────┐
│ ⏳ Wird vorbereitet...               │
└──────────────────────────────────────┘

PROCESSING:
┌──────────────────────────────────────┐
│ 🔄 Wird verarbeitet...               │
│ ━━━━━━━━━━━━━━━━━━━━ 45%             │
└──────────────────────────────────────┘

COMPLETED:
┌──────────────────────────────────────┐
│ ✅ Untertitel: Deutsch (YouTube)     │
│ ✅ Kapitel: 5 verfügbar              │
└──────────────────────────────────────┘

FAILED:
┌──────────────────────────────────────┐
│ ❌ Fehler: API nicht erreichbar      │
│ [🔄 Erneut versuchen]                │
└──────────────────────────────────────┘
```

---

### 2. ChapterList Komponente

**Datei:** `frontend/src/components/ChapterList.tsx`

```typescript
interface ChapterListProps {
  chapters: Chapter[]
  currentTime: number
  onSeek: (time: number) => void
}

interface Chapter {
  start: number
  end: number
  title: string
}
```

**Design:**

```
📑 Chapters
┌─────────────────────────────────────────┐
│                                         │
│  00:00   Intro                          │
│  02:30   Setup & Installation           │
│ ▶10:15   Demo    ← aktiv (hervorgehoben)│
│  25:00   Summary                        │
│  40:00   Q&A                            │
│                                         │
└─────────────────────────────────────────┘
```

**Styling:**
- Aktives Kapitel: Fetter Text, linker Akzent-Border, Hintergrund-Highlight
- Hover: Cursor pointer, leichte Hintergrundfarbe
- Timestamp: Monospace Font, grau

---

## Neue Hooks

### useVideoEnrichment

**Datei:** `frontend/src/hooks/useVideoEnrichment.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface EnrichmentData {
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed'
  captions?: {
    vtt: string
    language: string
    source: 'youtube_manual' | 'youtube_auto' | 'groq_whisper'
  } | null
  chapters?: {
    vtt: string
    items: Array<{ start: number; end: number; title: string }>
    source: 'youtube' | 'description_parsed'
  } | null
  thumbnails?: {
    vtt_url: string
  } | null
  error?: string | null
  processed_at?: string | null
}

export function useVideoEnrichment(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-enrichment', videoId],
    queryFn: async (): Promise<EnrichmentData | null> => {
      if (!videoId) return null

      try {
        const { data } = await api.get(`/videos/${videoId}/enrichment`)
        return data
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null  // Kein Enrichment = OK, kein Fehler
        }
        throw error
      }
    },
    enabled: !!videoId,

    // Polling während Verarbeitung
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending') return 10000    // 10s
      if (status === 'processing') return 3000  // 3s
      return false                               // Kein Polling
    },

    // Cache für abgeschlossene
    staleTime: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') {
        return 1000 * 60 * 60  // 1 Stunde
      }
      return 0
    },
  })
}
```

### useRetryEnrichment

**Datei:** `frontend/src/hooks/useVideoEnrichment.ts` (gleiche Datei)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRetryEnrichment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoId: string) => {
      const { data } = await api.post(`/videos/${videoId}/enrichment/retry`)
      return data
    },
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({ queryKey: ['video-enrichment', videoId] })
    },
  })
}
```

---

## VideoDetailsPage Integration

### Änderungen an VideoDetailsPage.tsx

```tsx
// IMPORTS - NEU
import { useVideoEnrichment, useRetryEnrichment } from '@/hooks/useVideoEnrichment'
import { EnrichmentStatus } from '@/components/EnrichmentStatus'
import { ChapterList } from '@/components/ChapterList'
import { buildTextTracks } from '@/lib/enrichmentUtils'

// In der Komponente
export const VideoDetailsPage = () => {
  // ... bestehender Code ...

  // NEU: Enrichment Hook
  const { data: enrichment, isLoading: enrichmentLoading } = useVideoEnrichment(videoId)
  const retryEnrichment = useRetryEnrichment()

  // NEU: Player-Referenz für Seek
  const playerRef = useRef<{ seek: (time: number) => void } | null>(null)

  // NEU: Text Tracks aus Enrichment bauen
  const textTracks = useMemo(() => {
    if (!enrichment?.captions?.vtt) return []

    return [{
      src: `data:text/vtt;base64,${btoa(unescape(encodeURIComponent(enrichment.captions.vtt)))}`,
      kind: 'subtitles' as const,
      language: enrichment.captions.language,
      label: getLanguageLabel(enrichment.captions.language, enrichment.captions.source),
      default: true,
    }]
  }, [enrichment?.captions])

  // NEU: Handle Chapter Click
  const handleChapterClick = (time: number) => {
    playerRef.current?.seek(time)
  }

  // NEU: Handle Retry
  const handleRetry = () => {
    if (videoId) {
      retryEnrichment.mutate(videoId)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* ... bestehender Code ... */}

      {/* Video Player - MODIFIZIERT */}
      <VideoPlayer
        ref={playerRef}
        youtubeId={video.youtube_id}
        videoId={video.id}
        initialPosition={video.watch_position}
        thumbnailUrl={video.thumbnail_url}
        textTracks={textTracks}                        // NEU
        thumbnailsVtt={enrichment?.thumbnails?.vtt_url} // NEU
      />

      {/* NEU: Enrichment Status (unter Player) */}
      {(enrichment || enrichmentLoading) && (
        <EnrichmentStatus
          status={enrichment?.status ?? 'pending'}
          captions={enrichment?.captions}
          chapters={enrichment?.chapters ? { count: enrichment.chapters.items.length } : null}
          error={enrichment?.error}
          onRetry={handleRetry}
          isRetrying={retryEnrichment.isPending}
        />
      )}

      {/* NEU: Chapter List (wenn vorhanden) */}
      {enrichment?.chapters?.items && enrichment.chapters.items.length > 1 && (
        <ChapterList
          chapters={enrichment.chapters.items}
          currentTime={0}  // TODO: Sync mit Player
          onSeek={handleChapterClick}
        />
      )}

      {/* ... restlicher bestehender Code ... */}
    </div>
  )
}
```

---

## Utility Functions

### enrichmentUtils.ts

**Datei:** `frontend/src/lib/enrichmentUtils.ts`

```typescript
import type { TextTrack } from '@/types/player'

export function getLanguageLabel(language: string, source: string): string {
  const languageNames: Record<string, string> = {
    de: 'Deutsch',
    en: 'English',
    fr: 'Français',
    es: 'Español',
  }

  const sourceLabels: Record<string, string> = {
    youtube_manual: '',
    youtube_auto: '(Auto)',
    groq_whisper: '(Transkribiert)',
  }

  const langName = languageNames[language] || language.toUpperCase()
  const sourceLabel = sourceLabels[source] || ''

  return `${langName} ${sourceLabel}`.trim()
}

export function formatChapterTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}
```

---

## Type Definitions

### enrichment.ts

**Datei:** `frontend/src/types/enrichment.ts`

```typescript
export type EnrichmentStatus = 'pending' | 'processing' | 'completed' | 'partial' | 'failed'

export type CaptionSource = 'youtube_manual' | 'youtube_auto' | 'groq_whisper'

export type ChapterSource = 'youtube' | 'description_parsed'

export interface EnrichmentCaptions {
  vtt: string
  language: string
  source: CaptionSource
}

export interface EnrichmentChapter {
  start: number
  end: number
  title: string
}

export interface EnrichmentChapters {
  vtt: string
  items: EnrichmentChapter[]
  source: ChapterSource
}

export interface EnrichmentThumbnails {
  vtt_url: string
}

export interface EnrichmentData {
  status: EnrichmentStatus
  captions: EnrichmentCaptions | null
  chapters: EnrichmentChapters | null
  thumbnails: EnrichmentThumbnails | null
  error: string | null
  processed_at: string | null
}
```

---

## Komponenten-Dateien Übersicht

| Datei | Typ | Beschreibung |
|-------|-----|--------------|
| `components/EnrichmentStatus.tsx` | NEU | Status-Anzeige Komponente |
| `components/ChapterList.tsx` | NEU | Kapitel-Liste Komponente |
| `hooks/useVideoEnrichment.ts` | NEU | Enrichment Data Hook + Retry Mutation |
| `lib/enrichmentUtils.ts` | NEU | Helper Functions |
| `types/enrichment.ts` | NEU | TypeScript Types |
| `pages/VideoDetailsPage.tsx` | MODIFIZIERT | Integration (~30 Zeilen) |

---

## Styling

### Tailwind Classes für EnrichmentStatus

```tsx
// Basis-Container
className="p-4 rounded-lg border"

// Status-spezifische Varianten
const statusStyles = {
  pending: 'bg-gray-50 border-gray-200 text-gray-600',
  processing: 'bg-blue-50 border-blue-200 text-blue-700',
  completed: 'bg-green-50 border-green-200 text-green-700',
  partial: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  failed: 'bg-red-50 border-red-200 text-red-700',
}
```

### Tailwind Classes für ChapterList

```tsx
// Container
className="mt-4 p-4 bg-muted rounded-lg"

// Chapter Item
className="flex items-center gap-3 py-2 px-3 rounded cursor-pointer hover:bg-accent"

// Active Chapter
className="bg-accent border-l-2 border-primary font-medium"

// Timestamp
className="font-mono text-sm text-muted-foreground w-16"
```

---

## Zusammenfassung

### Neue Dateien (5)
1. `components/EnrichmentStatus.tsx`
2. `components/ChapterList.tsx`
3. `hooks/useVideoEnrichment.ts`
4. `lib/enrichmentUtils.ts`
5. `types/enrichment.ts`

### Modifizierte Dateien (1)
1. `pages/VideoDetailsPage.tsx` (~30 Zeilen Änderungen)

### VideoPlayer - Keine Änderungen
Der VideoPlayer unterstützt bereits `textTracks` und `thumbnailsVtt`. Diese Props werden jetzt mit echten Daten befüllt.

---

**Exit Condition:** ✅ Klare UI-Komponenten und Integrationsplan definiert
**Nächste Phase:** Implementation Plan
