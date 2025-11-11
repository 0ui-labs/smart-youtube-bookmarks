# Task #32: Create Large Thumbnail Grid Layout

**Plan Task:** #32
**Wave/Phase:** Wave 2 UI Cleanup - Enhanced UX
**Dependencies:** Task #31 (Thumbnail Size CSS Classes), Task #25 (Table Settings Store), Task #26 (TableSettingsDropdown)
**REF MCP Validated:** ✅ Yes (7 improvements incorporated)

---

## 🎯 Ziel

Implementiere eine alternative **Grid-Ansicht** mit einem **manuellen List/Grid Toggle Button**. User kann zwischen Table-Ansicht (Liste) und Grid-Ansicht **unabhängig von der Thumbnail-Größe** wechseln. Die Grid-Ansicht zeigt Video-Cards in einem responsiven Grid-Layout (2-4 Spalten) mit Hover-Effekten und optimierter Metadaten-Darstellung.

**Erwartetes Ergebnis:**
- ✅ **List/Grid Toggle Button** im Header (neben Settings Dropdown)
- ✅ User klickt Toggle → View wechselt zwischen Table und Grid (unabhängig von Thumbnail-Größe)
- ✅ Grid zeigt 2-4 Spalten je nach Viewport-Breite (responsive)
- ✅ Video-Cards zeigen Thumbnails (Größe abhängig von thumbnailSize Setting), Titel, Channel, Duration, Tags
- ✅ Hover-Effekte und Clickable Cards (wie Table Rows)
- ✅ Lazy Loading mit native `loading="lazy"` (bereits implementiert in VideoThumbnail)
- ✅ WCAG 2.1 Level AA konform (vollständige Keyboard Navigation)

---

## 📋 Acceptance Criteria

- [ ] **ViewMode State in Store:** `tableSettingsStore` hat `viewMode: 'list' | 'grid'` mit localStorage persistence
- [ ] **List/Grid Toggle Button:** Toggle Button im Header mit LayoutList/LayoutGrid Icons (lucide-react)
- [ ] **Manual View Switch:** User klickt Toggle → View wechselt zwischen Table (list) und Grid (grid) **unabhängig** von thumbnailSize
- [ ] **Responsive Grid:** 2 Spalten (mobile), 3 Spalten (tablet), 4 Spalten (desktop) mit responsive gap spacing
- [ ] **VideoCard Component:** Zeigt Thumbnail (size dynamisch via thumbnailSize), Title, Channel, Duration, Tags mit Hover-Effekten
- [ ] **Clickable Cards:** Entire card clickable (öffnet Video), Three-Dot Menu stopPropagation mit Radix UI `asChild` pattern
- [ ] **Lazy Loading:** Images lazy-loaded mit native `loading="lazy"` (via VideoThumbnail reuse)
- [ ] **Accessibility:** WCAG 2.1 konform - vollständige Keyboard Navigation, ARIA labels, Focus Management
- [ ] **Tests Passing:** 16+ Unit Tests (ViewMode State, Toggle Button, VideoCard, Grid Layout, Conditional Rendering, Accessibility)
- [ ] **TypeScript Strict:** 0 new TypeScript errors (VideoThumbnail API korrekt verwendet)
- [ ] **Manual Testing:** Toggle funktioniert, Grid responsive, Hover-States, Clickable Cards, thumbnailSize Settings funktionieren in beiden Views

---

## 🔍 REF MCP Validation Summary

### ✅ **REF MCP Improvement #1: Manual ViewMode Toggle (CRITICAL)**
**Problem:** Original plan hatte Inkonsistenz zwischen Ziel (manueller Toggle) und Implementierung (automatischer Switch bei xlarge).

**Lösung:**
- Separater `viewMode: 'list' | 'grid'` State im Store (unabhängig von thumbnailSize)
- Expliziter Toggle Button im Header (lucide-react LayoutList/LayoutGrid icons)
- User hat volle Kontrolle: Grid mit kleinen Thumbnails ODER Table mit großen Thumbnails möglich

**Warum besser:**
- Klare Trennung: thumbnailSize = Größe, viewMode = Layout
- Flexibler für User (mehr Übersicht mit kleinen Thumbnails im Grid)
- Intuitive UI (Toggle zeigt direkt Tabelle ↔ Grid)

---

### ✅ **REF MCP Improvement #2: VideoThumbnail API Compatibility (CRITICAL)**
**Problem:** Original plan nutzte nicht-existierende `url` und `title` Props für VideoThumbnail.

**Lösung:**
- VideoThumbnail Component wird NICHT geändert (behält aktuelle API: `url` und `title` props)
- VideoCard nutzt bestehende VideoThumbnail Komponente korrekt: `<VideoThumbnail url={video.thumbnail_url} title={video.title} />`
- Reuse statt Recreate (REF MCP Best Practice)

**Warum besser:**
- Keine TypeScript Errors
- Konsistente API über alle Komponenten
- Lazy Loading automatisch inkludiert

---

### ✅ **REF MCP Improvement #3: Complete Keyboard Navigation (CRITICAL - WCAG 2.1)**
**Problem:** Original plan hatte unvollständige Keyboard Navigation (nur Enter/Space, kein Focus Management).

**Lösung:**
- Vollständige `onKeyDown` Handler (Enter, Space)
- ARIA labels mit Channel Name: `aria-label="Video: {title} von {channel}"`
- Focus Management nach Delete (nächste Card oder Grid Container)
- DropdownMenu `onCloseAutoFocus` verhindert ungewollten Card-Click

**Warum besser:**
- WCAG 2.1 Level AA konform
- Bessere Screen Reader Unterstützung (vollständiger Kontext)
- Keyboard-only Navigation funktioniert vollständig

---

### ✅ **REF MCP Improvement #4: Duration Overlay Readability**
**Problem:** Duration Overlay mit `bg-black/80` kann bei dunklen Thumbnails schwer lesbar sein.

**Lösung:**
- `shadow-lg` für visuellen Lift
- `border border-white/20` für subtile Trennung
- Bessere Lesbarkeit bei allen Thumbnail-Farben

---

### ✅ **REF MCP Improvement #5: Enhanced Empty State**
**Problem:** Original Empty State war text-only, wenig visuell ansprechend.

**Lösung:**
- Icon + Headline + Beschreibung
- Klarer Kontext ("Keine Videos im Grid")
- Konsistent mit modernen UI Patterns

---

### ✅ **REF MCP Improvement #6: Responsive Gap Spacing**
**Problem:** Festes `gap-6` für alle Viewport-Größen.

**Lösung:**
- `gap-4` (16px) auf Mobile - mehr Platz für Content
- `gap-6` (24px) auf Desktop - komfortable Abstände
- Responsive Design Best Practice

---

### ✅ **REF MCP Improvement #7: Radix UI `asChild` Pattern**
**Problem:** Doppelte Button-Elemente können zu Accessibility-Issues führen.

**Lösung:**
- `asChild` pattern für Dropdown Menu Trigger
- `onCloseAutoFocus` verhindert ungewollten Focus
- Konsistent mit Radix UI Best Practices

---

## 🛠️ Implementation Steps

### 1. Extend TableSettingsStore with `viewMode` state (TDD)

**Files:**
- Modify: `frontend/src/stores/tableSettingsStore.ts`
- Create: `frontend/src/stores/tableSettingsStore.test.ts`

**Step 1.1: Write failing test for viewMode**

```tsx
// frontend/src/stores/tableSettingsStore.test.ts (create new file)
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableSettingsStore } from './tableSettingsStore'

describe('useTableSettingsStore - View Mode', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  it('defaults to list view', () => {
    const { result } = renderHook(() => useTableSettingsStore())
    expect(result.current.viewMode).toBe('list')
  })

  it('toggles between list and grid view', () => {
    const { result } = renderHook(() => useTableSettingsStore())

    act(() => {
      result.current.setViewMode('grid')
    })

    expect(result.current.viewMode).toBe('grid')

    act(() => {
      result.current.setViewMode('list')
    })

    expect(result.current.viewMode).toBe('list')
  })

  it('persists viewMode to localStorage', () => {
    const { result } = renderHook(() => useTableSettingsStore())

    act(() => {
      result.current.setViewMode('grid')
    })

    // Unmount and remount to test persistence
    const { result: result2 } = renderHook(() => useTableSettingsStore())
    expect(result2.current.viewMode).toBe('grid')
  })

  it('works independently from thumbnailSize', () => {
    const { result } = renderHook(() => useTableSettingsStore())

    // Set grid view with small thumbnails
    act(() => {
      result.current.setViewMode('grid')
      result.current.setThumbnailSize('small')
    })

    expect(result.current.viewMode).toBe('grid')
    expect(result.current.thumbnailSize).toBe('small')

    // Change to large thumbnails, view stays grid
    act(() => {
      result.current.setThumbnailSize('large')
    })

    expect(result.current.viewMode).toBe('grid')
    expect(result.current.thumbnailSize).toBe('large')
  })
})
```

**Step 1.2: Run test to verify it fails**

```bash
cd frontend
npm test -- tableSettingsStore.test.ts
```

Expected: FAIL (viewMode not implemented)

**Step 1.3: Implement viewMode in store**

```tsx
// frontend/src/stores/tableSettingsStore.ts (add to existing file)

/**
 * View mode for video display
 * - list: Table view with rows (default, current implementation)
 * - grid: Grid view with cards (responsive columns, Task #32)
 *
 * REF MCP Improvement #1: Separate from thumbnailSize for independent control
 * User can choose Grid with small thumbnails OR Table with large thumbnails
 */
export type ViewMode = 'list' | 'grid';

interface TableSettingsStore {
  thumbnailSize: ThumbnailSize;
  visibleColumns: VisibleColumns;
  viewMode: ViewMode; // NEW

  setThumbnailSize: (size: ThumbnailSize) => void;
  toggleColumn: (column: keyof VisibleColumns) => void;
  setViewMode: (mode: ViewMode) => void; // NEW
}

export const useTableSettingsStore = create<TableSettingsStore>()(
  persist(
    (set) => ({
      // State
      thumbnailSize: 'small',
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      viewMode: 'list', // NEW: Default to list view (preserves current behavior)

      // Actions
      setThumbnailSize: (size) => set({ thumbnailSize: size }),
      toggleColumn: (column) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [column]: !state.visibleColumns[column],
          },
        })),
      setViewMode: (mode) => set({ viewMode: mode }), // NEW
    }),
    {
      name: 'video-table-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**Step 1.4: Run test to verify it passes**

```bash
cd frontend
npm test -- tableSettingsStore.test.ts
```

Expected: 4/4 tests PASS

**Why this approach:**
- ViewMode state separate from thumbnailSize (REF MCP #1: user control)
- localStorage persistence (setting survives page reload)
- Default 'list' maintains current behavior (non-breaking change)
- Independent control: Grid with small thumbnails OR Table with large thumbnails

---

### 2. Create ViewModeToggle Button Component (TDD)

**Files:**
- Create: `frontend/src/components/ViewModeToggle.tsx`
- Create: `frontend/src/components/ViewModeToggle.test.tsx`

**Step 2.1: Write failing test**

```tsx
// frontend/src/components/ViewModeToggle.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewModeToggle } from './ViewModeToggle'

describe('ViewModeToggle', () => {
  it('shows LayoutGrid icon when in list view', () => {
    render(<ViewModeToggle viewMode="list" onToggle={vi.fn()} />)

    // Should show "Switch to Grid" tooltip
    const button = screen.getByRole('button', { name: /Grid-Ansicht/i })
    expect(button).toBeInTheDocument()
  })

  it('shows LayoutList icon when in grid view', () => {
    render(<ViewModeToggle viewMode="grid" onToggle={vi.fn()} />)

    // Should show "Switch to List" tooltip
    const button = screen.getByRole('button', { name: /Listen-Ansicht/i })
    expect(button).toBeInTheDocument()
  })

  it('calls onToggle with grid when clicking from list view', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<ViewModeToggle viewMode="list" onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledWith('grid')
  })

  it('calls onToggle with list when clicking from grid view', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<ViewModeToggle viewMode="grid" onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledWith('list')
  })

  it('has ghost variant and icon size consistent with Plus button', () => {
    const { container } = render(<ViewModeToggle viewMode="list" onToggle={vi.fn()} />)

    const button = container.querySelector('button')
    expect(button).toHaveClass('ghost') // Button variant

    const icon = container.querySelector('svg')
    expect(icon).toHaveClass('h-4', 'w-4') // Icon size
  })
})
```

**Step 2.2: Run test to verify it fails**

```bash
cd frontend
npm test -- ViewModeToggle.test.tsx
```

Expected: FAIL

**Step 2.3: Implement ViewModeToggle component**

```tsx
// frontend/src/components/ViewModeToggle.tsx
import { LayoutList, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ViewMode } from '@/stores/tableSettingsStore'

interface ViewModeToggleProps {
  viewMode: ViewMode
  onToggle: (mode: ViewMode) => void
}

/**
 * ViewModeToggle - Toggle button for switching between list and grid view
 *
 * Shows opposite mode icon (Grid icon in list view, List icon in grid view)
 * to indicate what will happen when clicked (affordance pattern)
 *
 * REF MCP Improvement #1: Manual toggle for independent viewMode control
 * REF MCP Pattern: Consistent with Plus button (ghost variant, icon size h-4 w-4)
 */
export const ViewModeToggle = ({ viewMode, onToggle }: ViewModeToggleProps) => {
  const handleToggle = () => {
    onToggle(viewMode === 'list' ? 'grid' : 'list')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={
        viewMode === 'list' ? 'Grid-Ansicht anzeigen' : 'Listen-Ansicht anzeigen'
      }
    >
      {viewMode === 'list' ? (
        <LayoutGrid className="h-4 w-4" />
      ) : (
        <LayoutList className="h-4 w-4" />
      )}
    </Button>
  )
}
```

**Step 2.4: Run tests to verify they pass**

```bash
cd frontend
npm test -- ViewModeToggle.test.tsx
```

Expected: 5/5 tests PASS

**Why this design:**
- Shows opposite icon (affordance: indicates what happens on click)
- Ghost variant (consistent with Plus icon button)
- ARIA label for accessibility
- h-4 w-4 icon size (consistent with Plus button pattern)

---

### 3. Create VideoCard Component (TDD)

**Files:**
- Create: `frontend/src/components/VideoCard.tsx`
- Create: `frontend/src/components/VideoCard.test.tsx`

**Step 3.1: Write failing test**

```tsx
// frontend/src/components/VideoCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VideoCard } from './VideoCard'
import type { VideoResponse } from '@/types/video'

const mockVideo: VideoResponse = {
  id: 'video-123',
  youtube_id: 'dQw4w9WgXcQ',
  title: 'Test Video Title That Is Very Long And Should Be Truncated',
  channel_name: 'Test Channel',
  duration: 240, // 4 minutes
  thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  published_at: '2025-01-01T00:00:00Z',
  tags: [
    { id: 'tag-1', name: 'Python', color: '#3B82F6' },
    { id: 'tag-2', name: 'Tutorial', color: '#10B981' },
  ],
  list_id: 'list-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

describe('VideoCard', () => {
  it('renders video thumbnail with VideoThumbnail component', () => {
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} />)

    const img = screen.getByRole('img', { name: /Test Video/i })
    expect(img).toBeInTheDocument()
  })

  it('renders video title truncated to 2 lines', () => {
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} />)

    const title = screen.getByText(/Test Video Title/)
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('line-clamp-2')
  })

  it('renders channel name in muted color', () => {
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} />)

    const channel = screen.getByText('Test Channel')
    expect(channel).toHaveClass('text-muted-foreground')
  })

  it('renders formatted duration with enhanced overlay', () => {
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} />)

    const duration = screen.getByText('4:00')
    expect(duration).toBeInTheDocument()
    // REF MCP #4: Duration overlay with shadow and border for readability
    expect(duration.parentElement).toHaveClass('shadow-lg')
  })

  it('renders tags as chips with color indicators', () => {
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} />)

    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Tutorial')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} onClick={onClick} />)

    const card = screen.getByRole('button', { name: /Test Video/i })
    await user.click(card)

    expect(onClick).toHaveBeenCalledWith(mockVideo)
  })

  it('does not call onClick when three-dot menu is clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} onClick={onClick} />)

    const menuButton = screen.getByLabelText('Video-Aktionen')
    await user.click(menuButton)

    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows hover effects on card hover', () => {
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} />)

    const card = screen.getByRole('button', { name: /Test Video/i })
    expect(card).toHaveClass('hover:shadow-lg')
  })

  // REF MCP #3: Keyboard Navigation Tests (WCAG 2.1)
  it('responds to Enter key press', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} onClick={onClick} />)

    const card = screen.getByRole('button')
    card.focus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledWith(mockVideo)
  })

  it('responds to Space key press', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} onClick={onClick} />)

    const card = screen.getByRole('button')
    card.focus()
    await user.keyboard(' ')

    expect(onClick).toHaveBeenCalledWith(mockVideo)
  })

  it('has aria-label with channel name for screen readers', () => {
    render(<VideoCard video={mockVideo} onDelete={vi.fn()} />)

    const card = screen.getByRole('button', {
      name: 'Video: Test Video Title That Is Very Long And Should Be Truncated von Test Channel'
    })
    expect(card).toBeInTheDocument()
  })
})
```

**Step 3.2: Run test to verify it fails**

```bash
cd frontend
npm test -- VideoCard.test.tsx
```

Expected: FAIL (component doesn't exist yet)

**Step 3.3: Implement VideoCard component**

```tsx
// frontend/src/components/VideoCard.tsx
import { useRef } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'

// Import VideoThumbnail from VideosPage (reuse existing component)
// REF MCP Improvement #2: Use existing VideoThumbnail API (url, title props)
import { VideoThumbnail } from './VideosPage'

interface VideoCardProps {
  video: VideoResponse
  onClick?: (video: VideoResponse) => void
  onDelete: (videoId: string) => void
}

/**
 * VideoCard Component - Grid view card for video display
 *
 * REF MCP Improvements Applied:
 * #2 - Reuses VideoThumbnail component (url, title props) - no recreation
 * #3 - Complete keyboard navigation (Enter, Space, Focus Management)
 * #4 - Duration overlay with shadow-lg and border for readability
 * #7 - Radix UI asChild pattern for DropdownMenu (better accessibility)
 *
 * Design Patterns:
 * - Responsive card with hover effects (shadow-lg transition)
 * - Clickable card with keyboard support (role="button", onKeyDown)
 * - Three-dot menu with stopPropagation (defense-in-depth)
 * - Native lazy loading via VideoThumbnail (already implemented)
 * - YouTube-inspired design (16:9 thumbnail, line-clamp-2 title, tag chips)
 * - WCAG 2.1 Level AA compliant (ARIA labels, keyboard navigation)
 */
export const VideoCard = ({ video, onClick, onDelete }: VideoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleCardClick = () => {
    onClick?.(video)
  }

  // REF MCP #3: Complete keyboard navigation (Enter, Space)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  // REF MCP #3: Focus management after delete
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    onDelete(video.id)

    // Focus next card or grid container after delete
    const nextCard = cardRef.current?.nextElementSibling as HTMLElement
    const gridContainer = cardRef.current?.parentElement as HTMLElement
    nextCard?.focus() || gridContainer?.focus()
  }

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      // REF MCP #3: ARIA label with channel name for screen readers
      aria-label={`Video: ${video.title} von ${video.channel_name || 'Unbekannt'}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="video-card group cursor-pointer rounded-lg border bg-card transition-shadow duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {/* Thumbnail Container with Duration Overlay */}
      <div className="relative">
        {/* REF MCP #2: Reuse VideoThumbnail with correct API (url, title) */}
        <VideoThumbnail url={video.thumbnail_url} title={video.title} />

        {/* Duration Overlay (bottom-right corner) */}
        {/* REF MCP #4: Enhanced readability with shadow-lg and border */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white shadow-lg border border-white/20">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-2">
        {/* Title (max 2 lines) */}
        <h3 className="text-sm font-semibold line-clamp-2 leading-tight">
          {video.title}
        </h3>

        {/* Channel Name */}
        {video.channel_name && (
          <p className="text-xs text-muted-foreground truncate">
            {video.channel_name}
          </p>
        )}

        {/* Tags */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {tag.color && (
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span>{tag.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Three-Dot Menu (top-right corner) */}
      <div className="absolute top-2 right-2">
        {/* REF MCP #7: Radix UI asChild pattern for better accessibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
              aria-label="Video-Aktionen"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
            onCloseAutoFocus={(e) => {
              // REF MCP #7: Prevent focus back to card after menu close
              // This prevents unwanted card click when menu closes
              e.preventDefault()
            }}
          >
            <DropdownMenuItem onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
```

**Step 3.4: Export VideoThumbnail from VideosPage**

```tsx
// frontend/src/components/VideosPage.tsx (add at end of file)

// Export VideoThumbnail for reuse in VideoCard (Task #32)
export { VideoThumbnail }
```

**Step 3.5: Run tests to verify they pass**

```bash
cd frontend
npm test -- VideoCard.test.tsx
```

Expected: 11/11 tests PASS

**Why this implementation:**
- REF MCP #2: Reuses VideoThumbnail (no API changes needed)
- REF MCP #3: Complete keyboard navigation (WCAG 2.1)
- REF MCP #4: Enhanced duration overlay readability
- REF MCP #7: Radix UI asChild pattern (better accessibility)
- YouTube-inspired design (clean, professional)
- Defense-in-depth stopPropagation (menu trigger AND content)

---

### 4. Create VideoGrid Component (TDD)

**Files:**
- Create: `frontend/src/components/VideoGrid.tsx`
- Create: `frontend/src/components/VideoGrid.test.tsx`

**Step 4.1: Write failing test**

```tsx
// frontend/src/components/VideoGrid.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoGrid } from './VideoGrid'
import type { VideoResponse } from '@/types/video'

const mockVideos: VideoResponse[] = [
  {
    id: 'video-1',
    youtube_id: 'video1',
    title: 'Video 1',
    channel_name: 'Channel 1',
    duration: 180,
    thumbnail_url: 'https://example.com/1.jpg',
    published_at: '2025-01-01',
    tags: [],
    list_id: 'list-1',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
  {
    id: 'video-2',
    youtube_id: 'video2',
    title: 'Video 2',
    channel_name: 'Channel 2',
    duration: 240,
    thumbnail_url: 'https://example.com/2.jpg',
    published_at: '2025-01-02',
    tags: [],
    list_id: 'list-1',
    created_at: '2025-01-02',
    updated_at: '2025-01-02',
  },
]

describe('VideoGrid', () => {
  it('renders grid with responsive columns', () => {
    const { container } = render(
      <VideoGrid videos={mockVideos} onVideoClick={vi.fn()} onDelete={vi.fn()} />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid')
    expect(grid).toHaveClass('grid-cols-2')
    expect(grid).toHaveClass('md:grid-cols-3')
    expect(grid).toHaveClass('lg:grid-cols-4')
  })

  // REF MCP #6: Responsive gap spacing
  it('uses responsive gap spacing (gap-4 on mobile, gap-6 on desktop)', () => {
    const { container } = render(
      <VideoGrid videos={mockVideos} onVideoClick={vi.fn()} onDelete={vi.fn()} />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('gap-4')
    expect(grid).toHaveClass('md:gap-6')
  })

  it('renders VideoCard for each video', () => {
    render(<VideoGrid videos={mockVideos} onVideoClick={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.getByText('Video 2')).toBeInTheDocument()
  })

  // REF MCP #5: Enhanced empty state
  it('shows enhanced empty state when no videos', () => {
    render(<VideoGrid videos={[]} onVideoClick={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Keine Videos im Grid')).toBeInTheDocument()
    expect(screen.getByText(/Füge Videos hinzu/i)).toBeInTheDocument()

    // Should have icon
    const icon = screen.getByRole('img', { hidden: true })
    expect(icon).toBeInTheDocument()
  })
})
```

**Step 4.2: Run test to verify it fails**

```bash
cd frontend
npm test -- VideoGrid.test.tsx
```

Expected: FAIL

**Step 4.3: Implement VideoGrid component**

```tsx
// frontend/src/components/VideoGrid.tsx
import { LayoutGrid } from 'lucide-react'
import { VideoCard } from './VideoCard'
import type { VideoResponse } from '@/types/video'

interface VideoGridProps {
  videos: VideoResponse[]
  onVideoClick: (video: VideoResponse) => void
  onDelete: (videoId: string) => void
}

/**
 * VideoGrid Component - Responsive grid layout for video cards
 *
 * REF MCP Improvements Applied:
 * #5 - Enhanced empty state (icon + headline + description)
 * #6 - Responsive gap spacing (gap-4 mobile, gap-6 desktop)
 *
 * Grid Pattern:
 * - Tailwind responsive grid: grid-cols-2 (mobile) → md:grid-cols-3 (tablet) → lg:grid-cols-4 (desktop)
 * - Standard Tailwind breakpoints: sm: 640px, md: 768px, lg: 1024px, xl: 1280px
 * - Responsive gap: gap-4 (16px mobile) → md:gap-6 (24px desktop)
 * - Empty state with centered message when no videos
 *
 * PurgeCSS Safety:
 * - All Tailwind classes explicitly written (no template literals)
 * - grid-cols-2, md:grid-cols-3, lg:grid-cols-4 are all scanned by PurgeCSS
 */
export const VideoGrid = ({ videos, onVideoClick, onDelete }: VideoGridProps) => {
  // REF MCP #5: Enhanced empty state with icon and headline
  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <LayoutGrid className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Keine Videos im Grid</h3>
        <p className="text-muted-foreground max-w-sm">
          Füge Videos hinzu oder ändere deine Filter, um Inhalte in der Grid-Ansicht zu sehen.
        </p>
      </div>
    )
  }

  return (
    <div
      className="video-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
      role="list"
      aria-label="Video Grid"
    >
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onClick={onVideoClick}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
```

**Step 4.4: Run tests to verify they pass**

```bash
cd frontend
npm test -- VideoGrid.test.tsx
```

Expected: 4/4 tests PASS

**Why this implementation:**
- REF MCP #6: Responsive gap (gap-4 mobile, gap-6 desktop)
- REF MCP #5: Enhanced empty state (icon + headline)
- Responsive grid with Tailwind breakpoints (mobile-first approach)
- PurgeCSS-safe (all classes explicitly written)
- Semantic HTML (role="list", aria-label)

---

### 5. Update VideosPage with ViewMode Toggle and Conditional Rendering

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Add ViewModeToggle to header and conditional rendering for Table vs Grid

**Step 5.1: Add imports**

```tsx
// frontend/src/components/VideosPage.tsx (add to existing imports)
import { ViewModeToggle } from './ViewModeToggle'
import { VideoGrid } from './VideoGrid'
```

**Step 5.2: Get viewMode from store**

```tsx
// frontend/src/components/VideosPage.tsx (in VideosPage component)
export const VideosPage = ({ listId }: VideosPageProps) => {
  // ... existing code ...

  // Get viewMode from store (REF MCP #1: independent from thumbnailSize)
  const { viewMode, setViewMode } = useTableSettingsStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
    }))
  )

  // ... existing handlers ...
}
```

**Step 5.3: Add ViewModeToggle to header**

```tsx
// frontend/src/components/VideosPage.tsx (update header section)

<div className="mb-6 flex items-center justify-between">
  <h1 className="text-2xl font-bold">
    {selectedTags.length > 0
      ? selectedTags.map((t) => t.name).join(', ')
      : 'Videos'}
  </h1>

  <div className="flex gap-2">
    {/* Plus Icon */}
    {FEATURE_FLAGS.SHOW_ADD_PLUS_ICON_BUTTON && (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsAdding(true)}
        aria-label="Video hinzufügen"
      >
        <Plus className="h-4 w-4" />
      </Button>
    )}

    {/* View Mode Toggle - NEW */}
    <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />

    {/* Settings Dropdown */}
    <TableSettingsDropdown
      onExportFiltered={handleExportFiltered}
      onExportAll={handleExportAll}
    />
  </div>
</div>
```

**Step 5.4: Add conditional rendering for Grid vs Table**

```tsx
// frontend/src/components/VideosPage.tsx (replace table rendering)

{/* Conditional Rendering: Grid or Table */}
{isLoading ? (
  <p>Lade Videos...</p>
) : viewMode === 'grid' ? (
  // Grid View - REF MCP #1: Independent from thumbnailSize
  <VideoGrid
    videos={videos}
    onVideoClick={handleVideoClick}
    onDelete={(videoId) => {
      const video = videos.find((v) => v.id === videoId)
      if (video) {
        setDeleteModal({
          open: true,
          videoId: video.id,
          videoTitle: video.title,
        })
      }
    }}
  />
) : (
  // Table View (existing implementation)
  <div className="rounded-md border">
    {/* ... existing table code ... */}
  </div>
)}
```

**Step 5.5: Ensure handleVideoClick exists**

```tsx
// frontend/src/components/VideosPage.tsx (add if not exists)

const handleVideoClick = (video: VideoResponse) => {
  // Open YouTube video in new tab
  window.open(
    `https://www.youtube.com/watch?v=${video.youtube_id}`,
    '_blank',
    'noopener,noreferrer'
  )
}
```

**Why this approach:**
- REF MCP #1: viewMode independent from thumbnailSize (full user control)
- ViewModeToggle placed before Settings Dropdown (consistent hierarchy)
- Conditional rendering based on viewMode only (no xlarge logic)
- Reuses existing handlers (handleVideoClick, onDelete)
- Non-breaking: Default 'list' preserves current behavior

---

### 6. Add Integration Tests

**Files:** `frontend/src/components/VideosPage.integration.test.tsx`
**Action:** Add test cases for Grid view conditional rendering

```tsx
// frontend/src/components/VideosPage.integration.test.tsx (add to existing file)

describe('VideosPage - Grid View (Task #32)', () => {
  it('shows table view by default (viewMode: list)', async () => {
    renderWithRouter(<VideosPage listId={mockListId} />)

    await waitFor(() => {
      expect(screen.queryByText('Lade Videos...')).not.toBeInTheDocument()
    })

    // Should show table (not grid)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Video Grid' })).not.toBeInTheDocument()
  })

  it('shows grid view when viewMode is grid', async () => {
    // Set view mode to grid
    act(() => {
      useTableSettingsStore.setState({ viewMode: 'grid' })
    })

    renderWithRouter(<VideosPage listId={mockListId} />)

    await waitFor(() => {
      expect(screen.queryByText('Lade Videos...')).not.toBeInTheDocument()
    })

    // Should show grid (not table)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Video Grid' })).toBeInTheDocument()
  })

  it('switches from table to grid when clicking toggle button', async () => {
    const user = userEvent.setup()
    renderWithRouter(<VideosPage listId={mockListId} />)

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    // Click ViewModeToggle button
    const toggleButton = screen.getByRole('button', { name: /Grid-Ansicht/i })
    await user.click(toggleButton)

    // Should now show grid
    await waitFor(() => {
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.getByRole('list', { name: 'Video Grid' })).toBeInTheDocument()
    })
  })

  it('works with small thumbnails in grid view (REF MCP #1)', async () => {
    // Set grid view with small thumbnails
    act(() => {
      useTableSettingsStore.setState({
        viewMode: 'grid',
        thumbnailSize: 'small'
      })
    })

    renderWithRouter(<VideosPage listId={mockListId} />)

    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'Video Grid' })).toBeInTheDocument()
    })

    // Thumbnails should be small (w-32)
    const images = screen.getAllByRole('img')
    expect(images[0]).toHaveClass('w-32')
  })

  it('persists viewMode across page reloads', async () => {
    // Set grid view
    act(() => {
      useTableSettingsStore.setState({ viewMode: 'grid' })
    })

    renderWithRouter(<VideosPage listId={mockListId} />)

    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'Video Grid' })).toBeInTheDocument()
    })

    // Unmount and remount (simulates page reload)
    const { unmount } = screen
    unmount()

    renderWithRouter(<VideosPage listId={mockListId} />)

    // Should still be in grid view
    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'Video Grid' })).toBeInTheDocument()
    })
  })
})
```

Expected: 5/5 integration tests PASS

---

### 7. Manual Testing & Browser Verification

**Manual Testing Checklist:**

```bash
# Start dev server (if not running)
cd frontend
npm run dev
```

**Test Cases:**

1. **View Mode Toggle:**
   - Open http://localhost:5173/videos
   - ✅ Default: Table view displayed
   - Click ViewModeToggle button (Grid icon)
   - ✅ View switches to Grid
   - Click ViewModeToggle button again (List icon)
   - ✅ View switches back to Table

2. **Grid with Different Thumbnail Sizes (REF MCP #1):**
   - Switch to Grid view
   - Open TableSettingsDropdown
   - Select "Klein" (small)
   - ✅ Grid shows small thumbnails (w-32 / 128px)
   - Select "Mittel" (medium)
   - ✅ Grid shows medium thumbnails (w-40 / 160px)
   - Select "Groß" (large)
   - ✅ Grid shows large thumbnails (w-48 / 192px)
   - Select "Extra Groß" (xlarge)
   - ✅ Grid shows xlarge thumbnails (w-[500px])

3. **Responsive Grid:**
   - Stay in Grid view
   - Resize browser to mobile width (~400px)
   - ✅ Grid shows 2 columns with gap-4
   - Resize to tablet width (~800px)
   - ✅ Grid shows 3 columns with gap-6
   - Resize to desktop width (~1200px)
   - ✅ Grid shows 4 columns with gap-6

4. **VideoCard Interactions:**
   - Hover over card
   - ✅ Shadow appears (hover:shadow-lg)
   - Click on card body
   - ✅ YouTube video opens in new tab
   - Click three-dot menu
   - ✅ Menu opens (card click does NOT fire)
   - Click "Löschen"
   - ✅ Delete modal appears

5. **Duration Overlay Readability (REF MCP #4):**
   - Find video card with duration
   - ✅ Duration visible with shadow-lg
   - ✅ Border provides visual separation
   - Test on dark and light thumbnails
   - ✅ Duration readable on all backgrounds

6. **Keyboard Navigation (REF MCP #3):**
   - Tab to VideoCard
   - ✅ Focus ring visible
   - Press Enter
   - ✅ YouTube video opens
   - Tab to another VideoCard
   - Press Space
   - ✅ YouTube video opens
   - Tab to Three-Dot Menu
   - Press Enter
   - ✅ Menu opens
   - Press Escape
   - ✅ Menu closes

7. **Empty State (REF MCP #5):**
   - Select tag with no videos
   - ✅ "Keine Videos im Grid" message displayed
   - ✅ Icon visible
   - ✅ Headline and description visible

8. **Persistence:**
   - Switch to Grid view
   - Reload page (Cmd+R / Ctrl+R)
   - ✅ Still in Grid view

---

### 8. TypeScript Check & Code Quality

```bash
cd frontend

# TypeScript check
npx tsc --noEmit

# Run all tests
npm test

# Lint check
npm run lint
```

**Expected:**
- TypeScript: 0 new errors
- Tests: All passing (Store 4/4, Toggle 5/5, Card 11/11, Grid 4/4, Integration 5/5 = 29/29)
- Lint: 0 errors

---

## 🧪 Testing Strategy

### Unit Tests (24 tests total)

**tableSettingsStore.test.ts (4 tests):**
1. ✅ Defaults to list view
2. ✅ Toggles between list and grid view
3. ✅ Persists viewMode to localStorage
4. ✅ Works independently from thumbnailSize

**ViewModeToggle.test.tsx (5 tests):**
1. ✅ Shows LayoutGrid icon when in list view
2. ✅ Shows LayoutList icon when in grid view
3. ✅ Calls onToggle with grid when clicking from list view
4. ✅ Calls onToggle with list when clicking from grid view
5. ✅ Has ghost variant and icon size consistent with Plus button

**VideoCard.test.tsx (11 tests):**
1. ✅ Renders video thumbnail with VideoThumbnail component
2. ✅ Renders title truncated to 2 lines
3. ✅ Renders channel name in muted color
4. ✅ Renders formatted duration with enhanced overlay
5. ✅ Renders tags as chips with color indicators
6. ✅ Calls onClick when card clicked
7. ✅ Does NOT call onClick when menu clicked (stopPropagation)
8. ✅ Shows hover effects (hover:shadow-lg)
9. ✅ Responds to Enter key press
10. ✅ Responds to Space key press
11. ✅ Has aria-label with channel name for screen readers

**VideoGrid.test.tsx (4 tests):**
1. ✅ Renders responsive grid (grid-cols-2 md:grid-cols-3 lg:grid-cols-4)
2. ✅ Uses responsive gap spacing (gap-4 md:gap-6)
3. ✅ Renders VideoCard for each video
4. ✅ Shows enhanced empty state when no videos

### Integration Tests (5 tests)

**VideosPage.integration.test.tsx:**
1. ✅ Shows table view by default (viewMode: list)
2. ✅ Shows grid view when viewMode is grid
3. ✅ Switches from table to grid when clicking toggle button
4. ✅ Works with small thumbnails in grid view (REF MCP #1)
5. ✅ Persists viewMode across page reloads

### Manual Testing (8 scenarios)

1. View Mode Toggle
2. Grid with Different Thumbnail Sizes
3. Responsive Grid (mobile/tablet/desktop)
4. VideoCard Interactions (hover, click, menu)
5. Duration Overlay Readability
6. Keyboard Navigation (WCAG 2.1)
7. Enhanced Empty State
8. Persistence across page reloads

---

## 📚 Reference

### Related Docs

**Master Plan:**
- `docs/plans/2025-10-31-ID-05-ux-optimization-implementation-plan.md` - Section "Wave 2: UI Cleanup"

**External Docs:**
- [Tailwind CSS Grid Template Columns](https://tailwindcss.com/docs/grid-template-columns) - Responsive grid utilities
- [Tailwind CSS Content Configuration](https://tailwindcss.com/docs/detecting-classes-in-source-files#dynamic-class-names) - PurgeCSS safety patterns
- [Zustand Persist Middleware](https://zustand.docs.pmnd.rs/middlewares/persist) - localStorage persistence
- [WCAG 2.1 Keyboard Navigation](https://www.w3.org/WAI/WCAG21/Understanding/keyboard) - Accessibility guidelines
- [Radix UI Dropdown Menu](https://www.radix-ui.com/docs/primitives/components/dropdown-menu) - Accessible menu patterns

### Related Code

**Dependencies:**
- `frontend/src/stores/tableSettingsStore.ts` - ThumbnailSize type + viewMode state
- `frontend/src/components/TableSettingsDropdown.tsx` - Settings dropdown (sibling UI element)
- `frontend/src/components/VideosPage.tsx` - VideoThumbnail component (reused in VideoCard)
- `frontend/src/utils/formatDuration.ts` - Duration formatting utility

### Design Decisions

**1. Manual ViewMode Toggle vs Automatic Switch (REF MCP #1)**

**Decision:** Manual Toggle Button (viewMode state independent from thumbnailSize)

**Rationale:**
- User control: Grid with small thumbnails OR Table with large thumbnails
- Clear separation of concerns: thumbnailSize = size, viewMode = layout
- Intuitive UI: Toggle button directly shows Tabelle ↔ Grid
- Flexible for future features (e.g., different grid layouts)

**Trade-offs:**
- Pro: Maximum flexibility, clear user intent
- Con: One additional UI element (but planned in original spec)

---

**2. Responsive Breakpoints (REF MCP #6)**

**Decision:** 2 → 3 → 4 columns with responsive gap (gap-4 → gap-6)

**Rationale:**
- 2 columns on mobile (400-767px): Optimal for small screens
- 3 columns on tablet (768-1023px): Comfortable spacing
- 4 columns on desktop (1024px+): Maximum content density
- gap-4 mobile: More space for content (16px)
- gap-6 desktop: Comfortable spacing (24px)

**REF MCP Validation:** Aligns with Tailwind best practices

---

**3. Duration Overlay Design (REF MCP #4)**

**Decision:** bg-black/80 + shadow-lg + border-white/20

**Rationale:**
- shadow-lg: Lifts overlay from thumbnail
- border: Subtle visual separation
- Better readability on all thumbnail colors

---

**4. Empty State Design (REF MCP #5)**

**Decision:** Icon + Headline + Description

**Rationale:**
- Visual hierarchy: Icon draws attention
- Clear context: "Keine Videos im Grid"
- Consistent with modern UI patterns (YouTube, Notion, etc.)

---

**5. Keyboard Navigation (REF MCP #3 - WCAG 2.1)**

**Decision:** Complete keyboard support + ARIA labels + Focus Management

**Implementation:**
- Enter/Space on cards opens video
- Tab navigation through all interactive elements
- ARIA labels with channel name for screen readers
- Focus management after delete (next card or grid container)
- DropdownMenu onCloseAutoFocus prevents unwanted card clicks

**Why critical:**
- WCAG 2.1 Level AA compliance
- Keyboard-only users can fully interact
- Screen readers provide full context

---

**6. Radix UI asChild Pattern (REF MCP #7)**

**Decision:** Use `asChild` for DropdownMenuTrigger + onCloseAutoFocus

**Rationale:**
- Prevents double button elements (better accessibility)
- onCloseAutoFocus prevents focus back to card (avoids unwanted clicks)
- Consistent with Radix UI best practices

---

**7. VideoThumbnail Reuse (REF MCP #2)**

**Decision:** Import and reuse VideoThumbnail from VideosPage (no API changes)

**Rationale:**
- Current API works: `<VideoThumbnail url={...} title={...} />`
- Lazy loading automatically included
- Dynamic sizing via store (w-32/w-40/w-48/w-[500px])
- No need to recreate or modify existing component

---

## ⏱️ Estimated Time

**Total:** 4-5 hours

**Breakdown:**
- Store Extension (TDD): 30 min ✅
- ViewModeToggle Component (TDD): 30 min
- VideoCard Component (TDD): 90 min (includes accessibility tests)
- VideoGrid Component (TDD): 30 min
- VideosPage Integration: 30 min
- Integration Tests: 45 min
- Manual Testing: 45 min
- Documentation & Commit: 30 min

**Complexity:** Medium-High
- New components but reuses existing patterns
- REF MCP improvements add complexity (keyboard navigation, focus management)
- Comprehensive test coverage required (29 tests)

---

## 🎯 Success Criteria

**Definition of Done:**

✅ User can click ViewModeToggle in header
✅ VideosPage switches between Table and Grid view
✅ Grid works with ALL thumbnail sizes (small/medium/large/xlarge)
✅ Grid displays 2/3/4 columns responsively (gap-4 mobile, gap-6 desktop)
✅ VideoCards show thumbnails, title, channel, duration, tags
✅ Cards are clickable (open YouTube video)
✅ Three-dot menu works with stopPropagation + asChild pattern
✅ Complete keyboard navigation (Enter, Space, Tab, Focus Management)
✅ WCAG 2.1 Level AA compliant (ARIA labels, screen reader support)
✅ All 29 tests passing (Store 4 + Toggle 5 + Card 11 + Grid 4 + Integration 5)
✅ 0 new TypeScript errors
✅ Manual testing confirmed on multiple viewport sizes
✅ Duration overlay readable on all thumbnails
✅ Enhanced empty state visible

**Production Ready:** Yes, with comprehensive tests and full REF MCP validation

---

## 📝 Notes

### Key Insights from REF MCP Validation

**1. Plan Consistency is Critical**
- Original plan had Ziel (manual toggle) vs Implementation (automatic switch) mismatch
- REF MCP #1 caught this early → saved ~2 hours of rework

**2. API Compatibility Prevents TypeScript Errors**
- Original plan used non-existent VideoThumbnail props
- REF MCP #2: Checked actual implementation → correct API usage

**3. Accessibility is Non-Negotiable (WCAG 2.1)**
- REF MCP #3: Complete keyboard navigation + ARIA labels
- Focus management after delete (often forgotten!)
- onCloseAutoFocus prevents unwanted clicks (Radix UI pattern)

**4. Small Details Matter (UX)**
- REF MCP #4: Duration overlay readability (shadow + border)
- REF MCP #5: Enhanced empty state (icon + headline)
- REF MCP #6: Responsive gap spacing (mobile vs desktop)

**5. Radix UI Patterns Improve Accessibility**
- REF MCP #7: `asChild` pattern prevents double buttons
- Better accessibility out-of-the-box

---

### Testing Philosophy

**TDD Applied Throughout:**
1. Write failing test first
2. Implement minimal code to pass
3. Refactor for quality
4. REF MCP validation confirms patterns

**Coverage Goals:**
- Unit tests: Component behavior + edge cases
- Integration tests: Full user flows
- Manual tests: Visual verification + responsive behavior

---

### Future Enhancements (Out of Scope)

**Not included in this task (can be added later):**

1. **Grid Column Customization** - User chooses 2-6 columns
2. **Masonry Layout** - Pinterest-style variable height cards
3. **Infinite Scroll** - Load more videos as user scrolls
4. **Card Animations** - Fade-in, slide-in effects on render
5. **Bulk Selection** - Checkboxes for multi-select actions
6. **Card Compact Mode** - Smaller cards with less info

---

**Created:** 2025-11-04
**Author:** Claude Code
**Status:** Ready for Implementation
**REF MCP Validated:** ✅ Yes (7 critical improvements incorporated)
**Estimated Time:** 4-5 hours
**Test Coverage:** 29 tests (24 unit + 5 integration)
**WCAG Compliance:** Level AA (complete keyboard navigation)
