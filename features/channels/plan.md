# Implementierungsplan: YouTube-Kanäle Feature

## Übersicht

**Gesamtdauer:** 12-18 Stunden
**Phasen:** 6 logische Blöcke
**Abhängigkeiten:** Sequentiell (Backend vor Frontend)

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Daten-Fundament                                        │
│ ├── Channel Model                                               │
│ ├── Video Model erweitern                                       │
│ └── DB Migration                                                │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: YouTube-Integration                                    │
│ ├── YouTubeClient erweitern                                     │
│ └── Video Processor: Auto-Create                                │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: Backend API                                            │
│ ├── Channel Schemas                                             │
│ ├── Channel Endpoints                                           │
│ └── Filter API erweitern                                        │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: Frontend Foundation                                    │
│ ├── Types & Schemas                                             │
│ ├── Hooks (useChannels)                                         │
│ └── Store (channelStore)                                        │
├─────────────────────────────────────────────────────────────────┤
│ Phase 5: UI Components                                          │
│ ├── ChannelNavigation                                           │
│ ├── Sidebar Integration                                         │
│ ├── Video Items: Klickbare Kanäle                               │
│ └── Settings Integration                                        │
├─────────────────────────────────────────────────────────────────┤
│ Phase 6: Polish & Testing                                       │
│ ├── URL Sync                                                    │
│ ├── Auto-Delete Empty Channels                                  │
│ └── Tests                                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Daten-Fundament

### 1.1 Channel Model erstellen

**Datei:** `backend/app/models/channel.py`

```python
from typing import Optional, TYPE_CHECKING
from uuid import UUID as PyUUID
from sqlalchemy import String, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .user import User
    from .video import Video


class Channel(BaseModel):
    """
    Represents a YouTube channel that videos belong to.

    Channels are automatically created when videos are added.
    Each user has their own set of channels (user-scoped).
    """
    __tablename__ = 'channels'

    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False
    )
    youtube_channel_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="YouTube's channel ID (e.g., UCX6OQ3DkcsbYNE6H8uQQuVA)"
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Channel display name from YouTube"
    )
    thumbnail_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Channel avatar URL from YouTube"
    )
    is_hidden: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default='false',
        comment="Hidden channels don't appear in sidebar"
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="channels")
    videos: Mapped[list["Video"]] = relationship(
        "Video",
        back_populates="channel_ref",
        lazy="raise"
    )

    __table_args__ = (
        Index("idx_channels_user_id", "user_id"),
        Index("idx_channels_user_youtube", "user_id", "youtube_channel_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Channel(id={self.id}, name={self.name!r})>"
```

### 1.2 Video Model erweitern

**Datei:** `backend/app/models/video.py`

Hinzufügen nach Zeile 27:
```python
# Channel relationship
channel_id: Mapped[Optional[UUID]] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("channels.id", ondelete="SET NULL"),
    nullable=True,
    index=True
)

channel_ref: Mapped[Optional["Channel"]] = relationship(
    "Channel",
    back_populates="videos",
    lazy="raise"
)
```

### 1.3 Models __init__.py aktualisieren

**Datei:** `backend/app/models/__init__.py`

```python
from .channel import Channel
```

### 1.4 User Model erweitern

**Datei:** `backend/app/models/user.py`

```python
# In User class, add relationship:
channels: Mapped[list["Channel"]] = relationship(
    "Channel",
    back_populates="user",
    cascade="all, delete-orphan"
)
```

### 1.5 DB Migration erstellen

```bash
alembic revision --autogenerate -m "add_channels_table_and_video_channel_fk"
```

**Migration prüfen und ausführen:**
```bash
alembic upgrade head
```

---

## Phase 2: YouTube-Integration

### 2.1 VideoMetadata TypedDict erweitern

**Datei:** `backend/app/clients/youtube.py`

```python
class VideoMetadata(TypedDict, total=False):
    # ... existing fields ...
    channel_id: str  # NEU: YouTube channel ID
    channel_thumbnail: str  # NEU: Channel avatar URL (optional)
```

### 2.2 YouTubeClient: channelId extrahieren

**Datei:** `backend/app/clients/youtube.py`

In `get_video_metadata()` (ca. Zeile 149-153):
```python
metadata: VideoMetadata = {
    "video_id": video_id,
    "title": snippet["title"],
    "channel": snippet["channelTitle"],
    "channel_id": snippet["channelId"],  # NEU
    # Channel thumbnail requires separate API call - skip for now
    # Can be added later via channels.list API
    ...
}
```

Analog in `get_batch_metadata()` (ca. Zeile 360-364):
```python
metadata = {
    "youtube_id": video_id,
    "title": snippet.get("title", "Unknown Title"),
    "channel": snippet.get("channelTitle", "Unknown Channel"),
    "channel_id": snippet.get("channelId"),  # NEU
    ...
}
```

### 2.3 Video Processor: get_or_create_channel

**Datei:** `backend/app/workers/video_processor.py`

Neue Helper-Funktion:
```python
async def get_or_create_channel(
    db: AsyncSession,
    user_id: UUID,
    youtube_channel_id: str,
    channel_name: str,
    channel_thumbnail: Optional[str] = None
) -> Channel:
    """
    Find existing channel or create new one.
    Atomically handles concurrent requests via unique constraint.
    """
    # Try to find existing
    result = await db.execute(
        select(Channel).where(
            Channel.user_id == user_id,
            Channel.youtube_channel_id == youtube_channel_id
        )
    )
    channel = result.scalar_one_or_none()

    if channel:
        # Update name if changed on YouTube
        if channel.name != channel_name:
            channel.name = channel_name
        return channel

    # Create new channel
    channel = Channel(
        user_id=user_id,
        youtube_channel_id=youtube_channel_id,
        name=channel_name,
        thumbnail_url=channel_thumbnail
    )
    db.add(channel)
    await db.flush()  # Get ID
    return channel
```

Integration in Video-Verarbeitung:
```python
# In process_video or similar function
if metadata.get("channel_id"):
    channel = await get_or_create_channel(
        db=db,
        user_id=user_id,
        youtube_channel_id=metadata["channel_id"],
        channel_name=metadata["channel"],
        channel_thumbnail=metadata.get("channel_thumbnail")
    )
    video.channel_id = channel.id
```

---

## Phase 3: Backend API

### 3.1 Channel Schemas

**Datei:** `backend/app/schemas/channel.py` (NEU)

```python
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime


class ChannelBase(BaseModel):
    name: str
    youtube_channel_id: str
    thumbnail_url: Optional[str] = None
    is_hidden: bool = False


class ChannelCreate(ChannelBase):
    pass  # Channels are created automatically


class ChannelUpdate(BaseModel):
    is_hidden: Optional[bool] = None


class ChannelResponse(ChannelBase):
    id: UUID
    user_id: UUID
    video_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

### 3.2 Channel API Endpoints

**Datei:** `backend/app/api/channels.py` (NEU)

```python
from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.channel import Channel
from app.models.video import Video
from app.schemas.channel import ChannelResponse, ChannelUpdate
from app.dependencies import get_current_user, get_db

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("", response_model=List[ChannelResponse])
async def list_channels(
    include_hidden: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List all channels for current user with video counts."""
    # Subquery for video count
    video_count_subq = (
        select(Video.channel_id, func.count(Video.id).label("video_count"))
        .group_by(Video.channel_id)
        .subquery()
    )

    query = (
        select(Channel, func.coalesce(video_count_subq.c.video_count, 0).label("video_count"))
        .outerjoin(video_count_subq, Channel.id == video_count_subq.c.channel_id)
        .where(Channel.user_id == current_user.id)
    )

    if not include_hidden:
        query = query.where(Channel.is_hidden == False)

    query = query.order_by(Channel.name)

    result = await db.execute(query)
    channels = []
    for row in result:
        channel = row[0]
        channel.video_count = row[1]
        channels.append(channel)

    return channels


@router.patch("/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: UUID,
    update: ChannelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update channel (e.g., hide/unhide)."""
    channel = await db.get(Channel, channel_id)
    if not channel or channel.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Channel not found")

    if update.is_hidden is not None:
        channel.is_hidden = update.is_hidden

    await db.commit()
    await db.refresh(channel)
    return channel


@router.delete("/{channel_id}")
async def delete_channel(
    channel_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete channel (only if empty)."""
    channel = await db.get(Channel, channel_id)
    if not channel or channel.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check if channel has videos
    video_count = await db.scalar(
        select(func.count(Video.id)).where(Video.channel_id == channel_id)
    )
    if video_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete channel with {video_count} videos"
        )

    await db.delete(channel)
    await db.commit()
    return {"status": "deleted"}
```

### 3.3 Filter API erweitern

**Datei:** `backend/app/api/videos.py`

Schema erweitern:
```python
class VideoFilterRequest(BaseModel):
    tags: Optional[List[str]] = None
    channel_id: Optional[UUID] = None  # NEU
    field_filters: Optional[List[FieldFilter]] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = "asc"
```

Query erweitern:
```python
if filter_request.channel_id:
    query = query.where(Video.channel_id == filter_request.channel_id)
```

### 3.4 Router registrieren

**Datei:** `backend/app/main.py`

```python
from app.api.channels import router as channels_router

app.include_router(channels_router)
```

---

## Phase 4: Frontend Foundation

### 4.1 Types definieren

**Datei:** `frontend/src/types/channel.ts` (NEU)

```typescript
import { z } from 'zod';

export const ChannelSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  youtube_channel_id: z.string(),
  name: z.string(),
  thumbnail_url: z.string().nullable(),
  is_hidden: z.boolean(),
  video_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelUpdateSchema = z.object({
  is_hidden: z.boolean().optional(),
});

export type ChannelUpdate = z.infer<typeof ChannelUpdateSchema>;
```

### 4.2 useChannels Hook

**Datei:** `frontend/src/hooks/useChannels.ts` (NEU)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Channel, ChannelUpdate } from '@/types/channel';

export function useChannels(includeHidden = false) {
  return useQuery({
    queryKey: ['channels', { includeHidden }],
    queryFn: async () => {
      const { data } = await api.get<Channel[]>('/channels', {
        params: { include_hidden: includeHidden },
      });
      return data;
    },
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, update }: { channelId: string; update: ChannelUpdate }) => {
      const { data } = await api.patch<Channel>(`/channels/${channelId}`, update);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useHideChannel() {
  const updateChannel = useUpdateChannel();

  return {
    mutate: (channelId: string) =>
      updateChannel.mutate({ channelId, update: { is_hidden: true } }),
    ...updateChannel,
  };
}

export function useUnhideChannel() {
  const updateChannel = useUpdateChannel();

  return {
    mutate: (channelId: string) =>
      updateChannel.mutate({ channelId, update: { is_hidden: false } }),
    ...updateChannel,
  };
}
```

### 4.3 Channel Store

**Datei:** `frontend/src/stores/channelStore.ts` (NEU)

```typescript
import { create } from 'zustand';

interface ChannelStore {
  selectedChannelId: string | null;
  selectChannel: (channelId: string) => void;
  clearChannel: () => void;
}

export const useChannelStore = create<ChannelStore>((set) => ({
  selectedChannelId: null,

  selectChannel: (channelId) => set({ selectedChannelId: channelId }),
  clearChannel: () => set({ selectedChannelId: null }),
}));
```

### 4.4 useVideosFilter erweitern

**Datei:** `frontend/src/hooks/useVideosFilter.ts`

Interface erweitern:
```typescript
interface UseVideosFilterOptions {
  listId: string;
  tags?: string[];
  channelId?: string;  // NEU
  fieldFilters?: ActiveFilter[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
}
```

Request Body erweitern:
```typescript
if (channelId) {
  requestBody.channel_id = channelId;
}
```

---

## Phase 5: UI Components

### 5.1 ChannelNavigation Component

**Datei:** `frontend/src/components/ChannelNavigation.tsx` (NEU)

(Siehe ui-integration.md für vollständige Implementierung)

### 5.2 Sidebar Integration

**Datei:** `frontend/src/components/VideosPage.tsx`

In der Sidebar-Section nach TagNavigation:
```tsx
{/* Channel Navigation */}
<ChannelNavigation
  channels={channels}
  selectedChannelId={selectedChannelId}
  onChannelSelect={handleChannelSelect}
  showAvatars={showChannelAvatars}
  isLoading={channelsLoading}
/>
```

### 5.3 Video Items: Klickbare Kanäle

**List View:** Title-Column in VideosPage.tsx anpassen
**Grid View:** VideoCard.tsx um `onChannelClick` Prop erweitern

### 5.4 Settings Integration

**Datei:** `frontend/src/stores/tableSettingsStore.ts`

Neues Setting hinzufügen:
```typescript
showChannelAvatars: boolean;
setShowChannelAvatars: (show: boolean) => void;
```

---

## Phase 6: Polish & Testing

### 6.1 URL Sync

Channel-Filter in URL synchronisieren (wie Tags):
- `?channel=uuid` hinzufügen/entfernen
- Bei Page Load aus URL lesen

### 6.2 Auto-Delete Empty Channels

In Video Delete Handler:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['videos'] });
  queryClient.invalidateQueries({ queryKey: ['channels'] });  // NEU
},
```

Backend: Nach Video Delete prüfen ob Channel leer.

### 6.3 Tests

- Backend: Channel API Tests
- Frontend: channelStore Tests
- E2E: Channel Filter Flow

---

## Commit-Strategie

| Commit | Beschreibung |
|--------|--------------|
| 1 | `feat(backend): add Channel model and migration` |
| 2 | `feat(backend): extract channelId in YouTubeClient` |
| 3 | `feat(backend): auto-create channels in video processor` |
| 4 | `feat(backend): add Channel API endpoints` |
| 5 | `feat(backend): extend video filter with channel_id` |
| 6 | `feat(frontend): add channel types and hooks` |
| 7 | `feat(frontend): add channelStore for filter state` |
| 8 | `feat(frontend): add ChannelNavigation component` |
| 9 | `feat(frontend): integrate channels in VideosPage sidebar` |
| 10 | `feat(frontend): make channel clickable in video items` |
| 11 | `feat(frontend): add channel avatar toggle in settings` |
| 12 | `feat(frontend): sync channel filter with URL` |
| 13 | `feat(backend): auto-delete empty channels` |
| 14 | `test: add channel feature tests` |
