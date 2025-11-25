# Feature Understanding: Video Player Integration

## Feature Summary

Integration eines Plyr Video Players zur direkten Wiedergabe von YouTube-Videos in der App, mit erweitertem Feature-Set und Backend-Persistenz.

## Anforderungen

### Platzierung
- **VideoDetailsPage**: Player ersetzt das Thumbnail auf der Detail-Ansicht
- **VideoDetailsModal**: Player auch im Modal verfügbar

### Feature-Scope: Erweitert

**Basis-Features:**
- Play/Pause
- Lautstärkeregelung
- Fullscreen-Modus

**Standard-Features:**
- Geschwindigkeitssteuerung (0.5x - 2x)
- Picture-in-Picture
- Keyboard Shortcuts (Space, Arrow Keys, etc.)

**Erweiterte Features:**
- Wiedergabe-Fortschritt speichern (Backend)
- Timestamp-Marker (Notizen zu bestimmten Zeitpunkten)
- Kapitel-Support (falls vom Video bereitgestellt)

### Fortschritt-Persistenz
- Backend-Speicherung des Wiedergabe-Fortschritts
- Automatisches Fortsetzen beim erneuten Öffnen
- Neues Datenbank-Feld für `watch_position`

## Ziel

Benutzer können Videos direkt in der App ansehen, ohne zu YouTube wechseln zu müssen. Der Fortschritt wird gespeichert, sodass man später an derselben Stelle weiterschauen kann.

## Erwarteter User Flow

1. User öffnet Video-Details (Page oder Modal)
2. Player lädt mit YouTube-Video
3. User schaut Video, kann pausieren, vor-/zurückspulen
4. Fortschritt wird automatisch im Backend gespeichert
5. Bei erneutem Öffnen: Video setzt an letzter Position fort

## Edge Cases

- Video nicht verfügbar (gelöscht/privat) → Fallback auf Thumbnail + Fehlerhinweis
- Keine Internetverbindung → Cached Thumbnail zeigen
- Backend-Speicherung fehlgeschlagen → Lokaler Fallback (localStorage)
- Video < 30 Sekunden → Kein Fortschritt speichern (nicht sinnvoll)

## Nicht im Scope

- Offline-Wiedergabe (YouTube erlaubt das nicht)
- Download-Funktion
- Playlists / Autoplay nächstes Video
- Benutzerdefinierte Kapitel erstellen (nur YouTube-native)

## Exit Condition

✅ Feature kann in 2-3 Sätzen erklärt werden:

> "Der Plyr Video Player wird in VideoDetailsPage und VideoDetailsModal integriert. Er bietet erweiterte Features wie Geschwindigkeitssteuerung, PiP und Keyboard Shortcuts. Der Wiedergabe-Fortschritt wird im Backend gespeichert, sodass Benutzer später an derselben Stelle weiterschauen können."
