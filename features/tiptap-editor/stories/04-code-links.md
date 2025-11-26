# User Story 04 - Code & Links

**As a** User
**I want to** Code-Snippets und Links einfügen
**So that** ich technische Notizen und Referenzen speichern kann

## UX Flow - Inline Code

1. User selektiert Text (z.B. `useState`)
2. Bubble Menu erscheint
3. User klickt auf Code Button (</>)
4. Text wird als Inline Code formatiert
5. Monospace Font, leichter Hintergrund

## UX Flow - Code Block

1. User tippt ``` (drei Backticks)
2. Code Block wird erstellt
3. User tippt Code
4. Syntax Highlighting (falls erkannt)
5. Enter erstellt neue Zeile im Block
6. Escape oder Klick außerhalb beendet Block

## UX Flow - Links

1. User selektiert Text
2. Bubble Menu erscheint
3. User klickt auf Link Button (🔗)
4. URL-Input erscheint
5. User fügt URL ein
6. Enter → Link wird erstellt
7. Text ist jetzt klickbar

## Bubble Menu Buttons

| Button | Icon | Funktion |
|--------|------|----------|
| Inline Code | </> | Monospace Code im Fließtext |
| Code Block | ``` | Mehrzeiliger Code-Block |
| Link | 🔗 | URL zum selektierten Text |

## Akzeptanzkriterien

### Inline Code
- [ ] Code Button formatiert als Inline Code
- [ ] Monospace Font
- [ ] Hintergrund-Highlight
- [ ] Toggle: Erneuter Klick entfernt Formatierung

### Code Block
- [ ] ``` erstellt Code Block
- [ ] Mehrzeilige Eingabe möglich
- [ ] Syntax Highlighting (Basic)
- [ ] Code-Schriftart

### Links
- [ ] Link Button öffnet URL-Input
- [ ] URL wird validiert (http/https)
- [ ] Link ist in Read-Only klickbar
- [ ] Link öffnet in neuem Tab
- [ ] Link kann bearbeitet werden
- [ ] Link kann entfernt werden

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Ungültige URL | Fehlermeldung, Link nicht erstellt |
| Link im Link | Verhindert (kein nesting) |
| Leere Selektion + Link | Nichts passiert |
| Code Block im Code Block | Verhindert |
| Paste URL auf Selektion | Link wird erstellt |
