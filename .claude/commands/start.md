# Task Execution Workflow

## Command Usage

**Automatisch (Standard):**
```
/start
```
→ Ich suche automatisch den letzten Report und den nächsten Task

**Manuell (Override):**
```
/start docs/plans/tasks/task-xyz.md
```
→ Ich verwende dein spezifiziertes Task-Dokument + letzten Report

## Phase 0: Dokument-Loading

**Wenn KEINE Argumente übergeben wurden:**

1. **Finde letzten Report automatisch**
   - Suche in `docs/reports/` alle Dateien mit Pattern: `YYYY-MM-DD-task-XXX-*.md`
   - Extrahiere Task-Nummer aus jedem Dateinamen (die `XXX` zwischen "task-" und dem nächsten "-")
   - Sortiere nach Task-Nummer absteigend
   - Nimm die Datei mit der **höchsten Task-Nummer**
   - Beispiel: Bei `task-137-...md`, `task-138-...md`, `task-139-...md` → nimm `task-139-...md`

2. **Finde nächsten Task automatisch**
   - Lese `status.md`
   - Suche ersten `[ ]` Task in PLAN-Sektion
   - Extrahiere Task-Nummer (z.B. `139`)
   - Suche in `docs/plans/tasks/` nach `task-139-*.md`
   - Falls mehrere: Nimm die neueste

3. **Validiere gefundene Dokumente**
   - Zeige dem User welche Dokumente ich gefunden habe
   - Format:
     ```
     📋 Gefundene Dokumente:
     - Report: docs/reports/2025-11-14-task-138-fieldslist-implementation.md
     - Task: docs/plans/tasks/task-139-field-editor.md
     ```
   - Frage: "Sind diese Dokumente korrekt? (ja/nein oder alternativer Pfad)"
   - Warte auf Bestätigung

**Wenn Argumente übergeben wurden:**

1. **Verwende übergebenen Task-Pfad**
   - Lese das spezifizierte Task-Dokument

2. **Finde letzten Report automatisch**
   - Wie oben beschrieben

3. **Validiere**
   - Zeige gefundene Dokumente
   - Warte auf Bestätigung

## Phase 1: Setup & Time Tracking

1. **Erfasse die Startzeit**
   - Führe `./berlin_time.sh` aus, um die präzise Berlin-Zeit zu ermitteln
   - Speichere die Startzeit im Format: `YYYY-MM-DD HH:MM`
   - **Wichtig:** Die Zeit wird NICHT mehr in `status.md` geschrieben
   - Die Zeit wird später in Phase 4 in `time_tracking.csv` eingetragen

2. **Identifiziere den Task**
   - Task-Nummer und Beschreibung sind bereits aus Phase 0 bekannt
   - Falls noch nicht gelesen: Lese `status.md` und finde Task

**Wichtig:** Die chronologische LOG-Historie wurde in separate Datei ausgelagert:
- **PLAN:** `status.md` - Was zu tun ist (organisiert nach Themen)
- **LOG:** `LOG.md` - Was getan wurde (chronologisch)

## Phase 2: Plan-Validierung mit REF MCP

**Bevor du mit der Implementierung beginnst, validiere den Plan mit REF MCP:**

1. **Lese alle relevanten Plan-Dokumente**
   - **Letzter Report** (automatisch gefunden oder vom User übergeben)
   - **Task-Plan** (automatisch gefunden oder vom User übergeben)
   - Weitere relevante Dokumente:
     - Technische Pläne aus `docs/plans/tasks/`
     - Komponentendokumentation aus `docs/components/`
     - Pattern-Dokumentation aus `docs/patterns/`

2. **Konsultiere REF MCP zur Validierung**

   Stelle folgende Fragen an REF:

   - **Best Practices:** Folgt der Plan den aktuellen Best Practices für die verwendeten Frameworks und Bibliotheken?
   - **Fachliche Korrektheit:** Sind die vorgeschlagenen Implementierungsansätze technisch korrekt?
   - **Halluzinationen prüfen:** Hat die KI bei der Planung Bibliotheken, APIs oder Frameworks erwähnt, die nicht existieren oder falsch verwendet werden?
   - **Architektur:** Ist der Plan optimal durchdacht? Gibt es bessere Alternativen?
   - **Kompatibilität:** Sind die vorgeschlagenen Library-Versionen kompatibel?
   - **Performance:** Gibt es Performance-Bedenken bei der vorgeschlagenen Implementierung?
   - **Testing:** Ist die Test-Strategie angemessen?

3. **Präsentiere Verbesserungsvorschläge**

   Wenn REF Verbesserungen vorschlägt, präsentiere sie dem User:

   - Schreibe Vorschläge in **ganzen Sätzen**, leicht verständlich
   - Füge **Beispiele** hinzu (Code-Snippets, konkrete Szenarien)
   - **Begründe**, warum der Vorschlag besser ist
   - Erkläre **mögliche Nachteile** oder Trade-offs
   - Warte auf User-Feedback vor der Umsetzung

   **Beispiel-Format:**
   ```
   ## REF MCP Validierung - Verbesserungsvorschläge

   ### 1. [Vorschlag-Titel]

   **Aktueller Plan:** [Was steht im Plan]

   **REF Empfehlung:** [Was schlägt REF vor]

   **Begründung:** [Warum ist das besser - mit Beispiel]

   **Nachteil:** [Falls vorhanden]

   **Beispiel:**
   ```typescript
   // Code-Beispiel
   ```
   ```

## Phase 3: Implementierung mit Subagent-Driven Development

**Verwende das `superpowers:subagent-driven-development` Skill für die Umsetzung:**

1. **Aktiviere das Skill**
   ```
   Ich verwende das subagent-driven-development Skill für die Implementierung.
   ```

2. **Folge dem Skill-Workflow**
   - Das Skill dispatcht einen frischen Subagent für jeden Task
   - Code Review zwischen Tasks
   - Ermöglicht schnelle Iteration mit Quality Gates

3. **Dokumentiere im LOG**
   - Füge einen Eintrag in `LOG.md` hinzu (nicht mehr in status.md!)
   - Format: `XXX. YYYY-MM-DD [Plan #123] Task Beschreibung`
   - Eintrag wird am Ende der Datei angefügt (chronologisch)

## Phase 4: Completion & Documentation

1. **Erstelle Implementation Report** (automatisch)
   - Verwende Template: `docs/templates/task-report-template.md`
   - Speichere in: `docs/reports/YYYY-MM-DD-task-XXX-[beschreibung].md`
   - Setze Status je nach Situation:
     - `Status: Complete` - Task vollständig abgeschlossen
     - `Status: In Progress` - Session-Ende, Task läuft weiter
     - `Status: Blocked` - Blockiert durch externe Abhängigkeiten
     - `Status: Paused` - Auf User-Feedback wartend

2. **Erfasse die Endzeit** (NACH Report)
   - Führe erneut `./berlin_time.sh` aus
   - Dokumentiere die Endzeit
   - Berechne die Dauer in Minuten (inkl. Dokumentationszeit!)
   - **Wichtig:** Die Endzeit umfasst die komplette Arbeit inkl. Report

3. **Aktualisiere Dateien mit finalen Zeiten**

   **time_tracking.csv:**
   - Füge einen neuen Eintrag am Ende der CSV-Datei hinzu
   - Format: `YYYY-MM-DD,#XXX,HH:MM,HH:MM,XXX`
   - Beispiel: `2025-11-14,#138,08:30,10:15,105`
   - **Wichtig:** Verwende `echo` mit append (`>>`) um den Eintrag hinzuzufügen

   **status.md:**
   - Markiere den Task als erledigt: `[ ]` → `[x]`
   - **KEINE Zeitinformationen mehr in status.md!** (nur Task-Nummer und Beschreibung)
   - Format: `138. [x] Task Beschreibung`

   **Report (Task Overview Sektion):**
   - Aktualisiere die Zeit im Report

   **LOG.md:**
   - Erstelle chronologischen LOG-Eintrag am Ende der Datei
   - Referenziere die Plan-Nummer
   - Format: `245. 2025-11-14 [Plan #138] Task Beschreibung`

**Beispiel completion:**
```markdown
# time_tracking.csv - CSV-Eintrag:
2025-11-14,#138,08:30,10:15,105

# status.md - PLAN Sektion:
138. [x] Implement FieldsList component

# LOG.md - Chronologischer Eintrag:
245. 2025-11-14 [Plan #138] Implement FieldsList component with TanStack Table v8

# Erstelltes Dokument:
- docs/reports/2025-11-14-task-138-fieldslist-implementation.md (Status: Complete)
```

**Nach Completion:**
- Zeige Report-Pfad und Status
- Bestätige, dass alle Schritte abgeschlossen sind

---

## Quick Reference

**Command Usage:**
- `/start` - Automatische Dokument-Suche (Report + Task)
- `/start docs/plans/tasks/task-xyz.md` - Manuelle Task-Auswahl

**Workflow:**
1. Phase 0: Dokumente laden & validieren
2. Phase 1: Zeit erfassen, Task identifizieren
3. Phase 2: REF MCP Validierung
4. Phase 3: Subagent-Driven Development
5. Phase 4: Report + Status Update (automatisch)

**Wichtige Details:**
- **Time Format:** `YYYY-MM-DD HH:MM`
- **Duration:** In Minuten berechnen
- **Script:** `./berlin_time.sh` (in project root)
- **REF Check:** Immer vor Implementierung
- **Skill:** `superpowers:subagent-driven-development`
- **Template:** `docs/templates/task-report-template.md`

**Automatische Dokumentation:**
Nach jedem Task/Session wird automatisch erstellt:
- Implementation Report in `docs/reports/` (mit Status-Flag)
- Status-Update in `status.md` (PLAN)
- LOG-Eintrag in `LOG.md` (Chronologie)

**Dateistruktur:**
- `status.md` - PLAN: Was zu tun ist (organisiert nach Themen)
- `LOG.md` - Was getan wurde (chronologisch) 