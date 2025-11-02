# Phase 1a - Task 3: Frontend Metadata Display Implementation Plan (Version A)

> **Created:** 2025-10-31
> **Status:** Draft (Pre-REF Validation)
> **Version:** 1.0 (A)
> **Context:** Backend Tasks 1-2 complete, Frontend needs to display YouTube metadata

---

## 🎯 Ziel

Frontend aktualisieren, um YouTube-Metadaten (Thumbnails, Titel, Channel, Duration) anzuzeigen, die jetzt sofort nach CSV-Upload verfügbar sind.

---

## 📊 Kontext

**Was ist fertig (Tasks 1-2):**
- ✅ Backend fetcht YouTube metadata während CSV upload
- ✅ Videos werden mit vollständigen Metadaten erstellt (title, channel, thumbnail_url, duration)
- ✅ Batch API (50 videos per call) implementiert
- ✅ Redis caching aktiv

**Was fehlt:**
- ❌ Frontend zeigt nur YouTube Icon statt echten Thumbnails
- ❌ Titel zeigt "Video {youtube_id}" statt echten Titel
- ❌ Channel wird nicht angezeigt
- ❌ Duration nicht formatiert
- ❌ Kein Loading State für Bilder

**Aktuelle Frontend-Architektur:**
- React 18.2.0 + TypeScript 5.3.3
- TanStack Table 8.11.6 für Video-Grid
- Tailwind CSS 3.4.1 für Styling
- Keine ShadCN/UI yet (wird später in Phase 3 integriert)
- Kein separates VideoCard Component (alles in VideosPage.tsx)

---

## 🏗️ Technische Analyse

### Aktueller Code-Status

**VideosPage.tsx** (Lines 1-446):
- Nutzt TanStack Table mit column helpers
- Zeigt statisches YouTube-Icon (SVG) statt thumbnails
- Titel-Spalte zeigt nur "Video {youtube_id}" Link
- Duration-Spalte zeigt "Nicht verfügbar" bzw. Processing-Status
- Keine Formatierungs-Funktionen für Duration

**Video TypeScript Interface** (types/video.ts):
```typescript
export interface VideoResponse {
  id: string
  list_id: string
  youtube_id: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  // MISSING: title, channel, thumbnail_url, duration, published_at
}
```

**Backend liefert jetzt (seit Tasks 1-2):**
```python
# Video Model (backend/app/models/video.py)
title: str | None
channel: str | None
thumbnail_url: str | None
duration: int | None  # Sekunden
published_at: datetime | None
```

---

## 📋 Implementierungsplan

### Task 3.1: TypeScript Interface aktualisieren

**Ziel:** Frontend-Interface mit Backend-Model synchronisieren

**File:** `frontend/src/types/video.ts`

**Changes:**
```typescript
export interface VideoResponse {
  id: string
  list_id: string
  youtube_id: string

  // NEW: YouTube Metadata (from Backend Tasks 1-2)
  title: string | null
  channel: string | null
  thumbnail_url: string | null
  duration: number | null  // Seconds
  published_at: string | null  // ISO 8601

  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}
```

**Verification:**
```bash
cd frontend
npm run build  # TypeScript compilation check
```

**Expected:** No errors, interface matches backend data structure

---

### Task 3.2: Duration Formatter Utility

**Ziel:** Sekunden in human-readable Format (MM:SS oder H:MM:SS) konvertieren

**File:** `frontend/src/utils/formatDuration.ts` (NEW)

**Implementation:**
```typescript
/**
 * Format duration in seconds to human-readable string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (MM:SS or H:MM:SS)
 *
 * @example
 * formatDuration(90) // "1:30"
 * formatDuration(3661) // "1:01:01"
 * formatDuration(0) // "0:00"
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) {
    return '-'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  // Format: H:MM:SS if hours > 0, else MM:SS
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
```

**Tests:** `frontend/src/utils/formatDuration.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('0:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(930)).toBe('15:30')  // Real example from backend
  })

  it('formats hours, minutes, seconds', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(formatDuration(7265)).toBe('2:01:05')
  })

  it('pads single digits correctly', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3605)).toBe('1:00:05')
  })

  it('handles null', () => {
    expect(formatDuration(null)).toBe('-')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('-')
  })
})
```

**Verification:**
```bash
cd frontend
npm test -- formatDuration.test.ts
```

**Expected:** All tests pass

---

### Task 3.3: TanStack Table Columns aktualisieren

**Ziel:** Columns für Thumbnail, Title+Channel, Duration mit echten Daten

**File:** `frontend/src/components/VideosPage.tsx`

**Changes:**

#### 3.3.1 Import formatDuration Utility

```typescript
import { formatDuration } from '@/utils/formatDuration'
```

#### 3.3.2 Update Column Definitions (Lines 81-172)

**Replace entire columns definition:**

```typescript
const columns = useMemo(
  () => [
    // Column 1: Thumbnail
    columnHelper.accessor('thumbnail_url', {
      id: 'thumbnail',
      header: 'Vorschau',
      cell: (info) => {
        const thumbnailUrl = info.getValue()
        const row = info.row.original
        const title = row.title || `Video ${row.youtube_id}`

        if (thumbnailUrl) {
          return (
            <img
              src={thumbnailUrl}
              alt={title}
              loading="lazy"
              className="w-32 h-18 object-cover rounded shadow-sm"
              onError={(e) => {
                // Fallback to YouTube icon if image fails to load
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <div className="hidden w-32 h-18 bg-red-50 rounded flex items-center justify-center">
              <svg className="w-12 h-12 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
          )
        }

        // No thumbnail available - show placeholder
        return (
          <div className="w-32 h-18 bg-gray-100 rounded flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
        )
      },
    }),

    // Column 2: Title + Channel
    columnHelper.accessor('title', {
      id: 'title',
      header: 'Titel',
      cell: (info) => {
        const row = info.row.original
        const title = info.getValue() || `Video ${row.youtube_id}`
        const channel = row.channel
        const youtubeUrl = `https://www.youtube.com/watch?v=${row.youtube_id}`

        return (
          <div className="flex flex-col space-y-1 min-w-[200px]">
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-900 hover:text-blue-600 hover:underline line-clamp-2"
              title={title}
            >
              {title}
            </a>
            {channel && (
              <span className="text-sm text-gray-600">
                {channel}
              </span>
            )}
          </div>
        )
      },
    }),

    // Column 3: Duration
    columnHelper.accessor('duration', {
      id: 'duration',
      header: 'Dauer',
      cell: (info) => {
        const duration = info.getValue()
        return (
          <span className="text-sm text-gray-700 font-mono">
            {formatDuration(duration)}
          </span>
        )
      },
    }),

    // Column 4: Status (unchanged)
    columnHelper.accessor('processing_status', {
      id: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue()
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
              status
            )}`}
          >
            {getStatusLabel(status)}
          </span>
        )
      },
    }),

    // Column 5: Actions (unchanged)
    columnHelper.accessor('id', {
      id: 'actions',
      header: 'Aktionen',
      cell: (info) => (
        <button
          onClick={() => {
            if (window.confirm('Video wirklich löschen?')) {
              deleteVideo.mutate(info.getValue())
            }
          }}
          className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
        >
          Löschen
        </button>
      ),
    }),
  ],
  [deleteVideo]
)
```

**Key Changes:**
1. **Thumbnail Column:**
   - Zeigt `thumbnail_url` als `<img>` mit lazy loading
   - Fallback zu YouTube Icon bei Fehler
   - Placeholder wenn keine URL vorhanden
2. **Title Column:**
   - Zeigt echten `title` statt "Video {id}"
   - Channel unter Titel (wenn vorhanden)
   - Line-clamp-2 für lange Titel
3. **Duration Column:**
   - Nutzt `formatDuration()` utility
   - Monospace font für bessere Lesbarkeit

---

### Task 3.4: Loading State für Thumbnails

**Ziel:** Skeleton UI während Bild lädt

**File:** `frontend/src/components/VideosPage.tsx`

**Approach:** CSS-basiertes Loading mit Tailwind (kein zusätzliches State Management)

**Implementation:**

Add CSS animation class in component:
```typescript
// Add to imports
import { useState } from 'react'

// Update thumbnail cell to track loading state per image
cell: (info) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const thumbnailUrl = info.getValue()
  const row = info.row.original
  const title = row.title || `Video ${row.youtube_id}`

  if (!thumbnailUrl || imageError) {
    return (
      <div className="w-32 h-18 bg-gray-100 rounded flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
          {/* YouTube icon path */}
        </svg>
      </div>
    )
  }

  return (
    <div className="relative w-32 h-18">
      {/* Skeleton loader */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-200 rounded animate-pulse" />
      )}

      {/* Actual image */}
      <img
        src={thumbnailUrl}
        alt={title}
        loading="lazy"
        className={`w-32 h-18 object-cover rounded shadow-sm transition-opacity duration-200 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </div>
  )
}
```

**Problem:** useState in cell renderer = Re-renders!

**Better Approach:** Tailwind's built-in image loading classes

**Final Implementation (Version A):**
```typescript
// No state needed - browser handles loading naturally
<img
  src={thumbnailUrl}
  alt={title}
  loading="lazy"
  className="w-32 h-18 object-cover rounded shadow-sm bg-gray-200"
  onError={(e) => {
    const target = e.target as HTMLImageElement
    target.style.display = 'none'
  }}
/>
```

**Note:** Actual skeleton UI will be revisited in REF Research (might need better pattern)

---

### Task 3.5: Update Tests

**File:** `frontend/src/components/VideosPage.test.tsx` (if exists) or create new

**Test Plan:**
1. Test formatDuration utility (separate file - done in 3.2)
2. Test VideosPage renders thumbnails
3. Test fallback when thumbnail_url is null
4. Test title + channel display
5. Test YouTube link opens correctly

**Implementation:**

Create `frontend/src/components/VideosPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideosPage } from './VideosPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { VideoResponse } from '@/types/video'

// Mock hooks
vi.mock('@/hooks/useVideos', () => ({
  useVideos: () => ({
    data: mockVideos,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    jobProgress: new Map(),
    reconnecting: false,
    historyError: null,
  }),
}))

const mockVideos: VideoResponse[] = [
  {
    id: 'video-1',
    list_id: 'list-1',
    youtube_id: 'dQw4w9WgXcQ',
    title: 'Python Tutorial for Beginners',
    channel: 'Tech Academy',
    thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    duration: 930, // 15:30
    published_at: '2024-01-15T10:00:00Z',
    processing_status: 'completed',
    created_at: '2024-01-20T12:00:00Z',
    updated_at: '2024-01-20T12:00:00Z',
  },
  {
    id: 'video-2',
    list_id: 'list-1',
    youtube_id: 'jNQXAC9IVRw',
    title: null, // Test fallback
    channel: null,
    thumbnail_url: null, // Test placeholder
    duration: null,
    published_at: null,
    processing_status: 'pending',
    created_at: '2024-01-21T14:00:00Z',
    updated_at: '2024-01-21T14:00:00Z',
  },
]

describe('VideosPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <VideosPage listId="list-1" onBack={() => {}} />
      </QueryClientProvider>
    )
  }

  it('renders video thumbnails when available', () => {
    renderComponent()

    const thumbnail = screen.getByAlt('Python Tutorial for Beginners')
    expect(thumbnail).toBeInTheDocument()
    expect(thumbnail).toHaveAttribute('src', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('shows placeholder when thumbnail_url is null', () => {
    renderComponent()

    // Should have YouTube icon SVG in placeholder
    const placeholders = screen.getAllByRole('img', { hidden: true })
    expect(placeholders.length).toBeGreaterThan(0)
  })

  it('displays video title and channel', () => {
    renderComponent()

    expect(screen.getByText('Python Tutorial for Beginners')).toBeInTheDocument()
    expect(screen.getByText('Tech Academy')).toBeInTheDocument()
  })

  it('displays fallback title when title is null', () => {
    renderComponent()

    expect(screen.getByText('Video jNQXAC9IVRw')).toBeInTheDocument()
  })

  it('formats duration correctly', () => {
    renderComponent()

    expect(screen.getByText('15:30')).toBeInTheDocument() // 930 seconds
  })

  it('shows dash when duration is null', () => {
    renderComponent()

    // Count all dashes (there will be multiple in the table)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders YouTube links correctly', () => {
    renderComponent()

    const link = screen.getByRole('link', { name: /Python Tutorial for Beginners/i })
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
```

**Verification:**
```bash
cd frontend
npm test -- VideosPage.test.tsx
```

---

### Task 3.6: TypeScript Build & Manual Testing

**Verification Steps:**

#### 1. TypeScript Compilation
```bash
cd frontend
npm run build
```

**Expected:** No errors, successful build

#### 2. Dev Server Test
```bash
npm run dev
```

Navigate to `http://localhost:5173`:
1. Create test list
2. Upload CSV with real YouTube URLs:
   ```csv
   url
   https://www.youtube.com/watch?v=dQw4w9WgXcQ
   https://youtu.be/jNQXAC9IVRw
   ```

**Verify:**
- ✅ Thumbnails appear immediately (from batch fetch in Tasks 1-2)
- ✅ Titles visible (not "Video {id}")
- ✅ Channels shown under titles
- ✅ Duration formatted as "MM:SS"
- ✅ No console errors
- ✅ Images lazy load properly
- ✅ Placeholder shows when no thumbnail

---

## 📦 Deliverables

**Files Changed:**
1. `frontend/src/types/video.ts` - Interface update
2. `frontend/src/utils/formatDuration.ts` - NEW utility
3. `frontend/src/utils/formatDuration.test.ts` - NEW tests
4. `frontend/src/components/VideosPage.tsx` - Column updates
5. `frontend/src/components/VideosPage.test.tsx` - NEW component tests

**Tests:**
- Unit tests: formatDuration (6 tests)
- Component tests: VideosPage (7 tests)
- Manual E2E: CSV upload → thumbnails visible

**Performance:**
- Images: lazy loading enabled
- No additional API calls (data from Tasks 1-2)
- Instant display (<100ms after data fetch)

---

## ⚠️ Known Issues / Questions (Pre-REF)

**1. Skeleton UI Pattern**
- Current: Simple CSS `bg-gray-200` during load
- Question: Is there a better React pattern for image loading states?
- Alternative: Intersection Observer API for viewport-based loading?

**2. Image Error Handling**
- Current: `onError` hides image, shows fallback
- Question: Should we retry failed thumbnails?
- Alternative: Use service worker for offline caching?

**3. Large Tables Performance**
- Current: TanStack Table renders all rows
- Question: Should we use virtualization for >100 videos?
- Alternative: TanStack Virtual (already in package.json but not used)

**4. Accessibility**
- Current: Basic alt tags on images
- Question: Are we meeting WCAG 2.1 AA standards?
- Missing: Screen reader announcements for loading states?

**5. TypeScript Strictness**
- Current: All fields nullable (backend allows null)
- Question: Should we have separate types for "loaded" vs "loading" videos?
- Alternative: Discriminated unions based on `processing_status`?

**6. Duration Formatting i18n**
- Current: Hardcoded format (MM:SS)
- Question: Do we need localization for different regions?
- Alternative: Intl.DurationFormat (but experimental browser support)

---

## 🔍 REF Research Topics (Task 3.7)

**Before finalizing this plan, research:**

1. **React 18 Image Best Practices 2025**
   - Lazy loading patterns
   - Skeleton UI approaches
   - Error boundaries for images
   - Progressive image loading

2. **TanStack Table + Images Performance**
   - Virtualization for large datasets
   - Memoization strategies
   - Cell rendering optimization

3. **TypeScript Video Types**
   - Null vs. undefined handling
   - Discriminated unions for processing states
   - Type guards for metadata presence

4. **Accessibility**
   - Image alt text best practices
   - Loading state announcements
   - Keyboard navigation in tables

5. **Tailwind CSS Patterns**
   - Responsive image containers
   - Aspect ratio handling
   - Skeleton loaders without JavaScript

**Search Queries for REF MCP:**
- "React 18 image lazy loading best practices 2025"
- "TanStack Table virtualization performance"
- "TypeScript nullable fields video metadata"
- "Tailwind CSS skeleton loader no JavaScript"
- "WCAG 2.1 AA image accessibility"

---

## ✅ Success Criteria

**Task 3 Complete when:**
1. ✅ Frontend TypeScript interface matches backend model
2. ✅ formatDuration() utility tested and working
3. ✅ Thumbnails displayed in table
4. ✅ Titles + channels visible
5. ✅ Duration formatted correctly
6. ✅ Fallbacks work (no thumbnail → placeholder)
7. ✅ All tests passing (13+ frontend tests)
8. ✅ TypeScript builds without errors
9. ✅ Manual E2E test successful
10. ✅ REF Research findings incorporated (Version B)

---

## 📊 Estimated Effort

| Sub-Task | Estimated Time |
|----------|----------------|
| 3.1 TypeScript Interface | 10 min |
| 3.2 Duration Formatter + Tests | 20 min |
| 3.3 Column Definitions Update | 30 min |
| 3.4 Loading State (Simple) | 10 min |
| 3.5 Component Tests | 30 min |
| 3.6 Build + Manual Testing | 15 min |
| **Total (without REF)** | **~2 hours** |
| 3.7 REF Research | 30-45 min |
| 3.8 Plan Optimization (V2) | 20 min |
| **Grand Total** | **3-3.5 hours** |

---

## 🔄 Next Steps

1. **Stop here** - Do NOT implement yet!
2. **Run REF Research** (Task 3.7) via Subagent
3. **Review findings** against this plan
4. **Create Version B** with optimizations
5. **User approval** for final plan
6. **Implement** Version B using TDD workflow

---

**Version:** 1.0 (A - Pre-REF)
**Status:** Draft - Awaiting REF Validation
**Next:** REF MCP Research → Version B with optimizations
