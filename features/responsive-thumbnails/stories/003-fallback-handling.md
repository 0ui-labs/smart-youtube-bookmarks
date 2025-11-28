# User Story 003: Graceful Fallback Handling

**As a** user viewing videos
**I want to** always see some thumbnail even when things go wrong
**So that** the UI doesn't break or show broken images

## UX Flow

### Happy Path
1. WebP URL loads successfully
2. User sees optimized thumbnail

### Fallback Path 1: WebP Fails
1. WebP URL returns error (404 or network issue)
2. `<picture>` element automatically tries JPEG source
3. JPEG loads successfully
4. User sees thumbnail (slightly larger file, same quality)

### Fallback Path 2: Both WebP and JPEG Fail
1. WebP fails → JPEG tried
2. JPEG also fails
3. System tries `fallbackUrl` (DB thumbnail_url)
4. DB URL loads successfully
5. User sees thumbnail (original quality from import)

### Fallback Path 3: All Images Fail
1. WebP → fails
2. JPEG → fails
3. DB URL → fails
4. Placeholder SVG displayed
5. User sees YouTube logo placeholder

## Acceptance Criteria

- [ ] WebP failure triggers JPEG load (automatic via `<picture>`)
- [ ] JPEG failure triggers fallbackUrl load
- [ ] All failures show placeholder (no broken image icon)
- [ ] Fallbacks happen silently (no error messages to user)
- [ ] Error state is tracked per-thumbnail (not global)

## Edge Cases

| Scenario | youtube_id | fallbackUrl | Result |
|----------|-----------|-------------|--------|
| Normal video | ✓ | ✓ | WebP → (JPEG) |
| Old video | ✓ | ✓ | WebP → (JPEG) → (DB) |
| No youtube_id | ✗ | ✓ | DB URL directly |
| No fallback | ✓ | ✗ | WebP → JPEG → Placeholder |
| Nothing | ✗ | ✗ | Placeholder immediately |

## Technical Implementation

```typescript
const VideoThumbnail = ({ youtubeId, fallbackUrl, ... }) => {
  const [webpFailed, setWebpFailed] = useState(false)
  const [jpegFailed, setJpegFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  // No youtube_id → skip to fallback
  if (!youtubeId) {
    if (fallbackUrl && !fallbackFailed) {
      return <img src={fallbackUrl} onError={() => setFallbackFailed(true)} />
    }
    return <Placeholder />
  }

  // All generated URLs failed → try DB fallback
  if (webpFailed && jpegFailed) {
    if (fallbackUrl && !fallbackFailed) {
      return <img src={fallbackUrl} onError={() => setFallbackFailed(true)} />
    }
    return <Placeholder />
  }

  // Primary: picture element with WebP + JPEG
  return (
    <picture>
      <source srcSet={urls.webp} type="image/webp" />
      <img
        src={urls.jpeg}
        onError={() => {
          // picture element tries sources in order
          // This only fires when JPEG (last source) fails
          setJpegFailed(true)
        }}
      />
    </picture>
  )
}
```

## Error Tracking

**Note:** We intentionally don't log errors for thumbnail failures because:
- They're expected in some cases (private videos, deleted videos)
- They're handled gracefully
- Logging would be noisy

## Visual States

```
┌─────────────────────────────────────────┐
│ State 1: WebP Loaded (Normal)           │
│ ┌─────────────┐                         │
│ │  ████████   │  ← Optimal WebP         │
│ │  ████████   │    (smallest file)      │
│ └─────────────┘                         │
├─────────────────────────────────────────┤
│ State 2: JPEG Fallback                  │
│ ┌─────────────┐                         │
│ │  ████████   │  ← JPEG loaded          │
│ │  ████████   │    (slightly larger)    │
│ └─────────────┘                         │
├─────────────────────────────────────────┤
│ State 3: DB URL Fallback                │
│ ┌─────────────┐                         │
│ │  ████████   │  ← Original from import │
│ │  ████████   │    (may be oversized)   │
│ └─────────────┘                         │
├─────────────────────────────────────────┤
│ State 4: Placeholder                    │
│ ┌─────────────┐                         │
│ │     ▶       │  ← YouTube logo SVG     │
│ │   (gray)    │    (always available)   │
│ └─────────────┘                         │
└─────────────────────────────────────────┘
```

---

**Priority:** HIGH
**Estimated Effort:** Part of main implementation
