# Codebase Analysis: Drag & Drop Video Import

## Projektstruktur

```
Smart Youtube Bookmarks/
├── backend/                    # FastAPI Python Backend
│   ├── app/
│   │   ├── api/               # API Route Handler
│   │   ├── models/            # SQLAlchemy Models
│   │   ├── schemas/           # Pydantic Schemas
│   │   ├── services/          # Business Logic
│   │   └── workers/           # ARQ Background Workers
│   └── alembic/               # DB Migrations
│
└── frontend/                  # React + TypeScript
    ├── src/
    │   ├── components/        # React Components
    │   ├── hooks/            # Custom Hooks (TanStack Query)
    │   ├── stores/           # Zustand State Management
    │   ├── types/            # TypeScript Types
    │   └── lib/              # API Utilities
```

## Relevante Komponenten

### Video Liste (Hauptbereich)
**Datei:** `/frontend/src/components/VideosPage.tsx`

- Zeigt Videos in Table oder Grid View
- Verwendet TanStack Table
- URL-basiertes State Management für Filter/Sortierung
- **Bestehende Video-Hinzufügen Methoden:**
  - Einzelne URL Input (Zeile ~965-1019)
  - CSV Upload via `CSVUpload` Komponente (Zeile ~957-963, hidden)
  - Plus-Icon Quick-Add Button (Zeile ~869-878)

### Sidebar Navigation
**Datei:** `/frontend/src/components/MainLayout.tsx`

- Verwendet `CollapsibleSidebar` Komponente
- Enthält:
  - `TagNavigation` - Tag/Kategorie Filter
  - `ChannelNavigation` - Kanal Filter
  - Settings Button

### Tag Navigation
**Datei:** `/frontend/src/components/TagNavigation.tsx`

- Zeigt Tags als Filter-Buttons
- Multi-Select möglich (OR Filterung)
- Verwendet `tagStore` für State

## State Management

### Zustand Stores
| Store | Datei | Zweck |
|-------|-------|-------|
| `tagStore` | `/frontend/src/stores/tagStore.ts` | Ausgewählte Tags |
| `tableSettingsStore` | `tableSettingsStore.ts` | View-Einstellungen |
| `fieldFilterStore` | `fieldFilterStore.ts` | Custom Field Filter |

### TanStack Query Hooks
**Datei:** `/frontend/src/hooks/useVideos.ts`

| Hook | Zweck |
|------|-------|
| `useVideos()` | Videos mit Filter laden |
| `useCreateVideo()` | Einzelnes Video hinzufügen |
| `useBulkUploadVideos()` | CSV Bulk Upload |
| `useAssignTags()` | Tags zuweisen |

## Bestehendes CSV Import Feature

### Frontend
**Datei:** `/frontend/src/components/CSVUpload.tsx`

- File Input für CSV (max 10MB)
- Validiert Datei-Typ und -Größe
- Zeigt Erfolg/Fehler Statistiken
- **Status:** Existiert aber versteckt via Feature Flag

```typescript
// /frontend/src/config/featureFlags.ts
SHOW_CSV_UPLOAD_BUTTON: false  // Hidden
```

### Backend
**Endpoint:** `POST /api/lists/{list_id}/videos/bulk`
**Datei:** `/backend/app/api/videos.py` (Zeilen 1538-1780)

**CSV Format:**
```csv
url,field_Overall_Rating,field_Presentation
https://youtube.com/watch?v=dQw4w9WgXcQ,5,great
```

**Response:**
```json
{
  "created_count": 5,
  "failed_count": 1,
  "failures": [{ "row": 3, "url": "...", "error": "..." }]
}
```

## API Endpoints

### Einzelnes Video hinzufügen
```
POST /lists/{list_id}/videos
Body: { "url": "https://youtube.com/watch?v=..." }
```

### Bulk Upload (CSV)
```
POST /lists/{list_id}/videos/bulk
Body: FormData mit CSV Datei
```

### YouTube URL Validierung
**Funktion:** `extract_youtube_id(url: str)`
**Unterstützte Formate:**
- `youtube.com/watch?v=VIDEO_ID`
- `youtu.be/VIDEO_ID`
- `youtube.com/embed/VIDEO_ID`

## Tag/Kategorie System

### Dual-Purpose Tags
```python
class Tag:
    is_video_type: bool  # True = Kategorie (nur 1 pro Video)
                         # False = Label (mehrere pro Video)
```

### Kategorie zuweisen
```
PUT /videos/{video_id}/category
Body: { "category_id": "uuid" }
```

## Existierendes Drag & Drop

### Bibliothek: @dnd-kit (bereits installiert!)
**Versionen:** Core v6.3.1, Sortable v10.0.0

### Verwendung in Codebase
**Datei:** `/frontend/src/components/schemas/SortableFieldRow.tsx`

- Drag & Drop für Field Reordering
- Verwendet `useSortable` Hook
- Pattern kann adaptiert werden

## Wichtige Erkenntnisse

### Vorhandene Infrastruktur ✅
- CSV Bulk Upload Backend **vollständig funktional**
- Frontend CSV Komponente **existiert** (nur versteckt)
- @dnd-kit Bibliothek **bereits installiert**
- FormData Upload Pattern **etabliert**
- Optimistic Updates **in allen Mutations**

### Kein Backend-Änderung nötig
- Bestehender Endpoint reicht aus
- Können das gleiche CSV-Format nutzen
- Error Handling bereits implementiert

## Code Patterns

### Mutation Pattern (zu folgen)
```typescript
const bulkUpload = useMutation({
  mutationFn: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post(`/lists/${listId}/videos/bulk`, formData)
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: videoKeys.list(listId) })
  }
})
```

### Styling Pattern
- Tailwind CSS für alle Styles
- Radix UI Komponenten in `/frontend/src/components/ui/`
- Framer Motion für Animationen

## Datei-Referenzen

### Frontend (zu modifizieren)
| Datei | Änderung |
|-------|----------|
| `VideosPage.tsx` | Drop Zone hinzufügen |
| `MainLayout.tsx` | Sidebar Drop Targets |
| `TagNavigation.tsx` | Drop auf Tags |
| `useVideos.ts` | Evtl. neue Hooks |

### Backend (keine Änderung)
| Datei | Status |
|-------|--------|
| `videos.py` | ✅ Fertig |
| `video.py` | ✅ Fertig |
