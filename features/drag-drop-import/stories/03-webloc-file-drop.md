# User Story 03: .webloc Datei per Drag & Drop hinzufügen

**Als** macOS Nutzer
**möchte ich** Safari Bookmarks (.webloc Dateien) in die App ziehen
**damit** ich meine gespeicherten YouTube Links einfach importieren kann

## Akzeptanzkriterien

- [ ] Eine .webloc Datei kann auf Video-Liste gezogen werden
- [ ] URL wird aus der XML-Struktur extrahiert
- [ ] Video wird direkt importiert (bei einzelner Datei)
- [ ] Mehrere .webloc Dateien zeigen Vorschau-Dialog

## UX Flow (Einzelne Datei)

```
1. User hat YouTube Video als .webloc auf Desktop gespeichert
2. User zieht Datei auf die Video-Liste
   → UI zeigt Drop Zone Highlight
   → Icon zeigt Datei-Symbol
3. User lässt los (Drop)
   → .webloc wird geparst
   → URL wird extrahiert
4. Video wird importiert
   → Toast: "Video hinzugefügt"
```

## UX Flow (Mehrere Dateien)

```
1. User wählt mehrere .webloc Dateien im Finder
2. User zieht alle Dateien auf die Video-Liste
3. User lässt los (Drop)
   → ImportPreviewModal öffnet sich
   → Zeigt alle gefundenen URLs
4. User bestätigt Import
   → Alle Videos werden hinzugefügt
```

## .webloc Dateiformat

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>https://www.youtube.com/watch?v=dQw4w9WgXcQ</string>
</dict>
</plist>
```

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Korrupte .webloc Datei | Fehlermeldung: "Datei konnte nicht gelesen werden" |
| .webloc ohne YouTube URL | Fehlermeldung: "Keine YouTube URL gefunden" |
| Gemischte Dateitypen | Nur .webloc und .csv verarbeiten, Rest ignorieren |

## Technische Details

- Datei-Zugriff via FileReader API
- XML Parsing via DOMParser
- Extraktion des `<string>` Werts unter `<key>URL</key>`
- Fallback: Regex für URL-Extraktion
