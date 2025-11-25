# Implementation Plan: Video Player

## Übersicht

Implementierung in 5 Phasen, geordnet nach Abhängigkeiten:
1. Backend Foundation
2. Frontend Foundation
3. Player-Komponente
4. Integration in Seiten
5. Polish & Advanced Features

---

## Phase 1: Backend Foundation

### 1.1 Database Migration

**Datei:** `backend/alembic/versions/xxx_add_watch_position.py`

```python
"""add watch_position to videos

Revision ID: xxx
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('videos', sa.Column('watch_position', sa.Integer(), nullable=True))
    op.add_column('videos', sa.Column('watch_position_updated_at', sa.DateTime(timezone=True), nullable=True))

def downgrade():
    op.drop_column('videos', 'watch_position_updated_at')
    op.drop_column('videos', 'watch_position')
```

### 1.2 Video Model erweitern

**Datei:** `backend/app/models/video.py`

Hinzufügen:
```python
watch_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
watch_position_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
```

### 1.3 Pydantic Schemas erweitern

**Datei:** `backend/app/schemas/video.py`

```python
class VideoResponse(BaseModel):
    # ... existing fields
    watch_position: Optional[int] = None
    watch_position_updated_at: Optional[datetime] = None

class UpdateWatchProgressRequest(BaseModel):
    position: int = Field(..., ge=0, description="Position in seconds")

class UpdateWatchProgressResponse(BaseModel):
    video_id: UUID
    watch_position: int
    updated_at: datetime
```

### 1.4 API Endpoint

**Datei:** `backend/app/api/videos.py`

```python
@router.patch("/{video_id}/progress", response_model=UpdateWatchProgressResponse)
async def update_watch_progress(
    video_id: UUID,
    request: UpdateWatchProgressRequest,
    db: AsyncSession = Depends(get_db)
):
    video = await crud.videos.get(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    video.watch_position = request.position
    video.watch_position_updated_at = datetime.now(timezone.utc)
    await db.commit()

    return UpdateWatchProgressResponse(
        video_id=video_id,
        watch_position=video.watch_position,
        updated_at=video.watch_position_updated_at
    )
```

---

## Phase 2: Frontend Foundation

### 2.1 Plyr installieren

```bash
cd frontend
npm install plyr
```

### 2.2 TypeScript Types

**Datei:** `frontend/src/types/player.ts`

```typescript
export interface PlayerSettings {
  volume: number      // 0-1
  muted: boolean
  playbackRate: number  // 0.5-2
}

export interface WatchProgress {
  videoId: string
  position: number
  updatedAt: string
}
```

### 2.3 Video Types erweitern

**Datei:** `frontend/src/types/video.ts`

```typescript
// Zu VideoResponseSchema hinzufügen:
watch_position: z.number().nullable().optional(),
watch_position_updated_at: z.string().nullable().optional(),
```

### 2.4 Zustand Store

**Datei:** `frontend/src/stores/playerSettingsStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PlayerSettings } from '@/types/player'

interface PlayerSettingsState extends PlayerSettings {
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setPlaybackRate: (rate: number) => void
}

export const usePlayerSettingsStore = create<PlayerSettingsState>()(
  persist(
    (set) => ({
      volume: 1,
      muted: false,
      playbackRate: 1,
      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
    }),
    {
      name: 'player-settings',
    }
  )
)
```

### 2.5 Watch Progress Hook

**Datei:** `frontend/src/hooks/useWatchProgress.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const useUpdateWatchProgress = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoId, position }: { videoId: string; position: number }) => {
      const { data } = await api.patch(`/videos/${videoId}/progress`, { position })
      return data
    },
    onSuccess: (_, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: ['videos', videoId] })
    },
  })
}
```

---

## Phase 3: Player-Komponente

### 3.1 VideoPlayer Komponente

**Datei:** `frontend/src/components/VideoPlayer.tsx`

```typescript
import { useRef, useEffect, useCallback } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { usePlayerSettingsStore } from '@/stores/playerSettingsStore'
import { useUpdateWatchProgress } from '@/hooks/useWatchProgress'
import { useDebouncedCallback } from 'use-debounce'

interface VideoPlayerProps {
  youtubeId: string
  videoId: string
  initialPosition?: number | null
  onReady?: () => void
  onEnded?: () => void
  onError?: (error: Error) => void
}

export const VideoPlayer = ({
  youtubeId,
  videoId,
  initialPosition,
  onReady,
  onEnded,
  onError,
}: VideoPlayerProps) => {
  const playerRef = useRef<Plyr | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Store
  const { volume, muted, playbackRate, setVolume, setMuted, setPlaybackRate } =
    usePlayerSettingsStore()

  // Progress mutation
  const updateProgress = useUpdateWatchProgress()

  // Debounced progress save (every 10 seconds)
  const saveProgress = useDebouncedCallback((position: number) => {
    updateProgress.mutate({ videoId, position: Math.floor(position) })
  }, 10000)

  // Initialize Plyr
  useEffect(() => {
    if (!containerRef.current) return

    const player = new Plyr(containerRef.current, {
      controls: [
        'play-large',
        'play',
        'progress',
        'current-time',
        'mute',
        'volume',
        'settings',
        'pip',
        'fullscreen',
      ],
      settings: ['speed'],
      speed: {
        selected: playbackRate,
        options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      },
      keyboard: { focused: true, global: false },
    })

    // Apply stored settings
    player.volume = volume
    player.muted = muted
    player.speed = playbackRate

    // Seek to initial position
    if (initialPosition && initialPosition > 0) {
      player.once('ready', () => {
        player.currentTime = initialPosition
      })
    }

    // Event handlers
    player.on('ready', () => onReady?.())
    player.on('ended', () => onEnded?.())
    player.on('error', (e) => onError?.(new Error('Player error')))

    player.on('timeupdate', () => {
      saveProgress(player.currentTime)
    })

    player.on('pause', () => {
      // Immediate save on pause
      updateProgress.mutate({ videoId, position: Math.floor(player.currentTime) })
    })

    player.on('volumechange', () => {
      setVolume(player.volume)
      setMuted(player.muted)
    })

    player.on('ratechange', () => {
      setPlaybackRate(player.speed)
    })

    playerRef.current = player

    return () => {
      player.destroy()
    }
  }, [youtubeId])

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
      <div
        ref={containerRef}
        data-plyr-provider="youtube"
        data-plyr-embed-id={youtubeId}
      />
    </div>
  )
}
```

### 3.2 CSS Theme Integration

**Datei:** `frontend/src/index.css`

```css
/* Plyr Theme Variables */
:root {
  --plyr-color-main: hsl(var(--primary));
  --plyr-video-control-color: rgba(255, 255, 255, 0.9);
  --plyr-video-control-color-hover: hsl(var(--primary));
  --plyr-font-family: var(--font-sans, system-ui, sans-serif);
  --plyr-badge-background: hsl(var(--secondary));
  --plyr-badge-text-color: hsl(var(--secondary-foreground));
  --plyr-tooltip-background: hsl(var(--popover));
  --plyr-tooltip-color: hsl(var(--popover-foreground));
  --plyr-range-fill-background: hsl(var(--primary));
}

.plyr__control:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

---

## Phase 4: Integration in Seiten

### 4.1 VideoDetailsPage

**Datei:** `frontend/src/pages/VideoDetailsPage.tsx`

```diff
+ import { VideoPlayer } from '@/components/VideoPlayer'

// In JSX (Zeile ~180-194):
- {video.thumbnail_url && (
-   <div className="relative w-full aspect-video mb-4 rounded-lg overflow-hidden bg-gray-100">
-     <img
-       src={video.thumbnail_url}
-       alt={video.title || 'Video thumbnail'}
-       className="w-full h-full object-cover"
-       loading="lazy"
-     />
-     {video.duration && (
-       <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
-         {formatDuration(video.duration)}
-       </div>
-     )}
-   </div>
- )}
+ <VideoPlayer
+   youtubeId={video.youtube_id}
+   videoId={video.id}
+   initialPosition={video.watch_position}
+ />
```

### 4.2 VideoDetailsModal

**Datei:** `frontend/src/components/VideoDetailsModal.tsx`

```diff
+ import { VideoPlayer } from '@/components/VideoPlayer'

// In JSX (Zeile ~124-130):
- <div className="relative w-full aspect-video bg-gray-100 rounded-md overflow-hidden">
-   <img
-     src={displayVideo.thumbnail_url || ''}
-     alt={displayVideo.title || 'Video thumbnail'}
-     className="w-full h-full object-cover"
-   />
- </div>
+ <VideoPlayer
+   youtubeId={displayVideo.youtube_id}
+   videoId={displayVideo.id}
+   initialPosition={displayVideo.watch_position}
+ />
```

---

## Phase 5: Polish & Advanced Features

### 5.1 Error Handling mit Fallback

**Datei:** `frontend/src/components/VideoPlayer.tsx`

```typescript
const [error, setError] = useState<Error | null>(null)

// Fallback rendern bei Fehler
if (error) {
  return (
    <div className="relative w-full aspect-video bg-gray-100 rounded-lg">
      <img src={thumbnailUrl} className="w-full h-full object-cover blur-sm opacity-50" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-600">Video nicht verfügbar</p>
        <a href={`https://youtube.com/watch?v=${youtubeId}`} target="_blank">
          Auf YouTube ansehen →
        </a>
      </div>
    </div>
  )
}
```

### 5.2 Loading State

```typescript
const [isLoading, setIsLoading] = useState(true)

// Player ready callback
player.on('ready', () => {
  setIsLoading(false)
  onReady?.()
})

// Loading overlay
{isLoading && (
  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
    <Loader2 className="h-8 w-8 animate-spin text-white" />
  </div>
)}
```

### 5.3 Feature Flag (optional)

**Datei:** `frontend/src/config/featureFlags.ts`

```typescript
export const FEATURE_FLAGS = {
  VIDEO_PLAYER_ENABLED: true,
}
```

---

## Zusammenfassung

| Phase | Aufgabe | Dateien |
|-------|---------|---------|
| 1 | Backend Foundation | 4 |
| 2 | Frontend Foundation | 4 |
| 3 | Player-Komponente | 2 |
| 4 | Integration | 2 |
| 5 | Polish | 2 |

**Gesamt: ~14 Dateien, 5 Phasen**

## Exit Condition

✅ Actionable Implementierungsplan:
- Klare Phasen mit Abhängigkeiten
- Spezifische Dateien und Code-Snippets
- Backend → Frontend → Integration Reihenfolge
