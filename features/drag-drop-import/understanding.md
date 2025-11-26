# Feature Understanding: Drag & Drop Video Import

## Zusammenfassung

Nutzer sollen Videos per Drag & Drop zur App hinzufügen können - entweder zur Gesamtliste oder direkt einer bestimmten Kategorie zuweisen.

## Warum dieses Feature?

- **Schnellerer Workflow:** Videos hinzufügen ohne durch Dialoge navigieren zu müssen
- **Intuitive UX:** Drag & Drop ist ein natürliches Interaktionsmuster
- **Flexibilität:** Verschiedene Input-Formate unterstützen (URLs, Dateien, Listen)
- **Bessere Integration:** Nahtlose Nutzung mit Browser und Desktop

## Unterstützte Input-Formate

| Format | Beschreibung | Beispiel |
|--------|--------------|----------|
| YouTube URL | Einzelne URL aus Adresszeile | `https://youtube.com/watch?v=...` |
| `.webloc` Datei | macOS Web Location Datei | Safari Bookmark vom Desktop |
| Mehrere `.webloc` | Mehrere Dateien gleichzeitig | Ordner-Auswahl vom Desktop |
| CSV Datei | Liste von Videos | Bestehendes Import-Feature |
| Text (URLs) | Copy-Paste Liste | Mehrere URLs getrennt durch Zeilenumbruch |

## Drop-Ziele

### 1. Video-Liste (Hauptbereich)
- **Gesamtliste:** Video wird ohne Kategorie hinzugefügt
- **Gefilterte Liste:** Video wird der aktuell gefilterten Kategorie zugewiesen

### 2. Sidebar Navigation
- **Kategorie-Filter:** Video wird automatisch dieser Kategorie zugewiesen
- **"Alle Videos":** Video wird ohne Kategorie hinzugefügt

## Import-Verhalten

| Anzahl Videos | Verhalten |
|---------------|-----------|
| 1 Video | Direkt importieren, kein Dialog |
| Mehrere Videos | Vorschau-Dialog zeigen vor Import |

## Visuelles Feedback

- **Drop-Zone Highlight:** Bereich wird farblich hervorgehoben wenn Drag darüber
- **Cursor-Änderung:** Zeigt an ob Drop erlaubt ist

## Edge Cases

1. **Ungültige URL:** Fehlermeldung anzeigen, andere Videos trotzdem importieren
2. **Duplikat:** Hinweis dass Video bereits existiert
3. **Nicht-YouTube URL:** Ignorieren oder Fehlermeldung
4. **Leere Datei:** Entsprechende Meldung

## Nicht im Scope

- Drag & Drop zum Sortieren von Videos (anderes Feature)
- Drag & Drop zum Verschieben zwischen Kategorien (anderes Feature)
- Import von anderen Video-Plattformen (nur YouTube)
