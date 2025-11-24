# Atomic Steps: YouTube-Kanäle Feature

Jeder Step ist:
- In 15-60 Minuten umsetzbar
- Ändert 1-3 Dateien
- Ist unabhängig committbar
- Hat einen klaren Test/Verifikation

---

## Phase 1: Daten-Fundament (Backend)

### Step 1.1: Channel Model erstellen
**Dateien:** `backend/app/models/channel.py` (NEU)
**Aufwand:** 15 min
**Test:** Model kann importiert werden, Felder sind definiert
```bash
python -c "from app.models.channel import Channel; print(Channel.__tablename__)"
```

### Step 1.2: Channel in Models __init__ exportieren
**Dateien:** `backend/app/models/__init__.py`
**Aufwand:** 5 min
**Test:** Import funktioniert
```bash
python -c "from app.models import Channel"
```

### Step 1.3: Video Model um channel_id FK erweitern
**Dateien:** `backend/app/models/video.py`
**Aufwand:** 15 min
**Test:** Model kompiliert ohne Fehler
```bash
python -c "from app.models.video import Video; print(hasattr(Video, 'channel_id'))"
```

### Step 1.4: User Model um channels Relationship erweitern
**Dateien:** `backend/app/models/user.py`
**Aufwand:** 10 min
**Test:** Relationship ist definiert
```bash
python -c "from app.models.user import User; print(hasattr(User, 'channels'))"
```

### Step 1.5: Alembic Migration generieren
**Dateien:** `backend/alembic/versions/xxx_add_channels.py` (NEU)
**Aufwand:** 10 min
**Test:** Migration-Datei wurde erstellt
```bash
alembic revision --autogenerate -m "add_channels_table"
ls backend/alembic/versions/ | grep channels
```

### Step 1.6: Migration Review und Korrektur
**Dateien:** `backend/alembic/versions/xxx_add_channels.py`
**Aufwand:** 15 min
**Test:** Migration kann im Dry-Run ausgeführt werden
```bash
alembic upgrade head --sql | head -50
```

### Step 1.7: Migration ausführen
**Aufwand:** 5 min
**Test:** Tabelle existiert in DB
```bash
alembic upgrade head
psql -c "SELECT * FROM channels LIMIT 0;"
```

---

## Phase 2: YouTube Integration (Backend)

### Step 2.1: VideoMetadata TypedDict erweitern
**Dateien:** `backend/app/clients/youtube.py` (Zeile ~46-70)
**Aufwand:** 5 min
**Test:** TypedDict akzeptiert channel_id
```bash
python -c "from app.clients.youtube import VideoMetadata"
```

### Step 2.2: get_video_metadata: channelId extrahieren
**Dateien:** `backend/app/clients/youtube.py` (Zeile ~149)
**Aufwand:** 10 min
**Test:** Manueller Test mit echtem Video
```python
# Test in Python shell
metadata = await client.get_video_metadata("dQw4w9WgXcQ")
assert "channel_id" in metadata
```

### Step 2.3: get_batch_metadata: channelId extrahieren
**Dateien:** `backend/app/clients/youtube.py` (Zeile ~360)
**Aufwand:** 10 min
**Test:** Batch-Request enthält channel_id

### Step 2.4: get_or_create_channel Helper erstellen
**Dateien:** `backend/app/services/channel_service.py` (NEU)
**Aufwand:** 20 min
**Test:** Unit Test für Helper
```python
# Creates new channel
channel = await get_or_create_channel(db, user_id, "UCtest", "Test")
assert channel.id is not None

# Returns existing channel
same = await get_or_create_channel(db, user_id, "UCtest", "Test")
assert same.id == channel.id
```

### Step 2.5: Video Processor: Channel-Integration
**Dateien:** `backend/app/workers/video_processor.py`
**Aufwand:** 20 min
**Test:** Neues Video erstellt Channel
```python
# Add video, verify channel was created
video = await create_video(url="...")
assert video.channel_id is not None
```

---

## Phase 3: Backend API

### Step 3.1: Channel Schemas erstellen
**Dateien:** `backend/app/schemas/channel.py` (NEU)
**Aufwand:** 15 min
**Test:** Schemas können instanziiert werden
```bash
python -c "from app.schemas.channel import ChannelResponse"
```

### Step 3.2: GET /channels Endpoint
**Dateien:** `backend/app/api/channels.py` (NEU)
**Aufwand:** 25 min
**Test:** API-Test
```bash
curl http://localhost:8000/channels -H "Authorization: Bearer $TOKEN"
```

### Step 3.3: PATCH /channels/{id} Endpoint
**Dateien:** `backend/app/api/channels.py`
**Aufwand:** 15 min
**Test:** Kann Channel verstecken
```bash
curl -X PATCH http://localhost:8000/channels/$ID \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"is_hidden": true}'
```

### Step 3.4: DELETE /channels/{id} Endpoint
**Dateien:** `backend/app/api/channels.py`
**Aufwand:** 15 min
**Test:** Kann leeren Channel löschen

### Step 3.5: Router in main.py registrieren
**Dateien:** `backend/app/main.py`
**Aufwand:** 5 min
**Test:** Endpoint ist erreichbar
```bash
curl http://localhost:8000/channels -I
```

### Step 3.6: VideoFilterRequest um channel_id erweitern
**Dateien:** `backend/app/api/videos.py` (Schema)
**Aufwand:** 10 min
**Test:** Schema akzeptiert channel_id

### Step 3.7: Filter-Query um channel_id erweitern
**Dateien:** `backend/app/api/videos.py` (Query)
**Aufwand:** 10 min
**Test:** Filter funktioniert
```bash
curl -X POST http://localhost:8000/lists/$LIST/videos/filter \
  -d '{"channel_id": "..."}'
```

---

## Phase 4: Frontend Foundation

### Step 4.1: Channel Types definieren
**Dateien:** `frontend/src/types/channel.ts` (NEU)
**Aufwand:** 10 min
**Test:** Types kompilieren
```bash
npx tsc --noEmit
```

### Step 4.2: useChannels Hook erstellen
**Dateien:** `frontend/src/hooks/useChannels.ts` (NEU)
**Aufwand:** 20 min
**Test:** Hook fetcht Daten
```tsx
// In React DevTools: useChannels returns data
```

### Step 4.3: useUpdateChannel Hook erstellen
**Dateien:** `frontend/src/hooks/useChannels.ts`
**Aufwand:** 15 min
**Test:** Mutation funktioniert

### Step 4.4: channelStore erstellen
**Dateien:** `frontend/src/stores/channelStore.ts` (NEU)
**Aufwand:** 15 min
**Test:** Unit Test
```bash
npm run test channelStore
```

### Step 4.5: useVideosFilter um channelId erweitern
**Dateien:** `frontend/src/hooks/useVideosFilter.ts`
**Aufwand:** 15 min
**Test:** Request enthält channel_id
```tsx
// In Network Tab: Request body has channel_id
```

---

## Phase 5: UI Components

### Step 5.1: ChannelAvatar Component erstellen
**Dateien:** `frontend/src/components/ChannelAvatar.tsx` (NEU)
**Aufwand:** 15 min
**Test:** Component rendert
```tsx
<ChannelAvatar src={null} name="Test" />
// Shows "T" fallback
```

### Step 5.2: ChannelItem Component erstellen
**Dateien:** `frontend/src/components/ChannelItem.tsx` (NEU)
**Aufwand:** 25 min
**Test:** Component rendert mit Klick-Handler

### Step 5.3: ChannelNavigation Component erstellen
**Dateien:** `frontend/src/components/ChannelNavigation.tsx` (NEU)
**Aufwand:** 20 min
**Test:** Liste wird gerendert

### Step 5.4: VideosPage: Channels fetchen
**Dateien:** `frontend/src/components/VideosPage.tsx`
**Aufwand:** 10 min
**Test:** useChannels wird aufgerufen

### Step 5.5: VideosPage: ChannelNavigation in Sidebar
**Dateien:** `frontend/src/components/VideosPage.tsx`
**Aufwand:** 15 min
**Test:** Kanäle erscheinen in Sidebar

### Step 5.6: VideosPage: Channel-Filter State
**Dateien:** `frontend/src/components/VideosPage.tsx`
**Aufwand:** 15 min
**Test:** Klick auf Kanal filtert Videos

### Step 5.7: Table View: Kanal klickbar machen
**Dateien:** `frontend/src/components/VideosPage.tsx` (Title Column)
**Aufwand:** 15 min
**Test:** Klick auf Kanal in Tabelle filtert

### Step 5.8: VideoCard: onChannelClick Prop
**Dateien:** `frontend/src/components/VideoCard.tsx`
**Aufwand:** 10 min
**Test:** Prop wird durchgereicht

### Step 5.9: VideoGrid: onChannelClick Handler
**Dateien:** `frontend/src/components/VideoGrid.tsx`
**Aufwand:** 10 min
**Test:** Klick auf Kanal in Grid filtert

### Step 5.10: tableSettingsStore: showChannelAvatars
**Dateien:** `frontend/src/stores/tableSettingsStore.ts`
**Aufwand:** 10 min
**Test:** Setting wird gespeichert

### Step 5.11: Settings: Avatar-Toggle UI
**Dateien:** `frontend/src/pages/SettingsPage.tsx`
**Aufwand:** 15 min
**Test:** Toggle ändert Setting

### Step 5.12: ChannelNavigation: Avatar-Support
**Dateien:** `frontend/src/components/ChannelNavigation.tsx`
**Aufwand:** 10 min
**Test:** Avatare werden angezeigt wenn enabled

---

## Phase 6: Polish

### Step 6.1: URL Sync: Channel in URL schreiben
**Dateien:** `frontend/src/components/VideosPage.tsx`
**Aufwand:** 15 min
**Test:** URL hat ?channel= Parameter

### Step 6.2: URL Sync: Channel aus URL lesen
**Dateien:** `frontend/src/components/VideosPage.tsx`
**Aufwand:** 15 min
**Test:** Page Load mit ?channel= filtert

### Step 6.3: Header: Channel-Filter anzeigen
**Dateien:** `frontend/src/components/VideosPage.tsx`
**Aufwand:** 15 min
**Test:** Header zeigt Kanalnamen bei Filter

### Step 6.4: Context Menu: Kanal ausblenden
**Dateien:** `frontend/src/components/ChannelItem.tsx`
**Aufwand:** 20 min
**Test:** Klick auf "Ausblenden" versteckt Kanal

### Step 6.5: Settings: Ausgeblendete Kanäle Liste
**Dateien:** `frontend/src/pages/SettingsPage.tsx`
**Aufwand:** 20 min
**Test:** Versteckte Kanäle werden angezeigt

### Step 6.6: Settings: Kanal einblenden
**Dateien:** `frontend/src/pages/SettingsPage.tsx`
**Aufwand:** 10 min
**Test:** "Einblenden" macht Kanal wieder sichtbar

### Step 6.7: Backend: Auto-Delete leerer Channels
**Dateien:** `backend/app/api/videos.py` (delete endpoint)
**Aufwand:** 20 min
**Test:** Letztes Video löschen → Kanal weg

### Step 6.8: Frontend: Cache nach Video-Delete aktualisieren
**Dateien:** `frontend/src/hooks/useVideos.ts`
**Aufwand:** 10 min
**Test:** Channels werden nach Delete refetched

---

## Phase 7: Testing

### Step 7.1: Backend Unit Tests: Channel Model
**Dateien:** `backend/tests/unit/test_channel_model.py` (NEU)
**Aufwand:** 20 min

### Step 7.2: Backend Integration Tests: Channel API
**Dateien:** `backend/tests/integration/test_channels_api.py` (NEU)
**Aufwand:** 30 min

### Step 7.3: Frontend Unit Tests: channelStore
**Dateien:** `frontend/src/stores/channelStore.test.ts` (NEU)
**Aufwand:** 15 min

### Step 7.4: Frontend Component Tests: ChannelNavigation
**Dateien:** `frontend/src/components/ChannelNavigation.test.tsx` (NEU)
**Aufwand:** 25 min

---

## Zusammenfassung

| Phase | Steps | Geschätzt |
|-------|-------|-----------|
| 1. Daten-Fundament | 7 | 1.5h |
| 2. YouTube Integration | 5 | 1h |
| 3. Backend API | 7 | 1.5h |
| 4. Frontend Foundation | 5 | 1.25h |
| 5. UI Components | 12 | 3h |
| 6. Polish | 8 | 2h |
| 7. Testing | 4 | 1.5h |
| **Gesamt** | **48** | **~12h** |

## Kritischer Pfad

```text
1.1 → 1.3 → 1.5 → 1.7 → 2.4 → 2.5 → 3.2 → 4.2 → 5.3 → 5.5
```

Diese Steps müssen sequentiell sein. Andere können parallel ausgeführt werden.
