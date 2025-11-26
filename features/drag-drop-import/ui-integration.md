# UI/UX Integration: Drag & Drop Video Import

## Übersicht der UI-Bereiche

```
┌─────────────────────────────────────────────────────────────────┐
│                         Header                                   │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                 │
│    Sidebar     │              Main Content Area                  │
│                │                                                 │
│  ┌──────────┐  │     ┌─────────────────────────────────────┐    │
│  │Kategorien│  │     │                                     │    │
│  ├──────────┤  │     │                                     │    │
│  │Tutorial ◀├──┼─────│         Video Liste/Grid            │    │
│  │Review   ◀│  │     │                                     │    │
│  │Interview◀│  │     │         DROP ZONE                   │    │
│  └──────────┘  │     │                                     │    │
│                │     └─────────────────────────────────────┘    │
│  ┌──────────┐  │                                                 │
│  │ Kanäle   │  │                                                 │
│  └──────────┘  │                                                 │
│                │                                                 │
└────────────────┴────────────────────────────────────────────────┘

◀ = Drop Target
```

## Drop Zone Overlay

### Design

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│              ┌────────────────────────────┐                 │
│              │                            │                 │
│              │     ⬇️                      │                 │
│              │                            │                 │
│              │   Videos hier ablegen      │                 │
│              │                            │                 │
│              │   YouTube URLs, .webloc    │                 │
│              │   oder CSV Dateien         │                 │
│              │                            │                 │
│              └────────────────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Overlay: bg-primary/5 mit backdrop-blur-sm
Box: border-2 border-dashed border-primary rounded-lg
```

### Tailwind Classes

```tsx
// Overlay Container
className="absolute inset-0 z-50 flex items-center justify-center"
className="bg-primary/5 backdrop-blur-sm"

// Inner Box
className="border-2 border-dashed border-primary rounded-lg p-12"
className="bg-background/80 text-center"

// Icon
className="w-12 h-12 text-primary mx-auto mb-4"

// Text
className="text-lg font-medium text-foreground"
className="text-sm text-muted-foreground mt-2"
```

### States

| State | Visuelles Feedback |
|-------|-------------------|
| Drag Enter | Overlay erscheint (fade in) |
| Drag Over (valid) | Border: `border-primary` |
| Drag Over (invalid) | Border: `border-destructive` |
| Drag Leave | Overlay verschwindet (fade out) |
| Drop | Kurzer Pulse-Effekt, dann ausblenden |

## Kategorie Drop Target

### Normal State

```
┌─────────────────────┐
│  Tutorial           │
└─────────────────────┘
```

### Drag Over State

```
┌─────────────────────┐
│  Tutorial         ⬇️│   ← ring-2 ring-primary
└─────────────────────┘      bg-accent
```

### Tailwind Classes

```tsx
// Normal
className="w-full flex items-center gap-2 px-3 py-2 rounded-md"
className="text-sm hover:bg-accent"

// Drag Over
className="ring-2 ring-primary ring-offset-2 bg-accent"

// Transition
className="transition-all duration-150"
```

## Import Preview Modal

### Layout

```
┌────────────────────────────────────────────┐
│  Videos importieren                    ✕   │
├────────────────────────────────────────────┤
│                                            │
│  5 Videos erkannt                          │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ ✓ https://youtube.com/watch?v=abc   │  │
│  │ ✓ https://youtube.com/watch?v=def   │  │
│  │ ✓ https://youtube.com/watch?v=ghi   │  │
│  │ ✗ https://invalid-url.com           │  │  ← Rot
│  │ ⚠ https://youtube.com/watch?v=xyz   │  │  ← Gelb (Duplikat)
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌─ Kategorie (optional) ───────────────┐  │
│  │  Keine                            ▼  │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌────────────────┐  ┌────────────────┐   │
│  │   Abbrechen    │  │ 3 importieren  │   │
│  └────────────────┘  └────────────────┘   │
│                                            │
└────────────────────────────────────────────┘
```

### Komponenten

- `Dialog` (Radix UI) - bereits vorhanden
- `ScrollArea` - für lange Listen
- `Select` - Kategorie-Auswahl
- `Button` - Aktionen

### Status Icons

| Status | Icon | Farbe |
|--------|------|-------|
| Gültig | `CheckCircle` | `text-green-500` |
| Ungültig | `XCircle` | `text-destructive` |
| Duplikat | `AlertTriangle` | `text-yellow-500` |

## Toast Notifications

### Erfolg (einzelnes Video)

```
┌────────────────────────────────────┐
│ ✓  Video hinzugefügt               │
└────────────────────────────────────┘
```

### Erfolg (mehrere Videos)

```
┌────────────────────────────────────┐
│ ✓  5 Videos hinzugefügt            │
│    2 übersprungen (Duplikate)      │
└────────────────────────────────────┘
```

### Fehler

```
┌────────────────────────────────────┐
│ ✗  Import fehlgeschlagen           │
│    Nur YouTube URLs unterstützt    │
└────────────────────────────────────┘
```

## Responsive Design

### Desktop (>1024px)

- Volle Drop Zone über Video-Liste
- Sidebar Kategorien als Drop Targets
- Modal: 480px Breite

### Tablet (768px - 1024px)

- Drop Zone funktioniert
- Sidebar eventuell eingeklappt
- Modal: 90% Breite

### Mobile (<768px)

- **Drag & Drop deaktiviert** (Touch nicht praktikabel)
- Fallback: Bestehender URL-Input und CSV-Upload Button
- Kein Drop Target auf Kategorien

```tsx
// Feature Detection
const isTouchDevice = 'ontouchstart' in window
const enableDragDrop = !isTouchDevice && window.innerWidth > 768
```

## Animationen

### Drop Zone Erscheinen

```tsx
// Framer Motion
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.15 }}
>
  <DropZoneOverlay />
</motion.div>
```

### Kategorie Highlight

```css
/* Tailwind */
transition-all duration-150 ease-in-out
```

### Import Progress

```tsx
// Bestehende ProgressBar Komponente nutzen
<Progress value={importProgress} />
```

## Accessibility

### Keyboard Support

| Taste | Aktion |
|-------|--------|
| `Escape` | Drop abbrechen / Modal schließen |
| `Tab` | Durch Modal navigieren |
| `Enter` | Import bestätigen |

### ARIA Labels

```tsx
// Drop Zone
<div
  role="region"
  aria-label="Bereich zum Ablegen von Videos"
  aria-dropeffect="copy"
>

// Kategorie
<button
  aria-label={`Videos zur Kategorie ${tag.name} hinzufügen`}
  aria-dropeffect="copy"
>
```

### Screen Reader

- Ankündigung bei Drag Enter: "Drop Zone aktiv"
- Ankündigung bei Drop: "5 Videos werden importiert"
- Ankündigung bei Erfolg: "Import abgeschlossen"

## Bestehende Design Patterns

### Zu nutzen

| Pattern | Quelle | Verwendung |
|---------|--------|------------|
| Dialog | `components/ui/dialog` | Preview Modal |
| Button | `components/ui/button` | Aktionen |
| Progress | `components/ui/progress` | Import-Fortschritt |
| Toast | Sonner Library | Notifications |
| cn() | `lib/utils` | Conditional Classes |

### Farbschema

```
Primary: hsl(var(--primary))
Destructive: hsl(var(--destructive))
Muted: hsl(var(--muted))
Accent: hsl(var(--accent))
```

## Zusammenfassung

| Element | Platzierung | Priorität |
|---------|-------------|-----------|
| Drop Zone Overlay | VideosPage, über Content | P0 |
| Kategorie Drop | TagNavigation, pro Tag | P1 |
| Preview Modal | Global (Portal) | P0 |
| Toast Notifications | Bestehend | P0 |
| Progress Bar | In Modal | P1 |
