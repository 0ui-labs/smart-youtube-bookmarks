# UI/UX Integration: Video Player

## Platzierung in bestehender UI

### VideoDetailsPage

```
┌─────────────────────────────────────────────────────────┐
│  ← Zurück zur Übersicht                                 │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │              PLYR VIDEO PLAYER                  │    │
│  │                                                 │    │
│  │  ┌─────────────────────────────────────────┐   │    │
│  │  │ ▶ ▮▮ │ ═══════●═══════════ │ 🔊 │ ⛶ │ PiP │   │    │
│  │  └─────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Video Title                                            │
│  Channel Name                                           │
│  [Label 1] [Label 2]                                    │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Category Selector                                      │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Custom Fields Section                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### VideoDetailsModal

```
┌───────────────────────────────────────────────┐
│  Video Title                              [X] │
├───────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐    │
│  │                                       │    │
│  │         PLYR VIDEO PLAYER             │    │
│  │                                       │    │
│  │  ┌───────────────────────────────┐   │    │
│  │  │ ▶ │ ════●══════════ │ 🔊 │ ⛶ │   │    │
│  │  └───────────────────────────────┘   │    │
│  └───────────────────────────────────────┘    │
│                                               │
│  Duration • Channel                           │
│  [Label 1] [Label 2]                          │
│                                               │
│  Category Selector                            │
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Custom Fields (scrollable)                   │
│                                               │
└───────────────────────────────────────────────┘
```

---

## Design-System Integration

### Tailwind Classes für Player-Container

```tsx
// Konsistent mit bestehendem Design
<div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
  <VideoPlayer ... />
</div>
```

### Plyr CSS Variables (angepasst an App-Theme)

```css
/* index.css - Plyr Theme anpassen */
:root {
  /* Hauptfarbe = App Primary */
  --plyr-color-main: hsl(var(--primary));

  /* Controls = Foreground Farben */
  --plyr-video-control-color: rgba(255, 255, 255, 0.9);
  --plyr-video-control-color-hover: hsl(var(--primary));
  --plyr-video-control-background-hover: transparent;

  /* Font = System Font */
  --plyr-font-family: var(--font-sans, system-ui, sans-serif);
  --plyr-font-size-base: 14px;
  --plyr-font-size-small: 12px;

  /* Badges */
  --plyr-badge-background: hsl(var(--secondary));
  --plyr-badge-text-color: hsl(var(--secondary-foreground));
  --plyr-badge-border-radius: var(--radius);

  /* Progress Bar */
  --plyr-range-fill-background: hsl(var(--primary));
  --plyr-video-progress-buffered-background: rgba(255, 255, 255, 0.25);

  /* Tooltips */
  --plyr-tooltip-background: hsl(var(--popover));
  --plyr-tooltip-color: hsl(var(--popover-foreground));
  --plyr-tooltip-radius: var(--radius);

  /* Spacing */
  --plyr-control-spacing: 8px;
}

/* Dark Mode */
.dark {
  --plyr-video-control-color: rgba(255, 255, 255, 0.9);
}
```

---

## Responsive Verhalten

### Desktop (>1024px)
- Player nimmt volle Container-Breite
- Controls immer sichtbar bei Hover
- Alle Features aktiviert (PiP, Fullscreen, Speed)

### Tablet (768px - 1024px)
- Player nimmt volle Breite
- Controls auf Touch optimiert (größere Hit-Areas)
- PiP aktiviert

### Mobile (<768px)
- Player nimmt volle Breite
- Vereinfachte Controls
- Fullscreen-Button prominent
- Native Mobile Controls für bessere UX

```tsx
// Responsive Control-Set
const getPlyrControls = (): string[] => {
  const isMobile = window.innerWidth < 768

  const baseControls = [
    'play-large', // Big play button
    'play',       // Play/pause
    'progress',   // Progress bar
    'current-time',
    'mute',
    'volume',
    'fullscreen',
  ]

  if (!isMobile) {
    return [...baseControls, 'settings', 'pip']
  }

  return baseControls
}
```

---

## Loading States

### Initial Load
```
┌─────────────────────────────────────┐
│                                     │
│           [Skeleton]                │
│         aspect-video                │
│         animate-pulse               │
│                                     │
└─────────────────────────────────────┘
```

### Video Loading
```
┌─────────────────────────────────────┐
│                                     │
│         [Thumbnail]                 │
│         + Spinner Overlay           │
│                                     │
└─────────────────────────────────────┘
```

```tsx
// Loading State Implementation
<div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
  {isLoading && (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  )}
  <VideoPlayer ... />
</div>
```

---

## Error States

### Video nicht verfügbar
```
┌─────────────────────────────────────┐
│                                     │
│         [Thumbnail Blurred]         │
│                                     │
│    ⚠️ Video nicht verfügbar         │
│    Auf YouTube ansehen →            │
│                                     │
└─────────────────────────────────────┘
```

```tsx
// Error State Implementation
{playerError && (
  <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
    <img
      src={video.thumbnail_url}
      className="w-full h-full object-cover blur-sm opacity-50"
    />
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
      <AlertCircle className="h-8 w-8 text-red-500" />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Video nicht verfügbar
      </p>
      <a
        href={`https://youtube.com/watch?v=${video.youtube_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary hover:underline"
      >
        Auf YouTube ansehen →
      </a>
    </div>
  </div>
)}
```

---

## Accessibility

### Keyboard Navigation
- Tab: Navigiert durch Controls
- Space: Play/Pause (wenn fokussiert)
- Escape: Fullscreen verlassen

### Screen Reader
- Plyr hat ARIA-Labels eingebaut
- Controls sind benannt
- Status-Updates werden angesagt

### Focus Styles
```css
/* Plyr focus override für App-Konsistenz */
.plyr__control:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

---

## Animations

### Player erscheint
```tsx
// Framer Motion Integration (optional)
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
>
  <VideoPlayer ... />
</motion.div>
```

### Fullscreen Transition
- Native Browser-Transition
- Keine custom Animation nötig

---

## Zusammenfassung

| Aspekt | Lösung |
|--------|--------|
| **Platzierung** | Ersetzt Thumbnail (16:9, aspect-video) |
| **Styling** | CSS Variables für Theme-Match |
| **Responsive** | Vereinfachte Controls auf Mobile |
| **Loading** | Skeleton + Spinner Overlay |
| **Error** | Blurred Thumbnail + Fallback-Link |
| **A11y** | Plyr built-in + Focus-Ring Override |

## Exit Condition

✅ UI-Integration geplant:
- Player passt in bestehende Seiten-Layouts
- Design-System Integration via CSS Variables
- Responsive Verhalten definiert
- Loading/Error States geplant
- Accessibility berücksichtigt
