# User Story 001: Automatische Kanal-Erstellung

**Als** Nutzer der App
**möchte ich**, dass Kanäle automatisch erstellt werden, wenn ich Videos hinzufüge
**damit** ich ohne manuellen Aufwand eine Übersicht meiner gespeicherten Kanäle habe

## Akzeptanzkriterien

- [ ] Beim Hinzufügen eines Videos wird der YouTube-Kanal automatisch erkannt
- [ ] Existiert der Kanal noch nicht für diesen User → wird er erstellt
- [ ] Existiert der Kanal bereits → wird das Video damit verknüpft
- [ ] Der Kanal erscheint in der Sidebar unter "Kanäle"
- [ ] Der Video-Count des Kanals wird korrekt hochgezählt

## UX Flow

```
1. User fügt YouTube-URL ein
   └── UI zeigt "Video wird hinzugefügt..."

2. Backend verarbeitet Video
   ├── YouTube API liefert: channelId, channelTitle
   ├── Check: Existiert Channel für diesen User?
   │   ├── JA → Video mit Channel verknüpfen
   │   └── NEIN → Channel erstellen, dann verknüpfen
   └── Video wird gespeichert

3. UI aktualisiert sich
   ├── Video erscheint in der Liste
   └── Channel erscheint in Sidebar (oder Badge erhöht sich)
```

## Technische Details

### Backend: Video Processor
```python
# Pseudo-Code
metadata = await youtube.get_video_metadata(youtube_id)

channel = await get_or_create_channel(
    user_id=current_user.id,
    youtube_channel_id=metadata["channel_id"],
    channel_name=metadata["channel"],
    thumbnail_url=metadata.get("channel_thumbnail")
)

video.channel_id = channel.id
```

### Datenbank
```sql
-- Channel wird erstellt mit:
INSERT INTO channels (id, user_id, youtube_channel_id, name, thumbnail_url)
VALUES (uuid, user_uuid, 'UC...', 'MrBeast', 'https://...');

-- Video wird verknüpft mit:
UPDATE videos SET channel_id = channel_uuid WHERE id = video_uuid;
```

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| YouTube API liefert keine channelId | Video ohne Channel speichern (channel_id = NULL) |
| Kanalname hat sich auf YouTube geändert | Bei nächstem Video vom Kanal: Name updaten |
| Gleichzeitige Requests für gleichen Kanal | Datenbank-Unique-Constraint verhindert Duplikate |
| Video wird in mehrere Listen hinzugefügt | Gleicher Channel wird wiederverwendet (pro User) |

## Nicht in dieser Story

- Sidebar-Anzeige (Story 002)
- Kanal-Filterung (Story 003)
- Avatar-Anzeige (Story 005)
