# Codebase-Analyse: YouTube-Kanäle Feature

## Architektur-Überblick

### Tech Stack
- **Backend:** FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend:** React + TypeScript + TanStack Query + Zustand
- **Styling:** Tailwind CSS + shadcn/ui

## Relevante bestehende Strukturen

### 1. Video Model (`backend/app/models/video.py`)

**Aktueller Stand:**
```python
channel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Zeile 27
```

**Problem:** Nur Kanalname als String gespeichert, keine `channel_id` von YouTube.

**YouTube API liefert aber:**
```python
# backend/app/clients/youtube.py Zeile 152-153
"channel": snippet["channelTitle"],  # ✓ wird gespeichert
# snippet["channelId"] wird NICHT extrahiert!
```

### 2. Tag Model (`backend/app/models/tag.py`)

**Pattern für Channel-Feature adaptierbar:**
```python
class Tag(BaseModel):
    name: Mapped[str]
    color: Mapped[Optional[str]]
    user_id: Mapped[PyUUID]  # User-scoped
    is_video_type: Mapped[bool]  # Category vs Label Unterscheidung
    schema_id: Mapped[Optional[PyUUID]]  # Optional Custom Fields
```

**Beziehung zu Videos:** Many-to-Many via `video_tags` Junction Table

**Unterschied zu Channels:**
| Aspekt | Tags | Channels |
|--------|------|----------|
| Beziehung | n:m (viele Tags pro Video) | 1:n (ein Kanal pro Video) |
| Erstellung | Manuell durch User | Automatisch aus YouTube |
| Änderung | User kann umbenennen | Durch YouTube vorgegeben |

### 3. TagNavigation Component (`frontend/src/components/TagNavigation.tsx`)

**Pattern für ChannelNavigation:**
```tsx
interface TagNavigationProps {
  tags: Tag[]
  selectedTagIds: string[]  // Multi-select
  onTagSelect: (tagId: string) => void
  onTagCreate: () => void  // Nicht für Channels nötig
}
```

**Anpassung für Channels:**
- `selectedTagIds` → `selectedChannelId` (Single-Select)
- `onTagCreate` entfällt (Channels werden automatisch erstellt)
- Badge mit Video-Count hinzufügen

### 4. Sidebar-Struktur (`frontend/src/components/VideosPage.tsx`)

**Aktueller Aufbau:**
```tsx
<CollapsibleSidebar>
  <TagNavigation ... />  // "Kategorien"
  <Button>Einstellungen</Button>
</CollapsibleSidebar>
```

**Erweiterung für Channels:**
```tsx
<CollapsibleSidebar>
  <TagNavigation ... />      // "Kategorien"
  <ChannelNavigation ... />  // "Kanäle" (NEU)
  <Button>Einstellungen</Button>
</CollapsibleSidebar>
```

### 5. Filter-System (`frontend/src/hooks/useVideosFilter.ts`)

**Aktueller Request-Body:**
```typescript
{
  tags?: string[];           // Tag-Namen (OR-Logik)
  field_filters?: FieldFilter[];  // Custom Fields (AND-Logik)
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
```

**Erweiterung für Channels:**
```typescript
{
  tags?: string[];
  channel_id?: string;       // NEU: Filter nach Kanal (Single)
  field_filters?: FieldFilter[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
```

### 6. Settings Store Pattern (`frontend/src/stores/tableSettingsStore.ts`)

**Bestehendes Pattern für User-Preferences:**
```typescript
export const useTableSettingsStore = create<TableSettingsStore>()(
  persist(
    (set) => ({
      thumbnailSize: 'small',
      viewMode: 'list',
      // ...
    }),
    {
      name: 'video-table-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**Nutzung für Channel-Avatar-Setting:**
- Neues Setting: `showChannelAvatars: boolean` (default: false)
- Gleicher Persist-Pattern

### 7. Video-Anzeige in List/Grid (`frontend/src/components/VideosPage.tsx`)

**Aktueller Kanal-Display (Zeile 501-504):**
```tsx
{channel && (
  <span className="text-sm text-gray-600 truncate">
    {channel}
  </span>
)}
```

**Anpassung:** Klickbar machen, `onClick` für Filter-Aktivierung

## Bestehende Models (Backend)

```
backend/app/models/
├── base.py           # BaseModel mit id, created_at, updated_at
├── user.py           # User Model
├── list.py           # BookmarkList (User's Video-Listen)
├── video.py          # Video mit YouTube-Metadaten
├── tag.py            # Tags + video_tags Junction Table
├── field_schema.py   # Schema für Custom Fields
├── custom_field.py   # Custom Field Definitionen
├── video_field_value.py  # Field Values pro Video
└── ...
```

## Naming Conventions

### Backend (Python)
- Models: `PascalCase` (z.B. `Video`, `Tag`)
- Columns: `snake_case` (z.B. `user_id`, `channel_name`)
- Relationships: `snake_case` plural (z.B. `videos`, `tags`)

### Frontend (TypeScript)
- Components: `PascalCase` (z.B. `TagNavigation.tsx`)
- Hooks: `camelCase` mit `use` Prefix (z.B. `useTags.ts`)
- Stores: `camelCase` mit `Store` Suffix (z.B. `tagStore.ts`)
- Types: `PascalCase` (z.B. `VideoResponse`)

## Ähnliche Features als Referenz

### Tag-Feature (Best Practice Referenz)
1. **Model:** `backend/app/models/tag.py`
2. **Schema:** `backend/app/schemas/tag.py`
3. **API:** `backend/app/api/tags.py`
4. **Frontend Hook:** `frontend/src/hooks/useTags.ts`
5. **Frontend Component:** `frontend/src/components/TagNavigation.tsx`
6. **Frontend Store:** `frontend/src/stores/tagStore.ts`

### Custom Fields Feature (Complex Feature Referenz)
- Zeigt Pattern für Schema-basierte Erweiterungen
- Field Values pro Video
- UI für Konfiguration in Settings

## Wichtige Erkenntnisse

### 1. Channel ID fehlt
Die YouTube API liefert `channelId`, aber es wird aktuell NICHT gespeichert. Dies muss im YouTube Client und Video Model ergänzt werden.

### 2. Kein User-Settings Model
User-Preferences werden aktuell nur frontend-seitig in localStorage gespeichert. Für `showChannelAvatars` kann das gleiche Pattern verwendet werden.

### 3. Filter-API erweiterbar
Das POST-Endpoint `/lists/{listId}/videos/filter` kann einfach um `channel_id` erweitert werden.

### 4. Channel als eigene Entity
Channels sollten NICHT als Tags modelliert werden wegen:
- Unterschiedliche Kardinalität (1:n vs n:m)
- Automatische vs manuelle Erstellung
- Unveränderliche vs editierbare Namen

## Dateien die geändert werden müssen

### Backend (Neue Dateien)
- `backend/app/models/channel.py` - Channel Model
- `backend/app/schemas/channel.py` - Pydantic Schemas
- `backend/app/api/channels.py` - API Endpoints

### Backend (Änderungen)
- `backend/app/models/video.py` - FK zu Channel
- `backend/app/models/__init__.py` - Channel exportieren
- `backend/app/clients/youtube.py` - channelId extrahieren
- `backend/app/api/videos.py` - Filter um channel erweitern
- `backend/alembic/versions/` - Migration

### Frontend (Neue Dateien)
- `frontend/src/components/ChannelNavigation.tsx`
- `frontend/src/hooks/useChannels.ts`
- `frontend/src/stores/channelStore.ts`
- `frontend/src/types/channel.ts`

### Frontend (Änderungen)
- `frontend/src/components/VideosPage.tsx` - Sidebar + Video-Items
- `frontend/src/hooks/useVideosFilter.ts` - channel_id Filter
- `frontend/src/stores/tableSettingsStore.ts` - showChannelAvatars
- `frontend/src/components/VideoGrid.tsx` - Klickbarer Kanal
