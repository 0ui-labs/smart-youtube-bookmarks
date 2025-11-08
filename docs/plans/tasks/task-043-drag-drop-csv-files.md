# Task #43: Implement Drag & Drop for CSV Files

**Plan Task:** #43
**Wave/Phase:** Phase 4: Video Import (Roadmap lines 188-234)
**Dependencies:** Task #41 (SmartDropZone component - already handles CSV drops)
**Created:** 2025-11-08
**Estimated Duration:** 2-3 hours

---

## 🎯 Ziel

Enable CSV file drag & drop functionality by integrating the existing CSVUpload component with the SmartDropZone component (Task #41). Users can drag .csv files directly into the video list interface instead of clicking a button and selecting a file, providing a modern, friction-free import experience that reuses the existing CSV upload API endpoint.

**Expected Outcome:** Users drag CSV files into the app → SmartDropZone detects file type → existing CSV upload logic processes the file → real-time progress via WebSocket → videos appear in the list. No changes to backend API required.

---

## 📋 Acceptance Criteria

- [ ] Drag CSV file from desktop → drop zone activates with visual highlight
- [ ] Drop CSV file → existing bulk upload endpoint processes file (`POST /api/lists/{listId}/videos/bulk`)
- [ ] Visual feedback during drag-over (border highlight, color change)
- [ ] File type validation (must be .csv extension or text/csv MIME type)
- [ ] File size validation (max 10MB, reuse existing CSVUpload limit)
- [ ] Error handling for invalid file types shows clear message
- [ ] Error handling for upload failures displays error details
- [ ] Real-time progress updates via existing WebSocket system
- [ ] Success/failure statistics displayed after upload completes
- [ ] Click-to-browse still works (keyboard accessible fallback)
- [ ] WCAG 2.1 Level AA accessibility compliance
- [ ] Unit tests for file validation logic
- [ ] Integration test for CSV drop flow
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### Step 1: Verify SmartDropZone Completion (Task #41)

**Files:** Check if `frontend/src/components/SmartDropZone.tsx` exists
**Action:** Verify Task #41 is complete before starting this task

**Validation:**
```bash
# Check if SmartDropZone exists
ls frontend/src/components/SmartDropZone.tsx

# Check if react-dropzone is installed
grep "react-dropzone" frontend/package.json
```

**If Task #41 is NOT complete:** This task cannot proceed. SmartDropZone is the foundation.

**If Task #41 IS complete:** Proceed to Step 2.

---

### Step 2: Extract CSV Upload Logic into Reusable Hook

**Files:** `frontend/src/hooks/useCSVUpload.ts` (NEW)
**Action:** Extract CSV upload logic from CSVUpload component into a custom hook for reuse in SmartDropZone

```typescript
import { useState } from 'react'
import { useBulkUploadVideos, type BulkUploadResponse } from '@/hooks/useVideos'
import axios from 'axios'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel']

export interface CSVValidationError {
  type: 'size' | 'mime' | 'extension' | 'upload'
  message: string
}

export function useCSVUpload(listId: string) {
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null)
  const [error, setError] = useState<CSVValidationError | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const bulkUpload = useBulkUploadVideos(listId)

  /**
   * Validate CSV file before upload
   * Returns true if valid, false otherwise (sets error state)
   */
  const validateFile = (file: File): boolean => {
    setError(null)
    setUploadResult(null)

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError({
        type: 'extension',
        message: 'Bitte wählen Sie eine CSV-Datei aus'
      })
      return false
    }

    // Validate MIME type
    if (!VALID_MIME_TYPES.includes(file.type)) {
      setError({
        type: 'mime',
        message: 'Ungültiger Dateityp. Nur CSV-Dateien sind erlaubt.'
      })
      return false
    }

    // Validate file size (max 10MB)
    if (file.size > MAX_FILE_SIZE) {
      setError({
        type: 'size',
        message: 'Datei ist zu groß. Maximale Größe: 10MB'
      })
      return false
    }

    return true
  }

  /**
   * Upload CSV file to backend
   * Returns promise that resolves to upload result
   */
  const uploadFile = async (file: File): Promise<BulkUploadResponse> => {
    if (!validateFile(file)) {
      throw new Error(error?.message || 'File validation failed')
    }

    setIsUploading(true)
    setError(null)

    try {
      const result = await bulkUpload.mutateAsync(file)
      setUploadResult(result)
      setIsUploading(false)
      return result
    } catch (err) {
      setIsUploading(false)

      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        const errorMessage = typeof detail === 'string'
          ? detail
          : 'Fehler beim Hochladen der Datei. Bitte versuchen Sie es erneut.'

        setError({
          type: 'upload',
          message: errorMessage
        })
      } else {
        setError({
          type: 'upload',
          message: 'Ein unerwarteter Fehler ist aufgetreten.'
        })
      }

      throw err
    }
  }

  const resetState = () => {
    setUploadResult(null)
    setError(null)
    setIsUploading(false)
  }

  return {
    uploadFile,
    validateFile,
    resetState,
    uploadResult,
    error,
    isUploading,
    isPending: bulkUpload.isPending || isUploading
  }
}
```

**Rationale:**
- Separates validation and upload logic from UI
- Reusable in both CSVUpload (existing) and SmartDropZone (new)
- Maintains consistent validation rules across components
- Type-safe error handling

---

## 🧪 Testing Strategy

### Unit Tests

**useCSVUpload Hook:**
- ✅ File validation: valid .csv file accepted
- ✅ File validation: rejects non-.csv extension
- ✅ File validation: rejects invalid MIME type
- ✅ File validation: rejects files >10MB
- ✅ File validation: accepts application/vnd.ms-excel MIME
- ✅ Upload flow: successful upload returns result
- ✅ Upload flow: invalid file throws error
- ✅ State management: resetState clears errors

**Coverage Target:** 100% for useCSVUpload hook

### Integration Tests

**SmartDropZone CSV Flow:**
- ✅ CSV file drop → processes successfully → shows success message
- ✅ Invalid file type → shows error message
- ✅ Partial failures → displays statistics (X successful, Y failed)
- ✅ Auto-assign tags when selectedTagIds provided

### Manual Testing

**Test Scenarios:**

1. **Basic CSV drag & drop**
   - Open VideosPage
   - Click "CSV Upload" button
   - Drag test.csv from desktop → drop on zone
   - Expected: Drop zone highlights during drag, processes file, shows success

2. **Click-to-browse fallback**
   - Click "CSV Upload" button
   - Click the drop zone (no drag)
   - File dialog opens
   - Select test.csv
   - Expected: Same upload flow as drag & drop

3. **Invalid file type rejection**
   - Drag test.pdf onto drop zone
   - Expected: Red border, error message "Ungültiger Dateityp"

4. **Large file rejection**
   - Create 11MB CSV file
   - Drag onto drop zone
   - Expected: Error "Datei ist zu groß. Maximale Größe: 10MB"

5. **Real-time progress (WebSocket)**
   - Upload CSV with 50 videos
   - Observe job progress updates
   - Expected: Progress bar appears, updates in real-time

6. **Partial failures display**
   - Upload CSV with invalid URLs in rows 5, 10
   - Expected: Statistics show "48 erfolgreich, 2 fehlgeschlagen" with error details

7. **Keyboard accessibility**
   - Tab to drop zone
   - Press Enter
   - File dialog opens
   - Expected: Fully keyboard navigable

8. **Auto-assign tags**
   - Select tag "Tutorial" in sidebar
   - Upload CSV
   - Check newly created videos
   - Expected: All have "Tutorial" tag assigned

---

## 📚 Reference

### REF MCP Validation Findings

**1. react-dropzone Best Practices (GitHub)**
- Use `getRootProps()` and `getInputProps()` for accessibility
- Pass additional props through getRootProps, not directly on element
- `accept` parameter supports MIME types and extensions
- Built-in keyboard navigation and ARIA labels
- Evidence: https://github.com/react-dropzone/react-dropzone

**2. File MIME Type Validation (Zod Docs)**
- CSV files have two valid MIME types: `text/csv` and `application/vnd.ms-excel`
- Extension validation (.csv) should complement MIME type check
- Zod supports `.mime()` for validation schemas
- Evidence: https://zod.dev/api#files

**3. UX Drag & Drop Patterns (tldraw)**
- Visual feedback during drag-over (border highlight, background color change)
- Clear drop target indication before drop
- Immediate feedback after drop (processing, success, error states)
- Evidence: https://tldraw.dev/features/layout-and-composition

**4. react-dropzone Testing**
- Use `@testing-library/user-event` for file upload simulation
- Mock file objects with correct MIME types
- Test `accept` parameter rejection behavior
- Evidence: react-dropzone README testing section

---

### Design Decisions

#### Decision 1: Extract Logic into useCSVUpload Hook

**Chosen:** Create reusable `useCSVUpload` hook
**Alternatives:**
- Keep logic inline in SmartDropZone (duplicates CSVUpload logic)
- Use SmartDropZone everywhere, delete CSVUpload (breaking change)

**Rationale:**
- DRY principle: validation logic defined once
- Maintains backward compatibility (CSVUpload still works)
- Testable in isolation (unit tests for hook)
- Future-proof: can add CSV export, CSV templates, etc.

**Trade-offs:**
- Slightly more complex architecture (+1 abstraction layer)
- Migration path: gradually replace CSVUpload with SmartDropZone

**Validation:** REF MCP supports hooks for reusable logic (React best practices)

---

#### Decision 2: File Validation Strategy (Extension + MIME)

**Chosen:** Dual validation (extension AND MIME type)
**Alternatives:**
- Extension only (easier to bypass)
- MIME only (some systems send incorrect MIME)
- Content sniffing (overkill, security risk)

**Rationale:**
- Extension check: User-friendly (catches .txt renamed as .csv)
- MIME check: Security (validates actual file type)
- Both together: Defense in depth

**Trade-offs:**
- May reject valid files with wrong extension/MIME (rare)
- Acceptable: explicit error messages guide user to fix

**Validation:** REF MCP (Zod docs) recommends dual validation for file uploads

---

## ⏱️ Implementation Time Estimate

**Total:** 2-3 hours

- Step 1 (Verify Task #41): 5 minutes
- Step 2 (useCSVUpload Hook): 45 minutes
- Step 3 (Refactor CSVUpload): 20 minutes
- Step 4 (Extend SmartDropZone): 30 minutes
- Step 5 (Integrate VideosPage): 10 minutes
- Step 6 (Unit Tests): 30 minutes
- Step 7 (Integration Tests): 30 minutes
- Manual Testing & Documentation: 20 minutes

**Assumptions:**
- Task #41 (SmartDropZone) is complete
- react-dropzone is already installed
- Existing CSV upload API endpoint works correctly

**Risk Factors:**
- If Task #41 is incomplete, this task is blocked (+6-8 hours to complete Task #41 first)
- react-dropzone version incompatibility (mitigated by Task #41 installation)
- File MIME type edge cases on different OS (Windows, Mac, Linux send different MIME for .csv)

---

**Next Tasks:**
- Task #38: Smart CSV Import with Field Detection (enhance CSV processing logic)
- Task #39: Batch Video Existence Check (optimize duplicate detection)
- Task #40: Extend CSV Export to Include All Fields
