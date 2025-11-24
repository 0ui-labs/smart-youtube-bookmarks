# User Story 003: Kanal löschen mit Bestätigung

**Als** Nutzer der App
**möchte ich** Kanäle über die Übersichtsseite löschen können
**damit** ich nicht mehr benötigte Kanäle entfernen kann

**Als** Nutzer der App
**möchte ich** vor dem Löschen gewarnt werden
**damit** ich nicht versehentlich Kanäle lösche

## Akzeptanzkriterien

- [x] Menü enthält "Kanal löschen" Option
- [x] Bestätigungsdialog erscheint vor dem Löschen
- [x] Dialog erklärt dass Videos erhalten bleiben
- [x] Löschen erfordert explizite Bestätigung
- [x] Nach dem Löschen: Toast-Nachricht, Kanal verschwindet

## UX Flow

```
1. User klickt auf [⋮] → "Kanal löschen"

2. Bestätigungsdialog erscheint:
   ┌─────────────────────────────────────────────────┐
   │ Kanal löschen?                                  │
   │                                                 │
   │ Möchtest du "MrBeast" wirklich löschen?         │
   │                                                 │
   │ Die 125 Videos dieses Kanals bleiben erhalten,  │
   │ verlieren aber ihre Kanal-Zuordnung.            │
   │                                                 │
   │                    [Abbrechen]  [🗑️ Löschen]    │
   └─────────────────────────────────────────────────┘

3. User klickt "Löschen"
   - DELETE /channels/{id}
   - Kanal verschwindet aus Liste
   - Toast: "Kanal gelöscht"

4. Bei "Abbrechen": Dialog schließt, nichts passiert
```

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Kanal hat 0 Videos | Normale Löschung, keine spezielle Meldung |
| API-Fehler | Toast mit Fehlermeldung, Kanal bleibt |
| Schnelles Doppelklicken | Button disabled während Request |

## Technische Details

```tsx
const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null)
const deleteChannel = useDeleteChannel()

// Im AlertDialog
<AlertDialogAction
  onClick={() => {
    deleteChannel.mutate(channelToDelete.id)
    setChannelToDelete(null)
  }}
  disabled={deleteChannel.isPending}
>
  Löschen
</AlertDialogAction>
```
