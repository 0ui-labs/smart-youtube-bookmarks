# User Story 006: Kanal ausblenden

**Als** Nutzer der App
**möchte ich** einzelne Kanäle aus der Sidebar ausblenden können
**damit** ich nur die Kanäle sehe, die mich interessieren

## Akzeptanzkriterien

- [ ] Kontext-Menü oder Button zum Ausblenden pro Kanal
- [ ] Ausgeblendete Kanäle erscheinen nicht in Sidebar
- [ ] Videos bleiben erhalten (nur Sidebar-Anzeige betroffen)
- [ ] In Settings: Liste ausgeblendeter Kanäle mit "Einblenden"-Option
- [ ] Ausgeblendete Kanäle können wieder eingeblendet werden

## UX Flow

### Kanal ausblenden

```
1. User sieht Kanal in Sidebar
   ┌─────────────────────────────────┐
   │ Kanäle                          │
   │ ├── MrBeast (12)         [⋮]   │ ← Hover zeigt Menü
   └─────────────────────────────────┘

2. User klickt auf [⋮] → "Ausblenden"

3. Kanal verschwindet aus Sidebar
   - Toast: "MrBeast ausgeblendet. Rückgängig?"
   - PATCH /channels/{id} { is_hidden: true }
```

### Kanal einblenden

```
1. User geht zu Settings → "Ausgeblendete Kanäle"

2. Liste zeigt:
   ┌─────────────────────────────────────────────┐
   │ Ausgeblendete Kanäle                        │
   │ ├── MrBeast              [Einblenden]       │
   │ └── PewDiePie            [Einblenden]       │
   └─────────────────────────────────────────────┘

3. User klickt "Einblenden"
   - PATCH /channels/{id} { is_hidden: false }
   - Kanal erscheint wieder in Sidebar
```

## Technische Details

### Backend: Channel Model

```python
class Channel(BaseModel):
    # ... existing fields
    is_hidden: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default='false'
    )
```

### Backend: API Endpoint

```python
@router.patch("/channels/{channel_id}")
async def update_channel(
    channel_id: UUID,
    update: ChannelUpdate,
    current_user: User = Depends(get_current_user),
):
    channel = await get_channel_or_404(channel_id, current_user.id)
    channel.is_hidden = update.is_hidden
    await db.commit()
    return channel

class ChannelUpdate(BaseModel):
    is_hidden: Optional[bool] = None
```

### Backend: GET /channels Filter

```python
@router.get("/channels")
async def list_channels(
    include_hidden: bool = False,  # Query param
    current_user: User = Depends(get_current_user),
):
    query = select(Channel).where(Channel.user_id == current_user.id)

    if not include_hidden:
        query = query.where(Channel.is_hidden == False)

    return await db.execute(query)
```

### Frontend: Kontext-Menü

```tsx
// In ChannelNavigation
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="opacity-0 group-hover:opacity-100">
      <MoreVertical className="h-4 w-4" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => hideChannel(channel.id)}>
      <EyeOff className="h-4 w-4 mr-2" />
      Ausblenden
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Frontend: Hook

```typescript
// useChannels.ts
export function useHideChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, isHidden }: { channelId: string; isHidden: boolean }) => {
      await api.patch(`/channels/${channelId}`, { is_hidden: isHidden });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
```

## UI Spezifikation

### Hover-State mit Menü-Button
```
┌─────────────────────────────────┐
│ MrBeast (12)              [⋮]  │
│                            │    │
│                            └── Erscheint bei Hover
└─────────────────────────────────┘
```

### Settings: Ausgeblendete Kanäle
```
┌─────────────────────────────────────────────────────┐
│ Ausgeblendete Kanäle                                │
│                                                     │
│ Diese Kanäle werden nicht in der Sidebar angezeigt. │
│ Die Videos bleiben weiterhin verfügbar.             │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ MrBeast                         [Einblenden]    │ │
│ │ PewDiePie                       [Einblenden]    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Keine ausgeblendeten Kanäle? → Dieser Bereich       │
│ wird nicht angezeigt.                               │
└─────────────────────────────────────────────────────┘
```

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Ausgeblendeter Kanal ist aktuell gefiltert | Filter aufheben, dann ausblenden |
| Alle Kanäle ausgeblendet | "Kanäle" Sektion bleibt (aber leer) |
| Neues Video von ausgeblendetem Kanal | Video erscheint, Kanal bleibt hidden |

## Abhängigkeiten

- Story 002 (Sidebar Channel List)
- Settings Page muss erweitert werden
