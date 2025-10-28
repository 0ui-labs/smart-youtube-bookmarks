# Workflow-Verbesserungen: Skill-Hierarchie Problem

**Erstellt:** 2025-10-28
**Status:** Für späteren fokussierten Thread
**Priorität:** Mittel (verbessert Entwickler-Erfahrung)

---

## 🚨 Problem-Beschreibung

### Was ist passiert?

Bei der WebSocket-Feature Implementation (Tasks 1-10) ist Claude durch die Tasks gerannt ohne:
- ❌ REF MCP Research VOR Implementation (Phase 1)
- ❌ CodeRabbit CLI Reviews (Phase 4)
- ❌ Semgrep Scans (Phase 4)
- ❌ Pausen zwischen Tasks für User-Feedback (Phase 6)

### Root Cause

Der `superpowers:subagent-driven-development` Skill beschreibt nur **Phase 2 (Implementation)**, aber Claude interpretierte ihn als **kompletten Workflow**.

**Hierarchie-Konflikt:**
```
DEVELOPMENT_WORKFLOW.md (6 Phasen, MASTER)
  vs.
subagent-driven-development Skill (nur Phase 2, TOOL)
```

Claude hatte keine klare Anweisung, dass:
1. DEVELOPMENT_WORKFLOW.md = Master-Dokument
2. Skills = Tools innerhalb des Workflows
3. Skill deckt nur Phase 2 ab, Rest muss manuell passieren

---

## 📋 Anforderungen für ideale Lösung

1. **Unmöglich zu überspringen:** Workflow-Schritte können nicht vergessen werden
2. **Selbst-dokumentierend:** Klar erkennbar welche Phase gerade läuft
3. **Persistent:** Überlebt Plugin-Updates
4. **Wiederverwendbar:** Funktioniert in jedem neuen Thread
5. **Erweiterbar:** Leicht um eigene Checks erweiterbar (z.B. Selbstdokumentation)

---

## 🎯 Lösungsansätze (Detailliert)

### Option 1: DEVELOPMENT_WORKFLOW.md Hierarchie-Abschnitt

**Was:** Füge am Anfang von `.claude/DEVELOPMENT_WORKFLOW.md` einen Abschnitt hinzu, der die Hierarchie erklärt.

**Beispiel:**
```markdown
# 🚨 CRITICAL: Workflow-Hierarchie

**Dieses Dokument = MASTER-WORKFLOW (6 Phasen).**
**Skills = TOOLS innerhalb der Phasen.**

Wenn du `supagent-driven-development` verwendest:
- Der Skill macht NUR Phase 2 (Implementation)
- DU musst Phase 1 (REF MCP), 4 (CodeRabbit + Semgrep!), 6 (Pause!) TROTZDEM machen

Phase 1: REF MCP → Phase 2: Subagent Skill → Phase 3-6: Manual
```

**Vorteile:**
- ✅ Schnell umsetzbar (5 Minuten)
- ✅ Projekt-spezifisch anpassbar
- ✅ Keine Abhängigkeit von externen Skills

**Nachteile:**
- ⚠️ Claude muss aktiv daran denken, die Workflow-Datei zu lesen
- ⚠️ Kein automatischer Enforcement (kann trotzdem vergessen werden)
- ⚠️ Muss in jedem neuen Thread manuell beachtet werden

**Aufwand:** 🟢 Niedrig (5 Min.)

---

### Option 2: Granulare TodoWrite mit Workflow-Checkpoints

**Was:** Statt 10 Todos (Task 1-10) erstelle detaillierte Todos für jeden Workflow-Schritt.

**Beispiel:**
```
Aktuell (10 Todos):
☐ Task 1: Database Migration
☐ Task 2: Backend Model
...

Verbessert (50+ Todos):
☐ Task 1: REF MCP Research
☐ Task 1: Implementation
☐ Task 1: Code-Reviewer Subagent
☐ Task 1: CodeRabbit CLI
☐ Task 1: Semgrep Scan
☐ Task 1: Consolidate Issues
☐ Task 1: Fix ALL Issues
☐ Task 1: User Report
☐ Task 1: ⏸️ PAUSE - Wait for OK
☐ Task 2: REF MCP Research
...
```

**Vorteile:**
- ✅ Physisch unmöglich etwas zu überspringen (Todos müssen abgehakt werden)
- ✅ User sieht exakten Fortschritt
- ✅ Claude hat visuelle Checkliste vor Augen
- ✅ Funktioniert ohne Skill-Änderungen

**Nachteile:**
- ⚠️ Sehr lange Todo-Liste (10 Tasks × 9 Steps = 90 Todos)
- ⚠️ Könnte unübersichtlich werden
- ⚠️ Mehr Overhead beim TodoWrite-Management

**Aufwand:** 🟡 Mittel (einmalig beim Start, dann automatisch)

---

### Option 3: Meta-Orchestrator User-Skill erstellen

**Was:** Schreibe einen eigenen Skill `.claude/skills/complete-task-workflow/SKILL.md`, der andere Skills orchestriert.

**Beispiel:**
```markdown
---
name: complete-task-workflow
description: Execute tasks with full 6-phase workflow (REF MCP, Implementation, Reviews, Fixes, Pause)
---

For EACH task in the implementation plan:

## Phase 1: REF MCP Research (BEFORE Implementation)
- Dispatch Subagent: "Research best practices for [technology] using REF MCP"
- Report: Alignment issues with plan

## Phase 2: Implementation
- Use Skill(superpowers:subagent-driven-development)
- Follow that skill for implementation

## Phase 3: Verification
- Run verification commands from plan
- Evidence before claims

## Phase 4: ALL Review Tools (NOT just code-reviewer!)
- Code-Reviewer Subagent ✓
- CodeRabbit CLI: `coderabbit review --plain --base-commit <BASE> --type committed` ✓
- Semgrep: `semgrep --config=auto backend/ frontend/ --json` ✓
- Consolidate ALL issues from all 3 tools

## Phase 5: Fix ALL Issues (Option C)
- No issue ignored, not even "Suggestion"
- Re-validate after fixes

## Phase 6: User Report + MANDATORY PAUSE
- Use template from DEVELOPMENT_WORKFLOW.md
- Report: Was/Wie/Warum + Qualitäts-Metriken
- **⏸️ STOP - Wait for explicit user OK before next task**
```

**Vorteile:**
- ✅ Ein Skill = Ein Workflow (klare Abstraktion)
- ✅ Wiederverwendbar in jedem Thread
- ✅ Nutzt bestehende Skills als Bausteine
- ✅ Projekt-spezifisch anpassbar
- ✅ Überlebt Plugin-Updates (User-Skill, nicht Plugin-Skill)

**Nachteile:**
- ⚠️ Muss initial erstellt und getestet werden
- ⚠️ Redundanz zu DEVELOPMENT_WORKFLOW.md (2 Quellen der Wahrheit)
- ⚠️ Muss gepflegt werden wenn Workflow sich ändert

**Aufwand:** 🟡 Mittel (1-2 Stunden initial, dann wartbar)

---

### Option 4: Superpowers-Skill direkt ändern (Fork)

**Was:** Forke das Superpowers-Repository und ändere `subagent-driven-development.md` direkt.

**Beispiel:**
```markdown
# Subagent-Driven Development

⚠️ **IMPORTANT: This skill handles Phase 2 (Implementation) ONLY.**

You MUST still execute:
- **Phase 1 (BEFORE):** REF MCP Research via Subagent
- **Phase 4 (AFTER):** CodeRabbit CLI + Semgrep (not just code-reviewer!)
- **Phase 6 (AFTER):** User Report + ⏸️ MANDATORY PAUSE

See your project's `DEVELOPMENT_WORKFLOW.md` for complete 6-phase process.

---

## The Process (Phase 2 Implementation)
...
```

**Vorteile:**
- ✅ Skill dokumentiert sich selbst
- ✅ Funktioniert über alle Projekte hinweg
- ✅ Kann mit Upstream gemerged werden (Pull Request)

**Nachteile:**
- ⚠️ Muss Fork-Repository pflegen
- ⚠️ Upstream-Updates manuell mergen
- ⚠️ Nicht projekt-spezifisch anpassbar
- ⚠️ Aufwändiger Setup

**Aufwand:** 🔴 Hoch (Fork setup, merge management)

---

### Option 5: Lokale Skill-Patches (Technisch möglich, nicht empfohlen)

**Was:** Direkt `/Users/philippbriese/.claude/plugins/cache/superpowers/skills/` editieren.

**Vorteile:**
- ✅ Sofort wirksam

**Nachteile:**
- ❌ Wird beim nächsten Plugin-Update überschrieben
- ❌ Nicht persistent
- ❌ Schwer nachvollziehbar

**Aufwand:** 🟢 Niedrig, aber **NICHT EMPFOHLEN**

---

## 🎖️ Empfohlene Lösung: Hybrid (1 + 2 + 3)

### Kurzfristig (für aktuellen Thread):
1. **DEVELOPMENT_WORKFLOW.md erweitern** mit Hierarchie-Abschnitt (Option 1)
2. **TodoWrite granularer** machen (nicht 90, aber ~25 Checkpoints) (Option 2 light)

### Mittelfristig (eigener Thread):
3. **User-Skill erstellen**: `complete-task-workflow` (Option 3)
4. **Selbstdokumentation einbauen** (deine Idee)
5. **Testen und iterieren**

---

## 🔧 Zusätzliche Ideen (vom User erwähnt)

### Selbstdokumentation in Skills

**Idee:** Skills könnten sich selbst dokumentieren wann sie verwendet wurden, was sie gemacht haben.

**Beispiel-Struktur:**
```markdown
# Skill Execution Log

## 2025-10-28 16:30 - subagent-driven-development
- Context: WebSocket Progress Implementation
- Tasks executed: 1-10
- Issues found: Skipped Phase 1 (REF MCP), Phase 4 (CodeRabbit/Semgrep)
- Learnings: Need orchestrator skill
```

**Vorteile:**
- Debugging: Warum hat Claude das so gemacht?
- Lernen: Welche Skills wurden in welcher Reihenfolge verwendet?
- Audit Trail: Nachvollziehbarkeit

**Technisch:**
- Skills schreiben in `.claude/logs/skill-execution-log.md`
- Oder: Append zu THREAD_HANDOFF.md

---

## 📊 Vergleichsmatrix

| Kriterium | Option 1 (Workflow.md) | Option 2 (TodoWrite) | Option 3 (User-Skill) | Option 4 (Fork) |
|-----------|----------------------|---------------------|---------------------|----------------|
| **Aufwand** | 🟢 5 Min | 🟡 Einmalig | 🟡 1-2 Std | 🔴 Hoch |
| **Persistent** | ✅ | ✅ | ✅ | ⚠️ Merge-Aufwand |
| **Enforcement** | ⚠️ Manuell | ✅ Automatisch | ✅ Automatisch | ✅ Automatisch |
| **Anpassbar** | ✅ | ✅ | ✅ | ⚠️ Fork |
| **Wartbarkeit** | ✅ | ✅ | 🟡 | 🔴 |
| **Wiederverwendbar** | ⚠️ | ⚠️ | ✅ | ✅ |

---

## 🚀 Nächste Schritte (Für fokussierten Thread)

### Vorbereitung:
1. ☐ Dieses Dokument reviewen
2. ☐ Zusätzliche Ideen sammeln (Selbstdokumentation, etc.)
3. ☐ Entscheiden: Welche Option(en) kombinieren?

### Implementation:
1. ☐ User-Skill erstellen: `complete-task-workflow.md`
2. ☐ Selbstdokumentation-System designen
3. ☐ Skill-Execution-Log Struktur definieren
4. ☐ In Test-Projekt testen
5. ☐ In Production-Workflow integrieren

### Optional:
1. ☐ Pull Request an Superpowers-Repository (Disclaimer in subagent-driven-development)
2. ☐ Dokumentation für andere Nutzer schreiben

---

## 📚 Referenzen

- DEVELOPMENT_WORKFLOW.md: `.claude/DEVELOPMENT_WORKFLOW.md`
- Superpowers Skills: `/Users/philippbriese/.claude/plugins/cache/superpowers/skills/`
- Superpowers Repo: https://github.com/ckreiling/superpowers (angenommene URL)
- Claude Code Docs: https://docs.claude.com/en/docs/claude-code/

---

**Erstellt von:** Claude + Philipp (Pair-Programming)
**Für Thread:** WebSocket Progress Updates Implementation
**Kontext:** Task 2 Review - Workflow-Verletzungen identifiziert
