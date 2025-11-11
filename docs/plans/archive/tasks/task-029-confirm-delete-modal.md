Looking at this codebase, I can see it's a Smart YouTube Bookmarks application with React frontend and FastAPI backend. I'll adapt the Confirm Delete Modal Implementation Plan to align with the existing codebase structure and technologies. Here's the complete adapted plan:

# Confirm Delete Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace browser native `window.confirm()` with custom ConfirmDeleteModal using shadcn/ui AlertDialog for better UX and design consistency in the Smart YouTube Bookmarks application.

**Architecture:** Use shadcn/ui AlertDialog (not Dialog) for destructive confirmation pattern. AlertDialog is semantically correct for interrupting user with critical decision. Controlled modal state in VideosPage with video metadata.

**Tech Stack:** React 18, TypeScript, shadcn/ui AlertDialog, Radix UI primitives, TanStack React Query (delete mutation), Vitest, Tailwind CSS

---

## 🔍 REF MCP Validation Results

✅ **AlertDialog vs Dialog Component** (Critical Decision)
- **Finding:** shadcn/ui has TWO dialog components: Dialog (general purpose) and AlertDialog (destructive actions)
- **Validation:** AlertDialog documentation states "A modal dialog that interrupts the user with important content and expects a response" - perfect for delete confirmation
- **Decision:** Use AlertDialog, not Dialog
- **Why:** Semantically correct for destructive actions, has AlertDialogAction/AlertDialogCancel components (better a11y), interrupts user flow (expected for delete)
- **Source:** https://ui.shadcn.com/docs/components/alert-dialog

✅ **Dialog Nesting Pattern** (Critical Implementation Detail)
- **Finding:** shadcn/ui docs explicitly document: "To use the Dialog component from within a Context Menu or Dropdown Menu, you must encase the Context Menu or Dropdown Menu component in the Dialog component"
- **Validation:** Dialog/AlertDialog must wrap DropdownMenu in component tree, not vice versa
- **Why:** Portal rendering z-index issues, event propagation conflicts
- **Pattern:**
  ```tsx
  <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
    <DropdownMenu>
      <DropdownMenuTrigger>...</DropdownMenuTrigger>
      <DropdownMenuContent>
        <AlertDialogTrigger asChild>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </AlertDialogTrigger>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialogContent>...</AlertDialogContent>
  </AlertDialog>
  ```
- **Source:** https://ui.shadcn.com/docs/components/dialog#notes

✅ **Controlled vs Uncontrolled Modal**
- **Finding:** AlertDialog supports both controlled (`open` prop) and uncontrolled (internal state) patterns
- **Decision:** Use controlled pattern with useState for video metadata storage
- **Why:** Need to store videoId and videoTitle when opening modal, cleaner state management
- **Pattern:** `const [deleteModal, setDeleteModal] = useState<{open: boolean, videoId: string | null, videoTitle: string | null}>({open: false, videoId: null, videoTitle: null})`

✅ **Destructive Action Styling**
- **Finding:** Based on codebase inspection, the project uses Tailwind CSS for styling
- **Decision:** Use AlertDialogAction with Button variant="destructive" for delete confirmation, consistent with Tailwind destructive color classes
- **Why:** Visual consistency with other destructive actions, clear UX signal
- **Pattern:** `<AlertDialogAction asChild><Button variant="destructive">Löschen</Button></AlertDialogAction>`

✅ **Accessibility Requirements (WCAG 2.1 Level AA)**
- **Finding:** Radix UI AlertDialog has built-in accessibility (focus trap, ESC close, aria-labelledby)
- **Validation:** AlertDialogTitle automatically provides aria-labelledby for AlertDialogContent
- **Requirements:** ✅ Focus trap, ✅ ESC key closes, ✅ Focus return to trigger, ✅ aria-describedby from AlertDialogDescription
- **No additional work needed:** Radix UI handles all WCAG requirements out-of-the-box

---

## 📋 Tasks

### Task 1: Install shadcn/ui AlertDialog Component

**Files:**
- Will modify: `frontend/package.json` (add @radix-ui/react-alert-dialog dependency)
- Will create: `frontend/src/components/ui/alert-dialog.tsx` (shadcn/ui wrapper)

**Step 1: Install AlertDialog via shadcn CLI**

```bash
cd frontend
npx shadcn@latest add alert-dialog
```

Expected output:
```
✔ Installing dependencies...
✔ Created src/components/ui/alert-dialog.tsx
```

**Step 2: Verify installation**

```bash
ls -la frontend/src/components/ui/alert-dialog.tsx
cat frontend/package.json | grep "@radix-ui/react-alert-dialog"
```

Expected: File exists, dependency added to package.json

**Step 3: Test import**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add frontend/src/components/ui/alert-dialog.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: install shadcn/ui AlertDialog component

- Add @radix-ui/react-alert-dialog dependency
- Create alert-dialog.tsx wrapper component
- Verified TypeScript compilation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create ConfirmDeleteModal Component (TDD)

**Files:**
- Create: `frontend/src/components/ConfirmDeleteModal.tsx`
- Create: `frontend/src/components/ConfirmDeleteModal.test.tsx`

**Step 1: Write failing test for modal rendering**

```tsx
// frontend/src/components/ConfirmDeleteModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

describe('ConfirmDeleteModal', () => {
  it('renders modal with video title', () => {
    render(
      <ConfirmDeleteModal
        open={true}
        videoTitle="Test Video Title"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('Video löschen?')).toBeInTheDocument()
    expect(screen.getByText(/Test Video Title/)).toBeInTheDocument()
    expect(screen.getByText(/Diese Aktion kann nicht rückgängig gemacht werden/)).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(
      <ConfirmDeleteModal
        open={false}
        videoTitle="Test Video"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.queryByText('Video löschen?')).not.toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend
npm test -- ConfirmDeleteModal.test.tsx --run
```

Expected: FAIL with "Cannot find module './ConfirmDeleteModal'"

**Step 3: Write minimal ConfirmDeleteModal component**

```tsx
// frontend/src/components/ConfirmDeleteModal.tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDeleteModalProps {
  open: boolean
  videoTitle: string | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export const ConfirmDeleteModal = ({
  open,
  videoTitle,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDeleteModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Video löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie das Video "{videoTitle}" wirklich löschen? Diese Aktion kann nicht
            rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault() // Prevent default AlertDialogAction behavior
                onConfirm()
              }}
              disabled={isLoading}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            >
              {isLoading ? 'Löschen...' : 'Löschen'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Why this implementation:**
- AlertDialog (not Dialog): Semantically correct for destructive confirmation
- onOpenChange handler: Calls onCancel when ESC pressed or overlay clicked
- AlertDialogAction with asChild: Custom button styling while keeping accessibility
- e.preventDefault(): Prevent AlertDialogAction from auto-closing before mutation completes
- isLoading prop: Disable buttons during delete mutation, show loading text
- videoTitle in description: User sees what they're deleting (prevents mistakes)
- Tailwind classes: Consistent with existing codebase styling patterns
- sm:max-w-[425px]: Responsive modal width consistent with modern design patterns

**Step 4: Run test to verify it passes**

```bash
cd frontend
npm test -- ConfirmDeleteModal.test.tsx --run
```

Expected: PASS (2/2 tests)

**Step 5: Commit**

```bash
git add frontend/src/components/ConfirmDeleteModal.tsx frontend/src/components/ConfirmDeleteModal.test.tsx
git commit -m "feat: create ConfirmDeleteModal component with tests

- Use shadcn/ui AlertDialog for destructive confirmation
- Controlled modal with open prop
- Show video title in confirmation message
- Loading state support with disabled buttons
- Tailwind CSS styling consistent with codebase
- Tests passing (2/2)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Add Button Click Tests

**Files:**
- Modify: `frontend/src/components/ConfirmDeleteModal.test.tsx` (add interaction tests)

**Step 1: Write failing tests for button interactions**

```tsx
// frontend/src/components/ConfirmDeleteModal.test.tsx (add to existing file)
import { fireEvent, waitFor } from '@testing-library/react'

describe('ConfirmDeleteModal', () => {
  // ... existing tests ...

  it('calls onConfirm when Löschen button clicked', () => {
    const onConfirm = vi.fn()

    render(
      <ConfirmDeleteModal
        open={true}
        videoTitle="Test Video"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /löschen/i })
    fireEvent.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Abbrechen button clicked', () => {
    const onCancel = vi.fn()

    render(
      <ConfirmDeleteModal
        open={true}
        videoTitle="Test Video"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        isLoading={false}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /abbrechen/i })
    fireEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables buttons when isLoading is true', () => {
    render(
      <ConfirmDeleteModal
        open={true}
        videoTitle="Test Video"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /löschen/i })
    const cancelButton = screen.getByRole('button', { name: /abbrechen/i })

    expect(deleteButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
    expect(screen.getByText('Löschen...')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they pass**

```bash
cd frontend
npm test -- ConfirmDeleteModal.test.tsx --run
```

Expected: PASS (5/5 tests)

**Step 3: Commit**

```bash
git add frontend/src/components/ConfirmDeleteModal.test.tsx
git commit -m "test: add button interaction tests for ConfirmDeleteModal

- Test onConfirm callback on delete button click
- Test onCancel callback on cancel button click
- Test button disabled state when loading
- Test loading text display
- All tests passing (5/5)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Integrate Modal into VideosPage

**Files:**
- Modify: `frontend/src/components/VideosPage.tsx` (add modal state and integration)

**Step 1: Add modal state to VideosPage**Now I can see the current VideosPage structure. I need to add the modal state and replace the window.confirm() call. Let me continue with the integration:

```tsx
// frontend/src/components/VideosPage.tsx
// Add import at top:
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
```

**Step 2: Add modal state to VideosPage**

Add this state after the existing useState declarations:

```tsx
// Add after existing useState declarations (around line 59)
const [deleteModal, setDeleteModal] = useState<{
  open: boolean
  videoId: string | null
  videoTitle: string | null
}>({
  open: false,
  videoId: null,
  videoTitle: null,
})
```

**Step 3: Replace window.confirm with modal trigger**

Find this code in the actions column (around line 183):

```tsx
// OLD CODE (remove this):
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
```

Replace with:

```tsx
// NEW CODE:
cell: (info) => (
  <button
    onClick={() => {
      const row = info.row.original
      setDeleteModal({
        open: true,
        videoId: info.getValue() as string,
        videoTitle: `Video ${row.youtube_id}`, // Use youtube_id as title since no title field exists
      })
    }}
    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
  >
    Löschen
  </button>
),
```

**Step 4: Add modal confirmation handlers**

Add these handlers before the return statement (around line 265):

```tsx
// Handle delete confirmation from modal
const handleDeleteConfirm = () => {
  if (!deleteModal.videoId) return

  deleteVideo.mutate(deleteModal.videoId, {
    onSuccess: () => {
      // Close modal after successful delete
      setDeleteModal({ open: false, videoId: null, videoTitle: null })
    },
    onError: (error) => {
      // Keep modal open on error, user can retry or cancel
      console.error('Failed to delete video:', error)
      // Optional: Add toast notification here
    },
  })
}

const handleDeleteCancel = () => {
  setDeleteModal({ open: false, videoId: null, videoTitle: null })
}
```

**Step 5: Add modal component to JSX**

Add this before the closing div of the return statement:

```tsx
return (
  <div className="max-w-7xl mx-auto p-8">
    {/* ... existing JSX ... */}

    {/* Confirm Delete Modal */}
    <ConfirmDeleteModal
      open={deleteModal.open}
      videoTitle={deleteModal.videoTitle}
      onConfirm={handleDeleteConfirm}
      onCancel={handleDeleteCancel}
      isLoading={deleteVideo.isPending}
    />
  </div>
)
```

**Step 6: Run TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

**Step 7: Test in browser**

```bash
cd frontend
npm run dev
```

Manual test:
1. Navigate to http://localhost:5173
2. Select a list to view videos
3. Click "Löschen" button on any video
4. Custom modal appears (not browser confirm)
5. Shows video ID in confirmation message
6. Click "Abbrechen" → modal closes, video not deleted
7. Click "Löschen" again → click "Löschen" button
8. Modal shows "Löschen..." while deleting
9. Modal closes after successful delete
10. Video removed from table

**Step 8: Commit**

```bash
git add frontend/src/components/VideosPage.tsx
git commit -m "feat: integrate ConfirmDeleteModal into VideosPage

- Replace window.confirm with custom AlertDialog modal
- Add modal state management (open, videoId, videoTitle)
- Show video YouTube ID in confirmation message
- Handle delete confirmation with mutation callbacks
- Display loading state during delete operation
- Manual testing confirmed all flows work

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Add Integration Tests

**Files:**
- Modify: `frontend/src/components/VideosPage.test.tsx` (add delete modal tests, create if doesn't exist)

**Step 1: Check if test file exists and examine testing setup****Step 2: Write integration test for delete flow**

```tsx
// frontend/src/components/VideosPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VideosPage } from './VideosPage'
import * as useVideosModule from '@/hooks/useVideos'
import * as useWebSocketModule from '@/hooks/useWebSocket'

// Mock the hooks
vi.mock('@/hooks/useVideos')
vi.mock('@/hooks/useWebSocket')

const mockUseVideos = vi.mocked(useVideosModule.useVideos)
const mockUseCreateVideo = vi.mocked(useVideosModule.useCreateVideo)
const mockUseDeleteVideo = vi.mocked(useVideosModule.useDeleteVideo)
const mockExportVideosCSV = vi.mocked(useVideosModule.exportVideosCSV)
const mockUseWebSocket = vi.mocked(useWebSocketModule.useWebSocket)

// Test utilities
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

const mockVideos = [
  {
    id: '1',
    youtube_id: 'abc123',
    processing_status: 'completed' as const,
    created_at: '2023-01-01T00:00:00Z',
    list_id: 'list1',
  },
  {
    id: '2',
    youtube_id: 'def456',
    processing_status: 'completed' as const,
    created_at: '2023-01-02T00:00:00Z',
    list_id: 'list1',
  },
]

const mockDeleteVideo = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}

describe('VideosPage - Delete Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockUseVideos.mockReturnValue({
      data: mockVideos,
      isLoading: false,
      error: null,
    })
    
    mockUseCreateVideo.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)
    
    mockUseDeleteVideo.mockReturnValue(mockDeleteVideo as any)
    
    mockUseWebSocket.mockReturnValue({
      jobProgress: new Map(),
      reconnecting: false,
      historyError: null,
    })
    
    mockExportVideosCSV.mockResolvedValue(undefined)
  })

  it('opens confirm delete modal when delete button clicked', async () => {
    renderWithQueryClient(<VideosPage listId="list1" onBack={vi.fn()} />)

    // Wait for videos to load
    await waitFor(() => expect(screen.getByText(/Video abc123/)).toBeInTheDocument())

    // Click delete button (first video)
    const deleteButtons = screen.getAllByText('Löschen')
    fireEvent.click(deleteButtons[0])

    // Modal should appear with video info
    await waitFor(() => {
      expect(screen.getByText('Video löschen?')).toBeInTheDocument()
      expect(screen.getByText(/Video abc123/)).toBeInTheDocument()
      expect(screen.getByText(/Diese Aktion kann nicht rückgängig gemacht werden/)).toBeInTheDocument()
    })
  })

  it('closes modal and deletes video when confirmed', async () => {
    const mockMutate = vi.fn((videoId, callbacks) => {
      // Simulate successful delete
      callbacks?.onSuccess?.()
    })
    mockDeleteVideo.mutate = mockMutate

    renderWithQueryClient(<VideosPage listId="list1" onBack={vi.fn()} />)

    // Wait for videos to load
    await waitFor(() => expect(screen.getByText(/Video abc123/)).toBeInTheDocument())

    // Open delete modal
    const deleteButtons = screen.getAllByText('Löschen')
    fireEvent.click(deleteButtons[0])

    // Wait for modal
    await waitFor(() => expect(screen.getByText('Video löschen?')).toBeInTheDocument())

    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: /löschen/i })
    fireEvent.click(confirmButton)

    // Verify delete was called
    expect(mockMutate).toHaveBeenCalledWith('1', expect.any(Object))

    // Modal should close (onSuccess callback)
    await waitFor(() => {
      expect(screen.queryByText('Video löschen?')).not.toBeInTheDocument()
    })
  })

  it('closes modal without deleting when cancelled', async () => {
    renderWithQueryClient(<VideosPage listId="list1" onBack={vi.fn()} />)

    // Wait for videos to load
    await waitFor(() => expect(screen.getByText(/Video abc123/)).toBeInTheDocument())

    // Open delete modal
    const deleteButtons = screen.getAllByText('Löschen')
    fireEvent.click(deleteButtons[0])

    // Wait for modal
    await waitFor(() => expect(screen.getByText('Video löschen?')).toBeInTheDocument())

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /abbrechen/i })
    fireEvent.click(cancelButton)

    // Modal should close, delete should not be called
    await waitFor(() => {
      expect(screen.queryByText('Video löschen?')).not.toBeInTheDocument()
    })
    expect(mockDeleteVideo.mutate).not.toHaveBeenCalled()
  })

  it('shows loading state during delete', async () => {
    mockUseDeleteVideo.mockReturnValue({
      ...mockDeleteVideo,
      isPending: true,
    } as any)

    renderWithQueryClient(<VideosPage listId="list1" onBack={vi.fn()} />)

    // Wait for videos to load
    await waitFor(() => expect(screen.getByText(/Video abc123/)).toBeInTheDocument())

    // Open delete modal
    const deleteButtons = screen.getAllByText('Löschen')
    fireEvent.click(deleteButtons[0])

    // Wait for modal
    await waitFor(() => expect(screen.getByText('Video löschen?')).toBeInTheDocument())

    // Should show loading state
    expect(screen.getByText('L