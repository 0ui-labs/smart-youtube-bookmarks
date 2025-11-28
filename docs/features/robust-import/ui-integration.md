# UI/UX Integration: Robust Video Import

## Design-Prinzipien

1. **Instant Feedback** - User sieht SOFORT dass etwas passiert
2. **iOS-Style Progress** - Vertrautes Pattern (App-Updates)
3. **Non-Intrusive Errors** - Fehler stören nicht den Flow
4. **Graceful States** - Jeder Zustand sieht gut aus

## UI-Komponenten Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  VideoGrid                                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ VideoCard   │ │ VideoCard   │ │ VideoCard   │ │ VideoCard   ││
│  │ (importing) │ │ (complete)  │ │ (complete)  │ │ (error)     ││
│  │             │ │             │ │             │ │             ││
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ ││
│  │ │Progress │ │ │ │Thumbnail│ │ │ │Thumbnail│ │ │ │Thumbnail│ ││
│  │ │Overlay  │ │ │ │         │ │ │ │         │ │ │ │  ⚠️     │ ││
│  │ │  60%    │ │ │ │         │ │ │ │         │ │ │ │         │ ││
│  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ ││
│  │ [grayscale] │ │ Title       │ │ Title       │ │ Title       ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## VideoCard States

### 1. Importing State (0-99%)

```
┌─────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░  │  ← Thumbnail (grayscale, 70% opacity)
│  ░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░ ┌───────────┐ ░░░░  │
│  ░░░░░ │    ◐     │ ░░░░  │  ← Circular Progress (white)
│  ░░░░░ │   60%    │ ░░░░  │
│  ░░░░░ └───────────┘ ░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░  │
├─────────────────────────────┤
│  (no title yet)             │  ← Placeholder Text
│  • Importing...             │
└─────────────────────────────┘

CSS:
- filter: grayscale(100%)
- opacity: 0.7
- pointer-events: none
```

### 2. Complete State (100%)

```
┌─────────────────────────────┐
│  ████████████████████████  │  ← Thumbnail (full color)
│  ████████████████████████  │
│  ████████████████████████  │
│  ████████ ▶️ ████████████  │  ← Play Button on Hover
│  ████████████████████████  │
│  ████████████████████████  │
│  ██████████████████ 12:34  │  ← Duration Badge
├─────────────────────────────┤
│  Video Title Here           │
│  Channel Name • 1.2M views  │
└─────────────────────────────┘

CSS:
- filter: none
- opacity: 1
- cursor: pointer
```

### 3. Error State

```
┌─────────────────────────────┐
│  ████████████████████████  │  ← Thumbnail (slightly desaturated)
│  ████████████████████████  │
│  ████████████████████████  │
│  ████████████████████████  │
│  █████████████████████ ⚠️  │  ← Warning Icon (bottom-right)
│  ████████████████████████  │
│  ████████████████████████  │
├─────────────────────────────┤
│  Video Title                │
│  ⚠️ Nicht verfügbar         │  ← Error Text (muted)
└─────────────────────────────┘

On Hover: Tooltip mit Details
```

### 4. Partial State (ohne Captions)

```
┌─────────────────────────────┐
│  ████████████████████████  │  ← Full color (normal video)
│  ████████████████████████  │
│  ████████████████████████  │
│  ████████████████████████  │
│  █████████████████████ 📝❌ │  ← Small "no captions" icon
│  ████████████████████████  │
│  ██████████████████ 12:34  │
├─────────────────────────────┤
│  Video Title                │
│  Channel Name               │
└─────────────────────────────┘

Video ist voll funktional, nur ohne Untertitel.
Icon ist dezent (nicht störend).
```

## ProgressOverlay Component

```typescript
// ProgressOverlay.tsx - iOS App Update Style

interface ProgressOverlayProps {
  progress: number  // 0-100
  stage?: 'created' | 'metadata' | 'captions' | 'chapters' | 'complete'
}

export function ProgressOverlay({ progress, stage }: ProgressOverlayProps) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
      {/* Circular Progress */}
      <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 96 96">
        {/* Background Circle */}
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="6"
        />
        {/* Progress Arc */}
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Percentage Text */}
      <span className="absolute text-white text-lg font-semibold">
        {progress}%
      </span>
    </div>
  )
}
```

## Animation Details

### Progress Animation
```css
/* Smooth progress updates */
.progress-circle {
  transition: stroke-dashoffset 500ms ease-out;
}

/* Pulse animation während "stuck" stages */
@keyframes pulse-subtle {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; }
}

.progress-container.waiting {
  animation: pulse-subtle 2s infinite;
}
```

### State Transition
```css
/* Von importing zu complete */
.video-card {
  transition:
    filter 400ms ease-out,
    opacity 400ms ease-out;
}

.video-card.importing {
  filter: grayscale(100%);
  opacity: 0.7;
}

.video-card.complete {
  filter: grayscale(0%);
  opacity: 1;
}

/* Overlay fade-out */
.progress-overlay {
  transition: opacity 300ms ease-out;
}

.progress-overlay.complete {
  opacity: 0;
  pointer-events: none;
}
```

## Responsive Design

```typescript
// VideoGrid: Responsive Columns (bereits vorhanden)
const gridColumns = {
  sm: 2,   // Mobile: 2 Spalten
  md: 3,   // Tablet: 3 Spalten
  lg: 4,   // Desktop: 4 Spalten
  xl: 5    // Wide: 5 Spalten
}

// ProgressOverlay: Skaliert mit Card
// Nutzt relative Units (keine festen px)
```

## Toast Notifications

### Import Started (Batch)
```
┌────────────────────────────────────┐
│  📥 50 Videos werden importiert    │
│  ━━━━━━━━━━━░░░░░░░░░  24%        │
└────────────────────────────────────┘

Position: Bottom-Right
Auto-Dismiss: Nein (bleibt bis fertig)
```

### Import Complete
```
┌────────────────────────────────────┐
│  ✅ Import abgeschlossen           │
│  47 Videos importiert              │
│  [Details] [×]                     │
└────────────────────────────────────┘

Position: Bottom-Right
Auto-Dismiss: Nach 5 Sekunden
```

### Rate Limit Pause
```
┌────────────────────────────────────┐
│  ⏸️ Kurze Pause                    │
│  Wegen YouTube-Limits, geht       │
│  gleich automatisch weiter...      │
└────────────────────────────────────┘

Position: Bottom-Right
Auto-Dismiss: Wenn Pause vorbei
```

## Error Tooltip

```typescript
// Bei Error-Videos: Hover-Tooltip

<Tooltip content={
  <div className="max-w-xs">
    <p className="font-medium">Video nicht verfügbar</p>
    <p className="text-sm text-muted mt-1">
      Das Video ist möglicherweise privat oder wurde gelöscht.
    </p>
    <Button variant="ghost" size="sm" className="mt-2">
      Entfernen
    </Button>
  </div>
}>
  <WarningIcon className="text-amber-500" />
</Tooltip>
```

## Accessibility

### Screen Reader Support
```typescript
// ProgressOverlay mit aria-labels
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`Video wird importiert: ${progress}%`}
>
  ...
</div>

// Status-Änderungen announzen
<div aria-live="polite" className="sr-only">
  {progress === 100 ? 'Video erfolgreich importiert' : null}
</div>
```

### Keyboard Navigation
```typescript
// Importing Videos sind nicht fokussierbar
<div
  className="video-card"
  tabIndex={isImporting ? -1 : 0}
  aria-disabled={isImporting}
>
```

## Integration in bestehende UI

### VideosPage.tsx
```typescript
// Keine Änderungen an Layout
// Nur VideoCard bekommt neue Props

<VideoGrid>
  {videos.map(video => (
    <VideoCard
      key={video.id}
      video={video}
      importProgress={progressMap.get(video.id)}  // NEU
    />
  ))}
</VideoGrid>
```

### Neue Videos Position
```typescript
// Neue Videos erscheinen am ANFANG des Grids
// Bestehende Sort-Logik bleibt

const sortedVideos = useMemo(() => {
  const importing = videos.filter(v => v.import_stage !== 'complete')
  const complete = videos.filter(v => v.import_stage === 'complete')

  return [
    ...importing,  // Importing Videos zuerst
    ...complete.sort(existingSortFn)  // Dann normale Sortierung
  ]
}, [videos, sortSettings])
```

## Exit Condition ✅

**UI-Design passt zur bestehenden App?**

> - Nutzt shadcn/ui Komponenten (Tooltip, Toast)
> - Folgt bestehendem Grid-Layout
> - Responsive wie bestehende Cards
> - Animationen sind smooth (60fps)
> - Accessibility-Standards eingehalten

✅ UI/UX Design fertig, bereit für Phase 8.
