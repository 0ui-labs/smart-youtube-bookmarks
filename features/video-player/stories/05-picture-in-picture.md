# User Story 05: Picture-in-Picture

**Als** Benutzer
**Möchte ich** Videos im Picture-in-Picture Modus schauen können
**Damit** ich gleichzeitig andere Inhalte sehen kann

## UX Flow

1. User schaut Video
   → PiP-Button ist in Player-Controls sichtbar

2. User klickt PiP-Button
   → Video wird in schwebendes Fenster verschoben
   → User kann in der App navigieren

3. User klickt PiP-Fenster schließen
   → Video springt zurück in Player
   → Wiedergabe läuft weiter

## Akzeptanzkriterien

- [ ] PiP-Button ist sichtbar in Player-Controls
- [ ] PiP aktiviert Video in schwebendem Fenster
- [ ] Wiedergabe läuft im PiP weiter
- [ ] Fortschritt-Tracking funktioniert im PiP
- [ ] PiP-Fenster schließen kehrt zum inline Player zurück

## Browser-Support

| Browser | Support |
|---------|---------|
| Chrome | ✅ Vollständig |
| Firefox | ✅ Vollständig |
| Safari | ✅ Vollständig |
| Edge | ✅ Vollständig |

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Browser unterstützt PiP nicht | Button ausblenden |
| Berechtigungen verweigert | Fehlermeldung, Fallback auf inline |
| Tab wechseln während PiP | PiP bleibt aktiv |
| App schließen während PiP | PiP schließt mit |

## Technische Notizen

- Plyr hat PiP-Support eingebaut
- Config: `controls: [..., 'pip']`
- `pip` Control nur hinzufügen wenn `document.pictureInPictureEnabled`
