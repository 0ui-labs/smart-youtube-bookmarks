# User Story 01 - Basic Text Editing

**As a** User
**I want to** Text in einem Notizfeld eingeben und bearbeiten
**So that** ich meine Gedanken zu Videos festhalten kann

## UX Flow

1. User öffnet Video-Details (Seite oder Modal)
2. User klickt auf "Mehr Informationen" Button
3. User sieht das Text-Feld (Notizen)
4. User klickt in das Feld → Cursor blinkt
5. User tippt Text → Text erscheint im Editor
6. User verlässt das Feld → Text wird automatisch gespeichert

## Akzeptanzkriterien

- [ ] Text-Feld ist klickbar und fokussierbar
- [ ] Cursor blinkt bei Fokus
- [ ] Eingabe wird sofort angezeigt
- [ ] Mehrzeilige Eingabe möglich (Enter-Taste)
- [ ] Auto-Save beim Verlassen des Feldes
- [ ] Placeholder "Notizen eingeben..." bei leerem Feld

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Leeres Feld | Placeholder anzeigen |
| Sehr langer Text | Editor scrollt, kein Overflow |
| Schnelles Tippen | Keine Lag, sofortige Anzeige |
| Copy/Paste | Text wird eingefügt |
| Undo/Redo | Cmd+Z / Cmd+Shift+Z funktioniert |
