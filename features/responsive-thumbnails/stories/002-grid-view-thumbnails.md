# User Story 002: Grid View Thumbnail Optimization

**As a** user browsing videos in grid view
**I want to** have thumbnails load based on my grid column setting
**So that** I don't waste bandwidth on oversized images for small cards

## UX Flow

1. User opens Videos page in **Grid View**
2. System reads `gridColumns` setting (2/3/4/5 columns)
3. System calculates approximate card width
4. System adjusts for Retina displays (1.5x if devicePixelRatio > 1)
5. System generates optimal YouTube thumbnail URL
6. Browser loads appropriately-sized image
7. Cards render with optimized thumbnails

## Grid Column to Size Mapping

| Columns | ~Card Width | Target Width | YouTube Quality |
|---------|-------------|--------------|-----------------|
| 5 cols | ~200px | 200px | mqdefault (320px) |
| 4 cols | ~280px | 280px | mqdefault (320px) |
| 3 cols | ~380px | 380px | hqdefault (480px) |
| 2 cols | ~580px | 580px | sddefault (640px) |

**With Retina (1.5x):**
| Columns | Effective Width | YouTube Quality |
|---------|-----------------|-----------------|
| 5 cols | 300px | mqdefault (320px) |
| 4 cols | 420px | hqdefault (480px) |
| 3 cols | 570px | sddefault (640px) |
| 2 cols | 870px | maxresdefault (1280px) |

## Acceptance Criteria

- [ ] 5-column grid loads smaller thumbnails than 2-column
- [ ] Changing gridColumns triggers new image loads
- [ ] WebP format used when supported
- [ ] Visual quality matches card size (not pixelated)
- [ ] Grid with many videos loads faster than before

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User switches 5-col → 2-col | New larger images load |
| User switches 2-col → 5-col | Keep cached images (larger OK) |
| Window resize | CSS handles, no image reload |
| Mobile view (1-2 cols forced) | Use grid setting anyway |

## Performance Comparison

### Before (Current)
```
5-column grid, 20 videos:
20 × hqdefault.jpg (480×360, ~25KB each) = 500KB total
```

### After (Optimized)
```
5-column grid, 20 videos:
20 × mqdefault.webp (320×180, ~10KB each) = 200KB total

Savings: 60%!
```

## Mockup

```
┌───────────────────────────────────────────────────────────┐
│ Grid View (5 columns)                                     │
├───────────────────────────────────────────────────────────┤
│ ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐               │
│ │~200 │  │~200 │  │~200 │  │~200 │  │~200 │               │
│ │ px  │  │ px  │  │ px  │  │ px  │  │ px  │               │
│ │(mq) │  │(mq) │  │(mq) │  │(mq) │  │(mq) │               │
│ ├─────┤  ├─────┤  ├─────┤  ├─────┤  ├─────┤               │
│ │Title│  │Title│  │Title│  │Title│  │Title│               │
│ └─────┘  └─────┘  └─────┘  └─────┘  └─────┘               │
└───────────────────────────────────────────────────────────┘

Network: 5× mqdefault.webp (10KB each)


┌───────────────────────────────────────────────────────────┐
│ Grid View (2 columns)                                     │
├───────────────────────────────────────────────────────────┤
│ ┌────────────────┐        ┌────────────────┐              │
│ │    ~580 px     │        │    ~580 px     │              │
│ │    (sd)        │        │    (sd)        │              │
│ ├────────────────┤        ├────────────────┤              │
│ │ Video Title    │        │ Video Title    │              │
│ │ Channel        │        │ Channel        │              │
│ └────────────────┘        └────────────────┘              │
└───────────────────────────────────────────────────────────┘

Network: 2× sddefault.webp (20KB each)
```

---

**Priority:** HIGH
**Estimated Effort:** Part of main implementation (shared logic)
