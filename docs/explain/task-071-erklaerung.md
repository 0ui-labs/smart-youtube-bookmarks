# Task 71: Extend Video GET Endpoint to Include Field Values with Union Logic

## 🎯 **Was soll gemacht werden?**

Task 71 erweitert den Video-GET-Endpunkt (`GET /api/lists/{list_id}/videos`) um **benutzerdefinierte Feldwerte** in der API-Antwort. Konkret:

1. **Videos bekommen neue `field_values` Eigenschaft:** Jede Video-Antwort soll ein Array mit allen benutzerdefinierten Feldern und deren Werten enthalten
2. **Multi-Tag Union Logic:** Wenn ein Video mehrere Tags hat, die jeweils unterschiedliche Schemas (Bewertungssysteme) zugewiesen sind, sollen alle Felder aus allen Schemas zusammengeführt werden
3. **Konfliktlösung:** Bei Namenskonflikten (gleiche Feldnamen mit unterschiedlichen Typen) soll ein Schema-Präfix hinzugefügt werden

## 🔍 **Warum wird das gemacht?**

**Hauptgrund:** Das Frontend soll benutzerdefinierte Bewertungsfelder direkt auf den Video-Karten anzeigen können, **ohne zusätzliche API-Aufrufe** machen zu müssen.

**Konkretes Beispiel:**
- Du hast ein Video mit den Tags "Tutorial" und "Produktreview"
- "Tutorial" hat ein Schema mit den Feldern: "Schwierigkeit", "Dauer"
- "Produktreview" hat ein Schema mit den Feldern: "Qualität", "Preis-Leistung"
- Das Frontend soll alle 4 Felder auf einen Blick sehen können

## 🛠️ **Wie funktioniert die Union Logic?**

Die MAGIC passiert in der `_get_applicable_fields_for_video()` Funktion:

1. **Sammle alle Schema-IDs** von den Video-Tags
2. **Lade alle Felder** aus diesen Schemas mit einer einzigen optimierten Datenbankabfrage
3. **Erkenne Konflikte:**
   - Gleicher Name + Gleicher Typ → Zeige einmal (erstes Schema gewinnt)
   - Gleicher Name + Anderer Typ → Füge Schema-Präfix hinzu: "Video Qualität: Bewertung" vs "Inhalt: Bewertung"
4. **Sortiere nach display_order** (die Reihenfolge, die im Schema festgelegt wurde)

## 📊 **Technische Highlights**

### Performance-Optimierungen:
- **N+1 Prävention:** Statt für jedes Video单独 abzufragen, werden alle Feldwerte mit einer einzigen Abfrage geladen
- **selectinload() Pattern:** SQLAlchemy's optimiertes Eager Loading wird verwendet
- **Single Query Philosophy:** So wenige Datenbankabfragen wie möglich

### Datenbank-Struktur:
```sql
-- Die bereits existierende video_field_values Tabelle wird genutzt
video_field_values:
- video_id (Verweis auf das Video)
- field_id (Verweis auf das benutzerdefinierte Feld)
- value_numeric (für Bewertungen wie 4.5)
- value_text (für Text-Auswahlen wie "gut")
- value_boolean (für ja/nein Felder)
```

## 🎯 **Was ist das Endergebnis?**

### Vor Task 71:
```json
{
  "id": "video-uuid",
  "title": "Video Titel",
  "tags": [{"name": "Tutorial"}, {"name": "Review"}]
}
```

### Nach Task 71:
```json
{
  "id": "video-uuid", 
  "title": "Video Titel",
  "tags": [{"name": "Tutorial"}, {"name": "Review"}],
  "field_values": [
    {
      "field_id": "uuid-1",
      "field": {"name": "Schwierigkeit", "field_type": "select", "config": {...}},
      "value": "Fortgeschritten",
      "schema_name": null,
      "show_on_card": true
    },
    {
      "field_id": "uuid-2", 
      "field": {"name": "Qualität", "field_type": "rating", "config": {"max": 5}},
      "value": 4.5,
      "schema_name": null,
      "show_on_card": true
    }
  ]
}
```

## 🚀 **Warum ist das wichtig für das Gesamtprojekt?**

Task 71 ist ein **kritischer Baustein** für das Custom Fields System:

1. **Ermöglicht Task #82:** TagEditDialog mit Schema-Auswahl
2. **Ermöglicht Task #91-94:** Inline-Bearbeitung von Feldern im Frontend  
3. **Foundation für Features:** Video-Details, erweiterte Filterung, Import/Export

## 📝 **Status**

Basierend auf dem Code-Search ist Task 71 **bereits implementiert**:
- Die `field_values` Eigenschaft existiert in [`backend/app/schemas/video.py:139`](backend/app/schemas/video.py:139)
- Die Union Logic ist in [`backend/app/api/videos.py:421-456`](backend/app/api/videos.py:421-456) implementiert
- Tests existieren in [`backend/tests/api/test_videos.py:698-899`](backend/tests/api/test_videos.py:698-899)

**Wichtig:** Es gibt keinen separaten Report für Task 71, weil die Funktionalität direkt im Rahmen von Task #72 (Batch Update Field Values) mit implementiert und getestet wurde.

## 🔗 **Verwandte Dokumente**

- **Plan:** [`docs/plans/tasks/task-071-extend-video-endpoint-field-values.md`](../plans/tasks/task-071-extend-video-endpoint-field-values.md)
- **Abhängigkeiten:** Task #60 (FieldSchema Model), Task #61 (SchemaField Model), Task #62 (VideoFieldValue Model)
- **Folge-Tasks:** Task #72 (Batch Update Field Values), Task #82 (Tag Edit Dialog)

---

**Zusammengefasst:** Task 71 ist die "magische Brücke", die benutzerdefinierte Bewertungssysteme von den Tags zu den einzelnen Videos baut und dem Frontend alle nötigen Daten mit einer einzigen API-Antwort liefert. 🎯