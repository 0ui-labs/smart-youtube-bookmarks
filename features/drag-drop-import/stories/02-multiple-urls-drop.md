# User Story 02: Mehrere URLs per Copy-Paste Liste hinzufügen

**Als** Nutzer der Video-Bookmark App
**möchte ich** eine Liste von YouTube URLs auf einmal hinzufügen
**damit** ich mehrere Videos schnell importieren kann

## Akzeptanzkriterien

- [ ] Text mit mehreren URLs kann auf Video-Liste gezogen werden
- [ ] URLs werden durch Zeilenumbrüche oder Kommas getrennt erkannt
- [ ] Vorschau-Dialog zeigt alle erkannten Videos
- [ ] Ungültige URLs werden markiert aber nicht blockierend
- [ ] Import-Button für alle gültigen URLs
- [ ] Fortschrittsanzeige während Import

## UX Flow

```
1. User hat Liste von URLs (z.B. aus Notizen, E-Mail)
2. User kopiert die URLs
3. User zieht den Text auf die Video-Liste
   → UI zeigt Drop Zone Highlight
   → Text: "Videos hier ablegen"
4. User lässt los (Drop)
   → ImportPreviewModal öffnet sich
5. Modal zeigt:
   - 5 gültige YouTube URLs ✓
   - 1 ungültige URL ✗ (rot markiert)
   - 1 Duplikat ⚠️ (bereits vorhanden)
6. User klickt "5 Videos importieren"
   → Fortschrittsbalken
   → Videos werden nacheinander hinzugefügt
7. Erfolgsmeldung: "5 Videos hinzugefügt"
```

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Alle URLs ungültig | Hinweis, Import-Button deaktiviert |
| Mix aus gültig/ungültig | Nur gültige importieren, Fehler anzeigen |
| Sehr viele URLs (>50) | Warnung anzeigen, trotzdem erlauben |
| Leerer Text | Hinweis: "Keine URLs erkannt" |

## URL Parsing Regeln

Erkannte Formate:
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- URLs mit zusätzlichen Parametern (`&t=120s`, `&list=...`)

Trennzeichen:
- Zeilenumbruch (`\n`)
- Komma (`,`)
- Semikolon (`;`)
- Leerzeichen (nur wenn umgeben von URLs)

## Technische Details

- Nutzt `text/plain` aus DataTransfer
- Parsing via `parseUrlsFromText()` Utility
- Deduplizierung gegen bestehende Videos
- API Call: `POST /lists/{id}/videos/bulk` (CSV Format)
