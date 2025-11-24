# Feature: YouTube-Kanäle in der Sidebar

## Zusammenfassung

Automatische Erkennung und Anzeige von YouTube-Kanälen in der App-Sidebar. Wenn ein Video hinzugefügt wird, wird der zugehörige Kanal automatisch erfasst und unter einer neuen Sidebar-Sektion "Kanäle" angezeigt. Nutzer können auf Kanäle klicken, um alle Videos dieses Kanals zu filtern.

## Warum dieses Feature?

- Nutzer haben oft Videos von bestimmten Lieblingskanälen gespeichert
- Schneller Zugriff auf alle Videos eines Kanals ohne manuelle Tags
- Natürliche Organisationsebene, die YouTube selbst vorgibt
- Ergänzt die bestehenden Kategorien/Labels ohne sie zu ersetzen

## Kernfunktionalität

### 1. Automatische Kanal-Erstellung
- Beim Hinzufügen eines Videos wird der YouTube-Kanal automatisch erkannt
- Falls der Kanal noch nicht existiert, wird er automatisch angelegt
- Keine manuelle Kanal-Erstellung durch den Nutzer nötig

### 2. Sidebar-Sektion "Kanäle"
- Neue Sektion in der Sidebar unterhalb/oberhalb der Kategorien
- Überschrift: "Kanäle"
- Listet alle Kanäle auf, von denen Videos gespeichert wurden
- Zeigt Video-Anzahl als Badge neben dem Kanalnamen (z.B. "MrBeast (12)")

### 3. Kanal-Filterung
- Klick auf Kanal in der Sidebar → zeigt nur Videos dieses Kanals
- Single-Select (nur ein Kanal gleichzeitig auswählbar)
- Kombinierbar mit anderen Filtern (Kategorien, Labels, Feldfilter)

### 4. Klickbare Kanäle in Video-Items
- In der Grid- und Listen-Ansicht wird der Kanalname bei jedem Video angezeigt
- Klick auf Kanalname → filtert nach diesem Kanal
- Gleiche Funktionalität wie Sidebar-Klick

### 5. Kanal-Avatar (optional)
- Per Default: Nur Kanalname als Text
- In Settings konfigurierbar: Kanal-Thumbnail anzeigen
- Format: 24x24 Pixel, rund (wie auf YouTube)
- Avatar wird aus YouTube API geladen

### 6. Kanal ausblenden
- Nutzer kann einzelne Kanäle in der Sidebar ausblenden
- Ausgeblendete Kanäle erscheinen nicht in der Sidebar-Liste
- Videos bleiben erhalten, nur Sidebar-Anzeige wird unterdrückt

### 7. Leere Kanäle
- Wenn alle Videos eines Kanals gelöscht werden, wird der Kanal automatisch gelöscht
- Kein manuelles Aufräumen nötig

## Nicht im Scope

- Kanal-Abonnements von YouTube importieren
- Neue Videos eines Kanals automatisch hinzufügen
- Kanal-Statistiken (Abonnenten, etc.) anzeigen
- Kanäle manuell erstellen oder umbenennen

## Zielgruppe

Alle Nutzer der App, die Videos von verschiedenen YouTube-Kanälen speichern und diese nach Kanal organisieren möchten.

## Erwarteter User Flow

1. Nutzer fügt YouTube-Video hinzu
2. System erkennt Kanal automatisch (z.B. "MrBeast")
3. Kanal erscheint in Sidebar unter "Kanäle" mit Badge "(1)"
4. Nutzer fügt weiteres Video vom selben Kanal hinzu → Badge wird "(2)"
5. Nutzer klickt auf "MrBeast" in Sidebar → sieht nur MrBeast-Videos
6. Nutzer klickt auf Kanalname in Video-Card → gleiches Verhalten

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Kanal ändert Namen auf YouTube | Wird beim nächsten Video-Update aktualisiert |
| Video hat keinen Kanal (theoretisch unmöglich) | Fallback auf "Unbekannter Kanal" |
| Sehr viele Kanäle (>50) | Scrollbare Liste, evtl. Suchfeld später |
| Kanal-Name sehr lang | Truncation mit Ellipsis |
