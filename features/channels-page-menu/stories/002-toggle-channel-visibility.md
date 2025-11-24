# User Story 002: Kanal in Navigation ein-/ausblenden

**Als** Nutzer der App
**möchte ich** über die Kanäle-Übersichtsseite Kanäle in der Navigation ein- oder ausblenden können
**damit** ich nicht in die Sidebar gehen muss um Kanäle zu verwalten

## Akzeptanzkriterien

- [x] Jeder Kanal hat ein 3-Punkt-Menü
- [x] Menü enthält "In Navigation ausblenden" für sichtbare Kanäle
- [x] Menü enthält "In Navigation einblenden" für ausgeblendete Kanäle
- [x] Änderung wird sofort sichtbar (optimistic update)
- [x] Icon ändert sich je nach aktuellem Status

## UX Flow

### Kanal ausblenden

```
1. User klickt auf [⋮] bei einem sichtbaren Kanal

2. Dropdown erscheint:
   ┌───────────────────────────────┐
   │ 👁‍🗨 In Navigation ausblenden  │
   │ 🗑️ Kanal löschen              │
   └───────────────────────────────┘

3. User klickt "In Navigation ausblenden"
   - Kanal erhält EyeOff Indikator
   - Kanal verschwindet aus Sidebar
   - Toast: "Kanal ausgeblendet"
```

### Kanal einblenden

```
1. User klickt auf [⋮] bei einem ausgeblendeten Kanal

2. Dropdown erscheint:
   ┌───────────────────────────────┐
   │ 👁 In Navigation einblenden   │
   │ 🗑️ Kanal löschen              │
   └───────────────────────────────┘

3. User klickt "In Navigation einblenden"
   - EyeOff Indikator verschwindet
   - Kanal erscheint wieder in Sidebar
   - Toast: "Kanal eingeblendet"
```

## Technische Details

```tsx
const updateChannel = useUpdateChannel()

// Toggle visibility
updateChannel.mutate({
  channelId: channel.id,
  data: { is_hidden: !channel.is_hidden }
})
```
