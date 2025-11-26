# User Story 03 - Lists & Structure

**As a** User
**I want to** Listen und Überschriften erstellen
**So that** ich meine Notizen strukturieren kann

## UX Flow - Listen

1. User selektiert eine oder mehrere Zeilen
2. Bubble Menu erscheint
3. User klickt auf Bullet List → Zeilen werden zur Liste
4. User drückt Enter → Neuer Listenpunkt
5. User drückt Enter bei leerem Punkt → Liste beendet

## UX Flow - Überschriften

1. User selektiert eine Zeile
2. Bubble Menu erscheint
3. User klickt auf Heading Dropdown
4. User wählt H1, H2, oder H3
5. Zeile wird zur Überschrift

## Bubble Menu Buttons

| Button | Icon | Funktion |
|--------|------|----------|
| Bullet List | • | Aufzählungsliste |
| Ordered List | 1. | Nummerierte Liste |
| Heading | H | Dropdown: H1, H2, H3, Normal |
| Blockquote | " | Zitat-Block |

## Akzeptanzkriterien

- [ ] Bullet List Button erstellt Aufzählung
- [ ] Ordered List Button erstellt nummerierte Liste
- [ ] Enter in Liste → Neuer Punkt
- [ ] Enter bei leerem Punkt → Liste beendet
- [ ] Tab → Einrücken (Nested List)
- [ ] Shift+Tab → Ausrücken
- [ ] Heading Dropdown zeigt H1, H2, H3, Normal
- [ ] Blockquote formatiert als Zitat

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Leere Zeile zu Liste | Leerer Listenpunkt |
| Liste zu Normal | Liste wird aufgelöst |
| Verschachtelte Liste | Eingerückte Unterpunkte |
| H1 zu H2 | Überschrift wechselt Level |
