# User Story 04: CSV Datei per Drag & Drop importieren

**Als** Nutzer mit einer exportierten Video-Liste
**möchte ich** eine CSV Datei in die App ziehen
**damit** ich meine Videos schnell importieren kann

## Akzeptanzkriterien

- [ ] CSV Datei kann auf Video-Liste gezogen werden
- [ ] Bestehendes CSV Format wird unterstützt
- [ ] Vorschau-Dialog zeigt Anzahl der Videos
- [ ] Fehler pro Zeile werden angezeigt
- [ ] Custom Fields werden übernommen (wenn vorhanden)

## UX Flow

```
1. User hat CSV Datei mit Video-Liste
2. User zieht CSV auf die Video-Liste
   → UI zeigt Drop Zone Highlight
   → Text: "CSV hier ablegen"
3. User lässt los (Drop)
   → CSV wird validiert
   → ImportPreviewModal öffnet sich
4. Modal zeigt:
   - "15 Videos gefunden"
   - "2 Fehler (Zeile 5, 12)"
   - Optional: Fehlerdetails aufklappbar
5. User klickt "13 Videos importieren"
   → Fortschrittsbalken
   → Backend verarbeitet CSV
6. Erfolgsmeldung: "13 Videos hinzugefügt, 2 übersprungen"
```

## Unterstütztes CSV Format

```csv
url,field_Rating,field_Category
https://youtube.com/watch?v=abc123,5,Tutorial
https://youtu.be/def456,4,Review
```

**Pflichtfeld:**
- `url` - YouTube URL

**Optionale Felder:**
- `field_<Name>` - Custom Field Werte

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Leere CSV | Hinweis: "Keine Videos gefunden" |
| Fehlende url-Spalte | Fehler: "CSV muss 'url' Spalte enthalten" |
| Sehr große Datei (>10MB) | Fehler: "Datei zu groß (max 10MB)" |
| Falsche Dateiendung | Nur .csv akzeptieren |

## Unterschied zu bestehendem CSV Upload

| Aspekt | Bestehend (Button) | Neu (Drag & Drop) |
|--------|-------------------|-------------------|
| Auslöser | Button Klick | Datei ziehen |
| Vorschau | Nein | Ja |
| Visuelles Feedback | Minimal | Drop Zone Overlay |
| API Endpoint | Gleich | Gleich |

## Technische Details

- Nutzt `application/csv` oder `text/csv` MIME Type
- Max Dateigröße: 10MB (wie bestehend)
- API: `POST /lists/{id}/videos/bulk`
- Response-Handling identisch zu bestehendem CSVUpload
