# User Story 001: List View Thumbnail Optimization

**As a** user browsing videos in list view
**I want to** have thumbnails load in the optimal size for my settings
**So that** pages load faster without sacrificing visual quality

## UX Flow

1. User opens Videos page in **List View**
2. System reads `thumbnailSize` setting from store (small/medium/large/xlarge)
3. System calculates pixel width needed (128/160/192/500px)
4. System checks `devicePixelRatio` for Retina displays
5. System generates YouTube thumbnail URL:
   - WebP format (primary): `vi_webp/{id}/mqdefault.webp`
   - JPEG format (fallback): `vi/{id}/mqdefault.jpg`
6. Browser loads smaller image file
7. User sees thumbnail at correct visual size

## Acceptance Criteria

- [ ] Small (128px) → loads `mqdefault` (320px) - not `hqdefault` (480px)
- [ ] Medium (160px) → loads `mqdefault` (320px)
- [ ] Large (192px) → loads `mqdefault` (320px)
- [ ] XLarge (500px) → loads `sddefault` (640px)
- [ ] WebP is used when browser supports it
- [ ] JPEG fallback works for older browsers
- [ ] Retina displays get slightly larger images (1.5x)
- [ ] No visual quality degradation

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User changes thumbnailSize setting | New images load with correct size |
| YouTube CDN returns 404 | Fallback to DB thumbnail_url |
| Both WebP and JPEG fail | Show placeholder SVG |
| youtube_id is null | Use fallbackUrl directly |

## Technical Notes

```typescript
// List view size mapping
const listTargetWidth = {
  small: 128,    // → mqdefault (320px)
  medium: 160,   // → mqdefault (320px)
  large: 192,    // → mqdefault (320px)
  xlarge: 500,   // → sddefault (640px)
}

// With Retina (1.5x):
// small: 192px → mqdefault (320px) ✓
// xlarge: 750px → maxresdefault (1280px)
```

## Mockup

```
┌────────────────────────────────────────────────────────┐
│ List View (thumbnailSize: small)                       │
├────────────────────────────────────────────────────────┤
│ ┌────────┐                                             │
│ │ 128px  │  Video Title Here                           │
│ │ thumb  │  Channel Name                               │
│ │ (mq)   │  Duration: 10:30                            │
│ └────────┘                                             │
├────────────────────────────────────────────────────────┤
│ ┌────────┐                                             │
│ │ 128px  │  Another Video Title                        │
│ │ thumb  │  Another Channel                            │
│ │ (mq)   │  Duration: 5:15                             │
│ └────────┘                                             │
└────────────────────────────────────────────────────────┘

Network Tab:
GET i.ytimg.com/vi_webp/abc123/mqdefault.webp  (320x180, 15KB)
```

---

**Priority:** HIGH
**Estimated Effort:** 2 hours (part of main implementation)
