# Implementation Plan: Responsive Thumbnails

## Overview

| Aspect | Details |
|--------|---------|
| **Total Phases** | 4 |
| **Estimated Time** | 3-4 hours |
| **Risk Level** | Low |
| **Dependencies** | None (frontend only) |

---

## Phase 1: Foundation - Utility Functions

**Goal:** Create thumbnail URL generation logic

### Tasks

#### 1.1 Create thumbnailUrl.ts Utility

**File:** `frontend/src/utils/thumbnailUrl.ts`

```typescript
/**
 * YouTube thumbnail quality levels
 */
export type ThumbnailQuality = 'default' | 'mq' | 'hq' | 'sd' | 'maxres'

/**
 * Generated thumbnail URLs for WebP and JPEG
 */
export interface ThumbnailUrls {
  webp: string
  jpeg: string
}

/**
 * YouTube thumbnail dimensions by quality
 */
export const THUMBNAIL_DIMENSIONS = {
  default: { width: 120, height: 90 },
  mq: { width: 320, height: 180 },
  hq: { width: 480, height: 360 },
  sd: { width: 640, height: 480 },
  maxres: { width: 1280, height: 720 },
} as const

/**
 * Map target width to appropriate YouTube quality
 * Accounts for Retina displays with 1.5x multiplier
 */
export function getQualityForWidth(targetWidth: number): ThumbnailQuality {
  // Adjust for Retina displays
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  const effectiveWidth = targetWidth * (pixelRatio > 1 ? 1.5 : 1)

  if (effectiveWidth <= 120) return 'default'
  if (effectiveWidth <= 320) return 'mq'
  if (effectiveWidth <= 480) return 'hq'
  if (effectiveWidth <= 640) return 'sd'
  return 'maxres'
}

/**
 * Generate YouTube thumbnail URLs for given youtube_id and target width
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
 * Calculate target thumbnail width based on view settings
 */
export function calculateThumbnailWidth(
  viewMode: 'list' | 'grid',
  thumbnailSize: 'small' | 'medium' | 'large' | 'xlarge',
  gridColumns: 2 | 3 | 4 | 5
): number {
  if (viewMode === 'list') {
    const listSizeMap = {
      small: 128,
      medium: 160,
      large: 192,
      xlarge: 500,
    } as const
    return listSizeMap[thumbnailSize]
  }

  // Grid view: estimate card width based on columns
  const gridWidthMap = {
    5: 200,
    4: 280,
    3: 380,
    2: 580,
  } as const
  return gridWidthMap[gridColumns]
}
```

#### 1.2 Add Unit Tests for Utility

**File:** `frontend/src/utils/thumbnailUrl.test.ts`

Test cases:
- getQualityForWidth returns correct quality for each size range
- getThumbnailUrls generates correct WebP URL
- getThumbnailUrls generates correct JPEG URL
- calculateThumbnailWidth returns correct width for list view
- calculateThumbnailWidth returns correct width for grid view
- Retina detection (mock devicePixelRatio)

---

## Phase 2: Component Update

**Goal:** Update VideoThumbnail to use dynamic URLs

### Tasks

#### 2.1 Update VideoThumbnail Props

**File:** `frontend/src/components/VideosPage.tsx`

**Old Interface:**
```typescript
interface VideoThumbnailProps {
  url: string | null
  title: string
  useFullWidth?: boolean
}
```

**New Interface:**
```typescript
interface VideoThumbnailProps {
  youtubeId: string
  fallbackUrl?: string | null
  title: string
  useFullWidth?: boolean
}
```

#### 2.2 Implement New VideoThumbnail

```typescript
import { getThumbnailUrls, calculateThumbnailWidth } from '@/utils/thumbnailUrl'

const VideoThumbnail = ({
  youtubeId,
  fallbackUrl,
  title,
  useFullWidth = false
}: VideoThumbnailProps) => {
  const [loadError, setLoadError] = useState(false)

  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize)
  const viewMode = useTableSettingsStore((state) => state.viewMode)
  const gridColumns = useTableSettingsStore((state) => state.gridColumns)

  // Size classes (unchanged from current implementation)
  const sizeClasses = { ... }
  const placeholderSizeClasses = { ... }

  // Calculate target width
  const targetWidth = calculateThumbnailWidth(
    useFullWidth ? 'grid' : viewMode,
    thumbnailSize,
    gridColumns
  )

  // Generate URLs
  const urls = youtubeId ? getThumbnailUrls(youtubeId, targetWidth) : null

  // Placeholder component (unchanged)
  const Placeholder = () => ( ... )

  // No youtube_id or all loads failed → fallback chain
  if (!urls || loadError) {
    if (fallbackUrl) {
      return (
        <img
          src={fallbackUrl}
          alt={title}
          loading="lazy"
          className={useFullWidth ? fullWidthClasses : sizeClasses[thumbnailSize]}
          onError={() => setLoadError(true)}
        />
      )
    }
    return <Placeholder />
  }

  // Primary: picture element with WebP + JPEG
  return (
    <picture>
      <source srcSet={urls.webp} type="image/webp" />
      <img
        src={urls.jpeg}
        alt={title}
        loading="lazy"
        className={useFullWidth ? fullWidthClasses : sizeClasses[thumbnailSize]}
        onError={() => setLoadError(true)}
      />
    </picture>
  )
}
```

---

## Phase 3: Usage Updates

**Goal:** Update all VideoThumbnail usages

### Tasks

#### 3.1 Update VideoCard.tsx

**File:** `frontend/src/components/VideoCard.tsx`

```diff
- <VideoThumbnail url={video.thumbnail_url} title={video.title || 'Untitled'} useFullWidth={true} />
+ <VideoThumbnail
+   youtubeId={video.youtube_id}
+   fallbackUrl={video.thumbnail_url}
+   title={video.title || 'Untitled'}
+   useFullWidth={true}
+ />
```

#### 3.2 Update VideosPage List View

**File:** `frontend/src/components/VideosPage.tsx` (Line ~656)

```diff
- return <VideoThumbnail url={thumbnailUrl} title={title} />
+ return <VideoThumbnail
+   youtubeId={row.youtube_id}
+   fallbackUrl={thumbnailUrl}
+   title={title}
+ />
```

---

## Phase 4: Testing & Polish

**Goal:** Update tests and verify functionality

### Tasks

#### 4.1 Update VideoThumbnail.test.tsx

- Update test props to new interface
- Add tests for URL generation
- Add tests for fallback behavior
- Add tests for picture element rendering

#### 4.2 Update VideoCard.test.tsx

- Update mock VideoThumbnail props
- Verify youtube_id is passed correctly

#### 4.3 Manual Testing Checklist

- [ ] List view small thumbnails load correct size
- [ ] List view xlarge thumbnails load correct size
- [ ] Grid 5-col loads smaller images than 2-col
- [ ] WebP loads in Chrome/Firefox/Safari
- [ ] JPEG fallback works (disable WebP in DevTools)
- [ ] Missing youtube_id falls back to DB URL
- [ ] All failures show placeholder
- [ ] Retina display loads larger images
- [ ] No console errors

#### 4.4 Performance Verification

Open DevTools Network tab:
- [ ] Verify WebP format in requests
- [ ] Verify thumbnail sizes match expectations
- [ ] Compare total bytes vs. before

---

## Verification Criteria

### Must Pass
- [ ] All existing tests pass (after updates)
- [ ] New utility tests pass
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Thumbnails display correctly in all views

### Performance Goals
- [ ] 50%+ reduction in thumbnail data for small settings
- [ ] No increase in LCP (Largest Contentful Paint)
- [ ] No visible quality degradation

---

**Status:** ✅ Complete
**Created:** 2024-11-28
