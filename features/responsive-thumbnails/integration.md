# Integration Strategy: Responsive Thumbnails

## Approach: In-Place Enhancement

Wir erweitern die bestehende `VideoThumbnail` Komponente anstatt eine neue zu erstellen.

**Warum:**
- Minimale Code-Änderungen
- Keine neuen Imports nötig
- Bestehende Tests als Basis nutzbar
- Export bleibt gleich

## Component Interface Evolution

### Current Interface
```typescript
interface VideoThumbnailProps {
  url: string | null
  title: string
  useFullWidth?: boolean
}
```

### New Interface
```typescript
interface VideoThumbnailProps {
  youtubeId: string          // PRIMARY: für URL-Generierung
  fallbackUrl?: string | null // FALLBACK: DB-URL wenn Generierung fehlschlägt
  title: string
  useFullWidth?: boolean
}
```

## New Utility Functions

### 1. Thumbnail URL Generator

**Location:** Neue Datei `frontend/src/utils/thumbnailUrl.ts`

```typescript
// YouTube thumbnail sizes
type ThumbnailQuality = 'default' | 'mq' | 'hq' | 'sd' | 'maxres'

interface ThumbnailUrls {
  webp: string
  jpeg: string
}

/**
 * Generate optimal YouTube thumbnail URLs based on required width
 */
export function getThumbnailUrls(
  youtubeId: string,
  targetWidth: number
): ThumbnailUrls {
  const quality = getQualityForWidth(targetWidth)

  return {
    webp: `https://i.ytimg.com/vi_webp/${youtubeId}/${quality}default.webp`,
    jpeg: `https://i.ytimg.com/vi/${youtubeId}/${quality}default.jpg`,
  }
}

/**
 * Map target width to YouTube quality suffix
 */
function getQualityForWidth(width: number): ThumbnailQuality {
  // Account for Retina displays (1.5x multiplier)
  const effectiveWidth = width * (window.devicePixelRatio > 1 ? 1.5 : 1)

  if (effectiveWidth <= 120) return 'default'  // 120x90
  if (effectiveWidth <= 320) return 'mq'       // 320x180
  if (effectiveWidth <= 480) return 'hq'       // 480x360
  if (effectiveWidth <= 640) return 'sd'       // 640x480
  return 'maxres'                               // 1280x720
}
```

### 2. Width Calculator

```typescript
/**
 * Calculate required thumbnail width based on display settings
 */
export function calculateThumbnailWidth(
  viewMode: 'list' | 'grid',
  thumbnailSize: ThumbnailSize,
  gridColumns: GridColumnCount
): number {
  if (viewMode === 'list') {
    // List view: Use thumbnailSize setting
    const listSizeMap = {
      small: 128,
      medium: 160,
      large: 192,
      xlarge: 500,
    }
    return listSizeMap[thumbnailSize]
  }

  // Grid view: Estimate based on columns
  // Assumes ~1200px container, gaps, etc.
  const gridWidthMap = {
    5: 200,   // ~200px per card
    4: 280,   // ~280px per card
    3: 380,   // ~380px per card
    2: 580,   // ~580px per card
  }
  return gridWidthMap[gridColumns]
}
```

## Integration Points

### 1. VideoThumbnail Component

```typescript
const VideoThumbnail = ({
  youtubeId,
  fallbackUrl,
  title,
  useFullWidth = false
}: VideoThumbnailProps) => {
  const [webpFailed, setWebpFailed] = useState(false)
  const [jpegFailed, setJpegFailed] = useState(false)

  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize)
  const viewMode = useTableSettingsStore((state) => state.viewMode)
  const gridColumns = useTableSettingsStore((state) => state.gridColumns)

  // Calculate optimal width
  const targetWidth = calculateThumbnailWidth(
    useFullWidth ? 'grid' : viewMode,
    thumbnailSize,
    gridColumns
  )

  // Generate URLs
  const urls = getThumbnailUrls(youtubeId, targetWidth)

  // Fallback chain: WebP → JPEG → DB URL → Placeholder
  if (!youtubeId || (webpFailed && jpegFailed)) {
    if (fallbackUrl && !jpegFailed) {
      return <img src={fallbackUrl} ... onError={() => setJpegFailed(true)} />
    }
    return <Placeholder />
  }

  return (
    <picture>
      {!webpFailed && (
        <source
          srcSet={urls.webp}
          type="image/webp"
        />
      )}
      <img
        src={urls.jpeg}
        alt={title}
        loading="lazy"
        className={...}
        onError={() => {
          if (!webpFailed) setWebpFailed(true)
          else setJpegFailed(true)
        }}
      />
    </picture>
  )
}
```

### 2. VideoCard.tsx Update

```diff
- <VideoThumbnail url={video.thumbnail_url} title={...} useFullWidth={true} />
+ <VideoThumbnail
+   youtubeId={video.youtube_id}
+   fallbackUrl={video.thumbnail_url}
+   title={...}
+   useFullWidth={true}
+ />
```

### 3. VideosPage.tsx List View Update

```diff
- return <VideoThumbnail url={thumbnailUrl} title={title} />
+ return <VideoThumbnail
+   youtubeId={row.youtube_id}
+   fallbackUrl={thumbnailUrl}
+   title={title}
+ />
```

## File Organization

```
frontend/src/
├── utils/
│   └── thumbnailUrl.ts        # NEW: URL generation logic
├── components/
│   ├── VideosPage.tsx         # MODIFIED: VideoThumbnail update
│   └── VideoCard.tsx          # MODIFIED: New props
└── (other files unchanged)
```

## Extension Points

### For Future Enhancements

1. **Custom thumbnail sources:** Add `customUrl` prop that bypasses YouTube CDN
2. **Blur placeholder:** Add optional blur-up loading effect
3. **Preloading:** Add `preload` prop for critical thumbnails

### Interface Ready for Extension

```typescript
interface VideoThumbnailProps {
  youtubeId: string
  fallbackUrl?: string | null
  title: string
  useFullWidth?: boolean
  // Future extensions:
  // customUrl?: string
  // preload?: boolean
  // blurPlaceholder?: boolean
}
```

## Feature Flags

**Not needed** for this feature because:
- Change is low-risk
- Graceful degradation built-in
- Easy to revert if issues
- No server-side changes

## Migration Path

1. Add new `thumbnailUrl.ts` utility
2. Update `VideoThumbnail` component signature
3. Update all usages (2 places)
4. Update tests

**No database migration needed.**

---

**Status:** ✅ Complete
**Created:** 2024-11-28
