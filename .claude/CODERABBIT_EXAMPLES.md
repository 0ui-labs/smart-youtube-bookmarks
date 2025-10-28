# CodeRabbit CLI - Praktische Beispiele für Smart YouTube Bookmarks

> Konkrete Usage-Beispiele für CodeRabbit CLI im Smart YouTube Bookmarks Projekt

---

## 🎯 Scenario 1: Task-Implementierung Review (Backend)

**Kontext:** Task 7 "Video API Endpoints" wurde implementiert

### Schritt 1: Review nach Implementation
```bash
# Navigiere zum Projekt-Root
cd /path/to/Smart\ Youtube\ Bookmarks/

# Review committed changes (AI Agent Mode)
coderabbit --prompt-only --type committed

# Alternativ: Human-readable Output
coderabbit --plain --type committed
```

### Schritt 2: Issues analysieren
```bash
# CodeRabbit gibt Output wie:
#
# CRITICAL ISSUES:
# - app/api/videos.py:45 - SQL Injection vulnerability in query
# - app/api/videos.py:78 - Race condition in concurrent update
#
# MAJOR ISSUES:
# - app/api/videos.py:102 - Memory leak: unclosed database connection
# - tests/test_videos.py:23 - Flaky test: timing dependency
#
# MINOR ISSUES:
# - app/api/videos.py:150 - Missing docstring
# - app/models/video.py:67 - Type hint missing
```

### Schritt 3: Fixes anwenden (Option C Approach)
```bash
# Alle Issues fixen (nicht nur Critical!)
# Via Claude Code:
"Fix ALL 6 issues from CodeRabbit review:
1. [CRITICAL] SQL Injection in app/api/videos.py:45
2. [CRITICAL] Race condition in app/api/videos.py:78
3. [MAJOR] Memory leak in app/api/videos.py:102
4. [MAJOR] Flaky test in tests/test_videos.py:23
5. [MINOR] Missing docstring in app/api/videos.py:150
6. [MINOR] Type hint in app/models/video.py:67

Create separate commit for fixes."
```

### Schritt 4: Re-Validation
```bash
# Verification
pytest -v

# Zweiter CodeRabbit Run
coderabbit --prompt-only --type uncommitted

# Erwartet: 0 Critical, 0 Major, 0 Minor Issues
```

---

## 🎯 Scenario 2: Pre-Commit Review (Frontend)

**Kontext:** Neue React Component entwickelt, noch nicht committed

### Uncommitted Changes reviewen
```bash
cd /path/to/Smart\ Youtube\ Bookmarks/

# Review uncommitted changes
coderabbit --prompt-only --type uncommitted

# Output:
# CRITICAL:
# - frontend/src/components/VideoList.tsx:89 - Memory leak: useEffect missing cleanup
#
# MAJOR:
# - frontend/src/components/VideoList.tsx:45 - Re-render loop: missing dependency
#
# MINOR:
# - frontend/src/components/VideoList.tsx:120 - Unused import
```

### Fixes vor Commit anwenden
```bash
# Via Claude Code alle Issues fixen
"Fix all 3 issues from CodeRabbit:
1. Add cleanup function to useEffect (line 89)
2. Add missing dependency to useEffect (line 45)
3. Remove unused import (line 120)"

# Dann commit
git add frontend/src/components/VideoList.tsx
git commit -m "feat: add VideoList component with CodeRabbit fixes"
```

---

## 🎯 Scenario 3: Feature Branch Review vor PR

**Kontext:** feature/websocket-progress-updates Branch ist fertig

### Komplette Branch reviewen
```bash
# Review gegen main branch
coderabbit --prompt-only --base main

# Review nur die letzten 2 commits
coderabbit --prompt-only --type committed

# Background Execution für lange Reviews
coderabbit --prompt-only --base main &
# Arbeite an anderen Tasks weiter
# Komme später zurück für Ergebnisse
```

### Integration mit GitHub PR
```bash
# Nachdem PR erstellt wurde, auf GitHub:
# Comment im PR:
@coderabbitai full review

# CodeRabbit postet automatisch:
# - Summary
# - Walkthrough
# - Detailed review comments
# - Inline suggestions mit one-click fixes
```

---

## 🎯 Scenario 4: Multi-Tool Review (Phase 4 Workflow)

**Kontext:** Nach Task-Implementation, vollständiger Review-Prozess

### Step-by-Step Multi-Tool Approach
```bash
# 1. Code-Reviewer Subagent (via Claude Code)
"Dispatch code-reviewer subagent for Task 7 implementation:
- WHAT_WAS_IMPLEMENTED: Video API Endpoints (CRUD)
- BASE_SHA: abc1234
- HEAD_SHA: def5678"

# 2. CodeRabbit CLI (parallel)
coderabbit --prompt-only --type committed &

# 3. Semgrep (parallel)
cd backend
semgrep --config=auto app/ tests/ --json > ../semgrep-backend.json
cd ../frontend
semgrep --config=auto src/ --json > ../semgrep-frontend.json
cd ..

# 4. Warte auf alle Results
# Konsolidiere Issues aus:
# - Code-Reviewer Report
# - CodeRabbit Output
# - Semgrep JSON files

# 5. Fix ALL Issues (Option C)
"Fix all [N] issues from multi-tool review:

Code-Reviewer:
- Issue 1
- Issue 2

CodeRabbit:
- Issue 3
- Issue 4

Semgrep:
- Issue 5
- Issue 6

Apply fixes and create commit."
```

---

## 🎯 Scenario 5: Debugging mit CodeRabbit

**Kontext:** Flaky Test, Race Condition vermutet

### CodeRabbit für Root Cause Analysis
```bash
# Review mit Fokus auf Concurrency
coderabbit --prompt-only --type uncommitted

# CodeRabbit Output könnte sein:
# CRITICAL:
# - tests/test_concurrent_access.py:45 - Race condition detected
#   Goroutine accessing shared resource without lock
#
#   Suggestion:
#   ```python
#   async with self._lock:
#       # access shared resource
#   ```

# Via Claude Code:
"CodeRabbit identified race condition in test_concurrent_access.py:45.
Apply suggested fix with proper async lock."
```

---

## 🎯 Scenario 6: Continuous Background Review

**Kontext:** Lange Feature-Entwicklung, continuous quality checks

### Background Execution Pattern
```bash
# Start CodeRabbit im Background
coderabbit --prompt-only --type uncommitted > coderabbit-review.txt &
CR_PID=$!

# Arbeite weiter an Code
# ... edit files ...
# ... write tests ...

# Check Status
ps aux | grep $CR_PID

# Wenn fertig (nach 10-20 Minuten)
cat coderabbit-review.txt

# Falls Issues gefunden:
"CodeRabbit found [N] issues in coderabbit-review.txt.
Fix all issues:
$(cat coderabbit-review.txt)"
```

---

## 🎯 Scenario 7: Integration mit TDD Workflow

**Kontext:** Test-Driven Development für neue Feature

### TDD + CodeRabbit Combined
```bash
# Phase 1: RED - Write failing test
# ... write test ...
pytest -v  # FAILS ✗

# Phase 2: GREEN - Implement minimal code
# ... implement ...
pytest -v  # PASSES ✓

# Phase 3: REFACTOR - CodeRabbit check
git add .
git commit -m "feat: implement feature X"

coderabbit --prompt-only --type committed

# CodeRabbit Output:
# MAJOR:
# - app/feature.py:45 - Code duplication
# - app/feature.py:67 - Complex nested logic
#
# MINOR:
# - app/feature.py:89 - Magic number

# Phase 4: REFACTOR based on CodeRabbit
"Apply CodeRabbit refactoring suggestions:
1. Extract duplicated code to helper function
2. Simplify nested logic with early returns
3. Replace magic number with named constant

Ensure tests still pass after refactoring."

pytest -v  # Should still PASS ✓

git add .
git commit -m "refactor: apply CodeRabbit suggestions"
```

---

## 🛠️ Pro Tips

### Tip 1: Token Efficiency
```bash
# ALWAYS use --prompt-only with Claude Code
coderabbit --prompt-only     # ✓ Token-efficient
coderabbit --plain            # ✗ Verbose for AI Agents
```

### Tip 2: Parallel Execution
```bash
# Start CodeRabbit early, let it run in background
coderabbit --prompt-only &

# Work on other Phase 4 tasks
semgrep --config=auto app/ --json
# Dispatch code-reviewer subagent
# ...

# Come back for CodeRabbit results later
```

### Tip 3: Branch-Specific Reviews
```bash
# Review against different base branches
coderabbit --prompt-only --base main          # vs main
coderabbit --prompt-only --base develop       # vs develop
coderabbit --prompt-only --base origin/main   # vs remote
```

### Tip 4: Incremental Reviews
```bash
# After fixing issues, review only new changes
coderabbit --prompt-only --type uncommitted   # ✓ Fast
coderabbit --prompt-only                      # ✗ Reviews everything again
```

### Tip 5: Severity Filtering (Manual)
```bash
# Get full output
coderabbit --plain > review.txt

# Filter by severity
grep "CRITICAL" review.txt
grep "MAJOR" review.txt

# Option C: Fix ALL (don't filter!)
# But useful for prioritization in large reviews
```

---

## 📊 Expected Output Examples

### Minimal Output (--prompt-only)
```
🔍 CodeRabbit Review - AI Agent Mode

CRITICAL (2):
- app/api/videos.py:45: SQL injection vulnerability
- app/websocket.py:89: Race condition in concurrent access

MAJOR (3):
- app/api/videos.py:102: Memory leak - unclosed connection
- tests/test_videos.py:23: Flaky test - timing dependency
- frontend/src/components/VideoList.tsx:67: Re-render loop

MINOR (5):
- app/api/videos.py:150: Missing docstring
- app/models/video.py:67: Type hint missing
- frontend/src/utils/format.ts:34: Unused import
- backend/app/main.py:12: Console.log left in code
- tests/conftest.py:45: Hardcoded test data

Total: 10 issues
```

### Detailed Output (--plain)
```
🔍 CodeRabbit Review - Detailed Mode

════════════════════════════════════════
📁 app/api/videos.py
════════════════════════════════════════

🔴 CRITICAL - Line 45
SQL Injection Vulnerability

Current Code:
```python
query = f"SELECT * FROM videos WHERE id = {video_id}"
result = await db.execute(query)
```

Issue:
Direct string interpolation creates SQL injection risk.
Attacker could pass: "1 OR 1=1" to access all records.

Suggested Fix:
```python
query = "SELECT * FROM videos WHERE id = :id"
result = await db.execute(query, {"id": video_id})
```

References:
- OWASP Top 10: A03:2021 – Injection
- CWE-89: SQL Injection

────────────────────────────────────────

[... more issues ...]
```

---

## 🔄 Integration mit Projekt-Workflow

### Phase 4: Reviews (aus DEVELOPMENT_WORKFLOW.md)
```
1. Code-Reviewer Subagent dispatchen
   ↓
2. CodeRabbit CLI starten (background)    ← Use --prompt-only
   ↓
3. Semgrep scannen (parallel)
   ↓
4. Alle Results abwarten
   ↓
5. Issues konsolidieren
   ↓
6. Fix-Subagent dispatchen (Option C: ALL Issues)
   ↓
7. Re-Validation
```

### Konkrete Commands für Smart YouTube Bookmarks
```bash
# Backend Task (z.B. Task 7: Video API)
cd backend
coderabbit --prompt-only --type committed &
semgrep --config=auto app/ tests/ --json &
wait  # Wait for both to complete

# Frontend Task (z.B. VideoList Component)
cd frontend
coderabbit --prompt-only --type uncommitted &
npm run lint &
wait

# Full Stack Review
cd /project/root
coderabbit --prompt-only --base main  # Reviews entire branch
```

---

## 🎓 Lessons Learned

### DO:
- ✅ Use `--prompt-only` with Claude Code (token-efficient)
- ✅ Run in background for long reviews
- ✅ Fix ALL issues (Option C), not just Critical
- ✅ Re-validate after fixes
- ✅ Integrate into Phase 4 workflow
- ✅ Combine with Code-Reviewer + Semgrep

### DON'T:
- ❌ Use `--plain` with AI Agents (verbose)
- ❌ Ignore Minor/Trivial issues (Option C requires ALL fixes)
- ❌ Skip re-validation after fixes
- ❌ Run CodeRabbit without authentication check
- ❌ Forget to specify base branch for feature branches

---

**Version:** 1.0
**Created:** 2025-10-28
**Last Updated:** 2025-10-28
**For:** Smart YouTube Bookmarks Project
