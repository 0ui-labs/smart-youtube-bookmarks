# Impact-Analyse: YouTube-Kanäle Feature

## Komplexitäts-Einschätzung

**Gesamt-Komplexität: MITTEL**

- Neue Datenbank-Entity + Migration
- Mehrere Frontend-Komponenten
- Integration in bestehende Filter-Logik
- Aber: Klares Pattern vorhanden (Tag-Feature als Vorlage)

## Betroffene Bereiche

### 1. Datenbank / Backend Models

| Datei | Änderung | Komplexität |
|-------|----------|-------------|
| `backend/app/models/channel.py` | **NEU** - Channel Model | Mittel |
| `backend/app/models/video.py` | FK `channel_id` hinzufügen | Niedrig |
| `backend/app/models/__init__.py` | Channel exportieren | Niedrig |
| `backend/alembic/versions/xxx_add_channels.py` | **NEU** - Migration | Mittel |

**Schema-Änderungen:**
```sql
-- Neue Tabelle
CREATE TABLE channels (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    youtube_channel_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    thumbnail_url VARCHAR(500),
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(user_id, youtube_channel_id)
);

-- Video-Tabelle erweitern
ALTER TABLE videos ADD COLUMN channel_id UUID REFERENCES channels(id);
CREATE INDEX idx_videos_channel_id ON videos(channel_id);
```

### 2. Backend API

| Datei | Änderung | Komplexität |
|-------|----------|-------------|
| `backend/app/schemas/channel.py` | **NEU** - Pydantic Schemas | Niedrig |
| `backend/app/api/channels.py` | **NEU** - CRUD Endpoints | Mittel |
| `backend/app/api/videos.py` | Filter um `channel_id` erweitern | Niedrig |
| `backend/app/clients/youtube.py` | `channelId` extrahieren | Niedrig |
| `backend/app/workers/video_processor.py` | Auto-Create Channel | Mittel |

**Neue API Endpoints:**
- `GET /channels` - Alle Kanäle des Users (mit Video-Count)
- `PATCH /channels/{id}` - Kanal verstecken/zeigen
- `DELETE /channels/{id}` - Kanal löschen (wenn leer)

### 3. Frontend Components

| Datei | Änderung | Komplexität |
|-------|----------|-------------|
| `frontend/src/components/ChannelNavigation.tsx` | **NEU** | Mittel |
| `frontend/src/components/VideosPage.tsx` | Sidebar + Video-Items | Mittel |
| `frontend/src/components/VideoGrid.tsx` | Klickbarer Kanalname | Niedrig |
| `frontend/src/components/VideoCard.tsx` | Klickbarer Kanalname | Niedrig |
| `frontend/src/pages/SettingsPage.tsx` | Avatar-Toggle | Niedrig |

### 4. Frontend State & Hooks

| Datei | Änderung | Komplexität |
|-------|----------|-------------|
| `frontend/src/hooks/useChannels.ts` | **NEU** - React Query Hook | Niedrig |
| `frontend/src/stores/channelStore.ts` | **NEU** - Zustand Store | Niedrig |
| `frontend/src/stores/tableSettingsStore.ts` | `showChannelAvatars` | Niedrig |
| `frontend/src/hooks/useVideosFilter.ts` | `channelId` Parameter | Niedrig |
| `frontend/src/types/channel.ts` | **NEU** - TypeScript Types | Niedrig |

### 5. Tests

| Datei | Änderung | Komplexität |
|-------|----------|-------------|
| `backend/tests/test_channels.py` | **NEU** - API Tests | Mittel |
| `frontend/src/stores/channelStore.test.ts` | **NEU** - Store Tests | Niedrig |
| `frontend/src/hooks/useChannels.test.ts` | **NEU** - Hook Tests | Niedrig |

## Impact-Matrix

### Frontend Impact

```
                    ┌─────────────────────┐
                    │   VideosPage.tsx    │
                    │  (Main Integration) │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ CollapsibleSidebar│  │   VideoGrid    │  │ useVideosFilter │
│ + ChannelNav    │  │ + Channel Link │  │ + channelId     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ channelStore.ts │  │  VideoCard.tsx  │
│ (Selection)     │  │ + Channel Link  │
└─────────────────┘  └─────────────────┘
```

### Backend Impact

```
                    ┌─────────────────────┐
                    │  video_processor.py │
                    │ (Auto-Create Logic) │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  youtube.py     │  │  Channel Model  │  │  Video Model    │
│ + channelId     │  │     (NEU)       │  │ + channel_id FK │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   videos.py API     │
                    │ + channel filter    │
                    └─────────────────────┘
```

## Risiko-Bewertung

### Niedrige Risiken
- Neue Dateien/Components (isoliert, kein Breaking Change)
- Frontend Store-Erweiterung (bestehendes Pattern)
- Settings-Erweiterung (localStorage, isolated)

### Mittlere Risiken
- **DB-Migration:** Videos erhalten neue FK-Spalte `channel_id`
  - Mitigation: Migration mit NULL erlauben, dann Backfill
- **Video-Processor Änderung:** Auto-Create Channel Logik
  - Mitigation: Feature Flag für schrittweisen Rollout
- **Filter-API Erweiterung:** Neuer Parameter
  - Mitigation: Optional, backward-compatible

### Hohe Risiken
- **Keine identifiziert**

## Aufwands-Schätzung

| Bereich | Geschätzter Aufwand |
|---------|---------------------|
| Backend Model + Migration | 2-3 Stunden |
| Backend API Endpoints | 2-3 Stunden |
| YouTube Client + Processor | 1-2 Stunden |
| Frontend Components | 3-4 Stunden |
| Frontend State/Hooks | 1-2 Stunden |
| Settings Integration | 1 Stunde |
| Tests | 2-3 Stunden |
| **Gesamt** | **12-18 Stunden** |

## Abhängigkeiten

### Interne Abhängigkeiten
1. Channel Model → Video Model (FK)
2. YouTube Client → Video Processor (channelId extrahieren)
3. ChannelNavigation → channelStore (State)
4. VideosPage → useVideosFilter (Filter-Parameter)

### Externe Abhängigkeiten
- YouTube Data API (channelId wird bereits geliefert, nur nicht genutzt)

## Betroffene User Flows

### 1. Video hinzufügen (geändert)
- Vorher: Video wird erstellt
- Nachher: Video wird erstellt + Kanal wird automatisch erstellt/verknüpft

### 2. Videos filtern (erweitert)
- Vorher: Nach Tags filtern
- Nachher: Nach Tags ODER Kanal filtern (kombinierbar)

### 3. Video löschen (erweitert)
- Vorher: Video wird gelöscht
- Nachher: Video wird gelöscht + Kanal wird gelöscht wenn leer

### 4. Settings (erweitert)
- Neues Toggle: "Kanal-Avatare anzeigen"
