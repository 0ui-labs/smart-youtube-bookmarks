# Testing-Strategie: YouTube-Kanäle Feature

## Test-Pyramide

```
         ╱╲
        ╱  ╲
       ╱ E2E╲         2-3 Tests (Critical Paths)
      ╱──────╲
     ╱        ╲
    ╱Integration╲     8-12 Tests (API + Store)
   ╱──────────────╲
  ╱                ╲
 ╱    Unit Tests    ╲  15-20 Tests (Components + Utils)
╱────────────────────╲
```

## Backend Tests

### Unit Tests: Channel Model

**Datei:** `backend/tests/unit/test_channel_model.py`

```python
import pytest
from app.models.channel import Channel


class TestChannelModel:
    def test_channel_creation(self):
        """Channel can be created with required fields"""
        channel = Channel(
            user_id=uuid4(),
            youtube_channel_id="UCX6OQ3DkcsbYNE6H8uQQuVA",
            name="MrBeast"
        )
        assert channel.name == "MrBeast"
        assert channel.is_hidden == False

    def test_channel_default_hidden(self):
        """is_hidden defaults to False"""
        channel = Channel(
            user_id=uuid4(),
            youtube_channel_id="UCtest",
            name="Test"
        )
        assert channel.is_hidden == False

    def test_channel_repr(self):
        """__repr__ shows useful info"""
        channel = Channel(name="Test")
        assert "Test" in repr(channel)
```

### Integration Tests: Channel API

**Datei:** `backend/tests/integration/test_channels_api.py`

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestChannelsAPI:
    async def test_list_channels_empty(self, client: AsyncClient, auth_headers):
        """GET /channels returns empty list for new user"""
        response = await client.get("/channels", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_channels_with_data(self, client, auth_headers, sample_channel):
        """GET /channels returns channels with video counts"""
        response = await client.get("/channels", headers=auth_headers)
        assert response.status_code == 200
        channels = response.json()
        assert len(channels) == 1
        assert channels[0]["name"] == sample_channel.name
        assert "video_count" in channels[0]

    async def test_list_channels_excludes_hidden(self, client, auth_headers, hidden_channel):
        """GET /channels excludes hidden channels by default"""
        response = await client.get("/channels", headers=auth_headers)
        channels = response.json()
        assert not any(c["id"] == str(hidden_channel.id) for c in channels)

    async def test_list_channels_include_hidden(self, client, auth_headers, hidden_channel):
        """GET /channels?include_hidden=true includes hidden"""
        response = await client.get("/channels?include_hidden=true", headers=auth_headers)
        channels = response.json()
        assert any(c["id"] == str(hidden_channel.id) for c in channels)

    async def test_hide_channel(self, client, auth_headers, sample_channel):
        """PATCH /channels/{id} can hide channel"""
        response = await client.patch(
            f"/channels/{sample_channel.id}",
            json={"is_hidden": True},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["is_hidden"] == True

    async def test_unhide_channel(self, client, auth_headers, hidden_channel):
        """PATCH /channels/{id} can unhide channel"""
        response = await client.patch(
            f"/channels/{hidden_channel.id}",
            json={"is_hidden": False},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["is_hidden"] == False

    async def test_delete_empty_channel(self, client, auth_headers, empty_channel):
        """DELETE /channels/{id} works for empty channel"""
        response = await client.delete(
            f"/channels/{empty_channel.id}",
            headers=auth_headers
        )
        assert response.status_code == 200

    async def test_delete_channel_with_videos_fails(self, client, auth_headers, channel_with_videos):
        """DELETE /channels/{id} fails if channel has videos"""
        response = await client.delete(
            f"/channels/{channel_with_videos.id}",
            headers=auth_headers
        )
        assert response.status_code == 400

    async def test_channel_not_found(self, client, auth_headers):
        """PATCH/DELETE returns 404 for non-existent channel"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.patch(f"/channels/{fake_id}", json={}, headers=auth_headers)
        assert response.status_code == 404


@pytest.mark.asyncio
class TestVideoFilterWithChannel:
    async def test_filter_by_channel(self, client, auth_headers, list_id, channel_with_videos):
        """POST /videos/filter with channel_id filters correctly"""
        response = await client.post(
            f"/lists/{list_id}/videos/filter",
            json={"channel_id": str(channel_with_videos.id)},
            headers=auth_headers
        )
        assert response.status_code == 200
        videos = response.json()
        assert all(v.get("channel_id") == str(channel_with_videos.id) for v in videos)

    async def test_filter_by_channel_and_tags(self, client, auth_headers, list_id, channel_with_videos):
        """Filter combines channel_id and tags with AND logic"""
        response = await client.post(
            f"/lists/{list_id}/videos/filter",
            json={
                "channel_id": str(channel_with_videos.id),
                "tags": ["Python"]
            },
            headers=auth_headers
        )
        assert response.status_code == 200
```

### Integration Test: Auto-Create Channel

**Datei:** `backend/tests/integration/test_video_processor.py`

```python
@pytest.mark.asyncio
class TestVideoProcessorChannels:
    async def test_creates_channel_for_new_video(self, db, user, youtube_client_mock):
        """Processing video creates channel if not exists"""
        youtube_client_mock.get_video_metadata.return_value = {
            "video_id": "test123",
            "title": "Test Video",
            "channel": "MrBeast",
            "channel_id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
        }

        await process_video(video_id="test123", user_id=user.id, db=db)

        # Channel should be created
        channel = await db.scalar(
            select(Channel).where(Channel.youtube_channel_id == "UCX6OQ3DkcsbYNE6H8uQQuVA")
        )
        assert channel is not None
        assert channel.name == "MrBeast"

    async def test_reuses_existing_channel(self, db, user, existing_channel, youtube_client_mock):
        """Processing video uses existing channel"""
        youtube_client_mock.get_video_metadata.return_value = {
            "channel_id": existing_channel.youtube_channel_id,
            "channel": existing_channel.name,
        }

        await process_video(video_id="test456", user_id=user.id, db=db)

        # Should not create duplicate
        count = await db.scalar(
            select(func.count(Channel.id)).where(
                Channel.youtube_channel_id == existing_channel.youtube_channel_id
            )
        )
        assert count == 1

    async def test_updates_channel_name_if_changed(self, db, user, existing_channel, youtube_client_mock):
        """Channel name is updated if YouTube changed it"""
        youtube_client_mock.get_video_metadata.return_value = {
            "channel_id": existing_channel.youtube_channel_id,
            "channel": "MrBeast Gaming",  # Name changed
        }

        await process_video(video_id="test789", user_id=user.id, db=db)

        await db.refresh(existing_channel)
        assert existing_channel.name == "MrBeast Gaming"
```

---

## Frontend Tests

### Unit Tests: channelStore

**Datei:** `frontend/src/stores/channelStore.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useChannelStore } from './channelStore';

describe('channelStore', () => {
  beforeEach(() => {
    useChannelStore.setState({ selectedChannelId: null });
  });

  it('starts with no selected channel', () => {
    const { selectedChannelId } = useChannelStore.getState();
    expect(selectedChannelId).toBeNull();
  });

  it('selectChannel sets the selected channel', () => {
    const { selectChannel } = useChannelStore.getState();
    selectChannel('channel-123');

    const { selectedChannelId } = useChannelStore.getState();
    expect(selectedChannelId).toBe('channel-123');
  });

  it('clearChannel resets to null', () => {
    const { selectChannel, clearChannel } = useChannelStore.getState();
    selectChannel('channel-123');
    clearChannel();

    const { selectedChannelId } = useChannelStore.getState();
    expect(selectedChannelId).toBeNull();
  });

  it('selecting new channel replaces previous', () => {
    const { selectChannel } = useChannelStore.getState();
    selectChannel('channel-123');
    selectChannel('channel-456');

    const { selectedChannelId } = useChannelStore.getState();
    expect(selectedChannelId).toBe('channel-456');
  });
});
```

### Unit Tests: tableSettingsStore (Avatar Setting)

**Datei:** `frontend/src/stores/tableSettingsStore.test.ts` (erweitern)

```typescript
describe('showChannelAvatars', () => {
  it('defaults to false', () => {
    const { showChannelAvatars } = useTableSettingsStore.getState();
    expect(showChannelAvatars).toBe(false);
  });

  it('can be toggled on', () => {
    const { setShowChannelAvatars } = useTableSettingsStore.getState();
    setShowChannelAvatars(true);

    const { showChannelAvatars } = useTableSettingsStore.getState();
    expect(showChannelAvatars).toBe(true);
  });
});
```

### Component Tests: ChannelNavigation

**Datei:** `frontend/src/components/ChannelNavigation.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChannelNavigation } from './ChannelNavigation';

const mockChannels = [
  { id: '1', name: 'MrBeast', video_count: 12, is_hidden: false },
  { id: '2', name: 'Fireship', video_count: 8, is_hidden: false },
];

describe('ChannelNavigation', () => {
  it('renders channel list', () => {
    render(
      <ChannelNavigation
        channels={mockChannels}
        selectedChannelId={null}
        onChannelSelect={() => {}}
        showAvatars={false}
      />
    );

    expect(screen.getByText('MrBeast')).toBeInTheDocument();
    expect(screen.getByText('Fireship')).toBeInTheDocument();
  });

  it('shows video counts', () => {
    render(
      <ChannelNavigation
        channels={mockChannels}
        selectedChannelId={null}
        onChannelSelect={() => {}}
        showAvatars={false}
      />
    );

    expect(screen.getByText('(12)')).toBeInTheDocument();
    expect(screen.getByText('(8)')).toBeInTheDocument();
  });

  it('calls onChannelSelect when channel clicked', () => {
    const onSelect = vi.fn();
    render(
      <ChannelNavigation
        channels={mockChannels}
        selectedChannelId={null}
        onChannelSelect={onSelect}
        showAvatars={false}
      />
    );

    fireEvent.click(screen.getByText('MrBeast'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });

  it('highlights selected channel', () => {
    render(
      <ChannelNavigation
        channels={mockChannels}
        selectedChannelId="1"
        onChannelSelect={() => {}}
        showAvatars={false}
      />
    );

    const selectedButton = screen.getByRole('button', { pressed: true });
    expect(selectedButton).toHaveTextContent('MrBeast');
  });

  it('renders nothing when no channels', () => {
    const { container } = render(
      <ChannelNavigation
        channels={[]}
        selectedChannelId={null}
        onChannelSelect={() => {}}
        showAvatars={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows avatars when enabled', () => {
    render(
      <ChannelNavigation
        channels={mockChannels}
        selectedChannelId={null}
        onChannelSelect={() => {}}
        showAvatars={true}
      />
    );

    // Should render avatar elements
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });
});
```

### Hook Tests: useChannels

**Datei:** `frontend/src/hooks/useChannels.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { useChannels } from './useChannels';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('useChannels', () => {
  it('fetches channels from API', async () => {
    const mockChannels = [{ id: '1', name: 'Test' }];
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockChannels });

    const { result } = renderHook(() => useChannels(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockChannels);
  });

  it('passes include_hidden parameter', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] });

    renderHook(() => useChannels(true), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/channels', {
        params: { include_hidden: true },
      });
    });
  });
});
```

---

## E2E Tests

### Critical Path: Channel Filter Flow

**Datei:** `e2e/channels.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Channel Feature', () => {
  test('filters videos by channel via sidebar', async ({ page }) => {
    // Setup: User has videos from different channels
    await page.goto('/videos');

    // Verify channels appear in sidebar
    await expect(page.getByText('Kanäle')).toBeVisible();
    await expect(page.getByRole('button', { name: /MrBeast/ })).toBeVisible();

    // Click on channel
    await page.getByRole('button', { name: /MrBeast/ }).click();

    // Verify URL updated
    await expect(page).toHaveURL(/channel=/);

    // Verify only MrBeast videos shown
    await expect(page.getByText('MrBeast')).toBeVisible();
    // Other channels should not be visible in video list
  });

  test('clicks channel in video card to filter', async ({ page }) => {
    await page.goto('/videos');

    // Find channel link in a video card
    const channelLink = page.locator('.video-card').first().getByRole('button', { name: /MrBeast/ });
    await channelLink.click();

    // Should filter by that channel
    await expect(page).toHaveURL(/channel=/);
  });

  test('hides and unhides channel', async ({ page }) => {
    await page.goto('/videos');

    // Open context menu on channel
    const channelItem = page.getByRole('button', { name: /Fireship/ });
    await channelItem.hover();
    await page.getByLabel('Menü für Fireship').click();

    // Click hide
    await page.getByText('Ausblenden').click();

    // Channel should disappear
    await expect(page.getByRole('button', { name: /Fireship/ })).not.toBeVisible();

    // Go to settings, unhide
    await page.goto('/settings');
    await page.getByRole('button', { name: /Einblenden/ }).first().click();

    // Verify it's back
    await page.goto('/videos');
    await expect(page.getByRole('button', { name: /Fireship/ })).toBeVisible();
  });
});
```

---

## Regressions-Tests

### Bestehende Funktionalität

```typescript
// Sicherstellen, dass Tag-Filter noch funktioniert
test('tag filter still works after channel feature', async ({ page }) => {
  await page.goto('/videos');
  await page.getByRole('button', { name: 'Python' }).click();
  // Verify filter works as before
});

// Sicherstellen, dass Video-Details noch funktionieren
test('video details modal still works', async ({ page }) => {
  await page.goto('/videos');
  await page.locator('.video-row').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
```

---

## Test Data Setup

### Fixtures für Channel-Tests

```python
# backend/tests/conftest.py

@pytest.fixture
async def sample_channel(db, user):
    channel = Channel(
        user_id=user.id,
        youtube_channel_id="UCtest123",
        name="Test Channel"
    )
    db.add(channel)
    await db.commit()
    return channel

@pytest.fixture
async def hidden_channel(db, user):
    channel = Channel(
        user_id=user.id,
        youtube_channel_id="UChidden",
        name="Hidden Channel",
        is_hidden=True
    )
    db.add(channel)
    await db.commit()
    return channel

@pytest.fixture
async def channel_with_videos(db, user, sample_channel):
    for i in range(3):
        video = Video(
            list_id=...,
            youtube_id=f"video{i}",
            channel_id=sample_channel.id
        )
        db.add(video)
    await db.commit()
    return sample_channel
```

---

## Coverage-Ziele

| Bereich | Ziel | Mindestens |
|---------|------|------------|
| Backend Models | 90% | 80% |
| Backend API | 85% | 75% |
| Frontend Stores | 95% | 90% |
| Frontend Hooks | 80% | 70% |
| Frontend Components | 70% | 60% |
