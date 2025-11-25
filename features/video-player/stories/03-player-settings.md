# User Story 03: Player-Einstellungen

**Als** Benutzer
**Möchte ich** meine Player-Einstellungen (Lautstärke, Geschwindigkeit) behalten
**Damit** ich sie nicht jedes Mal neu einstellen muss

## UX Flow

1. User ändert Lautstärke
   → Einstellung wird sofort im localStorage gespeichert
   → Beim nächsten Video ist die Lautstärke gleich

2. User ändert Wiedergabe-Geschwindigkeit
   → Einstellung wird sofort gespeichert
   → Alle Videos starten mit dieser Geschwindigkeit

3. User wechselt Gerät
   → Einstellungen sind lokal pro Gerät
   → (Keine Cross-Device Sync nötig)

## Akzeptanzkriterien

- [ ] Lautstärke wird zwischen Videos beibehalten
- [ ] Geschwindigkeit wird zwischen Videos beibehalten
- [ ] Einstellungen überleben Browser-Neustart
- [ ] Plyr-Controls zeigen aktuelle Einstellungen an

## Geschwindigkeits-Optionen

- 0.5x
- 0.75x
- 1x (Standard)
- 1.25x
- 1.5x
- 1.75x
- 2x

## Technische Notizen

- Zustand Store mit `persist` Middleware
- localStorage key: `player-settings`
- Plyr Config: `speed: { selected: 1, options: [...] }`
- Plyr Events: `volumechange`, `ratechange`
