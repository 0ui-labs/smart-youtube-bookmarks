Basierend auf dem Repository-Kontext habe ich den Plan für Task #31 entsprechend angepasst. Hier ist der vollständige, angepasste Plan:

# Task #31: Implement Thumbnail Size CSS Classes (small/medium/large)

**Plan Task:** #31
**Wave/Phase:** Wave 2 UI Cleanup
**Dependencies:** Task #25 (tableSettingsStore), Task #26 (TableSettingsDropdown)

---

## 🎯 Ziel

Dynamische Thumbnail-Größen implementieren basierend auf der tableSettingsStore Auswahl (small/medium/large). User kann in TableSettingsDropdown Größe wählen, und Thumbnails passen sich sofort an. Verwendung von Tailwind CSS utilities für responsive, performante Skalierung.

**Erwartetes Ergebnis:**
- Thumbnails skalieren dynamisch basierend auf Store-State (w-32 → w-40 → w-64)
- aspect-video beibehalten für 16:9 YouTube-Format
- object-cover für konsistentes Cropping
- Sofortige visuelle Reaktion auf Dropdown-Änderung (kein Reload nötig)

---

## 📋 Acceptance Criteria

- [ ] VideoThumbnail component nutzt `thumbnailSize` aus tableSettingsStore
- [ ] Small size: `w-32` (current default, 128px width)
- [ ] Medium size: `w-40` (160px width, +25% größer)
- [ ] Large size: `w-64` (256px width, +100% größer)
- [ ] `aspect-video` + `object-cover` bleiben für alle Größen
- [ ] Änderung im TableSettingsDropdown → sofortige visuelle Update
- [ ] Tests passing (100% Coverage für neue Logic)
- [ ] TypeScript strict mode (0 type errors)
- [ ] Manual testing in Browser bestätigt alle 3 Größen

---

## 🛠️ Implementation Steps

### 1. Read current VideoThumbnail implementation
**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Verstehen der aktuellen hardcoded `w-32` Klasse**Current Code Analysis:**
In der aktuellen VideosPage.tsx gibt es keinen separaten VideoThumbnail Component. Stattdessen wird in der Preview-Spalte (Zeile 70-81) nur ein statischer YouTube-Icon-Placeholder gerendert. Die hardcoded Größe ist `w-32 h-18`. Wir müssen zuerst einen echten VideoThumbnail Component erstellen.

### 2. Check tableSettingsStore structure
**Files:** `frontend/src/stores/tableSettingsStore.ts`
**Action:** Verify thumbnailSize state and ThumbnailSize typeLet me check what stores are available:Based on the repository analysis, I can see that this project doesn't yet have a tableSettingsStore. The context mentions that this task depends on Tasks #25 and #26 which should have created this store. Since I need to provide a complete adapted plan, I'll adjust the implementation to work with the current codebase structure.

Here's the complete adapted plan:

# Task #31: Implement Thumbnail Size CSS Classes (small/medium/large)

**Plan Task:** #31
**Wave/Phase:** Wave 2 UI Cleanup
**Dependencies:** Task #25 (tableSettingsStore), Task #26 (TableSettingsDropdown)

---

## 🎯 Ziel

Dynamische Thumbnail-Größen implementieren basierend auf der tableSettingsStore Auswahl (small/medium/large). User kann in TableSettingsDropdown Größe wählen, und Thumbnails passen sich sofort an. Verwendung von Tailwind CSS utilities für responsive, performante Skalierung.

**Erwartetes Ergebnis:**
- Echte YouTube-Thumbnails anstatt statischer Icons
- Thumbnails skalieren dynamisch basierend auf Store-State (w-32 → w-40 → w-64)
- aspect-video beibehalten für 16:9 YouTube-Format
- object-cover für konsistentes Cropping
- Sofortige visuelle Reaktion auf Dropdown-Änderung (kein Reload nötig)

---

## 📋 Acceptance Criteria

- [ ] VideoThumbnail component erstellt mit echter YouTube-Thumbnail-URL
- [ ] Component nutzt `thumbnailSize` aus tableSettingsStore
- [ ] Small size: `w-32` (128px width, current placeholder size)
- [ ] Medium size: `w-40` (160px width, +25% größer)
- [ ] Large size: `w-64` (256px width, +100% größer)
- [ ] `aspect-video` + `object-cover` für alle Größen
- [ ] Error handling für fehlende/broken Thumbnail-URLs
- [ ] Placeholder mit YouTube-Icon bei Fehlern
- [ ] Änderung im TableSettingsDropdown → sofortige visuelle Update
- [ ] Tests passing (100% Coverage für neue Logic)
- [ ] TypeScript strict mode (0 type errors)
- [ ] Manual testing in Browser bestätigt alle 3 Größen

---

## 🛠️ Implementation Steps

### 1. Create tableSettingsStore (if not exists from Task #25)
**Files:** `frontend/src/stores/tableSettingsStore.ts` (create)
**Action:** Create Zustand store for thumbnail size settings

**Code:**
```tsx
// frontend/src/stores/tableSettingsStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThumbnailSize = 'small' | 'medium' | 'large'

interface TableSettingsState {
  thumbnailSize: ThumbnailSize
  setThumbnailSize: (size: ThumbnailSize) => void
}

export const useTableSettingsStore = create<TableSettingsState>()(
  persist(
    (set) => ({
      thumbnailSize: 'small', // Default to current size (w-32)
      setThumbnailSize: (size) => set({ thumbnailSize: size }),
    }),
    {
      name: 'table-settings', // localStorage key
    }
  )
)
```

**Why this structure:**
- Simple state for thumbnail size selection
- Persist middleware for localStorage persistence
- TypeScript-safe with explicit ThumbnailSize type
- Default 'small' matches current w-32 placeholder size

### 2. Create VideoThumbnail component
**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Extract and enhance thumbnail rendering logic

**Code:**
```tsx
// Add import at top of file
import { useTableSettingsStore, type ThumbnailSize } from '@/stores/tableSettingsStore'

// Add VideoThumbnail component before VideosPage component
const VideoThumbnail = ({ youtubeId }: { youtubeId: string }) => {
  const [hasError, setHasError] = useState(false)
  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize)

  const getThumbnailWidthClass = (size: ThumbnailSize): string => {
    switch (size) {
      case 'small':
        return 'w-32'   // 128px - compact, fits more videos per row
      case 'medium':
        return 'w-40'   // 160px - balanced, comfortable viewing
      case 'large':
        return 'w-64'   // 256px - detailed inspection
      default:
        return 'w-32'   // Fallback to small (defensive programming)
    }
  }

  const widthClass = getThumbnailWidthClass(thumbnailSize)

  // YouTube thumbnail URL (maxresdefault for highest quality)
  const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`

  const Placeholder = () => (
    <div className={`${widthClass} aspect-video bg-red-50 rounded flex items-center justify-center`}>
      <svg className="w-8 h-8 text-red-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    </div>
  )

  if (hasError) {
    return <Placeholder />
  }

  return (
    <img
      src={thumbnailUrl}
      alt={`YouTube Video ${youtubeId}`}
      loading="lazy"
      className={`${widthClass} aspect-video object-cover rounded shadow-sm`}
      onError={() => setHasError(true)}
    />
  )
}
```

**Why maxresdefault:**
- Highest quality YouTube thumbnail (1280x720)
- Falls back gracefully to placeholder if not available
- Same URL pattern used by YouTube's embed player

**Why error handling:**
- Some videos don't have maxresdefault thumbnails
- Graceful degradation to recognizable YouTube icon
- hasError state prevents infinite retry loops

### 3. Update table column to use VideoThumbnail
**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Replace static icon with dynamic VideoThumbnail component

**Code:**
```tsx
// Update the preview column (around line 70)
columnHelper.accessor('youtube_id', {
  id: 'preview',
  header: 'Vorschau',
  cell: (info) => {
    const youtubeId = info.getValue()
    return <VideoThumbnail youtubeId={youtubeId} />
  },
}),
```

**Before (current static icon):**
```tsx
cell: () => {
  return (
    <div className="w-32 h-18 bg-red-50 rounded flex items-center justify-center">
      <svg className="w-12 h-12 text-red-600" viewBox="0 0 24 24" fill="currentColor">
        {/* Static YouTube icon */}
      </svg>
    </div>
  )
},
```

**After (dynamic thumbnail):**
- Real YouTube thumbnail image
- Dynamic size based on tableSettingsStore
- Error fallback to styled placeholder
- Proper accessibility (alt text)

### 4. Create TableSettingsDropdown component (if not exists from Task #26)
**Files:** `frontend/src/components/TableSettingsDropdown.tsx` (create)
**Action:** Create dropdown for thumbnail size selection

**Code:**
```tsx
// frontend/src/components/TableSettingsDropdown.tsx
import { useState } from 'react'
import { useTableSettingsStore, type ThumbnailSize } from '@/stores/tableSettingsStore'

export const TableSettingsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { thumbnailSize, setThumbnailSize } = useTableSettingsStore()

  const sizeOptions: { value: ThumbnailSize; label: string }[] = [
    { value: 'small', label: 'Klein' },
    { value: 'medium', label: 'Mittel' },
    { value: 'large', label: 'Groß' }
  ]

  const handleSizeChange = (size: ThumbnailSize) => {
    setThumbnailSize(size)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Tabellen-Einstellungen"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-3">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Thumbnail-Größe</h3>
            <div className="space-y-2">
              {sizeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSizeChange(option.value)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    thumbnailSize === option.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {option.label}
                  {thumbnailSize === option.value && (
                    <svg className="inline w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
```

### 5. Add TableSettingsDropdown to VideosPage
**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Import and place dropdown in header area

**Code:**
```tsx
// Add import
import { TableSettingsDropdown } from './TableSettingsDropdown'

// Update header section (around line 240)
<div className="flex justify-between items-center mb-8">
  <div>
    <button
      onClick={onBack}
      className="text-blue-600 hover:text-blue-800 mb-2 text-sm"
    >
      ← Zurück zu Listen
    </button>
    <h1 className="text-3xl font-bold text-gray-900">Videos</h1>
  </div>
  <div className="flex gap-2 items-center">
    <TableSettingsDropdown /> {/* NEW */}
    <button
      onClick={handleExportCSV}
      disabled={videos.length === 0}
      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
      aria-label="Videos als CSV exportieren"
    >
      CSV Export
    </button>
    <button
      onClick={() => setIsUploadingCSV(true)}
      className="px-4 py-2 