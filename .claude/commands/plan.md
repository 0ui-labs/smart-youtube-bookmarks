# Task Planning Command

Bitte plane den nächsten Task aus der status.md Todo-Liste.

## 🎯 Planungsprozess

### Schritt 1: Kontext sammeln (MANDATORY)

**Lies folgende Dateien in dieser Reihenfolge:**

1. **status.md** - Identifiziere den nächsten pending Task `[ ]`
2. **Letztes Handoff** - Lies den letzten Handoff aus `docs/handoffs/` für Kontext
3. **Master Implementation Plan** - `docs/plans/2025-10-31-ID-05-ux-optimization-implementation-plan.md` - Prüfe die Task-Beschreibung im Plan
4. **Task Plan Template** - `docs/templates/task-plan-template.md` - Verwende als Struktur-Vorlage

### Schritt 2: Abhängigkeiten prüfen

**Stelle sicher, dass:**
- Alle Prerequisite-Tasks abgeschlossen sind (check status.md PLAN section)
- Benötigte Komponenten/Hooks existieren (nutze Glob/Grep)
- Backend-APIs verfügbar sind (prüfe vorherige Tasks)

**Beispiel-Checks:**
```bash
# Prüfe ob Komponente existiert
ls frontend/src/components/ComponentName.tsx

# Prüfe ob Hook existiert
ls frontend/src/hooks/useHookName.ts

# Suche nach bestehenden Patterns
grep -r "similar pattern" frontend/src/
```

### Schritt 3: Fehlende Informationen klären

**Wenn unklar, nutze AskUserQuestion für:**
- Architektur-Entscheidungen (z.B. "Welche Komponente für Layout?")
- Scope-Klarstellung (z.B. "Soll Create-Dialog in diesem Task enthalten sein?")
- Technologie-Wahl (z.B. "Welche Library für Feature X?")

**WICHTIG:** Plane NIE auf Basis von Annahmen! Wenn unsicher → User fragen!

### Schritt 4: REF MCP Best Practices Recherche (MANDATORY)

**BEVOR du den Plan schreibst, nutze REF MCP um:**

1. **Framework/Library Best Practices zu recherchieren:**
   - "React Query v5 best practices"
   - "Zustand state management patterns"
   - "shadcn/ui component composition"
   - "TanStack Table v8 filtering patterns"
   - etc.

2. **Aktuelle Dokumentation zu prüfen:**
   - Offizielle Docs der verwendeten Libraries
   - Migration Guides (v4 → v5, etc.)
   - GitHub Issues für bekannte Probleme

3. **Halluzinations-Check:**
   - Existiert die API wirklich? (Docs checken!)
   - Ist das Pattern deprecated? (Changelog prüfen!)
   - Gibt es neuere Empfehlungen? (Best Practices suchen!)

**Output:** Liste mit Verbesserungsvorschlägen für den Plan

**Format:**
```
REF MCP Validation Results:
✅ Pattern X ist aktuell (React Query v5 Docs, Stand 2024)
⚠️ Pattern Y ist deprecated, stattdessen Pattern Z nutzen (Migration Guide)
❌ API X existiert nicht, Plan halluziniert → muss angepasst werden
💡 Best Practice: Feature A sollte B nutzen statt C (Performance, 3x schneller)
```

### Schritt 5: Plan erstellen (nach REF MCP Validation)

**Nutze Task Plan Template und fülle aus:**

#### 🎯 Ziel
- 1-2 Sätze: Was soll erreicht werden?
- Erwartetes Ergebnis (konkret, testbar)

#### 📋 Acceptance Criteria
- [ ] Funktionales Kriterium 1 (mit Evidence)
- [ ] Funktionales Kriterium 2 (mit Evidence)
- [ ] Tests passing (100% Coverage für neuen Code)
- [ ] Code reviewed (Subagent + Semgrep + CodeRabbit)
- [ ] Documentation updated (JSDoc, inline comments)

#### 🛠️ Implementation Steps

**Für JEDEN Schritt:**
- **Files:** Exakte Pfade (nicht "src/component.tsx", sondern "frontend/src/components/ComponentName.tsx")
- **Action:** Klare Beschreibung was gemacht wird
- **Code Examples:** Zeige EXAKT wie es aussehen soll (nicht pseudocode!)

**Struktur:**
```markdown
### 1. [Schritt-Beschreibung]
**Files:** `frontend/src/path/to/file.tsx`
**Action:** [Was wird gemacht]

**Code:**
```tsx
// Echter Code, kein Pseudocode!
export const Component = () => {
  // Vollständiges Beispiel
}
```

**Why:** [Warum dieser Ansatz? Welche Alternativen gibt es?]
```

#### 🧪 Testing Strategy

**Unit Tests:**
- Test 1: [Was wird getestet] - [Erwartetes Ergebnis]
- Test 2: [Was wird getestet] - [Erwartetes Ergebnis]

**Integration Tests:**
- Test: [End-to-End Flow] - [Erwartetes Ergebnis]

**Manual Testing:**
1. Schritt 1 → Erwartetes Ergebnis
2. Schritt 2 → Erwartetes Ergebnis
3. Edge Case X → Erwartetes Verhalten

#### 📚 Reference

**Related Docs:**
- Master Plan: [Section X in implementation plan]
- External Docs: [URLs zu Framework Docs]

**Related Code:**
- Similar Pattern: `path/to/example.ts` (Lines XX-YY)
- Pattern to Follow: `path/to/pattern.tsx`

**Design Decisions:**
1. **Decision X:**
   - Alternatives: A, B, C
   - Chosen: B
   - Rationale: [Warum? Trade-offs?]
   - Validation: [REF MCP, Docs, etc.]

### Schritt 6: Plan Review mit User

**Zeige User den Plan mit:**

1. **Executive Summary:**
   - Was wird gebaut
   - Geschätzte Dauer
   - Abhängigkeiten

2. **Key Decisions:**
   - Wichtige Architektur-Entscheidungen
   - REF MCP Validierungs-Ergebnisse
   - Trade-offs

3. **Frage User:**
   - "Passt der Scope?"
   - "Sind die Entscheidungen nachvollziehbar?"
   - "Fehlt etwas?"

### Schritt 7: Plan speichern und LOG aktualisieren

**Nach User-Approval:**

1. **Speichere Plan:**
   ```
   docs/plans/tasks/task-NNN-description.md
   ```

   **Naming Convention:**
   - `task-019-integrate-tag-navigation.md` (3-stellig, kebab-case)
   - Speicherort: `docs/plans/tasks/` (NICHT `docs/plans/` direkt!)

2. **Update status.md:**
   - Füge LOG-Eintrag hinzu: `N. YYYY-MM-DD [Planning] Created Task #XX plan: [Description]`

3. **Commit (optional):**
   ```bash
   git add docs/plans/tasks/task-NNN-*.md status.md
   git commit -m "docs: add Task #XX implementation plan

   - Created detailed plan for [Task Name]
   - REF MCP validated against [Framework] best practices
   - [X] steps with code examples
   - Ready for implementation

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

---

## ⚠️ Häufige Fehler (AVOID!)

### ❌ Plan ohne REF MCP Validation
**Problem:** Plan basiert auf veraltetem Wissen oder Halluzinationen
**Fix:** IMMER REF MCP nutzen BEVOR Plan geschrieben wird

### ❌ Pseudocode statt echtem Code
**Problem:** Implementer muss raten wie es wirklich aussehen soll
**Fix:** Zeige VOLLSTÄNDIGE Code-Beispiele (import, export, types, alles!)

### ❌ Unklarer Scope
**Problem:** "Integrate Component" - was heißt das genau?
**Fix:** "Import Component, render in Sidebar, connect to Store, add event handlers"

### ❌ Fehlende Abhängigkeits-Checks
**Problem:** Plan sagt "nutze Component X" aber X existiert nicht
**Fix:** Prüfe mit Glob/Grep ob alle referenzierten Files existieren

### ❌ Keine Design Decisions dokumentiert
**Problem:** User/Implementer versteht nicht WARUM Ansatz X gewählt wurde
**Fix:** Jede wichtige Entscheidung mit Alternatives, Rationale, Trade-offs

### ❌ Tests als Nachgedanke
**Problem:** "Tests schreiben" als letzter Punkt
**Fix:** Testing Strategy mit konkreten Test-Cases (TDD!)

---

## 📋 Checklist (vor Plan-Finalisierung)

- [ ] status.md gelesen, nächster Task identifiziert
- [ ] Letztes Handoff gelesen, Kontext verstanden
- [ ] Master Plan gelesen, Task-Details geprüft
- [ ] Abhängigkeiten geprüft (Files existieren?)
- [ ] REF MCP Validation durchgeführt (3-5 Findings)
- [ ] Unklarheiten mit User geklärt (AskUserQuestion)
- [ ] Plan Template ausgefüllt (alle Sections)
- [ ] Code-Beispiele sind vollständig (kein Pseudocode!)
- [ ] Testing Strategy detailliert (Unit, Integration, Manual)
- [ ] Design Decisions dokumentiert (Rationale, Trade-offs)
- [ ] Plan-Datei gespeichert (docs/plans/task-NNN-*.md)
- [ ] status.md LOG aktualisiert

---

## 🎯 Erfolgskriterien

**Ein guter Plan ist:**
1. **Vollständig:** Implementer braucht keine zusätzlichen Informationen
2. **Konkret:** Exakte Pfade, vollständige Code-Beispiele, klare Steps
3. **Validiert:** REF MCP hat Best Practices bestätigt
4. **Testbar:** Testing Strategy mit konkreten Test-Cases
5. **Verständlich:** Design Decisions sind nachvollziehbar dokumentiert
6. **Geschätzt:** Realistische Zeitschätzung (basierend auf ähnlichen Tasks)

**Ein schlechter Plan ist:**
- Vage ("Irgendwie Component integrieren")
- Pseudocode ("// TODO: Add logic here")
- Unvalidiert (keine REF MCP Recherche)
- Ohne Tests ("Tests später hinzufügen")
- Ohne Rationale ("Mach es so, weil ich es sage")

---

## 💡 Pro-Tipps

### Tipp 1: REF MCP Queries formulieren
**Gut:**
- "React Query v5 queryOptions best practices 2024"
- "TanStack Table v8 filtering with Zustand state"
- "shadcn/ui Dialog component composition patterns"

**Schlecht:**
- "How to use React Query" (zu vage)
- "Table filtering" (keine Library/Version angegeben)
- "Best practices" (ohne Kontext)

### Tipp 2: Code-Beispiele strukturieren
**Gut:**
```tsx
// frontend/src/components/VideoTable.tsx
import { useTableStore } from '@/stores/tableStore'
import { Button } from '@/components/ui/button'

export const VideoTable = () => {
  const { filters, setFilter } = useTableStore()

  return (
    <div>
      {/* Vollständiges Beispiel */}
    </div>
  )
}
```

**Schlecht:**
```
// Irgendwo in der App
const table = createTable()
// ... more code here ...
```

### Tipp 3: Testing Strategy konkret machen
**Gut:**
- "Test 1: Clicking tag toggles selectedTagIds in store - Verify store.selectedTagIds includes clicked tag ID"
- "Test 2: Multiple tags selectable - Select 3 tags, verify all 3 have bg-accent class"

**Schlecht:**
- "Test tag selection"
- "Verify store works"

---

## 🔗 Verwandte Commands

- `/start` - Führt einen geplanten Task aus (nutzt den hier erstellten Plan)
- `/report` - Erstellt Report NACH Task-Completion (dokumentiert was gemacht wurde)
- `/handoff` - Erstellt Handoff für nächsten Thread (nach Report)

**Workflow:**
1. `/plan` → Erstelle Task-Plan
2. `/start` → Führe Task-Plan aus (in separatem Thread!)
3. `/report` → Dokumentiere Ergebnisse
4. `/handoff` → Übergabe an nächsten Thread
5. `/plan` → Plane nächsten Task (Zyklus wiederholt sich)

---

**Command erstellt:** 2025-11-02
**Letzte Aktualisierung:** 2025-11-02
**Version:** 1.0
