# User Story 04: Keyboard Shortcuts

**Als** Power-User
**Möchte ich** Videos mit Tastaturkürzel steuern können
**Damit** ich effizienter arbeiten kann

## UX Flow

1. User fokussiert Video Player
   → Keyboard Shortcuts sind aktiv

2. User drückt Space
   → Video pausiert/spielt

3. User drückt Pfeiltasten
   → Video springt vor/zurück

4. User drückt F
   → Fullscreen wird aktiviert

## Akzeptanzkriterien

- [ ] Space: Play/Pause
- [ ] Arrow Left: 10 Sekunden zurück
- [ ] Arrow Right: 10 Sekunden vor
- [ ] Arrow Up: Lautstärke +10%
- [ ] Arrow Down: Lautstärke -10%
- [ ] M: Mute/Unmute
- [ ] F: Fullscreen Toggle
- [ ] Shortcuts funktionieren nur wenn Player fokussiert

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Input-Feld fokussiert | Shortcuts deaktiviert |
| Modal geöffnet mit Player | Shortcuts aktiv im Modal |
| Video am Anfang + Arrow Left | Position bleibt bei 0 |
| Video am Ende + Arrow Right | Position bleibt am Ende |

## Technische Notizen

- Plyr hat Keyboard-Support eingebaut
- Config: `keyboard: { focused: true, global: false }`
- `global: false` verhindert Konflikte mit App-Shortcuts
