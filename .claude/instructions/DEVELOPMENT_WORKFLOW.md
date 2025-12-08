# Smart YouTube Bookmarks - Development Workflow

> **Thread-übergreifende Workflow-Dokumentation**
> Diese Datei definiert den MANDATORY Workflow für alle Development Tasks.

---

## 🚨 CRITICAL: Workflow-Hierarchie

**⚠️ DIESES DOKUMENT = MASTER-WORKFLOW (6 Phasen)**

**Skills wie `subagent-driven-development` sind TOOLS INNERHALB dieses Workflows:**

```text
Phase 1: REF MCP Research (VOR Implementation!)
Phase 2: Implementation ← HIER: subagent-driven-development Skill
Phase 3: Verification (Evidence before claims)
Phase 4: Reviews ← Code-Reviewer + CodeRabbit CLI + Semgrep (ALLE 3!)
Phase 5: Fix ALL Issues (Option C)
Phase 6: User-Bericht + ⏸️ MANDATORY PAUSE
```

**Wenn ein Skill nur Phase 2 beschreibt = Du musst Phase 1, 3-6 TROTZDEM machen!**

Der `subagent-driven-development` Skill macht NUR Phase 2 (Implementation).
DU musst IMMER NOCH:
- Phase 1: REF MCP Research via Subagent (VORHER!)
- Phase 4: CodeRabbit CLI + Semgrep zusätzlich zu Code-Reviewer (NACHHER!)
- Phase 6: User-Bericht erstellen + ⏸️ PAUSE (MANDATORY!)

---

## 🔄 Thread Start Protocol (MANDATORY bei jedem neuen Thread)

**CRITICAL:** Führe diese Checks IMMER am Anfang eines neuen Threads aus!

### 1. Dokumentation lesen
- Read `.claude/DEVELOPMENT_WORKFLOW.md` (diese Datei)
- Read `CLAUDE.md`

### 2. Skills laden
- Load `Skill(superpowers:using-superpowers)`

### 3. Git Status prüfen
```bash
git status
git log --oneline -10
```

### 4. Tool Authentication Status prüfen

**BEST PRACTICE:** Nutze das automatische Check-Script:

```bash
# Führe alle Thread-Start-Checks auf einmal aus
./.claude/thread-start-checks.sh
```

**Das Script prüft:**
- ✅ Git Status & Recent Commits
- ✅ Semgrep Authentication & Version
- ✅ CodeRabbit Authentication & Version
- ✅ Python & Node Environment
- ✅ Docker Services Status
- ✅ Summary mit Action Items

**Manuelle Checks (alternativ):**
```bash
# Semgrep Authentication Check
semgrep login 2>&1 | grep -q "already exists" && echo "✅ Semgrep authenticated (Pro Rules available)" || echo "⚠️ Semgrep NOT authenticated - Run: semgrep login"

# CodeRabbit Authentication Check
coderabbit auth status 2>&1 | grep -q "authenticated" && echo "✅ CodeRabbit authenticated" || echo "⚠️ CodeRabbit NOT authenticated - Run: coderabbit auth login"

# Version Checks
echo "Semgrep version: $(semgrep --version)"
echo "CodeRabbit version: $(coderabbit --version 2>&1 | head -1)"
```

**Warum wichtig:**
- **Semgrep ohne Auth** = Keine FastAPI/React Pro Rules (637 Rules fehlen!)
- **CodeRabbit ohne Auth** = Reviews funktionieren nicht
- In neuen Threads weißt du NICHT ob Tools authentifiziert sind
- Diese Checks dauern <5 Sekunden und verhindern Issues später

**Expected Output:**
```
✅ Semgrep authenticated (Pro Rules available)
   Version: 1.139.0
   Pro Rules: FastAPI, React, Django, Flask, Express

✅ CodeRabbit authenticated
   Version: [version]
```

### 5. Current Task Status
- Read implementation plan: `docs/plans/2025-10-27-initial-implementation.md`
- Identify current task and dependencies

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
- **⚠️ MANDATORY: IMMER via Subagent ausführen!**
  - **Warum:** REF Research verbraucht viele Tokens im Main Thread
  - **Nie direkt** im Main Thread REF MCP Tools aufrufen
  - **Immer** über Task-Subagent dispatchen
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
```text
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
```text
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
# AI Agent Mode (token-efficient, optimiert für Claude Code)
coderabbit --prompt-only --type uncommitted

# Alternative: Human-readable Output (uses review subcommand)
coderabbit review --plain

# Mit spezifischem Base Branch
coderabbit --prompt-only --type uncommitted --base main
```
- **IMPORTANT:** Läuft im Hintergrund, kann 7-30+ Minuten dauern
- **BEST PRACTICE:** Verwende `--prompt-only` für AI Agent Integration
- Sammle ALLE Issues aus Output (Critical, Major, Minor)

**10. Semgrep** (siehe `.claude/SEMGREP_QUICKREF.md` für Details)
```bash
# IMPORTANT: Authentifiziere zuerst für FastAPI/React-spezifische Pro Rules
semgrep login

# Option A: Quick Full Scan
semgrep scan --config=auto --text --output=semgrep-results.txt

# Option B: Backend Security Audit (empfohlen)
semgrep scan \
  --config=p/python \
  --config=p/security-audit \
  --config=p/owasp-top-ten \
  --json-output=backend-audit.json \
  backend/

# Option C: Frontend Security Audit (empfohlen)
semgrep scan \
  --config=p/javascript \
  --config=p/typescript \
  --config=p/react \
  --json-output=frontend-audit.json \
  frontend/

# Option D: Authenticated CI Mode (diff-aware, nur geänderte Files)
semgrep ci --text --output=semgrep-ci.txt
```
- **Speed:** Fast (seconds-minutes) vs CodeRabbit (7-30+ min)
- **⚠️ IMPORTANT:** Authentifiziere mit `semgrep login` für FastAPI/React Pro Rules
- **Framework Support:** FastAPI, React, Express explizit unterstützt (GA)
- Sammle ALLE findings (Security, Bugs, Patterns)

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
| **REF MCP** ⚠️ NUR via Subagent! | Aktuelle Best Practices recherchieren | **VOR Implementation** (Token-Management!) |
| **CodeRabbit CLI** | AI-powered Code Review: Race Conditions, Memory Leaks, Security Vulnerabilities, Logic Errors | Nach Implementation (Phase 4) - Verwende `--prompt-only` |
| **Semgrep** | Security & Code Quality Scan (Pattern Matching) | Nach Implementation (Phase 4) - Verwende `semgrep login` + `.claude/SEMGREP_QUICKREF.md` |
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
- **MANDATORY:** IMMER via Subagent (Token-Management!)
- Plan gegen aktuelle Docs abgleichen
- Potenzielle Issues VOR Code-Writing identifizieren
- NIEMALS direkt im Main Thread REF MCP Tools aufrufen

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

## 🔧 CodeRabbit CLI Setup & Verwendung

### Erstmalige Installation
```bash
# Installation
curl -fsSL https://cli.coderabbit.ai/install.sh | sh

# Shell neustarten oder:
source ~/.bashrc

# Authentifizierung
coderabbit auth login
# Folge dem Browser-Flow, Token wird automatisch gespeichert

# Status prüfen
coderabbit auth status
```

### Verwendung im Workflow

**Nach Task-Implementation (Phase 4):**
```bash
# Best Practice: AI Agent Mode (für uncommitted changes)
coderabbit --prompt-only --type uncommitted

# Für bereits committed changes (nach Commit)
coderabbit --prompt-only --type committed

# Mit spezifischem Base Branch
coderabbit --prompt-only --base main
```

**Im Hintergrund laufen lassen:**
- CodeRabbit dauert 7-30+ Minuten
- Lasse es im Hintergrund laufen
- Arbeite an anderen Tasks weiter (z.B. Semgrep)
- Komme zurück für Ergebnisse

**Severity Levels:**
- **Critical**: System Failures, Security Breaches, Data Loss
- **Major**: Funktionalitäts-/Performance-Impact
- **Minor**: Non-Critical Issues
- **Trivial**: Code Quality Improvements
- **Info**: Kontextuelle Kommentare

**Option C Approach:**
- Fixe ALLE Issues (nicht nur Critical/Major)
- Auch Minor & Trivial Issues werden adressiert
- Re-validate nach allen Fixes

### Troubleshooting
```bash
# Auth-Status prüfen
coderabbit auth status

# CLI updaten
coderabbit update

# Help anzeigen
coderabbit --help
```

---

## 🔍 Semgrep CLI Setup & Verwendung

### Erstmalige Installation
```bash
# macOS (empfohlen)
brew install semgrep

# Alternativ: pip (alle Plattformen)
python3 -m pip install semgrep

# Verify Installation
semgrep --version

# Authentifizierung (für FastAPI/React Pro Rules)
semgrep login
# Folge dem Browser-Flow für GitHub/GitLab Auth
```

**Prerequisites:**
- Python 3.9+
- GitHub oder GitLab Account (für Pro Rules)

### Verwendung im Workflow

**Nach Task-Implementation (Phase 4):**
```bash
# 1. CodeRabbit starten (Hintergrund) - für uncommitted changes
coderabbit --prompt-only --type uncommitted &

# 2. Semgrep parallel (Vordergrund, schnell)
semgrep scan \
  --config=p/python \
  --config=p/security-audit \
  --config=p/owasp-top-ten \
  backend/

# 3. Frontend Scan
semgrep scan \
  --config=p/javascript \
  --config=p/typescript \
  --config=p/react \
  frontend/
```

**Best Practices:**
- **Authentifiziere IMMER** mit `semgrep login` für Framework-spezifische Rules
- **Community Edition (CE):** Funktioniert ohne Auth, aber **FastAPI/React Rules fehlen!**
- **Pro Rules:** Erfordern Auth, bieten Cross-File + Framework-spezifische Analysis

### Language Support (für dieses Projekt)

| Language | Status | Parse Rate | True Positive | Features |
|----------|--------|------------|---------------|----------|
| Python (FastAPI) | GA | 99%+ | 84% | Cross-file, Cross-function, FastAPI-specific |
| JavaScript/TypeScript (React) | GA | 99%+ | 63% | Cross-file, Cross-function, React-specific |

**⚠️ CRITICAL:** "Many framework specific Pro rules will **fail** if run on Semgrep CE"

### Output Formats
```bash
# Text (human-readable)
semgrep scan --config=auto --text --output=results.txt

# JSON (for parsing)
semgrep scan --config=auto --json --output=results.json

# SARIF (for IDE integration)
semgrep scan --config=auto --sarif --output=results.sarif

# Multiple formats
semgrep ci --text --output=text.txt --json-output=json.json
```

### Performance
- **Speed:** Seconds to minutes (vs CodeRabbit: 7-30+ min)
- **Parallel Processing:** `semgrep scan --config=auto -j 4`
- **Timeout Control:** `semgrep ci --timeout 45 --timeout-threshold 2`

### Common Rulesets
```bash
# Python Security
--config=p/python
--config=p/security-audit
--config=p/owasp-top-ten

# JavaScript/TypeScript Security
--config=p/javascript
--config=p/typescript
--config=p/react

# Auto-detect (all languages)
--config=auto
```

### Troubleshooting
```bash
# Update Semgrep
brew upgrade semgrep  # macOS
python3 -m pip install --upgrade semgrep  # pip

# Check version
semgrep --version

# Verbose output for debugging
semgrep scan --config=auto -v

# Profile slow scans
semgrep scan --config=auto --time
```

**Memory Issues (Exit -11/-9):**
- Reduce parallel jobs: `semgrep scan -j 1`
- Skip large files: `--exclude='**/large-file.py'`

### Integration mit anderen Tools

| Vergleich | Semgrep | CodeRabbit |
|-----------|---------|------------|
| **Speed** | ⚡ Fast (sec-min) | 🐢 Slow (7-30+ min) |
| **Method** | Pattern Matching | AI Analysis |
| **Focus** | Security, Bugs | Comprehensive Review |
| **Best For** | Quick security scans | In-depth reviews |

**Empfehlung:** Beide Tools parallel nutzen:
1. Starte CodeRabbit im Hintergrund
2. Führe Semgrep im Vordergrund aus
3. Sammle Results aus beiden Tools

### Weitere Informationen
- **Quick Reference:** `.claude/SEMGREP_QUICKREF.md`
- **Official Docs:** https://semgrep.dev/docs
- **Rule Explorer:** https://semgrep.dev/explore

---

**Version:** 1.3
**Letzte Aktualisierung:** 2025-10-28
**Gilt für:** Alle Tasks im Smart YouTube Bookmarks Projekt

**Changes in v1.3:**
- Added "Thread Start Protocol" section (MANDATORY für neue Threads)
- Created automated thread-start-checks.sh script
- Added tool authentication verification workflow
- Ensures semgrep/CodeRabbit status is checked at thread start

**Changes in v1.2:**
- Added comprehensive Semgrep CLI section
- Updated Phase 4 with detailed semgrep commands
- Added reference to `.claude/SEMGREP_QUICKREF.md`
