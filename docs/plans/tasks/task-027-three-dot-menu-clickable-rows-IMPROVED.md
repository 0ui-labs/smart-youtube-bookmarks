# Task #27: Replace Actions Column with Three-Dot Menu (IMPROVED with REF MCP)

**Plan Task:** #27
**Wave/Phase:** Wave 2 UI Cleanup
**Dependencies:** Task #26 (TableSettingsDropdown with shadcn/ui dropdown-menu installed)
**REF MCP Validated:** ✅ Yes - All hallucinations removed, Best practices applied

---

## 🎯 Ziel

Replace the current "Aktionen" column (with visible "Löschen" button) with a compact three-dot menu (⋮) that contains the delete action. Additionally, make table rows clickable to open videos in a new tab, while preventing row clicks when interacting with the menu.

**Expected Result:** Users can click anywhere on a row to open the video, but clicking the three-dot menu opens a dropdown with delete action instead.

---

## ✅ REF MCP Improvements Applied

1. **No Custom DropdownMenu Component** - Use existing shadcn/ui from Task #26
2. **stopPropagation on Trigger** - Prevent menu trigger from firing row click
3. **tabIndex=-1 on Menu** - Better keyboard navigation (avoid tab-trap)
4. **Remove Title Link** - Eliminate competing click handlers
5. **Hover State Management** - Visual feedback only when appropriate
6. **Comprehensive Tests** - Edge cases for menu-row interaction

---

## 📋 Acceptance Criteria

- [ ] Actions column replaced with compact three-dot menu column
- [ ] Three-dot menu uses existing shadcn/ui DropdownMenu components
- [ ] Menu trigger has stopPropagation on click AND keyboard events
- [ ] Three-dot menu contains "Löschen" item with trash icon
- [ ] Clicking row (except menu) opens video in new tab
- [ ] Clicking menu trigger does NOT trigger row click
- [ ] Clicking menu items does NOT trigger row click
- [ ] Title column is plain text (no link)
- [ ] Menu button has tabIndex={-1} for better tab navigation
- [ ] Keyboard navigation works (Enter/Space opens video, Esc closes menu)
- [ ] Visual feedback: hover state on rows, separate hover on menu
- [ ] Tests passing (row click, menu click isolation, keyboard navigation, edge cases)
- [ ] Code reviewed (Subagent + verification)

---

## 🛠️ Implementation Tasks

### Task 1: Replace Actions Column with shadcn/ui DropdownMenu

**File:** `frontend/src/components/VideosPage.tsx`

**Action 1:** Add imports for shadcn/ui components (line ~17)
```typescript
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
```

**Action 2:** Replace Actions column definition (lines 176-191)
```typescript
// OLD: Column 4: Actions with button
columnHelper.accessor('id', {
  id: 'actions',
  header: 'Aktionen',
  cell: (info) => (
    <button onClick={() => {...}}>Löschen</button>
  ),
}),

// NEW: Column 4: Three-dot menu
columnHelper.accessor('id', {
  id: 'menu',
  header: '', // No header text - just icon column
  cell: (info) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
        tabIndex={-1}
        className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Aktionen"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm('Video wirklich löschen?')) {
              deleteVideo.mutate(info.getValue())
            }
          }}
          className="text-red-600 focus:text-red-700 cursor-pointer"
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
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}),
```

**Why:**
- ✅ Uses existing shadcn/ui components (no new code)
- ✅ `stopPropagation()` on trigger prevents row click
- ✅ `stopPropagation()` on keyboard events (Enter/Space)
- ✅ `tabIndex={-1}` keeps menu out of tab order (better UX)
- ✅ `align="end"` (Radix UI API) for right-alignment
- ✅ Three-dot SVG icon inline
- ✅ Trash icon with delete text
- ✅ `aria-label` for accessibility

**Tests to write:**
- Render test: Three-dot menu appears
- Click test: Menu trigger does NOT open video
- Menu item click: Delete action works, video does NOT open

---

### Task 2: Make Table Rows Clickable

**File:** `frontend/src/components/VideosPage.tsx`

**Action:** Update tbody rendering (lines 475-487)
```typescript
// OLD: Static rows
<tbody className="bg-white divide-y divide-gray-200">
  {table.getRowModel().rows.map((row) => (
    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-6 py-4">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  ))}
</tbody>

// NEW: Clickable rows
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
          <td key={cell.id} className="px-6 py-4">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    )
  })}
</tbody>
```

**Why:**
- ✅ `onClick` handler opens video in new tab
- ✅ `onKeyDown` supports Enter and Space keys
- ✅ `role="button"` for screen reader accessibility
- ✅ `tabIndex={0}` makes row focusable
- ✅ `cursor-pointer` shows clickable cursor
- ✅ `hover:bg-gray-50` for visual feedback
- ✅ `noopener,noreferrer` for security (prevents window.opener vulnerability)

**Tests to write:**
- Click test: Row click opens video in new tab
- Keyboard test: Enter/Space on row opens video
- Focus test: Row receives focus with Tab key

---

### Task 3: Remove Link from Title Column

**File:** `frontend/src/components/VideosPage.tsx`

**Action:** Update title column cell (lines 134-158)
```typescript
// OLD: Title with link
columnHelper.accessor('title', {
  id: 'title',
  header: 'Titel',
  cell: (info) => {
    const row = info.row.original
    const title = info.getValue() || `Video ${row.youtube_id}`
    const channel = row.channel
    const youtubeUrl = `https://www.youtube.com/watch?v=${row.youtube_id}`

    return (
      <div className="flex flex-col gap-1 min-w-[200px] max-w-[400px]">
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-900 hover:text-blue-600 hover:underline line-clamp-2 leading-tight"
          title={title}
        >
          {title}
        </a>
        {channel && (
          <span className="text-sm text-gray-600 truncate">
            {channel}
          </span>
        )}
      </div>
    )
  },
}),

// NEW: Title without link (plain text)
columnHelper.accessor('title', {
  id: 'title',
  header: 'Titel',
  cell: (info) => {
    const row = info.row.original
    const title = info.getValue() || `Video ${row.youtube_id}`
    const channel = row.channel

    return (
      <div className="flex flex-col gap-1 min-w-[200px] max-w-[400px]">
        <span
          className="font-medium text-gray-900 line-clamp-2 leading-tight"
          title={title}
        >
          {title}
        </span>
        {channel && (
          <span className="text-sm text-gray-600 truncate">
            {channel}
          </span>
        )}
      </div>
    )
  },
}),
```

**Why:**
- ✅ Removes competing click handler
- ✅ Clear single responsibility (row is clickable, not title)
- ✅ No nested button/link accessibility conflict
- ✅ Keeps `title` attribute for tooltip
- ✅ Maintains visual styling (font-medium, line-clamp)

**Tests to write:**
- Render test: Title displays as text, not link
- No <a> tag in title column

---

### Task 4: Add Comprehensive Tests

**File:** Create `frontend/src/components/VideosPage.rowclick.test.tsx`

**Action:** Create test suite for row click and menu interaction
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VideosPage } from './VideosPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithRouter } from '@/test/renderWithRouter'

// Mock hooks
vi.mock('@/hooks/useVideos', () => ({
  useVideos: vi.fn(() => ({
    data: [
      {
        id: 'video-1',
        youtube_id: 'dQw4w9WgXcQ',
        title: 'Test Video',
        channel: 'Test Channel',
        duration: 210,
        thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
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

vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}))

vi.mock('@/stores/tagStore', () => ({
  useTagStore: vi.fn((selector) =>
    selector({
      selectedTagIds: [],
      toggleTag: vi.fn(),
      clearTags: vi.fn(),
    })
  ),
}))

describe('VideosPage - Row Click & Menu Interaction', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const renderVideosPage = () =>
    renderWithRouter(
      <QueryClientProvider client={queryClient}>
        <VideosPage listId="list-1" />
      </QueryClientProvider>
    )

  beforeEach(() => {
    vi.clearAllMocks()
    global.window.open = vi.fn()
    global.window.confirm = vi.fn(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Row Click Behavior', () => {
    it('should open video in new tab when clicking row', async () => {
      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      const row = screen.getByRole('button', { name: /test video/i })
      fireEvent.click(row)

      expect(window.open).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('should open video when pressing Enter on row', async () => {
      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      const row = screen.getByRole('button', { name: /test video/i })
      row.focus()
      fireEvent.keyDown(row, { key: 'Enter' })

      expect(window.open).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('should open video when pressing Space on row', async () => {
      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      const row = screen.getByRole('button', { name: /test video/i })
      row.focus()
      fireEvent.keyDown(row, { key: ' ' })

      expect(window.open).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  describe('Menu Click Isolation', () => {
    it('should NOT open video when clicking menu trigger', async () => {
      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      const menuButton = screen.getByLabelText('Aktionen')
      fireEvent.click(menuButton)

      expect(window.open).not.toHaveBeenCalled()

      // Menu should be open
      await waitFor(() => {
        expect(screen.getByText('Löschen')).toBeInTheDocument()
      })
    })

    it('should NOT open video when clicking delete menu item', async () => {
      const { useDeleteVideo } = await import('@/hooks/useVideos')
      const mockMutate = vi.fn()
      vi.mocked(useDeleteVideo).mockReturnValue({ mutate: mockMutate } as any)

      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      // Open menu
      const menuButton = screen.getByLabelText('Aktionen')
      fireEvent.click(menuButton)

      // Click delete
      await waitFor(() => {
        expect(screen.getByText('Löschen')).toBeInTheDocument()
      })
      const deleteItem = screen.getByText('Löschen')
      fireEvent.click(deleteItem)

      // Confirm dialog shown
      expect(window.confirm).toHaveBeenCalledWith('Video wirklich löschen?')

      // Delete mutation called
      expect(mockMutate).toHaveBeenCalledWith('video-1')

      // Video NOT opened
      expect(window.open).not.toHaveBeenCalled()
    })

    it('should close menu when pressing Escape', async () => {
      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      // Open menu
      const menuButton = screen.getByLabelText('Aktionen')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Löschen')).toBeInTheDocument()
      })

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' })

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByText('Löschen')).not.toBeInTheDocument()
      })

      // Video should NOT open
      expect(window.open).not.toHaveBeenCalled()
    })
  })

  describe('Title Column', () => {
    it('should render title as text, not link', async () => {
      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      const title = screen.getByText('Test Video')

      // Should be span, not <a>
      expect(title.tagName).toBe('SPAN')

      // Should not have href
      expect(title).not.toHaveAttribute('href')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should allow tabbing through rows without stopping at menu buttons', async () => {
      renderVideosPage()

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      const row = screen.getByRole('button', { name: /test video/i })
      const menuButton = screen.getByLabelText('Aktionen')

      // Menu button should have tabIndex -1
      expect(menuButton).toHaveAttribute('tabIndex', '-1')

      // Row should have tabIndex 0
      expect(row).toHaveAttribute('tabIndex', '0')
    })
  })
})
```

**Why:**
- ✅ Comprehensive coverage of row-menu interaction
- ✅ Tests stopPropagation works (menu click doesn't trigger row)
- ✅ Tests keyboard navigation (Enter/Space/Escape)
- ✅ Tests title is text, not link
- ✅ Tests tabIndex values for proper tab order
- ✅ Uses proper test isolation (beforeEach/afterEach)

---

## 🎯 Success Criteria

After all tasks complete:
- [ ] All tests passing (existing + new row click tests)
- [ ] No console errors in dev server
- [ ] Manual verification: Row click opens video
- [ ] Manual verification: Menu click does NOT open video
- [ ] Manual verification: Delete action works from menu
- [ ] Manual verification: Tab navigation flows through rows smoothly
- [ ] Code review passed (no Critical/Important issues)

---

## 📝 Notes

**REF MCP Validation Applied:**
- Removed hallucinated custom DropdownMenu component
- Added stopPropagation on trigger AND keyboard events
- Added tabIndex=-1 on menu for better keyboard UX
- Removed link from title column (competing click handler)
- Added comprehensive tests for edge cases

**shadcn/ui Components Used:**
- DropdownMenu (root component)
- DropdownMenuTrigger (button with three dots)
- DropdownMenuContent (popup container)
- DropdownMenuItem (delete action)

**Security:**
- window.open with 'noopener,noreferrer' prevents window.opener vulnerability
- Confirm dialog before delete action

**Accessibility:**
- role="button" on clickable rows
- tabIndex={0} on rows, tabIndex={-1} on menu (avoid tab trap)
- aria-label="Aktionen" on menu trigger
- Keyboard support: Enter, Space, Escape

---

**Implementation Approach:** Subagent-Driven Development
- Task 1: Implementation subagent → Code review → Commit
- Task 2: Implementation subagent → Code review → Commit
- Task 3: Implementation subagent → Code review → Commit
- Task 4: Test implementation subagent → Code review → Commit
- Final: Overall code review → Finishing development branch
