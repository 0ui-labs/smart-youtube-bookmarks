# Smart YouTube Bookmarks - Development Workflow

> **Thread-übergreifende Workflow-Dokumentation**
> Diese Datei definiert den MANDATORY Workflow für alle Development Tasks.

---

## 🎯 Mandatory Skills (IMMER zuerst checken)

1. **superpowers:using-superpowers** - Mandatory first response protocol
2. **superpowers:subagent-driven-development** - Für Task-Execution
3. **superpowers:test-driven-development** - Für Backend-Tasks mit Tests
4. **superpowers:requesting-code-review** - Nach jedem Task
5. **superpowers:verification-before-completion** - Vor completion claims
6. **task-validator** - Für comprehensive validation
7. **superpowers:systematic-debugging** - Bei Bugs
8. **superpowers:finishing-a-development-branch** - Am Ende aller Tasks

---

## 📋 Workflow für JEDEN Task

### Phase 1: Vorbereitung & Planung (BEFORE Implementation)

**1. Skills laden**
- `Skill(superpowers:using-superpowers)` - Prüft, welche Skills relevant sind
- Lade identifizierte Skills

**2. Task Requirements lesen**
- Lese Task aus Plan (`docs/plans/2025-10-27-initial-implementation.md`)
- Identifiziere:
  - Welche Dateien erstellt werden sollen
  - Welche Tests geschrieben werden sollen
  - Welche Technologien verwendet werden

**3. 🆕 REF MCP Recherche VOR Umsetzung**
- **CRITICAL:** Mache Recherche VOR der Implementation, nicht danach!
- Dispatche REF-Recherche Subagent:
  ```
  Task (general-purpose):
    "Research best practices for [Technologie] using REF MCP.
    Search: '[Technology] best practices 2025'
    Compare findings with plan requirements.
    Report: Alignment issues, recommended changes."
  ```
- Prüfe Plan gegen aktuelle Docs
- Identifiziere potenzielle Issues BEVOR Implementation
- Falls Anpassungen nötig: User-Approval einholen

**4. Git Commit Hash notieren**
- `git rev-parse HEAD` - Für spätere Code Reviews

---

### Phase 2: Implementierung

**5. TDD Skill laden (bei Backend mit Tests)**
- `Skill(superpowers:test-driven-development)`
- Stelle sicher, dass RED-GREEN-REFACTOR befolgt wird

**6. Implementation Subagent dispatchen**
```
Task (general-purpose):
  "Implement Task X from plan.

  IMPORTANT:
  - Follow TDD if tests required (RED -> GREEN -> REFACTOR)
  - Create ALL files specified in plan
  - Run verification commands
  - Commit with exact message from plan

  Report:
  - What implemented
  - Test results (RED phase, GREEN phase)
  - Files changed
  - Commit hash
  - Any issues"
```

**Bei Frontend Tasks:**
- Chrome DevTools MCP für Tests verwenden
- `mcp__chrome-devtools__*` Tools nutzen

---

### Phase 3: Verification (BEFORE claiming complete)

**7. verification-before-completion Skill**
- `Skill(superpowers:verification-before-completion)`
- Führe ALLE Verification Commands aus:
  - Backend: `pytest -v`
  - Frontend: `npm run build`, `npm run dev` (check)
  - Docker: `docker-compose ps` (wenn relevant)
- **Evidence sammeln:** Command output, exit codes
- **NUR mit Evidence** completion claimen

---

### Phase 4: Reviews (Multi-Tool Approach)

**8. Code-Reviewer Subagent**
```
Task (superpowers:code-reviewer):
  "Review Task X implementation.

  WHAT_WAS_IMPLEMENTED: [Details]
  PLAN_OR_REQUIREMENTS: Task X from plan (lines X-Y)
  BASE_SHA: [hash]
  HEAD_SHA: [hash]
  DESCRIPTION: [Task summary]"
```

**9. CodeRabbit CLI**
```bash
coderabbit review --plain --base-commit <BASE_SHA> --type committed
```
- Sammle ALLE Issues aus Output

**10. Semgrep**
```bash
# Backend
semgrep --config=auto app/ tests/ --json

# Frontend
semgrep --config=auto src/ --json

# Docker
semgrep --config=auto docker-compose.yml Dockerfile --json
```
- Sammle ALLE findings

**11. Issues konsolidieren**
- Erstelle Master-Liste aller Issues aus:
  - Code-Reviewer Subagent
  - CodeRabbit CLI
  - Semgrep
  - REF MCP Vergleich

---

### Phase 5: Issue Fixing (Option C Approach)

**12. Fix-Subagent dispatchen**
- **Option C:** Fixe ALLE Issues, nicht nur Critical
- Keine Issue ignorieren

```
Task (general-purpose):
  "Fix ALL [N] issues from review.

  Issues:
  1. [Task X - CRITICAL] Description
  2. [Task X - HIGH] Description
  ...

  For each issue:
  - Apply exact fix
  - Test fix works

  Create separate commits per task if fixing multiple tasks.
  Report: All fixes applied, test results, commit hashes."
```

**13. Re-Validation**
- Führe Phase 3 (Verification) erneut aus
- Führe Phase 4 (Reviews) erneut aus (optional, bei major fixes)
- Bestätige: 0 Critical/High issues remaining

---

### Phase 6: User Communication

**14. Verständlichen Bericht erstellen**

Struktur:
```markdown
## 📊 TASK X ABGESCHLOSSEN

### ✅ Was wurde gemacht?
- Kurze Zusammenfassung (3-5 Bullet Points)
- Hauptfunktionalität erklärt

### 🔧 Wie wurde es gemacht?
- Technische Details
- Verwendete Patterns/Architekturen
- TDD Cycle (wenn relevant)

### 💡 Warum so gemacht?
- Design-Entscheidungen begründen
- Trade-offs erklären
- Best Practices nennen

### 📈 Qualitäts-Metriken
- Test Coverage: X/X passed
- Issues gefunden: X
- Issues gefixt: X
- Semgrep: 0 findings
- CodeRabbit: 0 critical issues

### 📝 Commits
- [hash] Commit message
- [hash] Fix commit message

### 🎓 Lessons Learned (optional)
- Was lief gut?
- Was könnte besser sein?
```

**15. ⏸️ PAUSE**
- **STOP hier und warte auf User-OK**
- Nicht automatisch zum nächsten Task weitergehen
- User kann Fragen stellen, Anpassungen fordern

---

## 🛠️ Tool Matrix

| Tool | Wofür | Wann verwenden |
|------|-------|----------------|
| **Superpowers Skills** | Workflow-Steuerung, TDD, Reviews | Immer |
| **task-validator** | Plan-Compliance Validierung | Nach Implementation |
| **REF MCP** (via Subagent) | Aktuelle Best Practices recherchieren | **VOR Implementation** |
| **CodeRabbit CLI** | Automatisches Code Review | Nach Implementation |
| **Semgrep** | Security & Code Quality Scan | Nach Implementation |
| **Chrome DevTools MCP** | Frontend Testing (screenshots, navigation) | Bei Frontend-Tasks |
| **pytest** | Backend Unit/Integration Tests | Bei Backend-Tasks |
| **git** | Version Control, SHA tracking | Immer |

---

## 🔄 Spezial-Workflows

### Bei Bug-Fixes
1. `Skill(superpowers:systematic-debugging)` laden
2. Root Cause Analysis durchführen
3. Test schreiben, der Bug reproduziert (RED)
4. Fix implementieren (GREEN)
5. Refactor bei Bedarf
6. Normal durch Phases 3-6

### Bei mehreren Tasks
1. `Skill(superpowers:subagent-driven-development)` verwenden
2. TodoWrite für alle Tasks erstellen
3. EIN Task nach dem anderen
4. Nach jedem Task: Pause & User-OK

### Am Ende aller Tasks
1. `Skill(superpowers:finishing-a-development-branch)` verwenden
2. Final Review
3. PR-Erstellung oder Merge-Entscheidung mit User

---

## ⚠️ Critical Rules

### Option C Approach
- **Fixe ALLE Issues**, nicht nur Critical
- Keine Issue wird ignoriert oder aufgeschoben
- Re-validate nach JEDEM Fix-Batch

### Evidence Before Claims
- NIEMALS "sollte funktionieren" sagen
- IMMER Commands ausführen und Output zeigen
- Bei Test-Claims: pytest output zeigen
- Bei Build-Claims: build output zeigen

### REF MCP BEFORE Implementation
- **CRITICAL:** Recherche VOR Implementierung
- Plan gegen aktuelle Docs abgleichen
- Potenzielle Issues VOR Code-Writing identifizieren

### Pause After Every Task
- Nach Phase 6 IMMER pausieren
- NICHT automatisch weitermachen
- User muss explizit OK geben

---

## 📚 Skill-Dependencies

```
using-superpowers (root)
├── subagent-driven-development (multi-task execution)
│   ├── test-driven-development (backend)
│   ├── requesting-code-review (reviews)
│   └── verification-before-completion (evidence)
├── systematic-debugging (bug fixes)
├── task-validator (validation)
└── finishing-a-development-branch (completion)
```

---

## 🎯 Success Criteria

Ein Task ist NUR dann complete wenn:
- ✅ Alle Dateien laut Plan erstellt
- ✅ Alle Tests geschrieben und passing
- ✅ Verification-before-completion durchgeführt
- ✅ Code-Review (3 Tools) durchgeführt
- ✅ ALLE Issues gefixt
- ✅ Re-Validation erfolgreich
- ✅ User-verständlicher Bericht erstellt
- ✅ User hat OK gegeben

---

## 📝 Template für User-Reports

```markdown
# Task X: [Name] - ABGESCHLOSSEN ✅

## Was wurde gemacht?
[3-5 Sätze Zusammenfassung]

## Wie wurde es gemacht?
### Technischer Ansatz
- [Technologie/Pattern verwendet]
- [Wichtige Implementierungsdetails]

### TDD Cycle (wenn relevant)
- RED: Test geschrieben, failed mit [Grund]
- GREEN: Implementiert, test passed
- REFACTOR: [Verbesserungen]

## Warum so gemacht?
- **Design-Entscheidung 1:** [Begründung]
- **Design-Entscheidung 2:** [Begründung]

## Qualitäts-Metriken
| Metrik | Ergebnis |
|--------|----------|
| Tests | X/X passed ✅ |
| Issues gefunden | X |
| Issues gefixt | X ✅ |
| Semgrep | 0 findings ✅ |
| CodeRabbit | 0 critical ✅ |

## Commits
- `abc1234` - [Message]
- `def5678` - [Fix message]

## Bereit für nächsten Schritt?
⏸️ **Warte auf dein OK für Task Y**
```

---

**Version:** 1.0
**Letzte Aktualisierung:** 2025-10-27
**Gilt für:** Alle Tasks im Smart YouTube Bookmarks Projekt
