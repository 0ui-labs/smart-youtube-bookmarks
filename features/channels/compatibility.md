# Backward-Compatibility Analyse

## Zusammenfassung

**Risiko-Level: NIEDRIG**

Das Channel-Feature ist vollständig backward-compatible. Bestehende Funktionalität wird nicht beeinträchtigt.

## Compatibility Checklist

- [x] Bestehende API-Contracts unverändert
- [x] Datenbank-Migration ist non-breaking
- [x] Bestehende UI-Flows funktionieren weiterhin
- [x] Keine Änderungen an public Interfaces
- [x] Feature kann ohne Breaking Changes deaktiviert werden

## Detaillierte Analyse

### 1. Datenbank-Migration

**Änderung:** Neue `channels` Tabelle + `channel_id` FK in `videos`

**Warum non-breaking:**
```sql
-- channel_id ist NULLABLE
ALTER TABLE videos ADD COLUMN channel_id UUID REFERENCES channels(id);

-- ON DELETE SET NULL: Wenn Channel gelöscht wird → Video bleibt
FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
```

**Bestehende Videos:**
- Behalten `channel_id = NULL` nach Migration
- Werden erst bei nächstem Update (z.B. Metadata-Refresh) verknüpft
- Oder: Optionales Backfill-Script für bestehende Videos

**Backfill-Strategie (optional):**
```python
async def backfill_channels():
    """
    Nachträgliche Kanal-Erstellung für bestehende Videos.
    Kann als one-time Script oder Background-Job laufen.
    """
    # 1. Alle unique channel names aus videos holen
    unique_channels = await db.execute(
        select(Video.channel, Video.user_id)
        .where(Video.channel.isnot(None))
        .where(Video.channel_id.is_(None))
        .distinct()
    )

    # 2. Für jeden Channel: YouTube API aufrufen um channelId zu holen
    # 3. Channel erstellen und Videos verknüpfen
```

### 2. API Endpoints

**Bestehende Endpoints:**

| Endpoint | Änderung | Kompatibilität |
|----------|----------|----------------|
| `GET /videos` | Keine | ✅ Unverändert |
| `POST /videos` | Keine | ✅ Unverändert |
| `POST /videos/filter` | Neuer optionaler Parameter | ✅ Backward-compatible |
| `GET /tags` | Keine | ✅ Unverändert |

**Neue Endpoints:**

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /channels` | NEU - beeinflusst bestehende nicht |
| `PATCH /channels/{id}` | NEU |
| `DELETE /channels/{id}` | NEU |

**Filter-API Erweiterung:**

```python
# Vorher
class VideoFilterRequest(BaseModel):
    tags: Optional[List[str]] = None
    field_filters: Optional[List[FieldFilter]] = None

# Nachher (backward-compatible)
class VideoFilterRequest(BaseModel):
    tags: Optional[List[str]] = None
    channel_id: Optional[UUID] = None  # NEU, aber OPTIONAL
    field_filters: Optional[List[FieldFilter]] = None
```

**Alte Requests funktionieren weiterhin:**
```json
// Alt (funktioniert weiterhin)
{ "tags": ["Python"] }

// Neu (optional)
{ "tags": ["Python"], "channel_id": "uuid-here" }
```

### 3. Video Response Schema

**Bestehende Felder bleiben:**
```python
class VideoResponse(BaseModel):
    id: UUID
    youtube_id: str
    title: Optional[str]
    channel: Optional[str]  # BLEIBT (String)
    # ...
```

**Neue Felder sind optional:**
```python
class VideoResponse(BaseModel):
    # ... existing ...
    channel_id: Optional[UUID] = None  # NEU, aber optional
    channel_ref: Optional[ChannelResponse] = None  # NEU, aber optional
```

**Frontend Handling:**
```typescript
// Alt (funktioniert weiterhin)
video.channel  // "MrBeast"

// Neu (optional, graceful fallback)
video.channel_ref?.name ?? video.channel  // "MrBeast"
```

### 4. Frontend State

**Bestehende Stores unverändert:**
- `tagStore.ts` - keine Änderungen
- `fieldFilterStore.ts` - keine Änderungen
- `tableSettingsStore.ts` - nur Erweiterung (neues Feld)

**tableSettingsStore Erweiterung:**
```typescript
// Zustand persist middleware handles new fields gracefully
// Existing localStorage data is merged with new defaults
{
  thumbnailSize: 'small',
  viewMode: 'list',
  showChannelAvatars: false,  // NEU - default false
}
```

### 5. UI Components

**Bestehende Components unverändert:**
- `TagNavigation.tsx` - keine Änderungen
- `VideoGrid.tsx` - nur Erweiterung (neuer onClick)
- `VideoCard.tsx` - nur Erweiterung

**Sidebar-Erweiterung ist additiv:**
```tsx
<CollapsibleSidebar>
  <TagNavigation ... />  // Unverändert
  <ChannelNavigation ... />  // NEU - zusätzlich
  <Button>Einstellungen</Button>
</CollapsibleSidebar>
```

### 6. URL Query Parameters

**Bestehende Parameter bleiben:**
- `?tags=Python,React` - funktioniert weiterhin
- `?sort_by=title&sort_order=asc` - funktioniert weiterhin

**Neuer Parameter ist additiv:**
- `?channel=uuid-here` - NEU, aber optional

**Kombination möglich:**
- `?tags=Python&channel=uuid-here` - Tags UND Channel Filter

## Migrations-Strategie

### Phase 1: Schema-Migration (Day 1)
```sql
-- Non-breaking: Neue Tabelle, nullable FK
CREATE TABLE channels (...);
ALTER TABLE videos ADD COLUMN channel_id UUID;
```

### Phase 2: Feature Deploy (Day 1)
- Neue API Endpoints aktiv
- Frontend zeigt leere Channel-Liste (noch keine Channels)
- Bestehende Funktionalität 100% unverändert

### Phase 3: Automatische Befüllung (Day 1+)
- Neue Videos erstellen Channels automatisch
- Bestehende Videos bleiben `channel_id = NULL`

### Phase 4: Optional Backfill (später)
- Script läuft im Hintergrund
- Verknüpft bestehende Videos mit Channels
- Kann jederzeit pausiert/resumed werden

## Rollback-Plan

**Falls Probleme auftreten:**

### Datenbank Rollback
```sql
-- Channel FK entfernen (Videos bleiben)
ALTER TABLE videos DROP COLUMN channel_id;

-- Channel Tabelle entfernen
DROP TABLE channels;
```

### Code Rollback
- Frontend: ChannelNavigation ausblenden via Feature Flag
- Backend: Channel Endpoints deaktivieren
- Bestehende Funktionalität 100% erhalten

## Kompatibilitäts-Garantien

| Aspekt | Garantie |
|--------|----------|
| Bestehende Videos | Bleiben unverändert |
| Bestehende Tags | Funktionieren weiterhin |
| Bestehende Filter | Funktionieren weiterhin |
| API Responses | Erweitert, nicht geändert |
| localStorage | Merged mit neuen Defaults |
| URL Parameter | Erweitert, nicht geändert |

## Deprecation Plan

**`video.channel` (String) → `video.channel_ref.name`**

- **Phase 1:** Beide parallel verfügbar (aktueller Plan)
- **Phase 2:** Frontend nutzt `channel_ref` mit Fallback auf `channel`
- **Phase 3:** (Später) `channel` String deprecaten
- **Phase 4:** (Viel später) `channel` String entfernen

**Kein Zeitdruck:** Die String-Spalte stört nicht und kann beliebig lange bleiben.
