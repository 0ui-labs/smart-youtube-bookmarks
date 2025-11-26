# Implementation Plan: Drag & Drop Video Import

## Übersicht

| Phase | Beschreibung | Abhängigkeiten |
|-------|--------------|----------------|
| 1 | Foundation (Utilities) | Keine |
| 2 | Core Hook (useDropZone) | Phase 1 |
| 3 | UI Components | Phase 1, 2 |
| 4 | VideosPage Integration | Phase 2, 3 |
| 5 | TagNavigation Integration | Phase 2, 3 |
| 6 | Polish & Edge Cases | Phase 4, 5 |

---

## Phase 1: Foundation (Utilities)

### 1.1 URL Parser Utility erstellen

**Datei:** `/frontend/src/utils/urlParser.ts`

```typescript
// YouTube URL Validierung und ID-Extraktion
export const extractYouTubeId = (url: string): string | null

// Mehrere URLs aus Text parsen
export const parseUrlsFromText = (text: string): string[]

// .webloc Datei parsen (XML)
export const parseWeblocFile = (file: File): Promise<string | null>

// CSV zu URL Array
export const parseUrlsFromCSV = (file: File): Promise<string[]>
```

**Tests:** Unit Tests für alle Parser-Funktionen

### 1.2 CSV Helper erstellen

**Datei:** `/frontend/src/utils/csvHelper.ts`

```typescript
// URL Array zu CSV Blob konvertieren
export const createCSVFromUrls = (urls: string[]): Blob
```

### 1.3 Feature Flag hinzufügen

**Datei:** `/frontend/src/config/featureFlags.ts`

```typescript
export const FEATURE_FLAGS = {
  // Bestehend...
  DRAG_DROP_IMPORT: true,
}
```

---

## Phase 2: Core Hook (useDropZone)

### 2.1 useDropZone Hook erstellen

**Datei:** `/frontend/src/hooks/useDropZone.ts`

```typescript
interface UseDropZoneOptions {
  onDrop: (data: ParsedDropData) => void
  onValidationError?: (error: string) => void
  disabled?: boolean
}

interface ParsedDropData {
  type: 'youtube-urls' | 'webloc-files' | 'csv-file' | 'text-urls'
  urls: string[]
  files?: File[]
}

interface UseDropZoneReturn {
  isDragging: boolean
  isValidDrop: boolean
  dropZoneProps: {
    onDragEnter: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
}

export const useDropZone = (options: UseDropZoneOptions): UseDropZoneReturn
```

**Funktionalität:**
- Drag Event Handling
- Drop Data Parsing (delegiert an urlParser)
- State Management (isDragging, isValidDrop)
- Drag Counter für korrektes Enter/Leave Handling

**Tests:** Hook Tests mit Mock Events

---

## Phase 3: UI Components

### 3.1 DropZoneOverlay Komponente

**Datei:** `/frontend/src/components/DropZoneOverlay.tsx`

```typescript
interface DropZoneOverlayProps {
  isValid: boolean
  message?: string
}

export const DropZoneOverlay: React.FC<DropZoneOverlayProps>
```

**Features:**
- Halbtransparentes Overlay
- Zentrierte Box mit Icon und Text
- Fade In/Out Animation (Framer Motion)
- Valid/Invalid States

### 3.2 ImportPreviewModal Komponente

**Datei:** `/frontend/src/components/ImportPreviewModal.tsx`

```typescript
interface ImportPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  urls: string[]
  existingVideoIds?: string[]  // Für Duplikat-Erkennung
  preselectedCategoryId?: string
  onImport: (urls: string[], categoryId?: string) => Promise<void>
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps>
```

**Features:**
- URL-Liste mit Validierungs-Status
- Duplikat-Erkennung
- Kategorie-Auswahl (Select)
- Import-Button mit Fortschrittsanzeige
- Fehler-Anzeige

**Verwendet:**
- `Dialog` (Radix UI)
- `ScrollArea`
- `Select`
- `Button`
- `Progress`

---

## Phase 4: VideosPage Integration

### 4.1 Drop Zone zu VideosPage hinzufügen

**Datei:** `/frontend/src/components/VideosPage.tsx`

**Änderungen:**
1. `useDropZone` Hook importieren und verwenden
2. State für Modal und pending URLs
3. Drop Handler implementieren
4. DropZoneOverlay bei Drag anzeigen
5. ImportPreviewModal integrieren

```tsx
// Neue State Variablen
const [showImportModal, setShowImportModal] = useState(false)
const [pendingUrls, setPendingUrls] = useState<string[]>([])

// Hook verwenden
const { isDragging, dropZoneProps } = useDropZone({
  onDrop: handleDrop,
  disabled: !FEATURE_FLAGS.DRAG_DROP_IMPORT,
})

// Handler
const handleDrop = (data: ParsedDropData) => {
  if (data.urls.length === 1) {
    // Direkt importieren
    createVideo.mutate({ url: data.urls[0] })
  } else {
    // Modal öffnen
    setPendingUrls(data.urls)
    setShowImportModal(true)
  }
}
```

### 4.2 Import Handler für mehrere Videos

```tsx
const handleBulkImport = async (urls: string[], categoryId?: string) => {
  // CSV aus URLs erstellen
  const csvBlob = createCSVFromUrls(urls)
  const file = new File([csvBlob], 'import.csv', { type: 'text/csv' })

  // Bulk Upload
  const result = await bulkUpload.mutateAsync(file)

  // Optional: Kategorie zuweisen
  if (categoryId) {
    // Für jedes neu erstellte Video Kategorie setzen
    // (IDs kommen aus Response)
  }

  return result
}
```

---

## Phase 5: TagNavigation Integration

### 5.1 Drop Targets zu Tags hinzufügen

**Datei:** `/frontend/src/components/TagNavigation.tsx`

**Änderungen:**
1. Props erweitern für Drop-Callback
2. Drag-Over State pro Tag
3. Drop Handler mit Kategorie-ID
4. Visuelles Feedback

```tsx
interface TagNavigationProps {
  // Bestehend...
  onVideoDrop?: (urls: string[], categoryId: string) => void
}

// Pro Tag
const [dragOverTagId, setDragOverTagId] = useState<string | null>(null)

// Event Handler
const handleDragOver = (e: DragEvent, tagId: string) => {
  e.preventDefault()
  e.stopPropagation()
  setDragOverTagId(tagId)
}

const handleDragLeave = () => {
  setDragOverTagId(null)
}

const handleDrop = (e: DragEvent, tagId: string) => {
  e.preventDefault()
  setDragOverTagId(null)

  const data = parseDropData(e.dataTransfer)
  onVideoDrop?.(data.urls, tagId)
}
```

### 5.2 MainLayout Integration

**Datei:** `/frontend/src/components/MainLayout.tsx`

**Änderungen:**
1. `onVideoDrop` Handler an TagNavigation übergeben
2. Handler öffnet ImportPreviewModal mit vorausgewählter Kategorie

---

## Phase 6: Polish & Edge Cases

### 6.1 Error Handling

- Toast Notifications für alle Fehler-Szenarien
- Retry-Option bei Netzwerkfehlern
- Graceful Degradation bei nicht unterstützten Browsern

### 6.2 Performance Optimierungen

- `useCallback` für alle Event Handler
- Throttling für `dragOver` Events (16ms)
- Lazy Loading für ImportPreviewModal

### 6.3 Accessibility

- ARIA Labels für Drop Zones
- Keyboard Navigation in Modal
- Screen Reader Announcements

### 6.4 Edge Cases

- Leere Drops ignorieren
- Sehr lange URL-Listen (>100) mit Warnung
- Gleichzeitige Imports verhindern (Mutex)
- Browser-Kompatibilitäts-Checks

### 6.5 Analytics (Optional)

- Track Drop Events
- Track Import Success/Failure Rate
- Track verwendete Input-Formate

---

## Abhängigkeiten zwischen Phasen

```
Phase 1 (Utilities)
    │
    ▼
Phase 2 (useDropZone)
    │
    ├─────────────┐
    ▼             ▼
Phase 3       Phase 3
(Overlay)     (Modal)
    │             │
    └──────┬──────┘
           ▼
    Phase 4 (VideosPage)
           │
           ▼
    Phase 5 (TagNavigation)
           │
           ▼
    Phase 6 (Polish)
```

---

## Checkliste pro Phase

### Phase 1 ✓
- [ ] `urlParser.ts` erstellt und getestet
- [ ] `csvHelper.ts` erstellt und getestet
- [ ] Feature Flag hinzugefügt

### Phase 2 ✓
- [ ] `useDropZone.ts` erstellt
- [ ] Hook Tests geschrieben
- [ ] Drag Counter korrekt implementiert

### Phase 3 ✓
- [ ] `DropZoneOverlay.tsx` erstellt
- [ ] `ImportPreviewModal.tsx` erstellt
- [ ] Component Tests geschrieben

### Phase 4 ✓
- [ ] VideosPage nutzt useDropZone
- [ ] Einzelner URL Drop funktioniert
- [ ] Multi-URL Drop öffnet Modal
- [ ] Import funktioniert

### Phase 5 ✓
- [ ] Tags sind Drop Targets
- [ ] Kategorie wird zugewiesen
- [ ] Integration mit Modal

### Phase 6 ✓
- [ ] Error Handling komplett
- [ ] Accessibility geprüft
- [ ] Edge Cases behandelt
- [ ] Performance optimiert
