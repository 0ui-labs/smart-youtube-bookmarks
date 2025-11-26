# Integration Strategy: Drag & Drop Video Import

## Architektur-Entscheidung: react-dropzone

### Warum react-dropzone?

**Problem:** @dnd-kit funktioniert NICHT für externe Drops (Desktop, Browser URLs)

| Aspekt | react-dropzone | Native HTML5 | @dnd-kit |
|--------|---------------|--------------|----------|
| Desktop Dateien | ✅ | ✅ | ❌ |
| Browser URL Drag | ✅ | ✅ | ❌ |
| React Hooks | ✅ Native | ❌ Manuell | ✅ |
| Bundle Size | ~10 KB | 0 KB | N/A |
| Wartungsaufwand | Niedrig | Hoch | N/A |

**Entscheidung:**
- **react-dropzone** für externe Drops (Desktop-Dateien, URLs)
- **@dnd-kit** bleibt für interne Sortierung (Field Reordering)

## Integration Points

### 1. Globaler Drop Zone Provider

```
App
└── MainLayout
    ├── CollapsibleSidebar
    │   └── TagNavigation ← Drop Target (pro Tag)
    └── VideosPage ← Drop Target (Hauptbereich)
        └── DropZoneOverlay ← Visuelles Feedback
```

**Ansatz:** Kein globaler Provider nötig. Jede Komponente verwaltet eigene Drop Events.

### 2. VideosPage Integration

```tsx
// Bestehende Struktur bleibt erhalten
<div className="videos-page">
  {/* NEU: Drop Zone Wrapper */}
  <DropZone
    onDrop={handleDrop}
    onDragStateChange={setIsDragging}
  >
    {/* Bestehender Content unverändert */}
    <VideoTable ... />
    <VideoGrid ... />

    {/* NEU: Overlay nur bei Drag sichtbar */}
    {isDragging && <DropZoneOverlay />}
  </DropZone>
</div>
```

**Minimal-invasiv:** Bestehende JSX-Struktur bleibt erhalten, nur Wrapper hinzugefügt.

### 3. TagNavigation Integration

```tsx
// Jeder Tag wird Drop Target
<button
  key={tag.id}
  onClick={() => onTagSelect(tag.id)}
  // NEU: Drop Handling
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={(e) => handleDropOnTag(e, tag.id)}
  className={cn(
    'tag-button',
    isDragOver && 'ring-2 ring-primary' // Visuelles Feedback
  )}
>
  {tag.name}
</button>
```

**Minimal-invasiv:** Nur Event Handler und bedingte Styles hinzugefügt.

## Wiederverwendbare Module

### 1. useVideoDropZone Hook (basiert auf react-dropzone)

```tsx
// /frontend/src/hooks/useVideoDropZone.ts
import { useDropzone } from 'react-dropzone'

interface UseVideoDropZoneOptions {
  onVideosDetected: (data: ParsedDropData) => void
  onValidationError?: (error: string) => void
  disabled?: boolean
}

interface ParsedDropData {
  type: 'youtube-urls' | 'webloc-files' | 'csv-file' | 'text-urls'
  urls: string[]
  files?: File[]
}

export const useVideoDropZone = (options: UseVideoDropZoneOptions) => {
  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles, event) => {
    // 1. Check for text/URL data (browser URL drag)
    const text = event?.dataTransfer?.getData('text/plain')
    if (text) {
      const urls = parseUrlsFromText(text)
      if (urls.length > 0) {
        options.onVideosDetected({ type: 'youtube-urls', urls })
        return
      }
    }

    // 2. Handle .webloc files
    const weblocFiles = acceptedFiles.filter(f => f.name.endsWith('.webloc'))
    if (weblocFiles.length > 0) {
      const urls = await Promise.all(weblocFiles.map(parseWeblocFile))
      options.onVideosDetected({ type: 'webloc-files', urls: urls.filter(Boolean), files: weblocFiles })
      return
    }

    // 3. Handle .csv files
    const csvFiles = acceptedFiles.filter(f => f.name.endsWith('.csv'))
    if (csvFiles.length > 0) {
      options.onVideosDetected({ type: 'csv-file', urls: [], files: csvFiles })
      return
    }
  }, [options])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,  // Nur Drop, kein Klick-Dialog
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

**Vorteile von react-dropzone:**
- Handles Drag Counter automatisch (kein manuelles Enter/Leave Tracking)
- Keyboard/Click optional deaktivierbar
- Tested und maintained

### 2. URL Parser Utilities

```tsx
// /frontend/src/utils/urlParser.ts

// YouTube URL aus verschiedenen Formaten extrahieren
export const parseYouTubeUrl = (url: string): string | null
export const extractYouTubeId = (url: string): string | null

// .webloc Datei parsen (XML-basiert)
export const parseWeblocFile = async (file: File): Promise<string | null>

// Mehrere URLs aus Text extrahieren
export const parseUrlsFromText = (text: string): string[]

// CSV parsen und URLs extrahieren
export const parseUrlsFromCSV = async (file: File): Promise<string[]>
```

**Wiederverwendbar:** Getrennt von UI, testbar.

### 3. Drop Zone Overlay

```tsx
// /frontend/src/components/DropZoneOverlay.tsx

interface DropZoneOverlayProps {
  isValid: boolean
  message?: string
}

// Zeigt halbtransparentes Overlay mit Icon/Text
```

**Wiederverwendbar:** Stateless, rein visuell.

## Event Flow

### Drop auf Video-Liste

```
1. User zieht Datei/URL über VideosPage
2. onDragEnter → isDragging = true → Overlay erscheint
3. onDragOver → Validierung → isValid aktualisiert
4. onDrop:
   a. Parsen der Drop-Daten (useDropZone)
   b. Wenn 1 URL → Direkt importieren (useCreateVideo)
   c. Wenn mehrere → ImportPreviewModal öffnen
5. Nach Import → Cache invalidieren → UI aktualisiert
```

### Drop auf Kategorie-Tag

```
1. User zieht Datei/URL über Tag in Sidebar
2. onDragEnter → Tag bekommt Highlight
3. onDrop:
   a. Parsen der Drop-Daten
   b. Import mit automatischer Kategorie-Zuweisung
   c. Bei mehreren → Modal mit vorausgewählter Kategorie
```

## State Management

### Lokaler State (je Komponente)

```tsx
// VideosPage
const [isDragging, setIsDragging] = useState(false)
const [showPreviewModal, setShowPreviewModal] = useState(false)
const [pendingImport, setPendingImport] = useState<string[]>([])

// TagNavigation
const [dragOverTagId, setDragOverTagId] = useState<string | null>(null)
```

### Kein globaler State nötig

- Drag Events sind lokal
- Import-Ergebnisse via React Query (bereits vorhanden)
- Toast Notifications für Feedback (bereits vorhanden)

## API Integration

### Bestehende Hooks verwenden

```tsx
// Einzelnes Video
const createVideo = useCreateVideo(listId)
createVideo.mutate({ url: youtubeUrl })

// Mehrere Videos (CSV Format)
const bulkUpload = useBulkUploadVideos(listId)
const csvBlob = createCSVFromUrls(urls)
bulkUpload.mutate(new File([csvBlob], 'import.csv'))

// Kategorie zuweisen nach Import
const setCategory = useSetVideoCategory()
setCategory.mutate({ videoId, categoryId })
```

### Neuer Helper: URL Array zu CSV

```tsx
// /frontend/src/utils/csvHelper.ts

export const createCSVFromUrls = (urls: string[]): Blob => {
  const csvContent = 'url\n' + urls.join('\n')
  return new Blob([csvContent], { type: 'text/csv' })
}
```

## Feature Flags (Optional)

```tsx
// /frontend/src/config/featureFlags.ts

export const FEATURE_FLAGS = {
  // Bestehend
  SHOW_CSV_UPLOAD_BUTTON: false,

  // NEU: Drag & Drop schrittweise einführen
  DRAG_DROP_IMPORT: true,
  DRAG_DROP_ON_TAGS: true,
}
```

**Vorteil:** Feature kann bei Problemen schnell deaktiviert werden.

## Interface Boundaries

### Input → Parser → API

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Drop Events    │────▶│  URL Parser     │────▶│  React Query    │
│  (HTML5 DnD)    │     │  (urlParser.ts) │     │  (useVideos.ts) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
   Raw Events              Parsed URLs            API Calls
   (DataTransfer)          string[]               mutate()
```

**Klare Trennung:** Jede Schicht hat eine Verantwortung.

## Fallback-Strategie

| Situation | Fallback |
|-----------|----------|
| Drag & Drop nicht unterstützt | Bestehender CSV Upload |
| .webloc Parsing fehlschlägt | Fehlermeldung + Skip |
| Ungültige YouTube URL | In Fehlerliste anzeigen |
| Netzwerkfehler | Toast + Retry Option |

## Migration / Rollout

1. **Phase 1:** Drop Zone auf VideosPage (Hauptfunktionalität)
2. **Phase 2:** Drop auf Tags in Sidebar
3. **Phase 3:** Erweiterte Formate (.webloc, Multi-URL)
4. **Phase 4:** Polish (Animationen, Edge Cases)

Jede Phase unabhängig deploybar via Feature Flags.
