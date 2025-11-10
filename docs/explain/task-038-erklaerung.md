# Task #38: Smart CSV Import mit Field Detection - Erklärung

## 🎯 Was soll gemacht werden?

Task #38 wird den bestehenden CSV-Upload für YouTube-Bookmarks erheblich verbessert. Statt nur YouTube-URLs zu importieren, soll das System automatisch **zusätzliche Spalten** erkennen und als **individuelle Felder** für jedes Video speichern.

### Aktuelle Situation vs. Ziel

**Aktuell:** Der CSV-Upload funktioniert nur mit einer `url`-Spalte:
```csv
url
https://www.youtube.com/watch?v=abc123
https://www.youtube.com/watch?v=def456
```

**Ziel:** Der CSV-Upload soll automatisch zusätzliche Felder erkennen:
```csv
url,Bewertung,Qualität,Empfohlen
https://www.youtube.com/watch?v=abc123,5,gut,ja
https://www.youtube.com/watch?v=def456,4,sehr gut,nein
```

## 🔍 Wie funktioniert die "intelligente" Erkennung?

Das System analysiert automatisch jede Spalte und erkennt den Datentyp:

1. **Bewertung (Rating):** Zahlen 1-10 → wird als Bewertungsfeld gespeichert
2. **Auswahl (Select):** Wenige verschiedene Texte (z.B. "gut", "mittel", "schlecht") → wird als Dropdown-Feld
3. **Boolean (Ja/Nein):** Werte wie "ja/nein", "true/false", "1/0" → wird als Checkbox
4. **Text:** Alles andere → wird als Textfeld

### Erkennungsalgorithmus im Detail

```python
# Prioritäten der Typ-Erkennung:
1. Boolean (höchste Priorität): ja/nein, true/false, 1/0
2. Rating: Zahlen im Bereich 1-10
3. Select: ≤10 eindeutige Werte, jeder kommt ≥2mal vor
4. Text: alles übrige (Standard)
```

## 🛠️ Was wird konkret implementiert?

1. **Typ-Erkennung:** Ein Algorithmus analysiert die CSV-Daten und schließt auf die Feldtypen
2. **Feld-Zuordnung:** Existierende Felder werden wiederverwendet (fallunabhängige Namenssuche)
3. **Automatische Erstellung:** Neue Felder werden automatisch angelegt, wenn sie noch nicht existieren
4. **Wert-Validierung:** Alle Werte werden entsprechend ihres Typs geprüft (z.B. Bewertung 1-10)
5. **Fehlerberichterstattung:** Detaillierte Fehlermeldungen pro Zeile bei ungültigen Daten
6. **Progress-Tracking:** WebSocket-Updates während des Importvorgangs

### technische Komponenten

- **`ColumnTypeDetector`**: Analysiert Spalten und erkennt Datentypen
- **`FieldValueParser`**: Validiert und konvertiert Werte entsprechend des Feldtyps
- **Erweiterte CSV-Endpoint**: Integriert die Erkennung in den bestehenden Upload

## 💡 Warum ist das nützlich?

- **Zeitersparnis:** Manuelle Felderstellung entfällt
- **Flexibilität:** Jede CSV-Datei kann individuelle Spalten enthalten
- **Fehlervermeidung:** Automatische Typ-Erkennung reduziert Konfigurationsfehler
- **Skalierbarkeit:** Große Datenmengen können effizient importiert werden

### 📋 Beispiele für die automatische Erkennung:

```csv
url,Difficulty,Priority,Completed,Notes
https://youtu.be/video1,3,high,yes,Great explanation
https://youtu.be/video2,5,medium,no,Needs examples
```

→ Wird automatisch zu:
- `Difficulty`: Bewertungsfeld (max: 5)
- `Priority`: Auswahl-Feld (Optionen: high, medium)
- `Completed`: Boolean-Feld (Ja/Nein)
- `Notes`: Textfeld

---

## 📋 Szenario: Smart CSV Import mit neuen Feldern

### Beispielszenario

Stell dir vor, du hast eine Liste "Python-Tutorials" mit bereits existierenden Feldern:
- `Bewertung` (Rating 1-5)
- `Schwierigkeit` (Select: Anfänger, Mittel, Fortgeschritten)

Jetzt importierst du eine neue CSV-Datei mit zusätzlichen Spalten:

```csv
url,Bewertung,Schwierigkeit,Dauer,Quiz,Notizen
https://youtu.be/python1,4,Anfänger,15,yes,Grundlagen erklärt
https://youtu.be/python2,5,Mittel,30,no,Objekte und Klassen
https://youtu.be/python3,3,Fortgeschritten,45,yes,Advanced patterns
```

### 🔍 Was passiert beim Import?

#### 1. **Analyse der Spalten**
Das System untersucht jede Spalte:
- `url` → Behandelt als YouTube-URL (immer erforderlich)
- `Bewertung` → **Existiert bereits** → Wird wiederverwendet
- `Schwierigkeit` → **Existiert bereits** → Wird wiederverwendet  
- `Dauer` → **Neu** → Automatisch als Rating-Feld erkannt (Zahlen 15, 30, 45)
- `Quiz` → **Neu** → Automatisch als Boolean-Feld erkannt (yes/no)
- `Notizen` → **Neu** → Automatisch als Text-Feld erkannt (individuelle Texte)

#### 2. **Intelligente Zuordnung**
```python
# Pseudocode was passiert:
für jede_spalte_in_csv:
    wenn spalte_existiert_bereits(datenbank):
        verwende_existierendes_feld()
    sonst:
        erkenne_typ_automatisch()
        erstelle_neues_feld_mit_typ()
```

#### 3. **Automatische Felderstellung**

**Ja, das System legt neue Felder automatisch an!** Für unser Beispiel:

```
Neue Felder in der Datenbank:
├── Dauer (Rating, max: 45)
├── Quiz (Boolean)  
└── Notizen (Text)
```

### 🎯 Konkrete Auswirkungen

#### **Vor dem Import:**
- 3 Felder verfügbar (Bewertung, Schwierigkeit, plus Standardfelder)

#### **Nach dem Import:**
- 6 Felder verfügbar (Bewertung, Schwierigkeit, Dauer, Quiz, Notizen)
- Alle Videos haben die neuen Werte gespeichert
- Die Felder sind sofort im Frontend verfügbar für Filterung, Sortierung, etc.

### ⚠️ Wichtige Verhaltensregeln

#### **Typ-Konflikte:**
Was passiert wenn ein existierendes Feld anders typisiert ist?

```csv
# Existierendes Feld: Status (Boolean: yes/no)
# CSV hat: Status,working,failed,complete
```

**Design-Entscheidung aus Task #38:** Das System verwendet das existierende Feld und versucht die Werte anzupassen - bei Konflikten gibt es eine Fehlermeldung.

#### **Namensgleichheit (fallunabhängig):**
```csv
# Existierendes: "schwierigkeit"
# CSV hat: "Schwierigkeit" 
```
→ Wird korrekt zugeordnet (Groß/Kleinschreibung wird ignoriert)

### 🔄 Wiederholter Import mit gleichen Feldern

Wenn du später eine weitere CSV importierst mit den gleichen neuen Spalten:

```csv
url,Bewertung,Dauer,Quiz
https://youtu.be/python4,2,20,yes
```

→ Die Felder `Dauer` und `Quiz` werden **nicht neu erstellt**, sondern die existierenden wiederverwendet.

## 🎯 Zusammenfassung

Dies macht den CSV-Import extrem benutzerfreundlich und leistungsstark für große Video-Sammlungen mit individuellen Metadaten. Der "Smart" im Smart CSV Import liegt in der automatischen Erkennung und sauberen Integration neuer Datenstrukturen ohne manuelle Vorkonfiguration.

---

## 🔗 Bezüge zu anderen Tasks

- **Task #62**: `VideoFieldValue` Modell wird benötigt um die Feldwerte zu speichern
- **Task #64**: `CustomField` Pydantic-Schemas für die Datentyp-Validierung
- **Task #109**: CSV Feld Import/Export Framework wird hiermit erweitert

## 📋 Implementierungsstatus

Die Umsetzung erfolgt in mehreren Schritten:
1. ✅ Typ-Erkennungsalgorithmus entwerfen
2. ✅ CSV Parser erweitern
3. ✅ Feldzuordnung implementieren
4. ✅ Validierungslogik erstellen
5. ⏳ Tests schreiben
6. ⏳ Dokumentation aktualisieren