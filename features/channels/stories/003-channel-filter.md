# User Story 003: Nach Kanal filtern

**Als** Nutzer der App
**möchte ich** auf einen Kanal klicken, um nur dessen Videos zu sehen
**damit** ich schnell alle Videos eines bestimmten Creators finde

## Akzeptanzkriterien

- [ ] Klick auf Kanal in Sidebar → nur Videos dieses Kanals anzeigen
- [ ] Visuelles Feedback: Ausgewählter Kanal ist hervorgehoben
- [ ] URL wird aktualisiert mit Channel-Parameter
- [ ] Filter kombinierbar mit Tag-Filtern und Field-Filtern
- [ ] Erneuter Klick oder "Alle Videos" → Filter aufheben

## UX Flow

```
1. User sieht alle 50 Videos

2. User klickt auf "MrBeast" in Sidebar
   ├── URL: /videos?channel=uuid-here
   ├── API: POST /videos/filter { channel_id: "uuid" }
   └── UI: Zeigt nur MrBeast Videos (12 Stück)

3. Header ändert sich:
   ├── "Alle Videos" → "MrBeast"
   └── Link "Alle Videos anzeigen" erscheint

4. User klickt "Alle Videos anzeigen"
   ├── URL: /videos
   └── UI: Zeigt wieder alle 50 Videos
```

## Technische Details

### Frontend: channelStore
```typescript
const useChannelStore = create<ChannelStore>((set) => ({
  selectedChannelId: null,

  selectChannel: (channelId) => set({ selectedChannelId: channelId }),
  clearChannel: () => set({ selectedChannelId: null }),
}));
```

### Frontend: URL Sync
```typescript
// URL → Store (bei Page Load)
useEffect(() => {
  const channelId = searchParams.get('channel');
  if (channelId) {
    selectChannel(channelId);
  }
}, [searchParams]);

// Store → URL (bei Selection Change)
useEffect(() => {
  if (selectedChannelId) {
    searchParams.set('channel', selectedChannelId);
  } else {
    searchParams.delete('channel');
  }
  setSearchParams(searchParams, { replace: true });
}, [selectedChannelId]);
```

### Backend: Filter API
```python
@router.post("/lists/{list_id}/videos/filter")
async def filter_videos(
    list_id: UUID,
    filter_request: VideoFilterRequest,
):
    query = select(Video).where(Video.list_id == list_id)

    # NEU: Channel Filter
    if filter_request.channel_id:
        query = query.where(Video.channel_id == filter_request.channel_id)

    # Bestehend: Tag Filter
    if filter_request.tags:
        query = query.where(...)

    return await db.execute(query)
```

## Filter-Kombinationen

| Tags | Channel | Field-Filter | Ergebnis |
|------|---------|--------------|----------|
| - | MrBeast | - | Alle MrBeast Videos |
| Python | MrBeast | - | MrBeast Videos mit Tag "Python" |
| Python | - | Rating ≥ 4 | Videos mit Tag "Python" UND Rating ≥ 4 |
| Python | MrBeast | Rating ≥ 4 | MrBeast + Python + Rating ≥ 4 |

**Logik:** Alle Filter werden mit AND verknüpft.

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Channel existiert nicht mehr | 404 Error, Filter ignorieren |
| Channel hat keine Videos | Leere Liste anzeigen |
| Ungültige UUID in URL | Ignorieren, alle Videos zeigen |
| Channel eines anderen Users | 403 Forbidden |

## UI Spezifikation

### Sidebar: Selected State
```
┌─────────────────────────────────┐
│ Kanäle                          │
│ ├── MrBeast (12)      [accent]  │  ← Selected
│ ├── Fireship (8)                │
│ └── ThePrimeagen (4)            │
└─────────────────────────────────┘
```

### Header: Filter Active
```
┌─────────────────────────────────────────────────┐
│ MrBeast                                         │
│ Alle Videos anzeigen                            │
└─────────────────────────────────────────────────┘
```
