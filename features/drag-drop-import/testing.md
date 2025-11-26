# Testing Strategy: Drag & Drop Video Import

## Test-Pyramide

```
        ┌───────────┐
        │   E2E     │  2-3 Tests (kritische Flows)
        │  Tests    │
        ├───────────┤
        │Integration│  5-8 Tests (Komponenten-Zusammenspiel)
        │  Tests    │
        ├───────────┤
        │   Unit    │  20-30 Tests (Utilities, Hooks)
        │  Tests    │
        └───────────┘
```

---

## Unit Tests

### 1. URL Parser (`urlParser.test.ts`)

**Datei:** `/frontend/src/__tests__/utils/urlParser.test.ts`

```typescript
describe('extractYouTubeId', () => {
  // Gültige Formate
  it('extracts ID from youtube.com/watch?v=ID', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ')
  })

  it('extracts ID from youtu.be/ID', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ')
  })

  it('extracts ID from youtube.com/embed/ID', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ')
  })

  it('extracts ID with additional parameters', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s'))
      .toBe('dQw4w9WgXcQ')
  })

  // Ungültige Formate
  it('returns null for non-YouTube URLs', () => {
    expect(extractYouTubeId('https://vimeo.com/123456')).toBeNull()
  })

  it('returns null for invalid YouTube URLs', () => {
    expect(extractYouTubeId('https://youtube.com/invalid')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractYouTubeId('')).toBeNull()
  })
})

describe('parseUrlsFromText', () => {
  it('parses single URL', () => {
    expect(parseUrlsFromText('https://youtube.com/watch?v=abc123'))
      .toEqual(['https://youtube.com/watch?v=abc123'])
  })

  it('parses newline-separated URLs', () => {
    const text = `https://youtube.com/watch?v=abc
https://youtube.com/watch?v=def`
    expect(parseUrlsFromText(text)).toHaveLength(2)
  })

  it('parses comma-separated URLs', () => {
    const text = 'https://youtube.com/watch?v=abc, https://youtube.com/watch?v=def'
    expect(parseUrlsFromText(text)).toHaveLength(2)
  })

  it('filters out non-YouTube URLs', () => {
    const text = `https://youtube.com/watch?v=abc
https://google.com
https://youtube.com/watch?v=def`
    expect(parseUrlsFromText(text)).toHaveLength(2)
  })

  it('handles empty text', () => {
    expect(parseUrlsFromText('')).toEqual([])
  })

  it('deduplicates URLs', () => {
    const text = `https://youtube.com/watch?v=abc
https://youtube.com/watch?v=abc`
    expect(parseUrlsFromText(text)).toHaveLength(1)
  })
})

describe('parseWeblocFile', () => {
  it('parses valid .webloc file', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>https://www.youtube.com/watch?v=dQw4w9WgXcQ</string>
</dict>
</plist>`
    const file = new File([xml], 'test.webloc', { type: 'text/xml' })
    expect(await parseWeblocFile(file)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('returns null for invalid XML', async () => {
    const file = new File(['invalid xml'], 'test.webloc')
    expect(await parseWeblocFile(file)).toBeNull()
  })

  it('returns null for webloc without URL', async () => {
    const xml = `<?xml version="1.0"?><plist><dict></dict></plist>`
    const file = new File([xml], 'test.webloc')
    expect(await parseWeblocFile(file)).toBeNull()
  })
})
```

### 2. CSV Helper (`csvHelper.test.ts`)

**Datei:** `/frontend/src/__tests__/utils/csvHelper.test.ts`

```typescript
describe('createCSVFromUrls', () => {
  it('creates valid CSV with header', () => {
    const urls = ['https://youtube.com/watch?v=abc']
    const blob = createCSVFromUrls(urls)
    const text = await blob.text()
    expect(text).toBe('url\nhttps://youtube.com/watch?v=abc')
  })

  it('creates CSV with multiple URLs', () => {
    const urls = [
      'https://youtube.com/watch?v=abc',
      'https://youtube.com/watch?v=def'
    ]
    const blob = createCSVFromUrls(urls)
    const text = await blob.text()
    const lines = text.split('\n')
    expect(lines).toHaveLength(3) // header + 2 URLs
  })

  it('handles empty array', () => {
    const blob = createCSVFromUrls([])
    const text = await blob.text()
    expect(text).toBe('url')
  })
})
```

### 3. useDropZone Hook (`useDropZone.test.ts`)

**Datei:** `/frontend/src/__tests__/hooks/useDropZone.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react'
import { useDropZone } from '@/hooks/useDropZone'

describe('useDropZone', () => {
  const mockOnDrop = vi.fn()

  beforeEach(() => {
    mockOnDrop.mockClear()
  })

  it('initializes with isDragging=false', () => {
    const { result } = renderHook(() => useDropZone({ onDrop: mockOnDrop }))
    expect(result.current.isDragging).toBe(false)
  })

  it('sets isDragging=true on dragEnter', () => {
    const { result } = renderHook(() => useDropZone({ onDrop: mockOnDrop }))

    act(() => {
      result.current.dropZoneProps.onDragEnter(createDragEvent('dragenter'))
    })

    expect(result.current.isDragging).toBe(true)
  })

  it('sets isDragging=false on dragLeave', () => {
    const { result } = renderHook(() => useDropZone({ onDrop: mockOnDrop }))

    act(() => {
      result.current.dropZoneProps.onDragEnter(createDragEvent('dragenter'))
      result.current.dropZoneProps.onDragLeave(createDragEvent('dragleave'))
    })

    expect(result.current.isDragging).toBe(false)
  })

  it('handles nested dragEnter/dragLeave correctly', () => {
    const { result } = renderHook(() => useDropZone({ onDrop: mockOnDrop }))

    act(() => {
      // Enter parent
      result.current.dropZoneProps.onDragEnter(createDragEvent('dragenter'))
      // Enter child
      result.current.dropZoneProps.onDragEnter(createDragEvent('dragenter'))
      // Leave child
      result.current.dropZoneProps.onDragLeave(createDragEvent('dragleave'))
    })

    // Should still be dragging (only left child, not parent)
    expect(result.current.isDragging).toBe(true)
  })

  it('calls onDrop with parsed data', () => {
    const { result } = renderHook(() => useDropZone({ onDrop: mockOnDrop }))

    const dropEvent = createDragEvent('drop', {
      'text/plain': 'https://youtube.com/watch?v=abc123'
    })

    act(() => {
      result.current.dropZoneProps.onDrop(dropEvent)
    })

    expect(mockOnDrop).toHaveBeenCalledWith({
      type: 'youtube-urls',
      urls: ['https://youtube.com/watch?v=abc123'],
    })
  })

  it('respects disabled option', () => {
    const { result } = renderHook(() =>
      useDropZone({ onDrop: mockOnDrop, disabled: true })
    )

    act(() => {
      result.current.dropZoneProps.onDragEnter(createDragEvent('dragenter'))
    })

    expect(result.current.isDragging).toBe(false)
  })
})

// Helper function
function createDragEvent(type: string, data?: Record<string, string>) {
  const event = new Event(type) as DragEvent
  event.preventDefault = vi.fn()
  event.stopPropagation = vi.fn()
  event.dataTransfer = {
    getData: (key: string) => data?.[key] ?? '',
    files: [],
    types: data ? Object.keys(data) : [],
  } as any
  return event
}
```

---

## Integration Tests

### 4. DropZoneOverlay Component (`DropZoneOverlay.test.tsx`)

**Datei:** `/frontend/src/__tests__/components/DropZoneOverlay.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { DropZoneOverlay } from '@/components/DropZoneOverlay'

describe('DropZoneOverlay', () => {
  it('renders with default message', () => {
    render(<DropZoneOverlay isValid={true} />)
    expect(screen.getByText(/Videos hier ablegen/i)).toBeInTheDocument()
  })

  it('renders custom message', () => {
    render(<DropZoneOverlay isValid={true} message="Custom message" />)
    expect(screen.getByText('Custom message')).toBeInTheDocument()
  })

  it('shows valid state styling', () => {
    const { container } = render(<DropZoneOverlay isValid={true} />)
    expect(container.querySelector('.border-primary')).toBeInTheDocument()
  })

  it('shows invalid state styling', () => {
    const { container } = render(<DropZoneOverlay isValid={false} />)
    expect(container.querySelector('.border-destructive')).toBeInTheDocument()
  })

  it('has correct ARIA attributes', () => {
    render(<DropZoneOverlay isValid={true} />)
    expect(screen.getByRole('region')).toHaveAttribute('aria-label')
  })
})
```

### 5. ImportPreviewModal Component (`ImportPreviewModal.test.tsx`)

**Datei:** `/frontend/src/__tests__/components/ImportPreviewModal.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImportPreviewModal } from '@/components/ImportPreviewModal'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

describe('ImportPreviewModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    urls: [
      'https://youtube.com/watch?v=abc123',
      'https://youtube.com/watch?v=def456',
    ],
    onImport: vi.fn().mockResolvedValue(undefined),
  }

  it('displays URL count', () => {
    render(<ImportPreviewModal {...defaultProps} />, { wrapper })
    expect(screen.getByText(/2 Videos erkannt/i)).toBeInTheDocument()
  })

  it('displays all URLs', () => {
    render(<ImportPreviewModal {...defaultProps} />, { wrapper })
    expect(screen.getByText(/abc123/)).toBeInTheDocument()
    expect(screen.getByText(/def456/)).toBeInTheDocument()
  })

  it('marks invalid URLs', () => {
    const props = {
      ...defaultProps,
      urls: [
        'https://youtube.com/watch?v=abc123',
        'https://invalid-url.com',
      ],
    }
    render(<ImportPreviewModal {...props} />, { wrapper })
    expect(screen.getByText(/invalid-url/)).toHaveClass('text-destructive')
  })

  it('marks duplicate URLs', () => {
    const props = {
      ...defaultProps,
      existingVideoIds: ['abc123'],
    }
    render(<ImportPreviewModal {...props} />, { wrapper })
    // Check for duplicate indicator
    expect(screen.getByTestId('duplicate-indicator-abc123')).toBeInTheDocument()
  })

  it('calls onImport with valid URLs only', async () => {
    render(<ImportPreviewModal {...defaultProps} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /importieren/i }))

    await waitFor(() => {
      expect(defaultProps.onImport).toHaveBeenCalledWith(
        defaultProps.urls,
        undefined
      )
    })
  })

  it('passes selected category to onImport', async () => {
    render(<ImportPreviewModal {...defaultProps} />, { wrapper })

    // Select category
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Tutorial'))

    fireEvent.click(screen.getByRole('button', { name: /importieren/i }))

    await waitFor(() => {
      expect(defaultProps.onImport).toHaveBeenCalledWith(
        defaultProps.urls,
        'tutorial-id'
      )
    })
  })

  it('disables import when no valid URLs', () => {
    const props = {
      ...defaultProps,
      urls: ['https://invalid.com'],
    }
    render(<ImportPreviewModal {...props} />, { wrapper })
    expect(screen.getByRole('button', { name: /importieren/i })).toBeDisabled()
  })

  it('closes modal on cancel', () => {
    render(<ImportPreviewModal {...defaultProps} />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }))

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })
})
```

### 6. VideosPage Drop Integration (`VideosPage.drop.test.tsx`)

**Datei:** `/frontend/src/__tests__/components/VideosPage.drop.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VideosPage } from '@/components/VideosPage'
import { createDragEvent } from '../helpers/dragDrop'

describe('VideosPage Drag & Drop', () => {
  it('shows overlay on drag enter', () => {
    render(<VideosPage listId="test-list" />)

    fireEvent.dragEnter(screen.getByTestId('videos-container'), createDragEvent())

    expect(screen.getByTestId('drop-zone-overlay')).toBeInTheDocument()
  })

  it('hides overlay on drag leave', () => {
    render(<VideosPage listId="test-list" />)

    const container = screen.getByTestId('videos-container')
    fireEvent.dragEnter(container, createDragEvent())
    fireEvent.dragLeave(container, createDragEvent())

    expect(screen.queryByTestId('drop-zone-overlay')).not.toBeInTheDocument()
  })

  it('imports single URL directly', async () => {
    render(<VideosPage listId="test-list" />)

    const dropEvent = createDragEvent({
      'text/plain': 'https://youtube.com/watch?v=abc123'
    })

    fireEvent.drop(screen.getByTestId('videos-container'), dropEvent)

    await waitFor(() => {
      expect(screen.getByText('Video hinzugefügt')).toBeInTheDocument()
    })
  })

  it('opens modal for multiple URLs', async () => {
    render(<VideosPage listId="test-list" />)

    const dropEvent = createDragEvent({
      'text/plain': `https://youtube.com/watch?v=abc
https://youtube.com/watch?v=def`
    })

    fireEvent.drop(screen.getByTestId('videos-container'), dropEvent)

    await waitFor(() => {
      expect(screen.getByText(/2 Videos erkannt/i)).toBeInTheDocument()
    })
  })
})
```

---

## E2E Tests

### 7. Playwright E2E Tests

**Datei:** `/frontend/e2e/drag-drop-import.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Drag & Drop Video Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/videos')
    await page.waitForSelector('[data-testid="videos-container"]')
  })

  test('imports single video via URL drop', async ({ page }) => {
    // Simulate drag & drop (Playwright)
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      return dt
    })

    const dropTarget = page.locator('[data-testid="videos-container"]')

    await dropTarget.dispatchEvent('dragenter', { dataTransfer })
    await expect(page.locator('[data-testid="drop-zone-overlay"]')).toBeVisible()

    await dropTarget.dispatchEvent('drop', { dataTransfer })

    // Check success toast
    await expect(page.getByText('Video hinzugefügt')).toBeVisible()

    // Check video appears in list
    await expect(page.getByText('Rick Astley')).toBeVisible({ timeout: 10000 })
  })

  test('imports multiple videos via modal', async ({ page }) => {
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', `https://youtube.com/watch?v=abc
https://youtube.com/watch?v=def
https://youtube.com/watch?v=ghi`)
      return dt
    })

    const dropTarget = page.locator('[data-testid="videos-container"]')
    await dropTarget.dispatchEvent('drop', { dataTransfer })

    // Modal should open
    await expect(page.getByText('3 Videos erkannt')).toBeVisible()

    // Click import
    await page.getByRole('button', { name: /importieren/i }).click()

    // Check success
    await expect(page.getByText('3 Videos hinzugefügt')).toBeVisible()
  })

  test('assigns category when dropping on sidebar', async ({ page }) => {
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', 'https://youtube.com/watch?v=test123')
      return dt
    })

    // Drop on "Tutorial" category
    const categoryButton = page.getByRole('button', { name: 'Tutorial' })
    await categoryButton.dispatchEvent('drop', { dataTransfer })

    await expect(page.getByText('Video als Tutorial hinzugefügt')).toBeVisible()
  })
})
```

---

## Regression Tests

### Bestehende Flows testen

```typescript
test.describe('Regression: Existing Features', () => {
  test('URL input still works', async ({ page }) => {
    await page.goto('/videos')
    await page.getByPlaceholder('YouTube URL').fill('https://youtube.com/watch?v=test')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.getByText('Video hinzugefügt')).toBeVisible()
  })

  test('tag click filtering still works', async ({ page }) => {
    await page.goto('/videos')
    await page.getByRole('button', { name: 'Tutorial' }).click()
    // Filter should be applied
    await expect(page.url()).toContain('tags=Tutorial')
  })

  test('CSV export still works', async ({ page }) => {
    await page.goto('/videos')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export' }).click()
    ])
    expect(download.suggestedFilename()).toContain('.csv')
  })
})
```

---

## Test Coverage Goals

| Bereich | Target | Priorität |
|---------|--------|-----------|
| URL Parser | 95% | P0 |
| useDropZone Hook | 90% | P0 |
| DropZoneOverlay | 80% | P1 |
| ImportPreviewModal | 85% | P0 |
| VideosPage Integration | 75% | P1 |
| E2E Critical Paths | 100% | P0 |

---

## Test-Daten

### Mock Files

```
/frontend/src/__tests__/fixtures/
├── valid.webloc
├── invalid.webloc
├── videos.csv
└── empty.csv
```

### Mock API Responses

```typescript
// /frontend/src/__tests__/mocks/handlers.ts
export const handlers = [
  rest.post('/api/lists/:listId/videos', (req, res, ctx) => {
    return res(ctx.json({ id: 'new-video-id', ...mockVideo }))
  }),

  rest.post('/api/lists/:listId/videos/bulk', (req, res, ctx) => {
    return res(ctx.json({
      created_count: 3,
      failed_count: 0,
      failures: []
    }))
  }),
]
```
