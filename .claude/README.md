# .claude Directory - Development Utilities

This directory contains workflow documentation and helper scripts for Claude Code development.

---

## 📚 Documentation Files

### `DEVELOPMENT_WORKFLOW.md` (v1.3)
**Purpose:** Master workflow document defining the 6-phase development process

**When to use:** Read at the start of EVERY new thread

**Contains:**
- Thread Start Protocol (MANDATORY)
- 6-Phase Workflow (Preparation → Implementation → Verification → Reviews → Fixing → User Report)
- Tool integration guides (Semgrep, CodeRabbit, REF MCP)
- Success criteria and quality gates

---

### `SEMGREP_QUICKREF.md`
**Purpose:** Quick reference guide for semgrep CLI usage

**When to use:** During Phase 4 (Code Reviews) or when running security scans

**Contains:**
- Installation & authentication instructions
- Common scan commands for backend/frontend
- Ruleset reference (Python, JavaScript, TypeScript, React)
- Output formats and performance tuning
- Language support details (FastAPI, React)
- Troubleshooting guide

---

### `CODERABBIT_EXAMPLES.md`
**Purpose:** CodeRabbit CLI usage examples and best practices

**When to use:** During Phase 4 (Code Reviews)

**Contains:**
- CodeRabbit CLI command examples
- Authentication setup
- Integration with workflow

---

### `THREAD_HANDOFF_TEMPLATE.md` (NEW!)
**Purpose:** Standardized template for creating thread handoff documents

**When to use:** When creating a new thread handoff document for feature work

**Contains:**
- Complete document structure with [PLACEHOLDERS]
- All essential sections (Quick Start, Completed Tasks, Pending Tasks, etc.)
- Integrated thread-start-checks.sh workflow
- Phase 1-6 workflow template
- Usage instructions and best practices
- Quality checklist

**How to use:**
```bash
# Copy template
cp .claude/THREAD_HANDOFF_TEMPLATE.md THREAD_HANDOFF_[FEATURE_NAME].md

# Replace all [PLACEHOLDERS] with actual values
# Update regularly as work progresses
# Version and date before handing off
```

**Key Benefits:**
- Ensures consistency across all thread handoffs
- Nothing gets forgotten (comprehensive sections)
- New Claude instances have clear instructions
- Reduces handoff errors and missing context

---

## 🛠️ Helper Scripts

### `thread-start-checks.sh` (Executable)
**Purpose:** Automated verification of tool setup at thread start

**When to run:** At the beginning of EVERY new thread (MANDATORY)

**Usage:**
```bash
./.claude/thread-start-checks.sh
```

**What it checks:**
- ✅ Git status & recent commits
- ✅ Semgrep authentication & version
  - Verifies Pro Rules availability (FastAPI/React)
  - Shows version: 1.139.0
  - Indicates if 637 Pro Rules are accessible
- ✅ CodeRabbit authentication & version
  - Checks if authenticated
  - Shows CLI version
- ✅ Python environment (version, pip)
- ✅ Node environment (version, npm)
- ✅ Docker services status
  - postgres (youtube-bookmarks-db)
  - redis (youtube-bookmarks-redis)
- ✅ Summary with action items

**Expected output:**
```
✅ Semgrep authenticated (Pro Rules available)
   Version: 1.139.0
   Pro Rules: FastAPI, React, Django, Flask, Express

✅ CodeRabbit authenticated
   Version: [version]

✅ Docker services running:
   - youtube-bookmarks-db (postgres)
   - youtube-bookmarks-redis (redis)
```

**If issues found:**
```
⚠️  ACTION REQUIRED: semgrep login
⚠️  ACTION REQUIRED: coderabbit auth login
```

**Duration:** ~5 seconds

---

## 🔄 Thread Handoff Workflow

### At Start of New Thread:

1. **Read Documentation:**
   ```bash
   # Read these files
   .claude/DEVELOPMENT_WORKFLOW.md
   CLAUDE.md
   ```

2. **Load Skills:**
   ```
   Skill(superpowers:using-superpowers)
   ```

3. **Run Automated Checks:**
   ```bash
   ./.claude/thread-start-checks.sh
   ```

4. **Fix Any Issues:**
   ```bash
   # If semgrep not authenticated:
   semgrep login

   # If CodeRabbit not authenticated:
   coderabbit auth login
   ```

5. **Check Task Status:**
   - Read `docs/plans/2025-10-27-initial-implementation.md`
   - Identify current task

6. **Continue with Phase 1**

---

## ⚠️ Critical Rules

### Semgrep Authentication
**Why it matters:**
- Without `semgrep login`: Missing 637 FastAPI/React Pro Rules
- Community Edition (CE) only provides basic rules
- Pro Rules include framework-specific security patterns

**Check authentication:**
```bash
semgrep login 2>&1 | grep -q "already exists" && echo "✅" || echo "⚠️"
```

### CodeRabbit Authentication
**Why it matters:**
- Reviews won't work without authentication
- Required for Phase 4 (Code Reviews)

**Check authentication:**
```bash
coderabbit auth status 2>&1 | grep -q "authenticated" && echo "✅" || echo "⚠️"
```

---

## 📊 Tool Matrix

| Tool | Auth Required | Check Command | Purpose |
|------|---------------|---------------|---------|
| **Semgrep** | Yes (for Pro) | `semgrep login` | Security & pattern scanning |
| **CodeRabbit** | Yes | `coderabbit auth status` | AI-powered code review |
| **Docker** | No | `docker-compose ps` | Services (postgres, redis) |
| **Git** | No | `git status` | Version control |

---

## 🚀 Quick Start for New Threads

```bash
# One command to check everything
./.claude/thread-start-checks.sh

# If issues, fix them:
semgrep login              # If semgrep not authenticated
coderabbit auth login      # If CodeRabbit not authenticated
docker-compose up -d       # If services not running
```

---

## 📝 Version History

### v1.4 (2025-10-28)
- Added `THREAD_HANDOFF_TEMPLATE.md` standardized template
- Documented template usage in README
- Provides consistent structure for all future thread handoffs

### v1.3 (2025-10-28)
- Added `thread-start-checks.sh` automated script
- Added Thread Start Protocol to DEVELOPMENT_WORKFLOW.md
- Enhanced Thread Handoff Checklist in CLAUDE.md
- Added tool authentication verification

### v1.2 (2025-10-28)
- Added comprehensive Semgrep documentation
- Created SEMGREP_QUICKREF.md
- Updated Phase 4 with semgrep commands

### v1.1 (2025-10-27)
- Added CodeRabbit CLI documentation
- Integrated CodeRabbit into Phase 4 workflow

---

## 🔗 Related Files

- `../CLAUDE.md` - Project guide and quick start
- `../docs/plans/` - Implementation plans
- `../backend/` - Python/FastAPI backend
- `../frontend/` - React/TypeScript frontend

---

**Last Updated:** 2025-10-28
**Directory Version:** 1.4
**Maintainer:** Claude Code Development Team
