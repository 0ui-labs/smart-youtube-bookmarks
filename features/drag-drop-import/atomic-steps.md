# Atomic Steps: Drag & Drop Video Import

Jeder Schritt ist:
- In 15-60 Minuten umsetzbar
- Ändert 1-3 Dateien
- Hat einen klaren Pass/Fail Test
- Unabhängig committbar

---

## Foundation Steps (1-6)

### Step 1: Feature Flag hinzufügen
**Dateien:** `featureFlags.ts`
**Test:** Flag existiert und ist `true`
**Dauer:** 5 min

```typescript
// featureFlags.ts
DRAG_DROP_IMPORT: true,
```

---

### Step 2: extractYouTubeId Funktion
**Dateien:** `urlParser.ts`, `urlParser.test.ts`
**Test:** Unit Tests für alle YouTube URL Formate
**Dauer:** 30 min

```typescript
// Implementierung
export const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ]
  // ...
}
```

---

### Step 3: parseUrlsFromText Funktion
**Dateien:** `urlParser.ts`, `urlParser.test.ts`
**Test:** Unit Tests für Multi-URL Parsing
**Dauer:** 30 min

```typescript
export const parseUrlsFromText = (text: string): string[] => {
  // Split by newlines, commas, semicolons
  // Filter valid YouTube URLs
  // Deduplicate
}
```

---

### Step 4: parseWeblocFile Funktion
**Dateien:** `urlParser.ts`, `urlParser.test.ts`
**Test:** Unit Tests für .webloc XML Parsing
**Dauer:** 30 min

```typescript
export const parseWeblocFile = async (file: File): Promise<string | null> => {
  const text = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  // Extract URL from plist
}
```

---

### Step 5: parseUrlsFromCSV Funktion
**Dateien:** `urlParser.ts`, `urlParser.test.ts`
**Test:** Unit Tests für CSV URL Extraktion
**Dauer:** 20 min

```typescript
export const parseUrlsFromCSV = async (file: File): Promise<string[]> => {
  const text = await file.text()
  const lines = text.split('\n')
  // Skip header, extract URLs
}
```

---

### Step 6: createCSVFromUrls Helper
**Dateien:** `csvHelper.ts`, `csvHelper.test.ts`
**Test:** Unit Tests für CSV Generierung
**Dauer:** 15 min

```typescript
export const createCSVFromUrls = (urls: string[]): Blob => {
  const csvContent = 'url\n' + urls.join('\n')
  return new Blob([csvContent], { type: 'text/csv' })
}
```

---

## Hook Steps (7-10)

### Step 7: react-dropzone installieren
**Dateien:** `package.json`
**Test:** Package installiert, importierbar
**Dauer:** 5 min

```bash
npm install react-dropzone
```

---

### Step 8: useVideoDropZone - Basic Structure
**Dateien:** `useVideoDropZone.ts`
**Test:** Hook initialisiert, getRootProps verfügbar
**Dauer:** 20 min

```typescript
import { useDropzone } from 'react-dropzone'

export const useVideoDropZone = (options: UseVideoDropZoneOptions) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    disabled: options.disabled,
  })

  return {
    isDragging: isDragActive,
    getRootProps,
    getInputProps,
  }
}
```

---

### Step 9: useVideoDropZone - Drop Handler
**Dateien:** `useVideoDropZone.ts`, `useVideoDropZone.test.ts`
**Test:** Drop wird geparst (Text, .webloc, .csv)
**Dauer:** 45 min

```typescript
const onDrop = useCallback(async (acceptedFiles: File[], _rejected, event) => {
  // 1. Text/URL aus Browser
  const text = event?.dataTransfer?.getData('text/plain') ||
               event?.dataTransfer?.getData('text/uri-list')
  if (text) {
    const urls = parseUrlsFromText(text)
    if (urls.length > 0) {
      options.onVideosDetected({ type: 'youtube-urls', urls })
      return
    }
  }

  // 2. .webloc Dateien
  const weblocFiles = acceptedFiles.filter(f => f.name.endsWith('.webloc'))
  if (weblocFiles.length > 0) {
    const urls = await Promise.all(weblocFiles.map(parseWeblocFile))
    options.onVideosDetected({ type: 'webloc-files', urls: urls.filter(Boolean) as string[] })
    return
  }

  // 3. .csv Dateien
  const csvFiles = acceptedFiles.filter(f => f.name.endsWith('.csv'))
  if (csvFiles.length > 0) {
    options.onVideosDetected({ type: 'csv-file', urls: [], files: csvFiles })
  }
}, [options])

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop,
  noClick: true,
  noKeyboard: true,
})
```

---

### Step 10: useVideoDropZone - Tests
**Dateien:** `useVideoDropZone.test.ts`
**Test:** Alle Drop-Szenarien getestet
**Dauer:** 30 min

```typescript
describe('useVideoDropZone', () => {
  it('parses YouTube URLs from text drop', () => {...})
  it('parses .webloc files', () => {...})
  it('handles .csv files', () => {...})
  it('respects disabled option', () => {...})
})
```

---

## Component Steps (11-17)

### Step 12: DropZoneOverlay - Basic Render
**Dateien:** `DropZoneOverlay.tsx`
**Test:** Komponente rendert mit Text
**Dauer:** 20 min

```tsx
export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({
  isValid,
  message = 'Videos hier ablegen'
}) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/5 backdrop-blur-sm">
      <div className="border-2 border-dashed border-primary rounded-lg p-12 bg-background/80">
        <Download className="w-12 h-12 mx-auto mb-4" />
        <p className="text-lg font-medium">{message}</p>
      </div>
    </div>
  )
}
```

---

### Step 13: DropZoneOverlay - Valid/Invalid States
**Dateien:** `DropZoneOverlay.tsx`, `DropZoneOverlay.test.tsx`
**Test:** Korrekte Farben für valid/invalid
**Dauer:** 15 min

```tsx
<div className={cn(
  "border-2 border-dashed rounded-lg p-12",
  isValid ? "border-primary" : "border-destructive"
)}>
```

---

### Step 14: DropZoneOverlay - Animation
**Dateien:** `DropZoneOverlay.tsx`
**Test:** Fade In/Out funktioniert
**Dauer:** 20 min

```tsx
import { AnimatePresence, motion } from 'framer-motion'

<AnimatePresence>
  {isVisible && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

---

### Step 15: ImportPreviewModal - Basic Structure
**Dateien:** `ImportPreviewModal.tsx`
**Test:** Modal öffnet und zeigt URL-Liste
**Dauer:** 30 min

```tsx
export const ImportPreviewModal: React.FC<Props> = ({
  open,
  onOpenChange,
  urls,
  onImport
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{urls.length} Videos erkannt</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[300px]">
          {urls.map(url => (
            <div key={url}>{url}</div>
          ))}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => onImport(urls)}>
            Importieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Step 16: ImportPreviewModal - URL Validation Display
**Dateien:** `ImportPreviewModal.tsx`, `ImportPreviewModal.test.tsx`
**Test:** Ungültige URLs werden rot markiert
**Dauer:** 30 min

```tsx
const validateUrl = (url: string) => {
  const id = extractYouTubeId(url)
  return { isValid: !!id, id }
}

{urls.map(url => {
  const { isValid } = validateUrl(url)
  return (
    <div className={cn(!isValid && "text-destructive")}>
      {isValid ? <CheckCircle /> : <XCircle />}
      {url}
    </div>
  )
})}
```

---

### Step 17: ImportPreviewModal - Duplikat-Erkennung
**Dateien:** `ImportPreviewModal.tsx`, `ImportPreviewModal.test.tsx`
**Test:** Duplikate werden gelb markiert
**Dauer:** 20 min

```tsx
const isDuplicate = (url: string) => {
  const id = extractYouTubeId(url)
  return existingVideoIds?.includes(id || '')
}
```

---

### Step 18: ImportPreviewModal - Kategorie-Auswahl
**Dateien:** `ImportPreviewModal.tsx`, `ImportPreviewModal.test.tsx`
**Test:** Kategorie kann ausgewählt werden
**Dauer:** 30 min

```tsx
const [selectedCategory, setSelectedCategory] = useState(preselectedCategoryId)

<Select value={selectedCategory} onValueChange={setSelectedCategory}>
  <SelectTrigger>
    <SelectValue placeholder="Kategorie (optional)" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">Keine</SelectItem>
    {categories.map(cat => (
      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## Integration Steps (19-24)

### Step 19: VideosPage - Drop Zone State
**Dateien:** `VideosPage.tsx`
**Test:** isDragging State existiert
**Dauer:** 15 min

```tsx
const [isDragging, setIsDragging] = useState(false)
const [showImportModal, setShowImportModal] = useState(false)
const [pendingUrls, setPendingUrls] = useState<string[]>([])
```

---

### Step 20: VideosPage - useDropZone Integration
**Dateien:** `VideosPage.tsx`
**Test:** Drop Zone Events werden registriert
**Dauer:** 30 min

```tsx
const { isDragging: dragActive, dropZoneProps } = useDropZone({
  onDrop: handleDrop,
  disabled: !FEATURE_FLAGS.DRAG_DROP_IMPORT,
})

// Apply to container
<div {...dropZoneProps} data-testid="videos-container">
```

---

### Step 21: VideosPage - Drop Handler
**Dateien:** `VideosPage.tsx`
**Test:** Einzelne URL wird importiert
**Dauer:** 30 min

```tsx
const handleDrop = async (data: ParsedDropData) => {
  if (data.urls.length === 1) {
    // Direct import
    try {
      await createVideo.mutateAsync({ url: data.urls[0] })
      toast.success('Video hinzugefügt')
    } catch (error) {
      toast.error('Import fehlgeschlagen')
    }
  } else {
    // Open modal
    setPendingUrls(data.urls)
    setShowImportModal(true)
  }
}
```

---

### Step 22: VideosPage - Overlay Anzeige
**Dateien:** `VideosPage.tsx`
**Test:** Overlay erscheint bei Drag
**Dauer:** 15 min

```tsx
{dragActive && FEATURE_FLAGS.DRAG_DROP_IMPORT && (
  <DropZoneOverlay isValid={true} />
)}
```

---

### Step 23: VideosPage - Modal Integration
**Dateien:** `VideosPage.tsx`
**Test:** Modal öffnet bei Multi-URL Drop
**Dauer:** 30 min

```tsx
<ImportPreviewModal
  open={showImportModal}
  onOpenChange={setShowImportModal}
  urls={pendingUrls}
  existingVideoIds={videos?.map(v => v.youtube_id)}
  onImport={handleBulkImport}
/>

const handleBulkImport = async (urls: string[], categoryId?: string) => {
  const csvBlob = createCSVFromUrls(urls)
  const file = new File([csvBlob], 'import.csv')

  const result = await bulkUpload.mutateAsync(file)

  if (categoryId) {
    // Assign category to newly created videos
    // (Implementation detail)
  }

  toast.success(`${result.created_count} Videos hinzugefügt`)
  setShowImportModal(false)
}
```

---

### Step 24: TagNavigation - Drop State
**Dateien:** `TagNavigation.tsx`
**Test:** dragOverTagId State existiert
**Dauer:** 15 min

```tsx
const [dragOverTagId, setDragOverTagId] = useState<string | null>(null)
```

---

### Step 25: TagNavigation - Drop Events
**Dateien:** `TagNavigation.tsx`
**Test:** Tags reagieren auf Drag Events
**Dauer:** 30 min

```tsx
<button
  key={tag.id}
  onClick={() => onTagSelect(tag.id)}
  onDragOver={(e) => {
    e.preventDefault()
    setDragOverTagId(tag.id)
  }}
  onDragLeave={() => setDragOverTagId(null)}
  onDrop={(e) => handleDropOnTag(e, tag.id)}
  className={cn(
    'tag-button',
    dragOverTagId === tag.id && 'ring-2 ring-primary'
  )}
>
```

---

### Step 26: TagNavigation - Drop Handler
**Dateien:** `TagNavigation.tsx`
**Test:** Drop auf Tag ruft Callback auf
**Dauer:** 30 min

```tsx
interface TagNavigationProps {
  // ... existing ...
  onVideoDrop?: (urls: string[], categoryId: string) => void
}

const handleDropOnTag = (e: DragEvent, tagId: string) => {
  e.preventDefault()
  setDragOverTagId(null)

  const text = e.dataTransfer?.getData('text/plain')
  if (text) {
    const urls = parseUrlsFromText(text)
    if (urls.length > 0) {
      onVideoDrop?.(urls, tagId)
    }
  }
}
```

---

## Polish Steps (27-30)

### Step 27: Error Handling
**Dateien:** `VideosPage.tsx`, `ImportPreviewModal.tsx`
**Test:** Fehler werden als Toast angezeigt
**Dauer:** 30 min

---

### Step 28: Accessibility
**Dateien:** `DropZoneOverlay.tsx`, `TagNavigation.tsx`
**Test:** ARIA Labels vorhanden
**Dauer:** 20 min

---

### Step 29: Mobile Detection
**Dateien:** `VideosPage.tsx`
**Test:** Feature auf Touch-Geräten deaktiviert
**Dauer:** 15 min

```tsx
const isTouchDevice = 'ontouchstart' in window
const enableDragDrop = !isTouchDevice && FEATURE_FLAGS.DRAG_DROP_IMPORT
```

---

### Step 30: E2E Tests
**Dateien:** `drag-drop-import.spec.ts`
**Test:** Alle E2E Tests grün
**Dauer:** 60 min

---

## Zusammenfassung

| Phase | Steps | Geschätzte Zeit |
|-------|-------|-----------------|
| Foundation | 1-6 | ~2.5h |
| Hook (react-dropzone) | 7-10 | ~1.5h |
| Components | 11-17 | ~2.5h |
| Integration | 18-25 | ~3h |
| Polish | 26-29 | ~2h |
| **Gesamt** | **29 Steps** | **~11.5h** |

**Hinweis:** Durch Verwendung von react-dropzone entfällt manuelles Drag Counter Handling.

---

## Commit-Strategie

Jeder Step = 1 Commit:
```
feat(drag-drop): add extractYouTubeId utility
feat(drag-drop): add parseUrlsFromText utility
feat(drag-drop): implement useDropZone hook
...
```

Oder gruppiert nach Phase:
```
feat(drag-drop): add URL parser utilities (Steps 1-6)
feat(drag-drop): implement useDropZone hook (Steps 7-11)
feat(drag-drop): add UI components (Steps 12-18)
feat(drag-drop): integrate with VideosPage (Steps 19-23)
feat(drag-drop): add category drop support (Steps 24-26)
feat(drag-drop): polish and accessibility (Steps 27-30)
```
