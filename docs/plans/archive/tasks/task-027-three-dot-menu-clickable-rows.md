Ich habe den Plan für Task #27 überprüft und an die Codebase angepasst. Hier ist der vollständige, überarbeitete Plan:Basierend auf der Analyse der Codebase sehe ich, dass das Projekt **keine shadcn/ui Komponenten** verwendet, sondern eine einfachere Setup mit Tailwind CSS. Ich muss den Plan entsprechend anpassen. Hier ist der vollständige, überarbeitete Plan:

# Task #27: Replace Actions Column with Three-Dot Menu

**Plan Task:** #27
**Wave/Phase:** Wave 2 UI Cleanup
**Dependencies:** None (Simplified implementation without shadcn/ui dependencies)

---

## 🎯 Ziel

Replace the current "Aktionen" column (with visible "Löschen" button) with a compact three-dot menu (⋮) that contains the delete action. Additionally, make table rows clickable to open videos in a new tab, while preventing row clicks when interacting with the menu.

**Expected Result:** Users can click anywhere on a row to open the video, but clicking the three-dot menu opens a dropdown with delete action instead.

---

## REF MCP Validation Results

⚠️ **UI Library Update** - Project uses Tailwind CSS without shadcn/ui components - need to build custom dropdown
✅ **React Event Handling** - event.stopPropagation() required to prevent row click when menu clicked
💡 **Best Practice: Three dots pattern** - Build simple dropdown with CSS/JS, no external component library needed
💡 **Row click handler pattern** - Use `onClick` on `<tr>` with keyboard support (Enter/Space)
💡 **Accessibility: role="button"** - Table rows acting as buttons need explicit ARIA role
💡 **Cursor feedback** - Use `cursor-pointer` class on clickable rows, `hover:bg-gray-50` for visual feedback

---

## 📋 Acceptance Criteria

- [ ] Actions column replaced with compact three-dot menu column
- [ ] Three-dot menu contains "Löschen" item with text
- [ ] Clicking row (except menu) opens video in new tab
- [ ] Clicking menu trigger/items does NOT trigger row click
- [ ] Keyboard navigation works (Enter/Space opens video, Esc closes menu)
- [ ] Visual feedback: hover state on rows, cursor pointer
- [ ] Tests passing (row click, menu click isolation, keyboard navigation)
- [ ] Code reviewed (Subagent + verification)

---

## 🛠️ Implementation Steps

### 1. Create Custom Dropdown Menu Component

**Files:** Create `frontend/src/components/DropdownMenu.tsx`
**Action:** Build a simple dropdown menu component

```typescript
import { useState, useRef, useEffect } from 'react'

interface DropdownMenuProps {
  children: React.ReactNode
  trigger: React.ReactNode
  align?: 'left' | 'right'
}

export const DropdownMenu = ({ children, trigger, align = 'right' }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Aktionen"
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-32 mt-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1" role="none">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

interface DropdownMenuItemProps {
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
  className?: string
}

export const DropdownMenuItem = ({ onClick, children, className = '' }: DropdownMenuItemProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      onClick(e as any)
    }
  }

  return (
    <button
      className={`group flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors ${className}`}
      role="menuitem"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  )
}
```

**Why:**
- **Custom implementation**: No external dependencies, works with existing Tailwind CSS setup
- **stopPropagation**: Critical to prevent row click when menu interactions happen
- **Keyboard support**: Enter/Space/Escape keys for accessibility
- **Click outside**: Closes menu when clicking elsewhere
- **ARIA attributes**: Proper accessibility support

---

### 2. Update Column Definition - Replace Actions with Menu

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Replace the "Aktionen" column with a three-dot menu column

**Add imports at the top:**
```typescript
import { DropdownMenu, DropdownMenuItem } from './DropdownMenu'
```

**Replace the actions column (lines ~172-186) with:**
```typescript
columnHelper.accessor('id', {
  id: 'menu',
  header: '', // No header text
  cell: (info) => (
    <DropdownMenu
      align="right"
      trigger={
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      }
    >
      <DropdownMenuItem
        className="text-red-600 hover:text-red-700"
        onClick={() => {
          if (window.confirm('Video wirklich löschen?')) {
            deleteVideo.mutate(info.getValue())
          }
        }}
      >
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        Löschen
      </DropdownMenuItem>
    </DropdownMenu>
  ),
}),
```

**Why:**
- **Three dots SVG**: Simple vertical dots icon (⋮) using inline SVG
- **Trash icon**: Visual indicator for delete action
- **align="right"**: Dropdown appears aligned to right side of menu button
- **Custom styling**: Tailwind classes for red text on delete item

---

### 3. Make Table Rows Clickable

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Add click handler to table rows to open videos

**Find the table rendering section (around line 350+) and replace the tbody:**
```typescript
<tbody className="bg-white divide-y divide-gray-200">
  {table.getRowModel().rows.map((row) => {
    const video = row.original
    const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtube_id}`

    const handleRowClick = () => {
      window.open(youtubeUrl, '_blank', 'noopener,noreferrer')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleRowClick()
      }
    }

    return (
      <tr
        key={row.id}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className="cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-100"
      >
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    )
  })}
</tbody>
```

**Why:**
- **onClick + onKeyDown**: Mouse and keyboard support for accessibility
- **role="button"**: ARIA role for clickable rows (semantic HTML)
- **tabIndex={0}**: Makes row focusable with keyboard
- **hover:bg-gray-50**: Visual feedback on hover
- **cursor-pointer**: Shows clickable cursor
- **noopener,noreferrer**: Security best practice for `window.open`

---

### 4. Remove Link from Title Column

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Simplify title column since row is now clickable

**Replace the title column cell (around line 110-125) with:**
```typescript
columnHelper.accessor('youtube_id', {
  id: 'title',
  header: 'Titel',
  cell: (info) => {
    const youtubeId = info.getValue()
    return (
      <span className="font-semibold text-gray-900">
        Video {youtubeId}
      </span>
    )
  },
}),
```

**Why:**
- **Remove redundant link**: Row click now handles navigation
- **Simple text display**: Cleaner appearance, no conflicting click handlers
- **font-semibold**: Maintains visual hierarchy

---

### 5. Add Tests for Row Click Behavior

**Files:** Create `frontend/src/components/VideosPage.test.tsx`
**Action:** Test row clicks, menu clicks, and keyboard navigation

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { VideosPage } from './VideosPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock hooks
vi.mock('@/hooks/useVideos', () => ({
  useVideos: vi.fn(() => ({
    data: [
      {
        id: 'video-1',
        youtube_id: 'dQw4w9WgXcQ',
        processing_status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    isLoading: false,
    error: null,
  })),
  useCreateVideo: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useDeleteVideo: vi.fn(() => ({ mutate: vi.fn() })),
  exportVideosCSV: vi.fn(),
}))

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    jobProgress: new Map(),
    reconnecting: false,
    historyError: null,
  })),
}))

describe('VideosPage - Row Click & Menu', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const renderVideosPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <VideosPage listId="list-1" onBack={() => {}} />
      </QueryClientProvider>
    )

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.open
    global.window.open = vi.fn()
  })

  after