# Testing Strategy: Responsive Thumbnails

## Test Coverage Overview

| Test Type | Files | Priority |
|-----------|-------|----------|
| Unit Tests | thumbnailUrl.ts | HIGH |
| Component Tests | VideoThumbnail | HIGH |
| Integration Tests | VideoCard, VideosPage | MEDIUM |
| E2E/Manual Tests | Full flow | LOW |

---

## Unit Tests: thumbnailUrl.ts

**File:** `frontend/src/utils/thumbnailUrl.test.ts`

### Test Cases

#### getQualityForWidth()

```typescript
describe('getQualityForWidth', () => {
  beforeEach(() => {
    // Mock devicePixelRatio to 1 (non-Retina)
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })
  })

  it('returns "default" for width <= 120', () => {
    expect(getQualityForWidth(100)).toBe('default')
    expect(getQualityForWidth(120)).toBe('default')
  })

  it('returns "mq" for width 121-320', () => {
    expect(getQualityForWidth(128)).toBe('mq')
    expect(getQualityForWidth(320)).toBe('mq')
  })

  it('returns "hq" for width 321-480', () => {
    expect(getQualityForWidth(380)).toBe('hq')
    expect(getQualityForWidth(480)).toBe('hq')
  })

  it('returns "sd" for width 481-640', () => {
    expect(getQualityForWidth(500)).toBe('sd')
    expect(getQualityForWidth(640)).toBe('sd')
  })

  it('returns "maxres" for width > 640', () => {
    expect(getQualityForWidth(800)).toBe('maxres')
    expect(getQualityForWidth(1280)).toBe('maxres')
  })

  describe('with Retina display (devicePixelRatio > 1)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true })
    })

    it('applies 1.5x multiplier to target width', () => {
      // 128px * 1.5 = 192px → still mq (320)
      expect(getQualityForWidth(128)).toBe('mq')
      // 320px * 1.5 = 480px → hq (480)
      expect(getQualityForWidth(320)).toBe('hq')
      // 500px * 1.5 = 750px → maxres (1280)
      expect(getQualityForWidth(500)).toBe('maxres')
    })
  })
})
```

#### getThumbnailUrls()

```typescript
describe('getThumbnailUrls', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })
  })

  it('generates correct WebP URL', () => {
    const urls = getThumbnailUrls('dQw4w9WgXcQ', 128)
    expect(urls.webp).toBe('https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/mqdefault.webp')
  })

  it('generates correct JPEG URL', () => {
    const urls = getThumbnailUrls('dQw4w9WgXcQ', 128)
    expect(urls.jpeg).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
  })

  it('uses correct quality for different widths', () => {
    expect(getThumbnailUrls('abc', 100).webp).toContain('default.webp')
    expect(getThumbnailUrls('abc', 200).webp).toContain('mqdefault.webp')
    expect(getThumbnailUrls('abc', 400).webp).toContain('hqdefault.webp')
    expect(getThumbnailUrls('abc', 600).webp).toContain('sddefault.webp')
    expect(getThumbnailUrls('abc', 800).webp).toContain('maxresdefault.webp')
  })
})
```

#### calculateThumbnailWidth()

```typescript
describe('calculateThumbnailWidth', () => {
  describe('list view', () => {
    it('returns 128 for small thumbnails', () => {
      expect(calculateThumbnailWidth('list', 'small', 3)).toBe(128)
    })

    it('returns 160 for medium thumbnails', () => {
      expect(calculateThumbnailWidth('list', 'medium', 3)).toBe(160)
    })

    it('returns 192 for large thumbnails', () => {
      expect(calculateThumbnailWidth('list', 'large', 3)).toBe(192)
    })

    it('returns 500 for xlarge thumbnails', () => {
      expect(calculateThumbnailWidth('list', 'xlarge', 3)).toBe(500)
    })

    it('ignores gridColumns in list view', () => {
      expect(calculateThumbnailWidth('list', 'small', 2)).toBe(128)
      expect(calculateThumbnailWidth('list', 'small', 5)).toBe(128)
    })
  })

  describe('grid view', () => {
    it('returns 200 for 5 columns', () => {
      expect(calculateThumbnailWidth('grid', 'small', 5)).toBe(200)
    })

    it('returns 280 for 4 columns', () => {
      expect(calculateThumbnailWidth('grid', 'small', 4)).toBe(280)
    })

    it('returns 380 for 3 columns', () => {
      expect(calculateThumbnailWidth('grid', 'small', 3)).toBe(380)
    })

    it('returns 580 for 2 columns', () => {
      expect(calculateThumbnailWidth('grid', 'small', 2)).toBe(580)
    })

    it('ignores thumbnailSize in grid view', () => {
      expect(calculateThumbnailWidth('grid', 'xlarge', 5)).toBe(200)
    })
  })
})
```

---

## Component Tests: VideoThumbnail

**File:** `frontend/src/components/VideoThumbnail.test.tsx`

### Test Cases

```typescript
describe('VideoThumbnail', () => {
  const defaultProps = {
    youtubeId: 'dQw4w9WgXcQ',
    fallbackUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    title: 'Test Video',
  }

  beforeEach(() => {
    // Reset store to defaults
    useTableSettingsStore.setState({
      thumbnailSize: 'small',
      viewMode: 'list',
      gridColumns: 3,
    })
  })

  describe('rendering', () => {
    it('renders picture element with WebP and JPEG sources', () => {
      render(<VideoThumbnail {...defaultProps} />)

      const picture = screen.getByRole('img').closest('picture')
      expect(picture).toBeInTheDocument()

      const source = picture?.querySelector('source[type="image/webp"]')
      expect(source).toBeInTheDocument()
      expect(source).toHaveAttribute('srcset', expect.stringContaining('vi_webp'))
    })

    it('renders img with correct alt text', () => {
      render(<VideoThumbnail {...defaultProps} />)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('alt', 'Test Video')
    })

    it('applies lazy loading', () => {
      render(<VideoThumbnail {...defaultProps} />)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('loading', 'lazy')
    })
  })

  describe('URL generation', () => {
    it('generates mqdefault for small thumbnail size', () => {
      useTableSettingsStore.setState({ thumbnailSize: 'small' })
      render(<VideoThumbnail {...defaultProps} />)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', expect.stringContaining('mqdefault'))
    })

    it('generates sddefault for xlarge thumbnail size', () => {
      useTableSettingsStore.setState({ thumbnailSize: 'xlarge' })
      render(<VideoThumbnail {...defaultProps} />)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', expect.stringContaining('sddefault'))
    })
  })

  describe('fallback behavior', () => {
    it('shows placeholder when youtubeId is missing', () => {
      render(<VideoThumbnail {...defaultProps} youtubeId="" />)

      // Should show fallbackUrl since youtubeId is empty
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', defaultProps.fallbackUrl)
    })

    it('shows placeholder when both youtubeId and fallbackUrl are missing', () => {
      render(<VideoThumbnail youtubeId="" fallbackUrl={null} title="Test" />)

      // Should show placeholder SVG
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      // Look for placeholder div with SVG
      expect(screen.getByLabelText(/placeholder/i)).toBeInTheDocument()
    })

    it('falls back to fallbackUrl on image error', async () => {
      render(<VideoThumbnail {...defaultProps} />)

      const img = screen.getByRole('img')

      // Simulate image load error
      fireEvent.error(img)

      // Should now show fallbackUrl
      await waitFor(() => {
        expect(img).toHaveAttribute('src', defaultProps.fallbackUrl)
      })
    })
  })

  describe('size classes', () => {
    it('applies correct size class for list view', () => {
      useTableSettingsStore.setState({ thumbnailSize: 'small', viewMode: 'list' })
      render(<VideoThumbnail {...defaultProps} />)

      const img = screen.getByRole('img')
      expect(img).toHaveClass('w-32')
    })

    it('applies full width class when useFullWidth is true', () => {
      render(<VideoThumbnail {...defaultProps} useFullWidth={true} />)

      const img = screen.getByRole('img')
      expect(img).toHaveClass('w-full')
    })
  })
})
```

---

## Integration Tests

### VideoCard Integration

```typescript
describe('VideoCard thumbnail integration', () => {
  it('passes youtube_id to VideoThumbnail', () => {
    const video = {
      id: '123',
      youtube_id: 'dQw4w9WgXcQ',
      thumbnail_url: 'https://...',
      title: 'Test',
      // ... other props
    }

    render(<VideoCard video={video} />)

    // Verify WebP URL is generated from youtube_id
    const img = screen.getByRole('img')
    expect(img.closest('picture')?.querySelector('source'))
      .toHaveAttribute('srcset', expect.stringContaining('dQw4w9WgXcQ'))
  })
})
```

---

## Regression Tests

### Existing Functionality

```typescript
describe('VideoThumbnail regression', () => {
  it('still shows thumbnails correctly after feature update', () => {
    // Basic rendering still works
    render(<VideoThumbnail youtubeId="abc" title="Test" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('still handles missing thumbnails with placeholder', () => {
    render(<VideoThumbnail youtubeId="" fallbackUrl={null} title="Test" />)
    // Placeholder should render
    expect(screen.getByText(/placeholder/i)).toBeInTheDocument()
  })
})
```

---

## Manual Testing Checklist

### List View
- [ ] Open Videos page in List View
- [ ] Set thumbnailSize to "small" → verify Network shows `mqdefault.webp`
- [ ] Set thumbnailSize to "xlarge" → verify Network shows `sddefault.webp`
- [ ] Verify visual quality is acceptable

### Grid View
- [ ] Switch to Grid View
- [ ] Set gridColumns to 5 → verify Network shows `mqdefault.webp`
- [ ] Set gridColumns to 2 → verify Network shows `sddefault.webp`
- [ ] Verify visual quality is acceptable

### Fallback
- [ ] Block WebP requests in DevTools → verify JPEG loads
- [ ] Block all YouTube CDN → verify placeholder shows
- [ ] Test video without youtube_id (if possible) → verify DB URL loads

### Cross-Browser
- [ ] Chrome: WebP should load
- [ ] Firefox: WebP should load
- [ ] Safari 14+: WebP should load
- [ ] Safari 13: JPEG should load (WebP fallback)

---

## Performance Testing

### Metrics to Measure

| Metric | Tool | Target |
|--------|------|--------|
| Image bytes transferred | DevTools Network | 50%+ reduction |
| LCP (Largest Contentful Paint) | Lighthouse | No regression |
| Total page weight | DevTools | Significant reduction |

### Test Scenario

1. Load Videos page with 20 videos
2. Set thumbnailSize to "small"
3. Record network waterfall
4. Compare total image bytes before vs after

---

**Status:** ✅ Complete
**Created:** 2024-11-28
