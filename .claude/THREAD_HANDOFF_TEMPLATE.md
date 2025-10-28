# 📋 Thread-Übergabe: [FEATURE_NAME]

> **INSTRUCTIONS:** Replace all [PLACEHOLDERS] with actual content. Delete sections that don't apply.

**Erstellt:** [DATE]
**Thread:** [DESCRIPTION]
**Branch:** `[BRANCH_NAME]`
**Status:** [SUMMARY_OF_CURRENT_STATE]

---

## 🎯 QUICK START für neuen Thread

```bash
# 1. Navigate to repo
cd "/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks"

# 2. Run automated thread start checks (MANDATORY!)
./.claude/thread-start-checks.sh

# This single command verifies:
# - Git status & branch
# - Semgrep authentication (Pro Rules for FastAPI/React)
# - CodeRabbit authentication
# - Docker services (postgres, redis)
# - Python/Node versions
# - Summary with action items

# Expected output:
# ✅ Semgrep authenticated (Pro Rules available) - Version: 1.139.0
# ✅ CodeRabbit authenticated
# ✅ Docker services running

# 3. Fix any issues if reported
[LIST_ANY_KNOWN_ISSUES_OR_LEAVE_BLANK]
```

**In Claude:**
```
Read(".claude/DEVELOPMENT_WORKFLOW.md")  # v1.3 with Thread Start Protocol
Read("THREAD_HANDOFF_[NAME].md")  # This document
Read("[PATH_TO_IMPLEMENTATION_PLAN]")  # If exists
Skill(superpowers:using-superpowers)
```

---

## ✅ Was ist FERTIG

> **INSTRUCTIONS:** List ALL completed tasks with commits, files, and verification status

### Task [N]: [TASK_NAME] ✅
**Commit(s):** `[COMMIT_HASH]`

**Was wurde implementiert:**
- [BULLET_POINT_1]
- [BULLET_POINT_2]
- [BULLET_POINT_3]

**Files:**
- `[FILE_PATH_1]` - [DESCRIPTION]
- `[FILE_PATH_2]` - [DESCRIPTION]

**Tests:**
- [X/X tests passing]
- Coverage: [PERCENTAGE]

**Reviews:**
- Code-Reviewer: [SUMMARY]
- CodeRabbit: [ISSUES_FOUND] → [ISSUES_FIXED]
- Semgrep: [FINDINGS]

**Verification:**
```bash
[VERIFICATION_COMMANDS_RUN]
```

---

## 🚧 Was ist OFFEN

> **INSTRUCTIONS:** List all pending tasks with estimates and requirements

### Task [N]: [TASK_NAME] (NEXT)
**Geschätzt:** [XX-XX Min]

**Was zu implementieren:**
- [REQUIREMENT_1]
- [REQUIREMENT_2]
- [REQUIREMENT_3]

**Files zu erstellen/ändern:**
- Create: `[NEW_FILE_PATH]`
- Modify: `[EXISTING_FILE_PATH]`

**Plan:** [REFERENCE_TO_PLAN_DOCUMENT]

**Workflow:**
1. Phase 1: REF MCP Research ([TOPIC])
2. Phase 2: Implementation (TDD if applicable)
3. Phase 3: Verification (pytest/npm test)
4. Phase 4: Reviews (Code-Reviewer + CodeRabbit + Semgrep)
5. Phase 5: Fix ALL issues (Option C)
6. Phase 6: User Report + ⏸️ PAUSE

---

### Task [N+1]: [NEXT_TASK_NAME]
**Geschätzt:** [XX-XX Min]

[REPEAT_AS_NEEDED]

---

## 📊 Git Status

**Branch:** `[BRANCH_NAME]`

**Recent Commits:**
```
[COMMIT_HASH] - [COMMIT_MESSAGE]
[COMMIT_HASH] - [COMMIT_MESSAGE]
[COMMIT_HASH] - [COMMIT_MESSAGE]
```

**Status:** [CLEAN / UNCOMMITTED_CHANGES / CONFLICT]

**Base Branch:** `[main/develop/etc]`

**GitHub:** [REPO_URL]

---

## ⚠️ WICHTIGE LEARNINGS

> **INSTRUCTIONS:** Document any important discoveries, issues, or patterns discovered

### 1. [LEARNING_TITLE]

**Problem:** [DESCRIPTION]

**Lösung:** [DESCRIPTION]

**Impact:** [WHY_THIS_MATTERS]

---

### 2. [LEARNING_TITLE]

[REPEAT_AS_NEEDED]

---

## 🔧 Tool Setup

> **INSTRUCTIONS:** Document the status of all development tools

### ✅ Semgrep CLI

**Status:** [AUTHENTICATED / NOT_AUTHENTICATED]
**Version:** [VERSION_NUMBER]

**Pro Rules Available:**
- [LIST_ACTIVE_RULESETS]

**Commands für Phase 4:**
```bash
# Backend
semgrep scan \
  --config=p/python \
  --config=p/security-audit \
  --config=p/owasp-top-ten \
  backend/

# Frontend
semgrep scan \
  --config=p/javascript \
  --config=p/typescript \
  --config=p/react \
  frontend/
```

**Documentation:** `.claude/SEMGREP_QUICKREF.md`

---

### ✅ CodeRabbit CLI

**Status:** [AUTHENTICATED / NOT_AUTHENTICATED]

**Commands für Phase 4:**
```bash
# AI Agent Mode (recommended)
coderabbit --prompt-only --type committed

# With specific base
coderabbit --prompt-only --base [BASE_BRANCH] --type committed
```

**Important:**
- Runs in background (7-30+ minutes)
- Use `--prompt-only` for token efficiency

**Documentation:** `.claude/DEVELOPMENT_WORKFLOW.md`

---

### ✅ Docker Services

**Status:** [RUNNING / NOT_RUNNING]

**Services:**
- postgres: [PORT] ([HEALTH_STATUS])
- redis: [PORT] ([HEALTH_STATUS])
- [OTHER_SERVICES]

**Check:**
```bash
docker-compose ps
```

---

### ✅ Automated Thread Start Checks

**Tool:** `.claude/thread-start-checks.sh`

**Verifies:**
- Git status & recent commits
- Semgrep authentication & Pro Rules
- CodeRabbit authentication
- Python/Node versions
- Docker services
- Summary with action items

**Duration:** ~5 seconds

---

## 📚 Wichtige Dateien & Ressourcen

### Workflow & Plans
- `.claude/DEVELOPMENT_WORKFLOW.md` - Master workflow (v1.3)
- `.claude/thread-start-checks.sh` - Automated checks
- `.claude/README.md` - .claude directory documentation
- `.claude/SEMGREP_QUICKREF.md` - Semgrep reference
- `[PATH_TO_IMPLEMENTATION_PLAN]` - Detailed task plan
- `[PATH_TO_DESIGN_DOC]` - Design document

### Code (Completed Tasks)
- `[FILE_PATH]` - [DESCRIPTION]
- `[FILE_PATH]` - [DESCRIPTION]
- `[FILE_PATH]` - [DESCRIPTION]

### Tests
- `[TEST_FILE_PATH]` - [DESCRIPTION]
- `[TEST_FILE_PATH]` - [DESCRIPTION]

---

## 🚀 Workflow für [NEXT_TASK_NAME]

> **INSTRUCTIONS:** Provide detailed workflow for the immediate next task

### Phase 1: REF MCP Research
```
Task(general-purpose):
  "Research best practices for [TOPIC].
   Focus on: [SPECIFIC_AREAS].
   Use REF MCP to search: '[SEARCH_QUERY]'
   Report: Alignment with our plan, recommendations."
```

### Phase 2: Implementation
```
Task(general-purpose):
  "Implement [TASK_NAME] from plan.

   [TDD_INSTRUCTIONS_IF_APPLICABLE]

   Report: [WHAT_TO_REPORT]"
```

### Phase 3: Verification
```bash
[VERIFICATION_COMMANDS]
```

### Phase 4: Reviews (ALLE 3 Tools!)
```bash
# 1. Code-Reviewer Subagent
Task(superpowers:code-reviewer):
  WHAT_WAS_IMPLEMENTED: [DESCRIPTION]
  PLAN_OR_REQUIREMENTS: [REFERENCE]
  BASE_SHA: [BASE_COMMIT]
  HEAD_SHA: [HEAD_COMMIT]
  DESCRIPTION: [SUMMARY]

# 2. CodeRabbit CLI (Background)
coderabbit --prompt-only --type committed &

# 3. Semgrep (Foreground)
semgrep scan \
  --config=p/[LANGUAGE] \
  --config=p/security-audit \
  [TARGET_FILES]
```

### Phase 5: Fix ALL Issues (Option C)
- Konsolidiere Issues aus allen 3 Tools
- Fixe JEDES Issue (auch Suggestions)
- Re-validate

### Phase 6: User-Bericht + PAUSE
```markdown
# [TASK_NAME] - ABGESCHLOSSEN

## Was wurde gemacht?
[SUMMARY]

## Wie wurde es gemacht?
[TECHNICAL_DETAILS]

## Warum so gemacht?
[DESIGN_DECISIONS]

## Qualitäts-Metriken
| Metrik | Ergebnis |
|--------|----------|
| Tests | X/X passed ✅ |
| Issues | 0 ✅ |

⏸️ **PAUSE - Warte auf OK**
```

---

## ⏱️ Geschätzter Zeitaufwand

> **INSTRUCTIONS:** Estimate time for remaining tasks

| Task | Geschätzt | Kumulativ |
|------|-----------|-----------|
| Task [N]: [NAME] | XX-XX Min | X.X-X.Xh |
| Task [N+1]: [NAME] | XX-XX Min | X.X-X.Xh |
| [REPEAT] | XX-XX Min | X.X-X.Xh |

**Total:** X.X-X.X Stunden für vollständigen Abschluss

---

## 🎯 Success Criteria

> **INSTRUCTIONS:** Define DONE criteria for this feature/branch

**Feature ist NUR dann complete wenn:**
- ✅ [CRITERION_1]
- ✅ [CRITERION_2]
- ✅ [CRITERION_3]
- ✅ Alle Tests passing (Backend: pytest, Frontend: Vitest)
- ✅ TypeScript compiles ohne Errors (if applicable)
- ✅ Multi-Tool Reviews durchgeführt (3 Tools)
- ✅ ALLE Issues gefixt (Option C)
- ✅ Final verification erfolgreich
- ✅ User hat OK gegeben für Merge/Continue

---

## 🔄 Am Ende: Branch Completion

> **INSTRUCTIONS:** Document what happens when ALL tasks are complete

Nach allen Tasks abgeschlossen:

```
Skill(superpowers:finishing-a-development-branch)
```

**Der Skill wird:**
1. Final Review aller Tasks
2. Merge-Optionen präsentieren:
   - Option A: Direct merge (git merge)
   - Option B: Pull Request (gh pr create)
   - Option C: Squash merge
3. Cleanup (branch deletion nach merge)

---

## 📞 Bei Problemen

**Wenn etwas unklar ist:**
1. Lies `.claude/DEVELOPMENT_WORKFLOW.md` nochmal
2. Checke Design-Doc/Plan für Details
3. Use `Skill(superpowers:systematic-debugging)` bei Bugs
4. Frag User für Clarification

**Bei Git-Problemen:**
```bash
git status              # Check status
git log --oneline -10   # Recent commits
git diff                # Uncommitted changes
```

**Bei Docker-Problemen:**
```bash
docker-compose ps                # Check services
docker-compose logs [SERVICE]    # Check logs
docker-compose restart [SERVICE] # Restart service
```

**Bei Test-Failures:**
```bash
# Backend
pytest -v
pytest [SPECIFIC_TEST] -v

# Frontend
npm test
npm test -- [SPECIFIC_TEST]
```

---

## 💡 Quick Tips

1. **TodoWrite nutzen:** Granular mit Checkpoints (Phase 1-6 pro Task)
2. **Evidence first:** Immer Command-Output zeigen
3. **Option C always:** Alle Issues fixen, keine Exceptions
4. **Pause religiously:** Nach jedem Task für User-OK
5. **REF MCP before coding:** Research best practices VOR Implementation
6. **Git commits:** Häufig committen, atomic changes
7. **Thread Start Checks:** IMMER `.claude/thread-start-checks.sh` ausführen

---

## ✅ Checklist für neuen Thread

```
□ cd in richtiges Verzeichnis
  cd "/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks"

□ Run automated thread start checks (MANDATORY!)
  ./.claude/thread-start-checks.sh
  # Expected: All ✅

□ Fix any issues if found
  semgrep login              # If needed
  coderabbit auth login      # If needed
  docker-compose up -d       # If needed

□ Read .claude/DEVELOPMENT_WORKFLOW.md (v1.3)
□ Read this Thread Handoff document
□ Read Implementation Plan (if exists)
□ Skill(superpowers:using-superpowers) laden
□ TodoWrite mit Tasks erstellen (granular mit Phasen!)
□ Start mit [NEXT_TASK], Phase 1 (REF MCP Research)
```

---

**Viel Erfolg! 🚀**

---

## 📝 Document Info

**Branch:** `[BRANCH_NAME]`
**Last Commit:** [COMMIT_HASH]
**GitHub:** [REPO_URL]
**Next Task:** [TASK_NAME]

**Created:** [DATE]
**Last Updated:** [DATE] (v[VERSION])
**Thread Context:** [XXk/200k tokens (XX%)]

**Changes in v[VERSION]:**
- [CHANGE_1]
- [CHANGE_2]
- [CHANGE_3]

---

## 📖 Template Usage Instructions

### How to Create a New Thread Handoff

1. **Copy this template:**
   ```bash
   cp .claude/THREAD_HANDOFF_TEMPLATE.md THREAD_HANDOFF_[FEATURE_NAME].md
   ```

2. **Replace ALL [PLACEHOLDERS]:**
   - Use Find & Replace for common values (dates, branch names, etc.)
   - Fill in specific details for each section
   - Delete sections that don't apply

3. **Key Sections to Fill:**
   - Header metadata (date, branch, status)
   - Quick Start (any special instructions)
   - Completed Tasks (with commits and verification)
   - Pending Tasks (with estimates)
   - Git Status (current state)
   - Important Learnings (discoveries, issues)
   - Tool Setup (current authentication status)
   - Next Task Workflow (detailed Phase 1-6)

4. **Update regularly:**
   - After completing each task
   - When discovering important learnings
   - When tool setup changes
   - Before handing off to new thread

5. **Version tracking:**
   - Increment version number (v1.0, v1.1, v2.0)
   - Document changes in changelog at bottom
   - Update "Last Updated" date

### Best Practices

- **Be specific:** Use exact file paths, commit hashes, command outputs
- **Be complete:** Don't skip verification steps or test results
- **Be current:** Update after each task, not at thread end
- **Be clear:** Next Claude instance should know EXACTLY what to do
- **Be honest:** Document failures, blockers, unknowns

### Quality Checklist

Before handing off thread, verify:
- ✅ All [PLACEHOLDERS] replaced
- ✅ Git status is accurate
- ✅ All completed tasks documented with commits
- ✅ Next task has detailed workflow (Phase 1-6)
- ✅ Tool authentication status verified
- ✅ Important learnings captured
- ✅ Success criteria defined
- ✅ Checklist is complete and actionable
