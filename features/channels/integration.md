# Integrationsstrategie: YouTube-Kanäle Feature

## Strategie-Überblick

**Ansatz:** Inkrementelle Integration mit Feature-Flag

Das Channel-Feature wird in Schichten implementiert:
1. **Daten-Schicht:** Model, Migration, YouTube-Client
2. **API-Schicht:** Endpoints, Filter-Erweiterung
3. **UI-Schicht:** Sidebar, Video-Items, Settings

Jede Schicht ist unabhängig testbar, bevor die nächste beginnt.

## Integrationspunkte im Detail

### 1. YouTube Client → Channel-Daten extrahieren

**Datei:** `backend/app/clients/youtube.py`

**Aktuelle Stelle (Zeile 149-153):**
```python
metadata: VideoMetadata = {
    "video_id": video_id,
    "title": snippet["title"],
    "channel": snippet["channelTitle"],  # ← Nur Name
    ...
}
```

**Integration:**
```python
metadata: VideoMetadata = {
    "video_id": video_id,
    "title": snippet["title"],
    "channel": snippet["channelTitle"],
    "channel_id": snippet["channelId"],  # ← NEU: YouTube Channel ID
    "channel_thumbnail": snippet.get("thumbnails", {}).get("default", {}).get("url"),  # Optional
    ...
}
```

**TypedDict erweitern:**
```python
class VideoMetadata(TypedDict, total=False):
    # ... existing fields ...
    channel_id: str  # NEU
    channel_thumbnail: str  # NEU (optional)
```

---

### 2. Video Processor → Auto-Create Channel

**Datei:** `backend/app/workers/video_processor.py`

**Integrationspunkt:** Nach dem Abrufen der YouTube-Metadaten

**Logik:**
```python
async def process_video(video_id: str, list_id: str, user_id: str):
    # 1. YouTube Metadaten abrufen
    metadata = await youtube_client.get_video_metadata(video_id)

    # 2. NEU: Channel finden oder erstellen
    channel = await get_or_create_channel(
        user_id=user_id,
        youtube_channel_id=metadata["channel_id"],
        channel_name=metadata["channel"],
        channel_thumbnail=metadata.get("channel_thumbnail")
    )

    # 3. Video mit Channel verknüpfen
    video.channel_id = channel.id

    # 4. Rest der Verarbeitung...
```

**Helper-Funktion:**
```python
async def get_or_create_channel(
    db: AsyncSession,
    user_id: UUID,
    youtube_channel_id: str,
    channel_name: str,
    channel_thumbnail: Optional[str] = None
) -> Channel:
    """
    Atomare Upsert-Operation für Channels.
    Erstellt neuen Channel oder gibt existierenden zurück.
    """
    # Check if channel exists for this user
    existing = await db.execute(
        select(Channel).where(
            Channel.user_id == user_id,
            Channel.youtube_channel_id == youtube_channel_id
        )
    )
    channel = existing.scalar_one_or_none()

    if channel:
        # Update name if changed on YouTube
        if channel.name != channel_name:
            channel.name = channel_name
        return channel

    # Create new channel
    channel = Channel(
        user_id=user_id,
        youtube_channel_id=youtube_channel_id,
        name=channel_name,
        thumbnail_url=channel_thumbnail
    )
    db.add(channel)
    await db.flush()  # Get ID without committing
    return channel
```

---

### 3. Video Model → Channel FK

**Datei:** `backend/app/models/video.py`

**Integration nach Zeile 27:**
```python
# Existing
channel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

# NEU: Foreign Key zu Channel
channel_id: Mapped[Optional[UUID]] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("channels.id", ondelete="SET NULL"),
    nullable=True,
    index=True
)

# NEU: Relationship
channel_ref: Mapped[Optional["Channel"]] = relationship(
    "Channel",
    back_populates="videos",
    lazy="raise"  # Explizite Loads erzwingen
)
```

**Hinweis:** `channel` (String) bleibt für Backward-Compatibility. Kann später entfernt werden.

---

### 4. Filter API → Channel-Filter

**Datei:** `backend/app/api/videos.py`

**Aktuelles Filter-Schema:**
```python
class VideoFilterRequest(BaseModel):
    tags: Optional[List[str]] = None
    field_filters: Optional[List[FieldFilter]] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = "asc"
```

**Erweiterung:**
```python
class VideoFilterRequest(BaseModel):
    tags: Optional[List[str]] = None
    channel_id: Optional[UUID] = None  # NEU
    field_filters: Optional[List[FieldFilter]] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = "asc"
```

**Query-Erweiterung:**
```python
if filter_request.channel_id:
    query = query.where(Video.channel_id == filter_request.channel_id)
```

---

### 5. Frontend: Sidebar Integration

**Datei:** `frontend/src/components/VideosPage.tsx`

**Aktuell (Zeile 762-775):**
```tsx
<CollapsibleSidebar>
  <div className="flex flex-col h-full">
    {/* TagNavigation */}
    <TagNavigation ... />

    {/* Settings Button */}
    <div className="mt-auto pt-4 border-t">
      <Button>Einstellungen</Button>
    </div>
  </div>
</CollapsibleSidebar>
```

**Mit Channel-Integration:**
```tsx
<CollapsibleSidebar>
  <div className="flex flex-col h-full">
    {/* TagNavigation - Kategorien */}
    <TagNavigation ... />

    {/* NEU: ChannelNavigation - Kanäle */}
    <ChannelNavigation
      channels={channels}
      selectedChannelId={selectedChannelId}
      onChannelSelect={handleChannelSelect}
      showAvatars={showChannelAvatars}
    />

    {/* Settings Button */}
    <div className="mt-auto pt-4 border-t">
      <Button>Einstellungen</Button>
    </div>
  </div>
</CollapsibleSidebar>
```

---

### 6. Frontend: Video-Items klickbar machen

**Datei:** `frontend/src/components/VideosPage.tsx` (Table View)

**Aktuell (Zeile 501-504):**
```tsx
{channel && (
  <span className="text-sm text-gray-600 truncate">
    {channel}
  </span>
)}
```

**Mit Channel-Link:**
```tsx
{video.channel_ref && (
  <button
    onClick={(e) => {
      e.stopPropagation();  // Verhindert Row-Click
      handleChannelSelect(video.channel_ref.id);
    }}
    className="text-sm text-gray-600 hover:text-blue-600 hover:underline truncate"
  >
    {video.channel_ref.name}
  </button>
)}
```

---

### 7. Frontend: Filter-Hook erweitern

**Datei:** `frontend/src/hooks/useVideosFilter.ts`

**Interface erweitern:**
```typescript
interface UseVideosFilterOptions {
  listId: string;
  tags?: string[];
  channelId?: string;  // NEU
  fieldFilters?: ActiveFilter[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
}
```

**Request Body erweitern:**
```typescript
const requestBody = {
  tags: tags?.length ? tags : undefined,
  channel_id: channelId || undefined,  // NEU
  field_filters: backendFilters?.length ? backendFilters : undefined,
  sort_by: sortBy,
  sort_order: sortOrder,
};
```

---

### 8. Channel Store

**Neue Datei:** `frontend/src/stores/channelStore.ts`

**Pattern von tagStore übernehmen:**
```typescript
interface ChannelStore {
  selectedChannelId: string | null;  // Single-Select (nicht Array wie bei Tags)

  selectChannel: (channelId: string) => void;
  clearChannel: () => void;
}

export const useChannelStore = create<ChannelStore>((set) => ({
  selectedChannelId: null,

  selectChannel: (channelId) => set({ selectedChannelId: channelId }),
  clearChannel: () => set({ selectedChannelId: null }),
}));
```

---

### 9. Settings: Avatar-Toggle

**Datei:** `frontend/src/stores/tableSettingsStore.ts`

**Erweiterung:**
```typescript
interface TableSettingsStore {
  // ... existing ...
  showChannelAvatars: boolean;  // NEU
  setShowChannelAvatars: (show: boolean) => void;  // NEU
}

// Default
showChannelAvatars: false,

// Action
setShowChannelAvatars: (show) => set({ showChannelAvatars: show }),
```

## Integration Reihenfolge

```
Phase 1: Daten-Fundament
├── 1.1 Channel Model erstellen
├── 1.2 Video Model erweitern (FK)
├── 1.3 DB Migration erstellen
└── 1.4 Migration ausführen

Phase 2: YouTube Integration
├── 2.1 YouTubeClient: channelId extrahieren
├── 2.2 VideoMetadata TypedDict erweitern
└── 2.3 Video Processor: get_or_create_channel

Phase 3: API Layer
├── 3.1 Channel Schemas (Pydantic)
├── 3.2 Channel API Endpoints
└── 3.3 Video Filter API erweitern

Phase 4: Frontend State
├── 4.1 Channel Types definieren
├── 4.2 useChannels Hook
├── 4.3 channelStore erstellen
└── 4.4 useVideosFilter erweitern

Phase 5: UI Components
├── 5.1 ChannelNavigation Component
├── 5.2 VideosPage: Sidebar Integration
├── 5.3 Video-Items: Klickbare Kanäle
└── 5.4 Settings: Avatar-Toggle

Phase 6: Polish
├── 6.1 URL-Sync für Channel-Filter
├── 6.2 Leere Kanäle auto-löschen
└── 6.3 Tests
```

## Feature Flag Strategie

**Empfehlung:** Kein Feature Flag nötig

Begründung:
- Sidebar zeigt nur Kanäle wenn welche existieren (natürliches "Feature Flag")
- Migration ist backward-compatible (nullable FK)
- Filter ist additiv (bestehendes Verhalten unverändert)

Alternative (falls gewünscht):
```typescript
// frontend/src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  // ... existing ...
  SHOW_CHANNELS_SIDEBAR: true,  // Für schrittweisen Rollout
}
```

## Interface Boundaries

### API Contract: GET /channels

```typescript
// Response
interface ChannelListResponse {
  channels: {
    id: string;
    youtube_channel_id: string;
    name: string;
    thumbnail_url: string | null;
    is_hidden: boolean;
    video_count: number;  // Aggregiert
  }[];
}
```

### API Contract: Video Filter erweitert

```typescript
// Request Body
interface VideoFilterRequest {
  tags?: string[];
  channel_id?: string;  // NEU
  field_filters?: FieldFilter[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
```

### Frontend → Backend Kommunikation

```
┌─────────────────┐     GET /channels      ┌─────────────────┐
│  ChannelNav     │ ──────────────────────▶ │  Channel API    │
│  Component      │ ◀────────────────────── │                 │
└─────────────────┘     ChannelList         └─────────────────┘

┌─────────────────┐   POST /videos/filter   ┌─────────────────┐
│ useVideosFilter │ ──────────────────────▶ │  Videos API     │
│     Hook        │ ◀────────────────────── │                 │
└─────────────────┘   + channel_id param    └─────────────────┘
```
