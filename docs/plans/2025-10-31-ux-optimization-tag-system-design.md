# UX-Optimierung & Tag-System - Design Document

**Datum:** 2025-10-31
**Typ:** Feature Enhancement & UI Redesign
**Ziel:** Iterative UX-Verbesserung mit Tag-basiertem Filtersystem
**Basiert auf:** Product Vision V2, Consumer App Roadmap

---

## 🎯 Übersicht

Transformation der aktuellen Listen-basierten UI zu einem modernen, Tag-basierten Filtersystem mit optimierter UX. Implementierung in 3 iterativen Wellen, jede Welle vollständig funktional und testbar.

**Kernziele:**
- Tag-basierte Navigation statt getrennte Listen
- Moderne 2-Spalten-Layout (Tags links, Videos rechts)
- Optimierte CSV Import/Export-Workflows
- Drag & Drop für URLs und CSV-Dateien
- Auto-Tagging bei gefiltertem Upload
- Konfigurierbare UI (Thumbnail-Größen, Spalten)

---

## 📋 Architektur-Entscheidungen

### Implementierungs-Ansatz
**Gewählt:** Iterativ-Inkrementell (3 Wellen)

**Rationale:**
- Jede Welle ist vollständig funktional und testbar
- Reduziert Risiko von großen Integrations-Problemen
- Ermöglicht frühes User-Feedback nach jeder Welle
- Backend → Frontend → Polish in kontrollierten Schritten

### Listen vs. Tags
**Entscheidung:** Listen-Konzept wird NICHT vollständig ersetzt

**Details:**
- Alle Listen außer einer werden gelöscht (Alembic Migration)
- Listen-Funktionalität bleibt im Backend erhalten
- Später nutzbar als "Workspaces" Feature
- UI zeigt keine Listen-Verwaltung (vorerst)

**Rationale:**
- Flexibilität für zukünftige Features
- Workspaces könnten gespeicherte Tag-Kombinationen sein
- Technische Schuld vermeiden durch vollständiges Löschen

---

## 🌊 Welle 1: Tag-System & Core Layout (Foundation)

### Ziel
Tag-basiertes Filtersystem mit neuem 2-Spalten-Layout implementieren.

### Backend-Änderungen

#### 1. Datenbank-Schema
**Neue Tabellen:**

```sql
-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7),  -- Hex color code, e.g., "#3B82F6"
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, user_id)  -- Tag names unique per user
);

-- Video-Tag junction table (many-to-many)
CREATE TABLE video_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(video_id, tag_id)  -- Prevent duplicate assignments
);

CREATE INDEX idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX idx_video_tags_tag_id ON video_tags(tag_id);
```

**Alembic Migration:**
```python
# Migration: delete_extra_lists_keep_one
# - Delete all lists except the first one per user
# - Keep lists table structure intact
# - Data migration: preserve videos in remaining list
```

#### 2. Tag API Endpoints

**Tag CRUD:**
```python
GET    /api/tags                    # List all user's tags
POST   /api/tags                    # Create new tag
       Body: {name: str, color?: str}
PUT    /api/tags/{tag_id}           # Update tag (rename/color)
       Body: {name?: str, color?: str}
DELETE /api/tags/{tag_id}           # Delete tag
```

**Video-Tag Assignment:**
```python
POST   /api/videos/{video_id}/tags  # Add tags to video
       Body: {tag_ids: UUID[]}
DELETE /api/videos/{video_id}/tags/{tag_id}  # Remove tag from video
GET    /api/videos/{video_id}/tags  # Get video's tags
```

**Tag Filtering:**
```python
GET    /api/videos?tags=python,tutorial  # OR filter (any matching tag)
       Returns: Videos with "python" OR "tutorial" tag

GET    /api/videos?tags_all=python,tutorial  # AND filter (all tags required)
       Returns: Videos with "python" AND "tutorial" tags
```

**SQLAlchemy Query Optimization:**
```python
# OR filter (any tag matches)
query = select(Video).join(video_tags).join(Tag).where(
    Tag.name.in_(tag_names)
).distinct()

# AND filter (all tags required)
query = select(Video).where(
    Video.id.in_(
        select(video_tags.c.video_id)
        .group_by(video_tags.c.video_id)
        .having(func.count(video_tags.c.tag_id) == len(tag_ids))
    )
)
```

#### 3. Response Schema Updates

**Extend VideoResponse:**
```python
class VideoResponse(BaseModel):
    id: UUID
    # ... existing fields ...
    tags: list[TagResponse] = []  # Include tags in video response

class TagResponse(BaseModel):
    id: UUID
    name: str
    color: str | None
```

### Frontend-Änderungen

#### 1. Layout-Struktur

**Neue Komponente: `TwoColumnLayout.tsx`**
```tsx
<TwoColumnLayout>
  <LeftSidebar
    isCollapsed={sidebarCollapsed}
    onToggle={toggleSidebar}
  >
    <TagNavigation />
  </LeftSidebar>

  <MainContent>
    <VideoTable />
  </MainContent>
</TwoColumnLayout>
```

**CSS Layout:**
```css
.two-column-layout {
  display: grid;
  grid-template-columns: 250px 1fr;  /* Fixed sidebar, flexible content */
  gap: 0;
  height: 100vh;
}

.two-column-layout.sidebar-collapsed {
  grid-template-columns: 0 1fr;  /* Sidebar hidden */
}

.left-sidebar {
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  transition: width 0.3s ease;
}

.main-content {
  overflow-y: auto;
  padding: 1rem;
  /* Extend to edge of window */
  padding-right: 0;
  padding-left: 1rem;
}
```

#### 2. Tag-Navigation Component

**Komponente: `TagNavigation.tsx`**
```tsx
interface TagNavigationProps {
  tags: Tag[];
  selectedTagIds: UUID[];
  onTagSelect: (tagId: UUID) => void;
  onTagCreate: () => void;
}

<TagNavigation>
  <Header>
    <h2>Tags</h2>
    <IconButton onClick={onTagCreate}>
      <PlusIcon />
    </IconButton>
  </Header>

  <TagList>
    {tags.map(tag => (
      <TagItem
        key={tag.id}
        tag={tag}
        isSelected={selectedTagIds.includes(tag.id)}
        onClick={() => onTagSelect(tag.id)}
      >
        <Checkbox checked={isSelected} />
        <TagName color={tag.color}>{tag.name}</TagName>
        <VideoCount>({tag.videoCount})</VideoCount>
      </TagItem>
    ))}
  </TagList>
</TagNavigation>
```

**State Management (Zustand):**
```tsx
interface TagFilterStore {
  selectedTagIds: UUID[];
  toggleTag: (tagId: UUID) => void;
  clearTags: () => void;
}

const useTagFilterStore = create<TagFilterStore>((set) => ({
  selectedTagIds: [],
  toggleTag: (tagId) => set((state) => ({
    selectedTagIds: state.selectedTagIds.includes(tagId)
      ? state.selectedTagIds.filter(id => id !== tagId)
      : [...state.selectedTagIds, tagId]
  })),
  clearTags: () => set({ selectedTagIds: [] }),
}));
```

#### 3. Routing & Navigation

**Route-Änderungen:**
```tsx
// Remove dashboard and lists routes from UI
// Keep backend routes for API compatibility

<Routes>
  <Route path="/" element={<Navigate to="/videos" />} />  {/* New default */}
  <Route path="/videos" element={<VideosPage />} />
  {/* Lists/Dashboard routes hidden but API remains */}
</Routes>
```

#### 4. UI-Cleanup (Teil 1)

**Entfernen (aus UI, nicht aus Code):**
- Navigation-Links zu Listen-Seite und Dashboard
- "Zurück zur Liste" Link über Videos

**Behalten (versteckt im Code):**
- Listen-API-Endpoints
- Dashboard-Komponente (für später)

### Testing

**Backend Tests:**
```python
# test_tags.py
def test_create_tag():
    # POST /api/tags

def test_assign_tags_to_video():
    # POST /api/videos/{id}/tags

def test_filter_videos_by_tags_or():
    # GET /api/videos?tags=python,tutorial

def test_filter_videos_by_tags_and():
    # GET /api/videos?tags_all=python,tutorial
```

**Frontend Tests:**
```tsx
// TagNavigation.test.tsx
test('displays tags with video counts', ...)
test('toggles tag selection on click', ...)
test('opens create tag dialog on plus icon', ...)

// TwoColumnLayout.test.tsx
test('collapses sidebar on toggle', ...)
test('maintains collapsed state in localStorage', ...)
```

### Erfolgskriterium
✅ User erstellt Tag "Python" → Weist Video zu → Klickt Tag in Sidebar → Nur Python-Videos sichtbar

### Geschätzter Aufwand
**Backend:** 3-4 Stunden
**Frontend:** 4-5 Stunden
**Testing:** 2-3 Stunden
**Total:** 9-12 Stunden

---

## 🌊 Welle 2: UI-Cleanup & Enhanced UX (Polish)

### Ziel
UI modernisieren, Buttons ausblenden, Settings-Dropdown, Thumbnail-Größen, Delete-Modal.

### Frontend-Änderungen

#### 1. UI-Element Visibility

**Buttons ausblenden (aber Funktionen behalten):**
```tsx
// VideosPage.tsx
const SHOW_ADD_VIDEO_BUTTON = false;  // Feature flag
const SHOW_CSV_UPLOAD_BUTTON = false;
const SHOW_CSV_EXPORT_BUTTON = false;

{SHOW_ADD_VIDEO_BUTTON && <Button onClick={...}>Video hinzufügen</Button>}
```

**Rationale:**
- Code bleibt intakt für spätere Nutzung
- Einfaches Toggle via Feature Flags
- Funktionen werden über alternative UI zugänglich (Plus-Icon, Drag & Drop)

#### 2. Videotabelle: Redesign

**Aktionen-Spalte → 3-Punkt-Menü:**
```tsx
// Remove "Actions" column
// Add ThreeDotsMenu in each row

<TableCell>
  <DropdownMenu>
    <DropdownMenuTrigger>
      <IconButton aria-label="Aktionen">
        <MoreVerticalIcon />  {/* ⋮ */}
      </IconButton>
    </DropdownMenuTrigger>

    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => handleDelete(video.id)}>
        <TrashIcon /> Löschen
      </DropdownMenuItem>
      {/* Future: Tags bearbeiten, Teilen, etc. */}
    </DropdownMenuContent>
  </DropdownMenu>
</TableCell>
```

**Gesamte Zeile klickbar:**
```tsx
<TableRow
  onClick={() => handleRowClick(video)}
  className="cursor-pointer hover:bg-accent"
  role="button"
  tabIndex={0}
>
  {/* Prevent click on 3-dot menu */}
  <TableCell onClick={(e) => e.stopPropagation()}>
    <ThreeDotsMenu />
  </TableCell>
</TableRow>
```

#### 3. Settings-Dropdown

**Position:** Rechts im Tabellen-Header

**Komponente: `TableSettingsDropdown.tsx`**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <IconButton aria-label="Einstellungen">
      <SettingsIcon />  {/* ⚙️ */}
    </IconButton>
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end" className="w-64">
    {/* Thumbnail Size */}
    <DropdownMenuLabel>Thumbnail-Größe</DropdownMenuLabel>
    <DropdownMenuRadioGroup value={thumbnailSize} onValueChange={setThumbnailSize}>
      <DropdownMenuRadioItem value="small">Klein</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="medium">Mittel</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="large">Groß</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>

    <DropdownMenuSeparator />

    {/* Export Options */}
    <DropdownMenuLabel>Exportieren</DropdownMenuLabel>
    <DropdownMenuItem onClick={exportFiltered}>
      Gefilterte Videos exportieren
    </DropdownMenuItem>
    <DropdownMenuItem onClick={exportAll}>
      Alle Videos exportieren
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    {/* Column Visibility */}
    <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
    <DropdownMenuCheckboxItem checked={columns.thumbnail} onCheckedChange={...}>
      Thumbnail
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem checked={columns.title} onCheckedChange={...}>
      Titel
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem checked={columns.channel} onCheckedChange={...}>
      Channel
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem checked={columns.duration} onCheckedChange={...}>
      Duration
    </DropdownMenuCheckboxItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**State Management:**
```tsx
interface TableSettings {
  thumbnailSize: 'small' | 'medium' | 'large';
  visibleColumns: {
    thumbnail: boolean;
    title: boolean;
    channel: boolean;
    duration: boolean;
  };
}

const useTableSettingsStore = create<TableSettings>(
  persist(
    (set) => ({
      thumbnailSize: 'small',
      visibleColumns: {
        thumbnail: true,
        title: true,
        channel: true,
        duration: true,
      },
      // ... setters
    }),
    { name: 'videoTableSettings' }  // LocalStorage key
  )
);
```

#### 4. Thumbnail-Größen-System

**CSS-Klassen:**
```css
.thumbnail-sm {
  width: 160px;
  height: 90px;   /* 16:9 aspect ratio */
}

.thumbnail-md {
  width: 240px;
  height: 135px;
}

.thumbnail-lg {
  width: 640px;
  height: 360px;
}
```

**Layout bei "Groß" (mehr Spalten nutzen):**
```tsx
// When thumbnailSize === 'large', use different row layout
{thumbnailSize === 'large' ? (
  <TableRow className="large-thumbnail-row">
    <TableCell className="thumbnail-cell">
      <img src={thumbnail} className="thumbnail-lg" />
    </TableCell>
    <TableCell className="metadata-cell">
      {/* More horizontal space for metadata */}
      <div className="metadata-grid">
        <div>Titel: {title}</div>
        <div>Channel: {channel}</div>
        <div>Duration: {duration}</div>
        <div>Published: {publishedAt}</div>
        <div>Tags: {tags.join(', ')}</div>
      </div>
    </TableCell>
  </TableRow>
) : (
  <TableRow>
    {/* Standard layout */}
  </TableRow>
)}
```

#### 5. Delete-Modal

**Komponente: `ConfirmDeleteModal.tsx`**
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Video löschen?</DialogTitle>
      <DialogDescription>
        Video "{videoTitle}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>
        Abbrechen
      </Button>
      <Button variant="destructive" onClick={onConfirm}>
        Löschen
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Ersetze Browser-Toast:**
```tsx
// Old (remove):
toast.success('Video gelöscht');

// New (replace with modal):
const [deleteModalOpen, setDeleteModalOpen] = useState(false);
const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);

const handleDelete = (video: Video) => {
  setVideoToDelete(video);
  setDeleteModalOpen(true);
};

const confirmDelete = async () => {
  await deleteVideo(videoToDelete.id);
  setDeleteModalOpen(false);
  // Optional: success toast after deletion
};
```

#### 6. Plus-Icon für Upload

**Position:** Oben rechts über der Tabelle (neben Settings-Icon)

```tsx
<div className="table-header">
  <h2>Videos</h2>  {/* Or selected tag names */}

  <div className="header-actions">
    <IconButton onClick={openAddVideoDialog} aria-label="Video hinzufügen">
      <PlusIcon />
    </IconButton>

    <TableSettingsDropdown />
  </div>
</div>
```

**Dialog öffnet bisherige "Video hinzufügen" Funktion:**
```tsx
const AddVideoDialog = () => (
  <Dialog>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Video hinzufügen</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <Input
          placeholder="YouTube URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button type="submit">Hinzufügen</Button>
      </form>
    </DialogContent>
  </Dialog>
);
```

### Testing

**Frontend Tests:**
```tsx
// TableSettingsDropdown.test.tsx
test('changes thumbnail size on selection', ...)
test('persists settings to localStorage', ...)
test('exports filtered videos when selected', ...)

// ConfirmDeleteModal.test.tsx
test('shows video title in confirmation', ...)
test('cancels delete on cancel button', ...)
test('deletes video on confirm button', ...)

// VideosPage.test.tsx
test('entire row is clickable except 3-dot menu', ...)
test('opens add video dialog on plus icon', ...)
```

### Erfolgskriterium
✅ User klickt Settings → Thumbnail "Groß" → Mehr Spalten sichtbar → Zeile klickt → Video öffnet → 3-Punkt-Menü → Löschen → Modal erscheint

### Geschätzter Aufwand
**Frontend:** 5-7 Stunden
**Testing:** 2-3 Stunden
**Total:** 7-10 Stunden

---

## 🌊 Welle 3: Advanced Features (CSV, Drag & Drop, Auto-Tagging)

### Ziel
CSV-Optimierung, Drag & Drop, Auto-Tagging, Spalten-Konfiguration.

### Backend-Änderungen

#### 1. CSV Import-Optimierung

**Intelligente Field-Detection:**
```python
# app/services/csv_service.py

async def process_csv_import(
    file: UploadFile,
    list_id: UUID,
    active_tag_ids: list[UUID] = []
) -> dict:
    """
    Import CSV with smart field detection.
    Only fetch missing fields from YouTube API.
    """
    df = pd.read_csv(file.file)

    # Detect available columns
    available_fields = set(df.columns)
    required_fields = {'video_id', 'title', 'channel', 'thumbnail_url', 'duration'}
    missing_fields = required_fields - available_fields

    videos_to_create = []

    for _, row in df.iterrows():
        video_id = row['video_id']

        # Check if video still exists (lightweight validation)
        if len(videos_to_create) % 50 == 0:  # Batch check every 50 videos
            video_ids_batch = df['video_id'][_:_+50].tolist()
            exists_map = await youtube_client.check_videos_exist(video_ids_batch)

            if not exists_map.get(video_id):
                logger.warning(f"Video {video_id} no longer exists, skipping")
                continue

        # Use CSV data if available, otherwise fetch from API
        if missing_fields:
            # Fetch only missing fields
            metadata = await youtube_client.get_video_metadata(
                video_id,
                fields=list(missing_fields)
            )
            video_data = {**row.to_dict(), **metadata}
        else:
            # Use all CSV data, no API call needed
            video_data = row.to_dict()

        videos_to_create.append({
            **video_data,
            'list_id': list_id,
            'tag_ids': active_tag_ids,  # Auto-tagging
        })

    # Bulk insert
    await video_repository.bulk_create(videos_to_create)

    return {
        'total': len(df),
        'imported': len(videos_to_create),
        'skipped': len(df) - len(videos_to_create),
        'api_calls': len(missing_fields) > 0,
    }
```

**YouTube Client: Batch Existence Check:**
```python
# app/services/youtube_client.py

async def check_videos_exist(self, video_ids: list[str]) -> dict[str, bool]:
    """
    Batch check if videos exist and are public.
    1 API call for up to 50 videos.
    """
    response = await self.client.videos().list(
        part='id',
        id=','.join(video_ids),
        maxResults=50
    ).execute()

    existing_ids = {item['id'] for item in response.get('items', [])}
    return {vid: vid in existing_ids for vid in video_ids}
```

#### 2. CSV Export-Erweiterung

**Export mit ALLEN Feldern:**
```python
# app/api/videos.py

@router.get("/export")
async def export_videos(
    list_id: UUID | None = None,
    tag_ids: list[UUID] = Query(default=[]),
    export_all: bool = False,
    current_user: User = Depends(get_current_user)
) -> StreamingResponse:
    """
    Export videos to CSV with all available fields.

    Args:
        list_id: Optional list filter
        tag_ids: Optional tag filters (OR logic)
        export_all: If True, export all videos regardless of filters
    """
    query = select(Video).where(Video.user_id == current_user.id)

    if not export_all:
        if list_id:
            query = query.where(Video.list_id == list_id)
        if tag_ids:
            query = query.join(video_tags).where(video_tags.c.tag_id.in_(tag_ids))

    videos = await db.execute(query)

    # Include ALL fields for re-import without API calls
    df = pd.DataFrame([
        {
            'video_id': v.video_id,
            'title': v.title,
            'channel': v.channel_name,
            'thumbnail_url': v.thumbnail_url,
            'duration': v.duration,
            'published_at': v.published_at.isoformat() if v.published_at else None,
            'view_count': v.view_count,
            'description': v.description,
            'tags': ','.join([t.name for t in v.tags]),  # Comma-separated tags
        }
        for v in videos.scalars()
    ])

    # Stream CSV
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=videos_{datetime.now():%Y%m%d}.csv"}
    )
```

### Frontend-Änderungen

#### 1. Drag & Drop System

**Smart Drop-Zone Component:**
```tsx
// components/SmartDropZone.tsx

const SmartDropZone = ({
  hasVideos,
  onUrlDrop,
  onCsvDrop
}: SmartDropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Check for files (CSV)
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        await onCsvDrop(file);
        return;
      }
    }

    // Check for text (URLs)
    const text = e.dataTransfer.getData('text/plain');
    const urls = extractYouTubeUrls(text);
    if (urls.length > 0) {
      await onUrlDrop(urls);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'drop-zone',
        isDragging && 'drop-zone-active',
        !hasVideos && 'drop-zone-empty'  // Show permanently when empty
      )}
    >
      {(!hasVideos || isDragging) && (
        <div className="drop-zone-content">
          <UploadIcon className="w-12 h-12" />
          <p>Videos oder CSV hier ablegen</p>
        </div>
      )}

      {/* Video table rendered inside */}
      {children}
    </div>
  );
};
```

**CSS:**
```css
.drop-zone {
  position: relative;
  min-height: 400px;
}

.drop-zone-empty {
  /* Always show drop zone when no videos */
  display: flex;
  justify-content: center;
  align-items: center;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  background: var(--accent-bg);
}

.drop-zone-active {
  /* Ghost overlay when dragging over existing videos */
  border: 2px dashed var(--primary);
  background: rgba(59, 130, 246, 0.1);
}

.drop-zone-content {
  pointer-events: none;
  text-align: center;
  z-index: 10;
}
```

**URL Extraction Utility:**
```tsx
// utils/extractYouTubeUrls.ts

const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

export const extractYouTubeUrls = (text: string): string[] => {
  const matches = text.matchAll(YOUTUBE_URL_REGEX);
  return Array.from(matches, m => m[0]);
};
```

#### 2. Auto-Tagging bei Upload

**Integration mit Tag-Filter-State:**
```tsx
// VideosPage.tsx

const { selectedTagIds } = useTagFilterStore();

const handleVideoUpload = async (url: string) => {
  // Upload video with currently active tags
  await addVideo({
    url,
    list_id: currentListId,
    tag_ids: selectedTagIds,  // Auto-assign active tags
  });

  // Show toast with applied tags
  if (selectedTagIds.length > 0) {
    const tagNames = tags
      .filter(t => selectedTagIds.includes(t.id))
      .map(t => t.name)
      .join(', ');

    toast.success(`Video hinzugefügt mit Tags: ${tagNames}`);
  }
};
```

**Backend: Auto-Tagging in Endpoints:**
```python
# app/api/videos.py

@router.post("/lists/{list_id}/videos")
async def add_video_to_list(
    list_id: UUID,
    video: VideoCreate,
    tag_ids: list[UUID] = [],  # Optional auto-tags
    current_user: User = Depends(get_current_user)
):
    # Create video
    new_video = await video_service.create_video(
        video_id=video.video_id,
        list_id=list_id,
        user_id=current_user.id
    )

    # Auto-assign tags if provided
    if tag_ids:
        await video_service.assign_tags(new_video.id, tag_ids)

    return new_video
```

#### 3. Spalten-Konfiguration

**TanStack Table Column Visibility:**
```tsx
// VideosPage.tsx with TanStack Table

const { visibleColumns } = useTableSettingsStore();

const columns = useMemo(() => [
  {
    id: 'thumbnail',
    accessorKey: 'thumbnail_url',
    header: 'Thumbnail',
    cell: (info) => <img src={info.getValue()} />,
    enableHiding: true,  // Can be toggled
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: 'Titel',
    enableHiding: true,
  },
  {
    id: 'channel',
    accessorKey: 'channel_name',
    header: 'Channel',
    enableHiding: true,
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Duration',
    cell: (info) => formatDuration(info.getValue()),
    enableHiding: true,
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: 'Tags',
    cell: (info) => <TagChips tags={info.getValue()} />,
    enableHiding: true,
  },
], []);

const table = useReactTable({
  data: videos,
  columns,
  state: {
    columnVisibility: visibleColumns,  // From settings store
  },
  onColumnVisibilityChange: setVisibleColumns,
});
```

**Tag-Chips Component:**
```tsx
// components/TagChips.tsx

const TagChips = ({ tags }: { tags: Tag[] }) => (
  <div className="flex gap-1 flex-wrap">
    {tags.map(tag => (
      <Badge
        key={tag.id}
        variant="secondary"
        style={{ backgroundColor: tag.color }}
        className="cursor-pointer"
        onClick={() => handleTagClick(tag.id)}  // Filter by tag
      >
        {tag.name}
      </Badge>
    ))}
  </div>
);
```

#### 4. Export-Integration

**Settings-Dropdown Actions:**
```tsx
const handleExportFiltered = async () => {
  const { selectedTagIds } = useTagFilterStore.getState();

  const params = new URLSearchParams({
    export_all: 'false',
    tag_ids: selectedTagIds.join(','),
  });

  const response = await fetch(`/api/videos/export?${params}`);
  const blob = await response.blob();
  downloadFile(blob, `videos_filtered_${Date.now()}.csv`);

  toast.success(`${filteredCount} Videos exportiert`);
};

const handleExportAll = async () => {
  const response = await fetch('/api/videos/export?export_all=true');
  const blob = await response.blob();
  downloadFile(blob, `videos_all_${Date.now()}.csv`);

  toast.success('Alle Videos exportiert');
};
```

### Testing

**Backend Tests:**
```python
# test_csv_import.py
def test_csv_import_with_all_fields_no_api_calls():
    # CSV with all required fields
    # Verify no YouTube API calls made

def test_csv_import_with_missing_fields_calls_api():
    # CSV with only video_id
    # Verify YouTube API called for metadata

def test_csv_import_validation_skip_deleted_videos():
    # CSV with deleted video IDs
    # Verify skipped count in response

# test_export.py
def test_export_filtered_videos_by_tags():
    # Export with tag_ids filter
    # Verify only matching videos in CSV

def test_export_all_videos_includes_all_fields():
    # Export all
    # Verify CSV has all columns
```

**Frontend Tests:**
```tsx
// SmartDropZone.test.tsx
test('shows drop zone when no videos exist', ...)
test('shows ghost overlay on drag over with videos', ...)
test('extracts YouTube URLs from dropped text', ...)
test('accepts CSV file drop', ...)

// AutoTagging.test.tsx
test('assigns active tags to uploaded video', ...)
test('shows toast with assigned tag names', ...)

// TableSettings.test.tsx
test('toggles column visibility', ...)
test('exports filtered videos with active tags', ...)
test('exports all videos when selected', ...)
```

### Erfolgskriterium
✅ User wählt Tag "Python" → Zieht CSV mit 50 Videos → Nur fehlende Felder geholt → Alle Videos haben "Python" Tag → Export enthält alle Felder → Re-Import ohne API-Calls

### Geschätzter Aufwand
**Backend:** 4-5 Stunden
**Frontend:** 5-6 Stunden
**Testing:** 3-4 Stunden
**Total:** 12-15 Stunden

---

## 📊 Gesamt-Übersicht

### Zeitaufwand
| Welle | Aufwand | Kumulativ |
|-------|---------|-----------|
| Welle 1: Tag-System & Layout | 9-12h | 9-12h |
| Welle 2: UI-Cleanup & UX | 7-10h | 16-22h |
| Welle 3: Advanced Features | 12-15h | 28-37h |

**Total:** 28-37 Stunden (ca. 4-5 Arbeitstage)

### Abhängigkeiten
- Welle 2 benötigt Welle 1 (Tag-System für Auto-Tagging)
- Welle 3 benötigt Welle 1 & 2 (Layout + Settings für Export)

### Risiken
| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| TanStack Table Column Visibility komplex | Mittel | Einfache CSS-basierte Alternative vorbereiten |
| Drag & Drop Browser-Kompatibilität | Niedrig | Polyfill für ältere Browser, Feature Detection |
| CSV Import Performance bei 1000+ Videos | Mittel | Batch-Processing, Progress-Indicator, Background Jobs |
| Tag-Filter-Performance bei vielen Tags | Niedrig | Database-Index auf video_tags, Query-Optimierung |

---

## 🎯 Erfolgskriterien (Gesamt)

### Welle 1
- [x] Tag erstellen/bearbeiten/löschen funktioniert
- [x] Videos können Tags zugewiesen werden
- [x] Filter nach Tags funktioniert (OR-Logik)
- [x] 2-Spalten-Layout responsiv
- [x] Sidebar kollapsierbar

### Welle 2
- [x] Settings-Dropdown mit allen Optionen
- [x] Thumbnail-Größen änderbar (3 Stufen)
- [x] Groß-Modus nutzt mehr Spalten
- [x] Delete-Modal statt Toast
- [x] 3-Punkt-Menü in jeder Zeile
- [x] Gesamte Zeile klickbar
- [x] Plus-Icon öffnet Upload-Dialog

### Welle 3
- [x] Drag & Drop für URLs funktioniert
- [x] Drag & Drop für CSV funktioniert
- [x] Smart Drop-Zone (leer vs. ghost)
- [x] CSV Import nur fehlende Felder holen
- [x] CSV Export mit allen Feldern
- [x] Auto-Tagging bei aktivem Filter
- [x] Spalten-Konfiguration funktioniert
- [x] Tags als Chips in Tabelle

---

## 🔄 Migration & Backwards Compatibility

### Listen-Migration
```python
# Alembic migration: 2025_10_31_delete_extra_lists

def upgrade():
    # Keep first list per user, delete rest
    conn.execute("""
        DELETE FROM lists
        WHERE id NOT IN (
            SELECT DISTINCT ON (user_id) id
            FROM lists
            ORDER BY user_id, created_at ASC
        )
    """)

    # Note: lists table structure remains intact
    # API endpoints remain functional

def downgrade():
    # Cannot restore deleted lists
    pass
```

### API Backwards Compatibility
- Listen-Endpoints bleiben bestehen (`/api/lists`)
- Dashboard-Endpoint bleibt bestehen
- UI entfernt nur Navigation-Links, nicht API-Funktionen

---

## 📝 Nächste Schritte nach Welle 3

### Mögliche Erweiterungen
1. **Batch-Tag-Assignment:** Mehrere Videos auf einmal taggen
2. **Tag-Hierarchien:** Parent/Child-Tags (z.B. "Python" → "FastAPI")
3. **Smart-Tags:** AI-basierte Tag-Vorschläge
4. **Workspaces:** Listen als gespeicherte Tag-Kombinationen reaktivieren
5. **Keyboard-Shortcuts:** Tag-Filter mit Hotkeys
6. **Tag-Colors:** Farbliche Kategorisierung

---

## 🔗 Verweise

**Basiert auf:**
- `docs/pivot/product-vision-v2.md` - Consumer-App Vision
- `docs/plans/2025-10-30-consumer-app-roadmap.md` - Roadmap
- `docs/handoffs/2025-10-31-phase-1a-task-3-e2e-testing-complete.md` - Aktueller Stand

**Implementierungs-Details:**
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Frontend: React, TypeScript, TanStack Table, Zustand
- UI: Tailwind CSS, shadcn/ui components

---

**Dokument-Version:** 1.0
**Erstellt:** 2025-10-31
**Status:** Design Complete - Ready for Implementation
**Nächster Schritt:** Worktree Setup + Implementation Plan (Welle 1)
