# User Story 007: Leere Kanäle automatisch löschen

**Als** Nutzer der App
**möchte ich**, dass Kanäle automatisch gelöscht werden, wenn alle ihre Videos entfernt wurden
**damit** ich keine verwaisten Kanäle in meiner Liste habe

## Akzeptanzkriterien

- [ ] Wenn letztes Video eines Kanals gelöscht wird → Kanal wird gelöscht
- [ ] Kein Bestätigungs-Dialog (automatisch)
- [ ] Kanal verschwindet sofort aus Sidebar
- [ ] Wenn Kanal gerade gefiltert ist → Filter aufheben vor Löschung

## UX Flow

```
1. User hat 1 Video von "MrBeast"
   └── Sidebar zeigt: MrBeast (1)

2. User löscht dieses Video
   ├── Video wird gelöscht
   ├── Backend prüft: Kanal hat 0 Videos?
   │   └── JA → Kanal automatisch löschen
   └── Sidebar aktualisiert sich (MrBeast weg)

3. Optional: Toast "Video gelöscht. Kanal 'MrBeast' wurde automatisch entfernt."
```

## Technische Details

### Backend: Video Delete Handler

```python
@router.delete("/videos/{video_id}")
async def delete_video(
    video_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    video = await get_video_or_404(video_id, current_user.id)
    channel_id = video.channel_id

    # 1. Video löschen
    await db.delete(video)

    # 2. Prüfen ob Kanal noch Videos hat
    if channel_id:
        video_count = await db.scalar(
            select(func.count(Video.id))
            .where(Video.channel_id == channel_id)
        )

        if video_count == 0:
            # Kanal hat keine Videos mehr → löschen
            channel = await db.get(Channel, channel_id)
            if channel:
                await db.delete(channel)

    await db.commit()
    return {"status": "deleted"}
```

### Alternative: Database Trigger

```sql
-- Automatischer Cleanup via Trigger (optional)
CREATE OR REPLACE FUNCTION cleanup_empty_channels()
RETURNS TRIGGER AS $$
BEGIN
    -- Prüfe ob der Channel des gelöschten Videos noch Videos hat
    IF OLD.channel_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM videos
            WHERE channel_id = OLD.channel_id
        ) THEN
            DELETE FROM channels WHERE id = OLD.channel_id;
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_empty_channels
AFTER DELETE ON videos
FOR EACH ROW
EXECUTE FUNCTION cleanup_empty_channels();
```

### Frontend: Cache Invalidation

```typescript
// useDeleteVideo hook
const deleteVideo = useMutation({
  mutationFn: async (videoId: string) => {
    await api.delete(`/videos/${videoId}`);
  },
  onSuccess: () => {
    // Beide Caches invalidieren
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    queryClient.invalidateQueries({ queryKey: ['channels'] });  // NEU
  },
});
```

### Frontend: Filter-Handling

```typescript
// In VideosPage oder channelStore
// Wenn aktuell gefilterter Kanal nicht mehr existiert:
useEffect(() => {
  if (selectedChannelId && channels) {
    const channelExists = channels.some(c => c.id === selectedChannelId);
    if (!channelExists) {
      clearChannel();  // Filter aufheben
    }
  }
}, [channels, selectedChannelId]);
```

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Bulk-Delete von Videos | Nach jedem Video prüfen (ineffizient, aber korrekt) |
| Gleichzeitige Requests | DB-Transaction schützt vor Race Conditions |
| Kanal ist hidden | Wird trotzdem gelöscht wenn leer |
| Video wird in andere Liste verschoben | Aktuell nicht möglich, aber falls: gleiche Logik |

## Optimierung für Bulk-Deletes

```python
# Für bessere Performance bei Bulk-Deletes
async def cleanup_empty_channels(db: AsyncSession, user_id: UUID):
    """
    Lösche alle Kanäle ohne Videos für einen User.
    Effizienter als einzelne Prüfungen.
    """
    empty_channels = await db.execute(
        select(Channel.id)
        .where(Channel.user_id == user_id)
        .where(
            ~exists(
                select(Video.id).where(Video.channel_id == Channel.id)
            )
        )
    )

    for (channel_id,) in empty_channels:
        await db.execute(delete(Channel).where(Channel.id == channel_id))
```

## Abhängigkeiten

- Story 001 (Auto-Channel-Creation) - Basis-Logik
- Video Delete Endpoint - Erweiterung
