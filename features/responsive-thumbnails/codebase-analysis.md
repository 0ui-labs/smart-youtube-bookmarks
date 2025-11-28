# Codebase Analysis: Responsive Thumbnails

## Existing Architecture

### VideoThumbnail Component

**Location:** `frontend/src/components/VideosPage.tsx:130-181`

```typescript
const VideoThumbnail = ({
  url,           // thumbnail_url from DB
  title,         // Video title for alt text
  useFullWidth   // Grid mode = true, List mode = false
}: Props) => {
  const [hasError, setHasError] = useState(false)
  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize)

  // Size classes mapping (PurgeCSS-safe)
  const sizeClasses = {
    small: 'w-32 aspect-video ...',   // 128px
    medium: 'w-40 aspect-video ...',  // 160px
    large: 'w-48 aspect-video ...',   // 192px
    xlarge: 'w-[500px] aspect-video ...',  // 500px
  }

  return (
    <img
      src={url}  // ← Currently: always DB thumbnail_url
      alt={title}
      loading="lazy"  // ✅ Already has lazy loading
      className={...}
      onError={() => setHasError(true)}  // ✅ Has error handling
    />
  )
}
```

**Key Observations:**
- ✅ Already has error handling with placeholder fallback
- ✅ Already has native lazy loading
- ✅ Already uses zustand store for size settings
- ❌ Uses `url` prop directly (no URL transformation)
- ❌ No WebP support
- ❌ No dynamic size selection

### Component Usage

| Location | Mode | Props |
|----------|------|-------|
| `VideosPage.tsx:656` | List View | `url={thumbnailUrl}, title={title}` |
| `VideoCard.tsx:159` | Grid View | `url={video.thumbnail_url}, title={...}, useFullWidth={true}` |

**Export:** `VideosPage.tsx:1323` exports `VideoThumbnail` for reuse.

### Settings Store

**Location:** `frontend/src/stores/tableSettingsStore.ts`

```typescript
interface TableSettingsStore {
  thumbnailSize: 'small' | 'medium' | 'large' | 'xlarge'
  viewMode: 'list' | 'grid'
  gridColumns: 2 | 3 | 4 | 5
  // ...
}
```

All required settings are already in the store and accessible.

### VideoResponse Type

**Location:** `frontend/src/types/video.ts:275-299`

```typescript
export const VideoResponseSchema = z.object({
  id: z.string().uuid(),
  youtube_id: z.string(),        // ✅ Available for URL generation
  thumbnail_url: z.string().nullable(),  // ✅ Available as fallback
  // ...
})
```

**Key:** `youtube_id` is always available - we can generate optimized URLs from it.

## Data Flow

```
Backend (DB)                    Frontend
┌─────────────┐                ┌──────────────────────┐
│ videos      │                │ VideoResponse        │
│ ─────────── │    API         │ ────────────────     │
│ youtube_id  │ ──────────────►│ youtube_id           │
│ thumbnail_url (hqdefault)    │ thumbnail_url        │
└─────────────┘                └──────────────────────┘
                                        │
                                        ▼
                               ┌──────────────────────┐
                               │ VideoThumbnail       │
                               │ ────────────────     │
                               │ url={thumbnail_url}  │ ← Current: passes through
                               │                      │
                               │ PROPOSED:            │
                               │ youtube_id + settings│
                               │ → generate optimal   │
                               │   WebP URL           │
                               └──────────────────────┘
```

## Existing Patterns

### 1. PurgeCSS-Safe Object Mapping
```typescript
// Pattern used throughout codebase
const sizeClasses = {
  small: 'w-32 ...',
  medium: 'w-40 ...',
} as const
```
**We must follow this pattern** for any new size mappings.

### 2. Zustand Store Access
```typescript
const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize)
```
**Selector pattern** - only subscribe to needed state.

### 3. Error Handling with Fallback
```typescript
const [hasError, setHasError] = useState(false)
if (!url || hasError) return <Placeholder />
```
**Keep this pattern** - extend for multi-level fallback.

## Similar Existing Features

### Channel Avatars (features/channels/stories/005-channel-avatars.md)
- Also uses YouTube thumbnail URLs
- Different size variants documented
- Similar pattern we can reference

### Thumbnail Size Settings (Task #31)
- Implemented dynamic size classes
- Object mapping for PurgeCSS safety
- localStorage persistence via zustand

## Files That Will Change

| File | Change Type | Reason |
|------|-------------|--------|
| `VideosPage.tsx` | **Major** | VideoThumbnail component rewrite |
| `VideoCard.tsx` | **Minor** | Pass `youtube_id` instead of/alongside `thumbnail_url` |
| `video.ts` | **None** | Types already sufficient |
| `tableSettingsStore.ts` | **None** | Settings already available |

## Technical Constraints

1. **PurgeCSS:** All Tailwind classes must be in object mappings (no template literals)
2. **SSR/Hydration:** Not applicable (SPA only)
3. **Browser Support:** WebP supported in all modern browsers (Safari 14+, 2020)
4. **YouTube URL Format:** Must use exact YouTube CDN patterns

## YouTube URL Patterns

```typescript
// JPEG (legacy, universal support)
`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`

// WebP (modern, ~30% smaller)
`https://i.ytimg.com/vi_webp/${youtubeId}/mqdefault.webp`

// Available sizes:
// default     = 120x90
// mqdefault   = 320x180
// hqdefault   = 480x360
// sddefault   = 640x480
// maxresdefault = 1280x720 (not always available)
```

## Integration Points

### 1. VideoThumbnail Props
**Current:**
```typescript
{ url: string | null; title: string; useFullWidth?: boolean }
```

**Proposed:**
```typescript
{
  youtubeId: string;           // NEW: for URL generation
  fallbackUrl: string | null;  // RENAMED: DB URL as fallback
  title: string;
  useFullWidth?: boolean
}
```

### 2. Store Access
Already have access to:
- `thumbnailSize` → determines base pixel width
- `viewMode` → 'list' or 'grid'
- `gridColumns` → 2-5 for grid sizing

---

**Status:** ✅ Complete
**Created:** 2024-11-28
