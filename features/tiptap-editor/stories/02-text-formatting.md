# User Story 02 - Text Formatting

**As a** User
**I want to** Text formatieren (fett, kursiv, durchgestrichen)
**So that** ich wichtige Stellen hervorheben kann

## UX Flow

1. User tippt Text im Editor
2. User selektiert einen Teil des Textes (Drag oder Shift+Pfeiltasten)
3. Bubble Menu erscheint über der Selektion
4. User klickt auf Bold (B) → Text wird fett
5. User klickt auf Italic (I) → Text wird kursiv
6. Bubble Menu verschwindet bei Klick außerhalb

## Bubble Menu Buttons

| Button | Icon | Shortcut | Funktion |
|--------|------|----------|----------|
| Bold | **B** | Cmd+B | Fettschrift |
| Italic | *I* | Cmd+I | Kursivschrift |
| Strikethrough | ~~S~~ | Cmd+Shift+S | Durchgestrichen |

## Akzeptanzkriterien

- [ ] Bubble Menu erscheint bei Text-Selektion
- [ ] Bold Button macht Text fett
- [ ] Italic Button macht Text kursiv
- [ ] Strikethrough Button streicht Text durch
- [ ] Aktive Formatierung wird im Menu hervorgehoben
- [ ] Erneuter Klick entfernt Formatierung (Toggle)
- [ ] Keyboard Shortcuts funktionieren

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Kein Text selektiert | Bubble Menu erscheint nicht |
| Bereits fetter Text selektiert | Bold Button ist aktiv (highlighted) |
| Mehrfache Formatierung | Alle aktiven Buttons highlighted |
| Selektion aufgehoben | Bubble Menu verschwindet |
