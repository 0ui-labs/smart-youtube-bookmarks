# User Story 01: Video-Wiedergabe starten

**Als** Benutzer der Smart YouTube Bookmarks App
**Möchte ich** Videos direkt in der App abspielen können
**Damit** ich nicht zu YouTube wechseln muss

## UX Flow

1. User öffnet VideoDetailsPage (oder Modal)
   → UI zeigt Video Player anstelle von Thumbnail
   → Player ist in Pause-Zustand

2. User klickt auf Play-Button
   → Video startet
   → Controls werden sichtbar (Plyr Standard)

3. User kann während der Wiedergabe:
   - Pausieren/Fortsetzen (Space oder Click)
   - Vor/Zurückspulen (Arrow Keys oder Timeline)
   - Lautstärke anpassen
   - Fullscreen aktivieren

4. User navigiert weg
   → Player stoppt automatisch
   → Fortschritt wird gespeichert (siehe Story 02)

## Akzeptanzkriterien

- [ ] Player ersetzt Thumbnail auf VideoDetailsPage
- [ ] Player ersetzt Thumbnail im VideoDetailsModal
- [ ] Play/Pause funktioniert per Klick und Space-Taste
- [ ] Timeline/Seeking funktioniert
- [ ] Lautstärkeregler funktioniert
- [ ] Fullscreen funktioniert
- [ ] Player ist responsive (Mobile + Desktop)

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Video nicht verfügbar | Fehlermeldung: "Video nicht verfügbar" |
| Video ist privat | Fehlermeldung: "Video ist privat" |
| Netzwerk-Fehler | Fehlermeldung + Retry-Button |
| Player-Library lädt nicht | Fallback auf Thumbnail mit YouTube-Link |

## Technische Notizen

- Plyr mit YouTube-Provider verwenden
- `data-plyr-provider="youtube"` + `data-plyr-embed-id`
- Cleanup bei Komponenten-Unmount
