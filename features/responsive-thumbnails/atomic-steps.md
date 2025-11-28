# Atomic Steps: Responsive Thumbnails

## Overview

Total: **10 atomic steps**
Each step: 15-45 minutes, 1-2 files, independently testable

---

## Step 1: Create thumbnailUrl.ts with getQualityForWidth

**Time:** 15 min
**Files:** `frontend/src/utils/thumbnailUrl.ts`

**Task:**
```typescript
// Create new file with:
export type ThumbnailQuality = 'default' | 'mq' | 'hq' | 'sd' | 'maxres'

export function getQualityForWidth(targetWidth: number): ThumbnailQuality {
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  const effectiveWidth = targetWidth * (pixelRatio > 1 ? 1.5 : 1)

  if (effectiveWidth <= 120) return 'default'
  if (effectiveWidth <= 320) return 'mq'
  if (effectiveWidth <= 480) return 'hq'
  if (effectiveWidth <= 640) return 'sd'
  return 'maxres'
}
```

**Test:** Run manually in browser console with different values

**Commit:** `feat(utils): add getQualityForWidth for responsive thumbnails`

---

## Step 2: Add getThumbnailUrls function

**Time:** 15 min
**Files:** `frontend/src/utils/thumbnailUrl.ts`

**Task:**
```typescript
// Add to existing file:
export interface ThumbnailUrls {
  webp: string
  jpeg: string
}

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
```

**Test:** `getThumbnailUrls('dQw4w9WgXcQ', 128)` returns expected URLs

**Commit:** `feat(utils): add getThumbnailUrls for WebP/JPEG URL generation`

---

## Step 3: Add calculateThumbnailWidth function

**Time:** 15 min
**Files:** `frontend/src/utils/thumbnailUrl.ts`

**Task:**
```typescript
// Add to existing file:
export function calculateThumbnailWidth(
  viewMode: 'list' | 'grid',
  thumbnailSize: 'small' | 'medium' | 'large' | 'xlarge',
  gridColumns: 2 | 3 | 4 | 5
): number {
  if (viewMode === 'list') {
    const listSizeMap = { small: 128, medium: 160, large: 192, xlarge: 500 }
    return listSizeMap[thumbnailSize]
  }
  const gridWidthMap = { 5: 200, 4: 280, 3: 380, 2: 580 }
  return gridWidthMap[gridColumns]
}
```

**Test:** Various input combinations return expected values

**Commit:** `feat(utils): add calculateThumbnailWidth for view-aware sizing`

---

## Step 4: Write unit tests for thumbnailUrl.ts

**Time:** 30 min
**Files:** `frontend/src/utils/thumbnailUrl.test.ts`

**Task:** Create test file with all test cases from testing.md

**Test:** `npm test thumbnailUrl.test.ts` passes

**Commit:** `test(utils): add comprehensive tests for thumbnailUrl utilities`

---

## Step 5: Update VideoThumbnail props interface

**Time:** 15 min
**Files:** `frontend/src/components/VideosPage.tsx`

**Task:**
```typescript
// Change from:
const VideoThumbnail = ({ url, title, useFullWidth = false }: {
  url: string | null
  title: string
  useFullWidth?: boolean
}) => {

// To:
const VideoThumbnail = ({
  youtubeId,
  fallbackUrl,
  title,
  useFullWidth = false
}: {
  youtubeId: string
  fallbackUrl?: string | null
  title: string
  useFullWidth?: boolean
}) => {
```

**Test:** TypeScript compiles (will have errors at usage sites - expected)

**Commit:** `refactor(VideoThumbnail): update props interface for responsive loading`

---

## Step 6: Implement new VideoThumbnail logic

**Time:** 30 min
**Files:** `frontend/src/components/VideosPage.tsx`

**Task:** Replace VideoThumbnail implementation with:
- Import utilities from thumbnailUrl.ts
- Read viewMode and gridColumns from store
- Generate URLs using utilities
- Render `<picture>` element with WebP + JPEG sources
- Handle fallback chain with loadError state

**Test:** Component renders without errors (usage sites still broken)

**Commit:** `feat(VideoThumbnail): implement responsive URL generation with WebP`

---

## Step 7: Update VideoCard.tsx usage

**Time:** 15 min
**Files:** `frontend/src/components/VideoCard.tsx`

**Task:**
```typescript
// Change from:
<VideoThumbnail url={video.thumbnail_url} title={...} useFullWidth={true} />

// To:
<VideoThumbnail
  youtubeId={video.youtube_id}
  fallbackUrl={video.thumbnail_url}
  title={video.title || 'Untitled'}
  useFullWidth={true}
/>
```

**Test:** Grid view renders thumbnails correctly

**Commit:** `refactor(VideoCard): use new VideoThumbnail props`

---

## Step 8: Update VideosPage.tsx list view usage

**Time:** 15 min
**Files:** `frontend/src/components/VideosPage.tsx`

**Task:**
```typescript
// In thumbnail column accessor (around line 656):
// Change from:
return <VideoThumbnail url={thumbnailUrl} title={title} />

// To:
return <VideoThumbnail
  youtubeId={row.youtube_id}
  fallbackUrl={thumbnailUrl}
  title={title}
/>
```

**Test:** List view renders thumbnails correctly

**Commit:** `refactor(VideosPage): use new VideoThumbnail props in list view`

---

## Step 9: Update VideoThumbnail.test.tsx

**Time:** 30 min
**Files:** `frontend/src/components/VideoThumbnail.test.tsx`

**Task:**
- Update all test props to new interface
- Add tests for picture element rendering
- Add tests for URL generation
- Add tests for fallback behavior

**Test:** `npm test VideoThumbnail.test.ts` passes

**Commit:** `test(VideoThumbnail): update tests for responsive thumbnail feature`

---

## Step 10: Update VideoCard.test.tsx

**Time:** 15 min
**Files:** `frontend/src/components/VideoCard.test.tsx`

**Task:**
- Update mock data to include youtube_id
- Update VideoThumbnail usage expectations

**Test:** `npm test VideoCard.test.ts` passes

**Commit:** `test(VideoCard): update tests for new VideoThumbnail interface`

---

## Verification Checklist

After all steps:

- [ ] `npm test` - All tests pass
- [ ] `npm run build` - No TypeScript errors
- [ ] Manual test: List view small → Network shows mqdefault.webp
- [ ] Manual test: Grid view 5-col → Network shows mqdefault.webp
- [ ] Manual test: Grid view 2-col → Network shows sddefault.webp

---

## Commit Summary

```
feat(utils): add getQualityForWidth for responsive thumbnails
feat(utils): add getThumbnailUrls for WebP/JPEG URL generation
feat(utils): add calculateThumbnailWidth for view-aware sizing
test(utils): add comprehensive tests for thumbnailUrl utilities
refactor(VideoThumbnail): update props interface for responsive loading
feat(VideoThumbnail): implement responsive URL generation with WebP
refactor(VideoCard): use new VideoThumbnail props
refactor(VideosPage): use new VideoThumbnail props in list view
test(VideoThumbnail): update tests for responsive thumbnail feature
test(VideoCard): update tests for new VideoThumbnail interface
```

---

**Status:** ✅ Complete
**Created:** 2024-11-28
