# Task #41: Create SmartDropZone for URLs and CSV Files

**Plan Task:** #41
**Wave/Phase:** Phase 4: Video-Import vereinfachen
**Dependencies:** None
**Created:** 2025-11-08
**Estimated Duration:** 6-8 hours

---

## 🎯 Ziel

Create a unified drag-and-drop component (SmartDropZone) that intelligently detects and processes both YouTube URLs (text/plain or .txt files) and CSV files. This component replaces the current separated CSV upload button and manual URL input with a streamlined import experience that automatically routes content to the appropriate backend endpoint.

**Expected Outcome:** Component that accepts CSV files and YouTube URLs via drag-drop or click-to-browse, auto-detects content type, displays real-time progress via WebSocket, and provides clear success/error feedback with WCAG 2.1 Level AA accessibility.

---

## 📋 Acceptance Criteria

- [ ] Component accepts drag-and-drop of CSV files (.csv extension)
- [ ] Component accepts drag-and-drop of YouTube URLs (plain text from browser, .txt files)
- [ ] Component accepts click-to-browse file selection (keyboard accessible)
- [ ] Auto-detects content type (CSV vs URLs) and routes to correct endpoint
- [ ] Extracts YouTube video IDs from all valid URL formats (youtube.com/watch?v=, youtu.be/, embed/, m.youtube.com)
- [ ] Visual feedback for drag-over, processing, success, and error states
- [ ] Displays real-time progress via WebSocket integration for CSV uploads
- [ ] Shows detailed error messages for invalid URLs and file types
- [ ] WCAG 2.1 Level AA accessibility compliance (keyboard navigation, ARIA labels, screen reader support)
- [ ] Unit tests for URL parsing, file type detection, and state management
- [ ] Integration tests for drag-drop events and backend API calls
- [ ] Code reviewed and passing all tests

---

## 🛠️ Implementation Steps

### Step 1: Install react-dropzone Library

**Files:** `frontend/package.json`

**Action:** Add react-dropzone dependency

```bash
cd frontend
npm install react-dropzone
```

**Rationale:** react-dropzone provides battle-tested drag-drop functionality with:
- Built-in accessibility (keyboard support, ARIA attributes)
- File validation (MIME types, extensions, size limits)
- React 18 compatibility
- Better browser compatibility than native HTML5 drag-drop API

---

### Step 2: Create YouTube URL Extraction Utility

**Files:** `frontend/src/utils/youtubeUrlParser.ts`

**Action:** Create utility function to extract YouTube video IDs from various URL formats

```typescript
/**
 * Extract YouTube video ID from URL or plain text
 *
 * Supports formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - Plain VIDEO_ID (11 characters)
 *
 * @param text - URL or plain text containing YouTube video ID
 * @returns Array of extracted video IDs (11 characters each)
 */
export function extractYoutubeIds(text: string): string[] {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/g,
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g,
    // Fallback: standalone 11-character ID (word boundary for safety)
    /\b([a-zA-Z0-9_-]{11})\b/g,
  ]

  const ids = new Set<string>() // Use Set to deduplicate

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      ids.add(match[1])
    }
  }

  return Array.from(ids)
}

/**
 * Validate if a string is a valid YouTube video ID
 * @param id - Potential YouTube video ID
 * @returns true if valid 11-character ID
 */
export function isValidYoutubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id)
}
```

---

### Step 3: Create File Type Detection Utility

**Files:** `frontend/src/utils/fileTypeDetector.ts`

**Action:** Create utility to detect dropped content type

```typescript
export type DropContentType = 'csv' | 'urls' | 'unknown'

/**
 * Detect content type from File object
 * @param file - Dropped file
 * @returns Content type classification
 */
export function detectFileType(file: File): DropContentType {
  const extension = file.name.toLowerCase().split('.').pop()

  // CSV detection: extension or MIME type
  if (extension === 'csv' || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel') {
    return 'csv'
  }

  // Text file detection (potential YouTube URLs)
  if (extension === 'txt' || file.type === 'text/plain') {
    return 'urls'
  }

  return 'unknown'
}

/**
 * Read file contents as text
 * @param file - File to read
 * @returns Promise resolving to file text content
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
```

---

### Step 4: Create SmartDropZone Component

**Files:** `frontend/src/components/SmartDropZone.tsx`

**Action:** Build main drop zone component with intelligent content detection

```typescript
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useCreateVideo, useBulkUploadVideos, useAssignTags } from '@/hooks/useVideos'
import { extractYoutubeIds } from '@/utils/youtubeUrlParser'
import { detectFileType, readFileAsText } from '@/utils/fileTypeDetector'
import { Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface SmartDropZoneProps {
  listId: string
  onSuccess?: () => void
  onCancel?: () => void
  autoAssignTagIds?: string[] // Auto-assign tags to imported videos
}

type ProcessingState = 'idle' | 'processing' | 'success' | 'error'

export const SmartDropZone = ({
  listId,
  onSuccess,
  onCancel,
  autoAssignTagIds = []
}: SmartDropZoneProps) => {
  const [state, setState] = useState<ProcessingState>('idle')
  const [message, setMessage] = useState<string>('')
  const [stats, setStats] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 })

  const createVideo = useCreateVideo(listId)
  const bulkUpload = useBulkUploadVideos(listId)
  const assignTags = useAssignTags()

  const handleUrlsImport = async (text: string) => {
    const urls = extractYoutubeIds(text)

    if (urls.length === 0) {
      setState('error')
      setMessage('Keine gültigen YouTube-URLs gefunden')
      return
    }

    setState('processing')
    setMessage(`${urls.length} URL(s) werden verarbeitet...`)

    let successCount = 0
    let failedCount = 0

    for (const url of urls) {
      try {
        const video = await createVideo.mutateAsync({ url: `https://www.youtube.com/watch?v=${url}` })

        // Auto-assign tags if specified
        if (autoAssignTagIds.length > 0) {
          await assignTags.mutateAsync({
            videoId: video.id,
            tagIds: autoAssignTagIds
          })
        }

        successCount++
      } catch (error) {
        failedCount++
      }
    }

    setStats({ success: successCount, failed: failedCount })

    if (failedCount === 0) {
      setState('success')
      setMessage(`${successCount} Video(s) erfolgreich hinzugefügt`)
      setTimeout(() => onSuccess?.(), 2000)
    } else {
      setState('error')
      setMessage(`${successCount} erfolgreich, ${failedCount} fehlgeschlagen`)
    }
  }

  const handleCsvImport = async (file: File) => {
    setState('processing')
    setMessage('CSV-Datei wird verarbeitet...')

    try {
      const result = await bulkUpload.mutateAsync(file)
      setStats({ success: result.created_count, failed: result.failed_count })

      if (result.failed_count === 0) {
        setState('success')
        setMessage(`${result.created_count} Videos erfolgreich hinzugefügt`)
        setTimeout(() => onSuccess?.(), 2000)
      } else {
        setState('error')
        setMessage(`${result.created_count} erfolgreich, ${result.failed_count} fehlgeschlagen`)
      }
    } catch (error) {
      setState('error')
      setMessage('Fehler beim Verarbeiten der CSV-Datei')
      setStats({ success: 0, failed: 1 })
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    const fileType = detectFileType(file)

    if (fileType === 'csv') {
      await handleCsvImport(file)
    } else if (fileType === 'urls') {
      const text = await readFileAsText(file)
      await handleUrlsImport(text)
    } else {
      setState('error')
      setMessage('Ungültiger Dateityp. Nur CSV oder TXT-Dateien werden unterstützt.')
    }
  }, [listId])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    multiple: false,
    noClick: state === 'processing',
    noDrag: state === 'processing',
  })

  return (
    <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
          ${isDragActive && !isDragReject ? 'border-blue-500 bg-blue-50' : ''}
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${state === 'processing' ? 'border-gray-300 bg-gray-50 cursor-not-allowed' : 'border-gray-300 hover:border-gray-400'}
          ${state === 'success' ? 'border-green-500 bg-green-50' : ''}
          ${state === 'error' ? 'border-red-500 bg-red-50' : ''}
        `}
        role="button"
        aria-label="Dateien hochladen oder URLs einfügen"
        tabIndex={state === 'processing' ? -1 : 0}
      >
        <input {...getInputProps()} aria-label="Datei-Upload-Eingabe" />

        {/* Icon based on state */}
        <div className="mb-4">
          {state === 'idle' && (
            isDragActive ? (
              <Upload className="mx-auto h-12 w-12 text-blue-500" />
            ) : (
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
            )
          )}
          {state === 'processing' && <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />}
          {state === 'success' && <CheckCircle className="mx-auto h-12 w-12 text-green-500" />}
          {state === 'error' && <XCircle className="mx-auto h-12 w-12 text-red-500" />}
        </div>

        {/* Message */}
        <div>
          {state === 'idle' && (
            <>
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive ? 'Datei hier ablegen...' : 'Dateien hier ablegen oder klicken'}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                CSV-Dateien oder YouTube-URLs (TXT)
              </p>
              <p className="text-xs text-gray-500">
                Unterstützte Formate: .csv, .txt mit YouTube-URLs
              </p>
            </>
          )}
          {state !== 'idle' && (
            <p className="text-sm font-medium text-gray-900">{message}</p>
          )}
          {(state === 'success' || state === 'error') && stats.success + stats.failed > 0 && (
            <p className="text-xs text-gray-600 mt-2">
              {stats.success} erfolgreich, {stats.failed} fehlgeschlagen
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {onCancel && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            type="button"
          >
            Schließen
          </button>
        </div>
      )}
    </div>
  )
}
```

---

### Step 5: Integrate SmartDropZone into VideosPage

**Files:** `frontend/src/pages/VideosPage.tsx`

**Action:** Replace existing CSV upload flow with SmartDropZone

```typescript
// Import SmartDropZone
import { SmartDropZone } from '@/components/SmartDropZone'

// Replace CSVUpload component usage
{isUploadingCSV && (
  <SmartDropZone
    listId={listId}
    onCancel={() => setIsUploadingCSV(false)}
    onSuccess={() => {
      setIsUploadingCSV(false)
      refetch() // Refresh video list
    }}
    autoAssignTagIds={selectedTagIds} // Auto-assign currently selected tags
  />
)}
```

---

### Step 6: Create Unit Tests for URL Parser

**Files:** `frontend/src/utils/__tests__/youtubeUrlParser.test.ts`

**Action:** Test all YouTube URL formats and edge cases

```typescript
import { describe, it, expect } from 'vitest'
import { extractYoutubeIds, isValidYoutubeId } from '../youtubeUrlParser'

describe('youtubeUrlParser', () => {
  describe('extractYoutubeIds', () => {
    it('extracts ID from youtube.com/watch?v= URL', () => {
      const ids = extractYoutubeIds('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(ids).toEqual(['dQw4w9WgXcQ'])
    })

    it('extracts ID from youtu.be short URL', () => {
      const ids = extractYoutubeIds('https://youtu.be/dQw4w9WgXcQ')
      expect(ids).toEqual(['dQw4w9WgXcQ'])
    })

    it('extracts multiple IDs from text', () => {
      const text = `
        https://www.youtube.com/watch?v=abc123def45
        https://youtu.be/xyz789ghi01
      `
      const ids = extractYoutubeIds(text)
      expect(ids).toHaveLength(2)
    })

    it('deduplicates identical IDs', () => {
      const text = `
        https://www.youtube.com/watch?v=dQw4w9WgXcQ
        https://youtu.be/dQw4w9WgXcQ
      `
      const ids = extractYoutubeIds(text)
      expect(ids).toEqual(['dQw4w9WgXcQ'])
    })

    it('returns empty array for invalid input', () => {
      expect(extractYoutubeIds('no urls here')).toEqual([])
      expect(extractYoutubeIds('')).toEqual([])
    })
  })

  describe('isValidYoutubeId', () => {
    it('validates correct 11-character IDs', () => {
      expect(isValidYoutubeId('dQw4w9WgXcQ')).toBe(true)
    })

    it('rejects invalid IDs', () => {
      expect(isValidYoutubeId('tooshort')).toBe(false)
      expect(isValidYoutubeId('waytooooolong')).toBe(false)
    })
  })
})
```

---

### Step 7: Create Component Tests

**Files:** `frontend/src/components/__tests__/SmartDropZone.test.tsx`

**Action:** Test component rendering and state transitions

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SmartDropZone } from '../SmartDropZone'

// Mock hooks
vi.mock('@/hooks/useVideos', () => ({
  useCreateVideo: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'video-123' })
  }),
  useBulkUploadVideos: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ created_count: 5, failed_count: 0 })
  }),
  useAssignTags: () => ({
    mutateAsync: vi.fn().mockResolvedValue({})
  })
}))

describe('SmartDropZone', () => {
  it('renders drop zone in idle state', () => {
    render(<SmartDropZone listId="list-123" />)
    expect(screen.getByText(/Dateien hier ablegen/i)).toBeInTheDocument()
  })

  it('is keyboard accessible', () => {
    render(<SmartDropZone listId="list-123" />)
    const dropzone = screen.getByRole('button')
    expect(dropzone).toHaveAttribute('tabIndex', '0')
  })

  it('has ARIA labels for accessibility', () => {
    render(<SmartDropZone listId="list-123" />)
    expect(screen.getByLabelText(/Datei-Upload-Eingabe/i)).toBeInTheDocument()
  })
})
```

---

## 🧪 Testing Strategy

**Unit Tests:**
- URL parsing: All YouTube formats, deduplication, edge cases
- File type detection: CSV by extension/MIME, text files, unknown types
- Component: Rendering states, accessibility attributes

**Integration Tests:**
- Drag-drop CSV file → calls bulk upload endpoint
- Drag-drop text file with URLs → extracts IDs, calls create endpoint
- Error handling → shows error messages

**Manual Testing:**
1. Drag CSV file → upload progress → success
2. Drag TXT file with URLs → videos created
3. Click drop zone → file dialog → upload
4. Drop unsupported file → error message
5. Keyboard navigation → Tab to zone, Enter to open dialog
6. Screen reader → verify ARIA announcements

---

## 📚 Reference

**Related Docs:**
- Roadmap Phase 4: Video-Import vereinfachen (lines 187-233)
- react-dropzone: https://github.com/react-dropzone/react-dropzone
- WCAG 2.1 File Upload: https://www.w3.org/WAI/WCAG21/Understanding/

**Related Code:**
- `frontend/src/hooks/useVideos.ts` - Existing upload hooks
- `backend/app/api/videos.py` - Bulk upload pattern

**Design Decisions:**

### Decision 1: react-dropzone vs Native HTML5
**Chosen:** react-dropzone
**Rationale:** Built-in accessibility, cross-browser compatibility, file validation
**Trade-off:** +15KB bundle size (acceptable for UX)

### Decision 2: Content Detection
**Chosen:** File extension + MIME type dual check
**Rationale:** Extension handles incorrect MIME, MIME validates content
**Trade-off:** May reject valid files with wrong extension (security)

### Decision 3: Auto-Tag Assignment
**Chosen:** Automatically assign selected tags
**Rationale:** Matches existing behavior, reduces friction
**Trade-off:** Implicit behavior (acceptable with UI feedback)

---

## ⏱️ Estimated Time

**Total:** 6-8 hours

- Setup & Dependencies: 30 minutes
- URL Parser Utility: 1 hour
- File Type Detector: 1 hour
- SmartDropZone Component: 2-3 hours
- Integration: 30 minutes
- Component Tests: 1.5 hours
- Accessibility Testing: 1 hour
- Documentation: 30 minutes

---

**Next Task:** Task #42 - Implement Drag & Drop for YouTube URLs (extends SmartDropZone)
