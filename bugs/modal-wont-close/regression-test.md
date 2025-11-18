# Regression Test Design: Video Details Modal Won't Close

## Date
2025-11-17

## Test Objective

Verify that the VideoDetailsModal can be opened and closed correctly when using "Modal Dialog" view mode, without reopening after close.

## Test Strategy

**Approach**: Integration test that simulates user interaction with VideoCard in modal mode

**Framework**: React Testing Library + Jest (existing test setup)

**Location**: `frontend/src/components/__tests__/VideoCard.modal.test.tsx` (new file)

## Test Cases

### Test 1: Modal Opens on Card Click (Modal Mode) ✅

**Purpose**: Verify modal opens correctly (existing behavior should work)

**Steps**:
1. Render VideoCard with videoDetailsView='modal'
2. Click on the card
3. Assert modal is visible

**Expected**: ✅ PASS (this already works)

### Test 2: Modal Closes on X Button Click (REGRESSION TEST) ❌→✅

**Purpose**: Verify modal closes when clicking X button

**Steps**:
1. Render VideoCard with videoDetailsView='modal'
2. Click card → modal opens
3. Click X button (close icon)
4. Assert modal is NOT visible
5. Wait 100ms (debounce)
6. Assert modal is STILL not visible (doesn't reopen)

**Expected Before Fix**: ❌ FAIL (modal reopens immediately)
**Expected After Fix**: ✅ PASS (modal stays closed)

### Test 3: Modal Closes on Backdrop Click (REGRESSION TEST) ❌→✅

**Purpose**: Verify modal closes when clicking outside (backdrop)

**Steps**:
1. Render VideoCard with videoDetailsView='modal'
2. Click card → modal opens
3. Click backdrop (overlay)
4. Assert modal is NOT visible
5. Wait 100ms
6. Assert modal is STILL not visible

**Expected Before Fix**: ❌ FAIL (modal reopens)
**Expected After Fix**: ✅ PASS (modal stays closed)

### Test 4: Modal Closes on Escape Key (REGRESSION TEST) ❌→✅

**Purpose**: Verify modal closes with keyboard (accessibility)

**Steps**:
1. Render VideoCard with videoDetailsView='modal'
2. Click card → modal opens
3. Press Escape key
4. Assert modal is NOT visible
5. Wait 100ms
6. Assert modal is STILL not visible

**Expected Before Fix**: ❌ FAIL (modal reopens)
**Expected After Fix**: ✅ PASS (modal stays closed)

### Test 5: Page Navigation Still Works (Page Mode) ✅

**Purpose**: Ensure fix doesn't break page navigation mode

**Steps**:
1. Render VideoCard with videoDetailsView='page'
2. Mock navigate function
3. Click card
4. Assert navigate was called with /videos/:videoId

**Expected**: ✅ PASS (should not be affected by fix)

## Test Implementation

### File: `frontend/src/components/__tests__/VideoCard.modal.test.tsx`

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { VideoCard } from '../VideoCard'
import { useTableSettingsStore } from '@/stores/tableSettingsStore'
import type { VideoResponse } from '@/types/video'

// Mock react-router-dom at module level
const navigateMock = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => navigateMock,
}))

// Mock video data
const mockVideo: VideoResponse = {
  id: 'video-1',
  youtube_id: 'abc123',
  title: 'Test Video',
  thumbnail_url: 'https://example.com/thumb.jpg',
  duration: 600,
  channel: 'Test Channel',
  list_id: 'list-1',
  tags: [],
  available_fields: [],
  field_values: [],
}

// Test setup helper
const renderVideoCard = (videoDetailsView: 'page' | 'modal' = 'modal') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  // Set videoDetailsView in store
  useTableSettingsStore.setState({ videoDetailsView })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VideoCard video={mockVideo} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('VideoCard Modal Behavior', () => {
  beforeEach(() => {
    // Reset store before each test
    useTableSettingsStore.setState({ videoDetailsView: 'page' })
    // Reset navigate mock
    navigateMock.mockClear()
  })

  test('Modal opens when card is clicked in modal mode', async () => {
    renderVideoCard('modal')
    const user = userEvent.setup()

    // Click card
    const card = screen.getByRole('button', { name: /Video: Test Video/ })
    await user.click(card)

    // Modal should be visible
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Test Video')).toBeInTheDocument()
  })

  test('REGRESSION: Modal closes when X button is clicked', async () => {
    renderVideoCard('modal')
    const user = userEvent.setup()

    // Open modal
    const card = screen.getByRole('button', { name: /Video: Test Video/ })
    await user.click(card)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click close button
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Wait to ensure modal doesn't reopen
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('REGRESSION: Modal closes when backdrop is clicked', async () => {
    renderVideoCard('modal')
    const user = userEvent.setup()

    // Open modal
    const card = screen.getByRole('button', { name: /Video: Test Video/ })
    await user.click(card)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click backdrop (overlay)
    const overlay = screen.getByRole('dialog').parentElement?.previousSibling
    if (overlay) {
      await user.click(overlay as Element)
    }

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Wait to ensure modal doesn't reopen
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('REGRESSION: Modal closes when Escape key is pressed', async () => {
    renderVideoCard('modal')
    const user = userEvent.setup()

    // Open modal
    const card = screen.getByRole('button', { name: /Video: Test Video/ })
    await user.click(card)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Press Escape
    await user.keyboard('{Escape}')

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Wait to ensure modal doesn't reopen
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('Page navigation works in page mode', async () => {
    renderVideoCard('page')
    const user = userEvent.setup()

    // Click card
    const card = screen.getByRole('button', { name: /Video: Test Video/ })
    await user.click(card)

    // Should navigate, not open modal
    expect(navigateMock).toHaveBeenCalledWith('/videos/video-1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

## Expected Test Results

### Before Fix (Current State)

```
PASS  Modal opens when card is clicked in modal mode
FAIL  REGRESSION: Modal closes when X button is clicked
  ✕ Expected modal to be closed, but it's still open
FAIL  REGRESSION: Modal closes when backdrop is clicked
  ✕ Expected modal to be closed, but it's still open
FAIL  REGRESSION: Modal closes when Escape key is pressed
  ✕ Expected modal to be closed, but it's still open
PASS  Page navigation works in page mode
```

**Result**: 3/5 tests fail (expected - proves bug exists)

### After Fix (Target State)

```
PASS  Modal opens when card is clicked in modal mode
PASS  REGRESSION: Modal closes when X button is clicked
PASS  REGRESSION: Modal closes when backdrop is clicked
PASS  REGRESSION: Modal closes when Escape key is pressed
PASS  Page navigation works in page mode
```

**Result**: 5/5 tests pass (proves bug is fixed)

## Test Execution Plan

1. **Write test first** (TDD principle)
2. **Run test** → Should see 3 failures (proves test catches bug)
3. **Implement fix** (Solution 1 from fix-strategy.md)
4. **Run test again** → Should see all tests pass
5. **Commit test + fix together** (atomic change)

## Coverage

These tests cover:
- ✅ Modal opening (existing behavior)
- ✅ Modal closing via X button (bug)
- ✅ Modal closing via backdrop click (bug)
- ✅ Modal closing via Escape key (bug)
- ✅ Page navigation mode (regression check)
- ✅ Event propagation issue (root cause)

## Integration with CI/CD

- Tests run in existing Jest suite
- No new dependencies required
- Fast execution (< 1 second per test)
- Can be run in watch mode during development
