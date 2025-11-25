# Testing Strategy: Video Player

## Test-Pyramide

```
         /\
        /  \    E2E Tests (2-3)
       /----\   - Full user flows
      /      \
     /--------\  Integration Tests (5-8)
    /          \ - Components + API
   /------------\
  /              \ Unit Tests (10-15)
 /________________\ - Functions, Hooks, Store
```

---

## Unit Tests

### 1. Player Settings Store

**Datei:** `frontend/src/stores/__tests__/playerSettingsStore.test.ts`

```typescript
describe('playerSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should initialize with default values', () => {
    const { volume, muted, playbackRate } = usePlayerSettingsStore.getState()
    expect(volume).toBe(1)
    expect(muted).toBe(false)
    expect(playbackRate).toBe(1)
  })

  it('should persist volume changes to localStorage', () => {
    usePlayerSettingsStore.getState().setVolume(0.5)
    expect(usePlayerSettingsStore.getState().volume).toBe(0.5)

    // Verify localStorage
    const stored = JSON.parse(localStorage.getItem('player-settings') || '{}')
    expect(stored.state.volume).toBe(0.5)
  })

  it('should persist playbackRate changes', () => {
    usePlayerSettingsStore.getState().setPlaybackRate(1.5)
    expect(usePlayerSettingsStore.getState().playbackRate).toBe(1.5)
  })

  it('should toggle muted state', () => {
    usePlayerSettingsStore.getState().setMuted(true)
    expect(usePlayerSettingsStore.getState().muted).toBe(true)
  })
})
```

### 2. Watch Progress Hook

**Datei:** `frontend/src/hooks/__tests__/useWatchProgress.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUpdateWatchProgress } from '../useWatchProgress'

describe('useUpdateWatchProgress', () => {
  it('should call API with correct parameters', async () => {
    const mockApi = vi.spyOn(api, 'patch').mockResolvedValue({
      data: { video_id: 'test-id', watch_position: 100, updated_at: '...' }
    })

    const { result } = renderHook(() => useUpdateWatchProgress(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ videoId: 'test-id', position: 100 })

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/videos/test-id/progress', { position: 100 })
    })
  })

  it('should invalidate video query on success', async () => {
    // ...
  })
})
```

### 3. Video Types (Zod Schema)

**Datei:** `frontend/src/types/__tests__/video.test.ts`

```typescript
describe('VideoResponseSchema', () => {
  it('should parse video with watch_position', () => {
    const video = {
      // ... required fields
      watch_position: 125,
      watch_position_updated_at: '2024-01-01T00:00:00Z',
    }

    const result = VideoResponseSchema.parse(video)
    expect(result.watch_position).toBe(125)
  })

  it('should accept null watch_position', () => {
    const video = {
      // ... required fields
      watch_position: null,
    }

    const result = VideoResponseSchema.parse(video)
    expect(result.watch_position).toBeNull()
  })

  it('should accept missing watch_position (optional)', () => {
    const video = {
      // ... required fields without watch_position
    }

    const result = VideoResponseSchema.parse(video)
    expect(result.watch_position).toBeUndefined()
  })
})
```

---

## Integration Tests

### 4. VideoPlayer Component

**Datei:** `frontend/src/components/__tests__/VideoPlayer.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { VideoPlayer } from '../VideoPlayer'

// Mock Plyr
vi.mock('plyr', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    once: vi.fn(),
    destroy: vi.fn(),
    volume: 1,
    muted: false,
    speed: 1,
    currentTime: 0,
  })),
}))

describe('VideoPlayer', () => {
  it('should render with youtube embed', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
      />
    )

    const container = screen.getByTestId('video-player')
    expect(container).toHaveAttribute('data-plyr-provider', 'youtube')
    expect(container).toHaveAttribute('data-plyr-embed-id', 'dQw4w9WgXcQ')
  })

  it('should initialize Plyr with correct config', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
      />
    )

    expect(Plyr).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        controls: expect.arrayContaining(['play', 'progress', 'fullscreen']),
      })
    )
  })

  it('should seek to initial position when provided', async () => {
    const mockPlayer = {
      on: vi.fn(),
      once: vi.fn((event, callback) => {
        if (event === 'ready') callback()
      }),
      destroy: vi.fn(),
      currentTime: 0,
    }

    Plyr.mockImplementation(() => mockPlayer)

    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
        initialPosition={125}
      />
    )

    await waitFor(() => {
      expect(mockPlayer.currentTime).toBe(125)
    })
  })

  it('should cleanup Plyr on unmount', () => {
    const mockDestroy = vi.fn()
    Plyr.mockImplementation(() => ({
      on: vi.fn(),
      destroy: mockDestroy,
    }))

    const { unmount } = render(
      <VideoPlayer youtubeId="test" videoId="test-uuid" />
    )

    unmount()
    expect(mockDestroy).toHaveBeenCalled()
  })
})
```

### 5. VideoDetailsPage mit Player

**Datei:** `frontend/src/pages/__tests__/VideoDetailsPage.test.tsx`

```typescript
describe('VideoDetailsPage with VideoPlayer', () => {
  it('should render VideoPlayer instead of thumbnail', async () => {
    const mockVideo = {
      id: 'test-uuid',
      youtube_id: 'dQw4w9WgXcQ',
      title: 'Test Video',
      thumbnail_url: 'https://...',
      watch_position: 60,
    }

    render(<VideoDetailsPage />, { route: '/videos/test-uuid' })

    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  it('should pass watch_position to VideoPlayer', async () => {
    // ...
  })
})
```

---

## Backend Tests

### 6. API Endpoint Test

**Datei:** `backend/tests/test_video_progress.py`

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_update_watch_progress(client: AsyncClient, sample_video):
    """Test PATCH /videos/{id}/progress endpoint"""
    response = await client.patch(
        f"/api/videos/{sample_video.id}/progress",
        json={"position": 125}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["video_id"] == str(sample_video.id)
    assert data["watch_position"] == 125
    assert "updated_at" in data

@pytest.mark.asyncio
async def test_update_watch_progress_invalid_position(client: AsyncClient, sample_video):
    """Test negative position is rejected"""
    response = await client.patch(
        f"/api/videos/{sample_video.id}/progress",
        json={"position": -10}
    )

    assert response.status_code == 422  # Validation error

@pytest.mark.asyncio
async def test_update_watch_progress_video_not_found(client: AsyncClient):
    """Test 404 for non-existent video"""
    response = await client.patch(
        "/api/videos/00000000-0000-0000-0000-000000000000/progress",
        json={"position": 100}
    )

    assert response.status_code == 404

@pytest.mark.asyncio
async def test_get_video_includes_watch_position(client: AsyncClient, sample_video):
    """Test GET /videos/{id} includes watch_position"""
    # First set position
    await client.patch(
        f"/api/videos/{sample_video.id}/progress",
        json={"position": 200}
    )

    # Then fetch video
    response = await client.get(f"/api/videos/{sample_video.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["watch_position"] == 200
```

---

## E2E Tests

### 7. Playwright Test

**Datei:** `e2e/video-player.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Video Player', () => {
  test('should play video on details page', async ({ page }) => {
    await page.goto('/videos/existing-video-id')

    // Wait for player to load
    await expect(page.locator('[data-plyr-provider="youtube"]')).toBeVisible()

    // Click play
    await page.click('[data-plyr="play"]')

    // Verify playing state
    await expect(page.locator('.plyr--playing')).toBeVisible()
  })

  test('should save and restore progress', async ({ page }) => {
    // Play video for a few seconds
    await page.goto('/videos/existing-video-id')
    await page.click('[data-plyr="play"]')
    await page.waitForTimeout(5000)

    // Navigate away
    await page.goto('/videos')

    // Return to video
    await page.goto('/videos/existing-video-id')

    // Check progress was restored (approximately)
    const timeDisplay = await page.textContent('.plyr__time--current')
    expect(parseInt(timeDisplay || '0')).toBeGreaterThan(0)
  })

  test('should work in modal', async ({ page }) => {
    await page.goto('/videos')

    // Open video modal
    await page.click('[data-testid="video-card"]:first-child')

    // Wait for modal and player
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('[data-plyr-provider="youtube"]')).toBeVisible()
  })
})
```

---

## Regression Tests

### 8. Bestehende Funktionalität

```typescript
describe('Regression: VideoDetailsPage', () => {
  it('should still display video title', async () => {
    // ...
  })

  it('should still show custom fields', async () => {
    // ...
  })

  it('should still allow field editing', async () => {
    // ...
  })

  it('should still show category selector', async () => {
    // ...
  })
})
```

---

## Test-Checkliste

### Unit Tests
- [ ] playerSettingsStore: Default values
- [ ] playerSettingsStore: Persistence
- [ ] useWatchProgress: API call
- [ ] useWatchProgress: Query invalidation
- [ ] VideoResponseSchema: watch_position parsing

### Integration Tests
- [ ] VideoPlayer: Render with YouTube embed
- [ ] VideoPlayer: Plyr initialization
- [ ] VideoPlayer: Initial position seek
- [ ] VideoPlayer: Cleanup on unmount
- [ ] VideoDetailsPage: Player statt Thumbnail
- [ ] VideoDetailsModal: Player statt Thumbnail

### Backend Tests
- [ ] PATCH /videos/{id}/progress: Success
- [ ] PATCH /videos/{id}/progress: Validation
- [ ] PATCH /videos/{id}/progress: 404
- [ ] GET /videos/{id}: watch_position included

### E2E Tests
- [ ] Video playback on details page
- [ ] Progress save and restore
- [ ] Player in modal

### Regression Tests
- [ ] VideoDetailsPage: All existing features work
- [ ] VideoDetailsModal: All existing features work
- [ ] API: Existing endpoints unchanged

---

## Exit Condition

✅ Teststrategie vollständig:
- Unit Tests für neue Logik
- Integration Tests für Komponenten
- Backend Tests für API
- E2E Tests für User Flows
- Regression Tests für bestehende Funktionen
