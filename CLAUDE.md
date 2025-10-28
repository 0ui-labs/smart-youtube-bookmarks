# Smart YouTube Bookmarks - Claude Development Guide

> **MANDATORY:** Read `.claude/DEVELOPMENT_WORKFLOW.md` FIRST in every new thread!

**Workflow Documentation:** [`.claude/DEVELOPMENT_WORKFLOW.md`](.claude/DEVELOPMENT_WORKFLOW.md)

---

## 🚀 Quick Start for New Threads

1. **Read Workflow:** `Read(.claude/DEVELOPMENT_WORKFLOW.md)`
2. **Check Plan:** `docs/plans/2025-10-27-initial-implementation.md`
3. **Check Git Status:** `git status` and `git log --oneline -10`
4. **Load Skills:** `Skill(superpowers:using-superpowers)`
5. **Continue:** Follow 6-phase workflow from documentation

---

## 📂 Project Structure

```
Smart Youtube Bookmarks/
├── .claude/
│   └── DEVELOPMENT_WORKFLOW.md          ← Read this FIRST!
├── .worktrees/
│   └── initial-implementation/          ← Current working directory
│       ├── backend/                     (FastAPI, Python 3.11)
│       ├── frontend/                    (React 18, TypeScript, Vite)
│       ├── docs/plans/                  (Implementation plans)
│       └── docker-compose.yml           (PostgreSQL, Redis)
├── CLAUDE.md                            ← You are here
└── README.md
```

---

## 🎯 Current Status

**Branch:** `feature/initial-implementation` (in worktree)

**Completed Tasks:**
- ✅ Task 1-3: Backend setup (models, database, Alembic)
- ✅ Task 4: Frontend Project Structure (React, Vite, TypeScript)
- ✅ Task 5: Docker Compose Setup (PostgreSQL, Redis)
- ✅ Task 6: List API Endpoints (CRUD with TDD)
- ✅ All 13 validation issues fixed

**Next Task:**
- Task 7: Video API Endpoints

**Git Commits:** See `git log --oneline` for full history

---

## 🛠️ Development Setup

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
pytest  # Run tests
uvicorn app.main:app --reload
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev  # Starts on localhost:5173
npm run build
```

### Docker Services
```bash
docker-compose up -d postgres redis
docker-compose ps  # Check health
```

---

## 📋 Mandatory Skills & Tools

### Superpowers Skills (Always Use)
1. `superpowers:using-superpowers` - Mandatory first response
2. `superpowers:subagent-driven-development` - Task execution
3. `superpowers:test-driven-development` - Backend with tests
4. `superpowers:requesting-code-review` - After each task
5. `superpowers:verification-before-completion` - Before claims
6. `task-validator` - Comprehensive validation
7. `superpowers:finishing-a-development-branch` - At end

### Review Tools (Use ALL after implementation)
1. **code-reviewer subagent** - Code quality review
2. **CodeRabbit CLI** - AI-powered automated review (Race Conditions, Memory Leaks, Security)
3. **Semgrep** - Security & code quality scan
4. **REF MCP** (via subagent) - Best practices (BEFORE implementation!)

### CodeRabbit CLI Quick Reference
```bash
# After Task Implementation (Phase 4)
coderabbit --prompt-only --type committed    # Best for AI Agents
coderabbit --plain --type committed          # Human-readable

# Before Commit (uncommitted changes)
coderabbit --prompt-only --type uncommitted

# With specific base branch
coderabbit --prompt-only --base main

# Check authentication
coderabbit auth status
```

**IMPORTANT:**
- Runs in background (7-30+ minutes)
- Use `--prompt-only` for token efficiency
- Fix ALL issues (Option C: Critical + Major + Minor + Trivial)

### Semgrep CLI Quick Reference
```bash
# Installation & Setup
brew install semgrep           # macOS
python3 -m pip install semgrep # Alternative
semgrep login                  # Authenticate for Pro Rules (FastAPI/React)

# After Task Implementation (Phase 4)
# Backend (Python/FastAPI)
semgrep scan --config=p/python --config=p/security-audit backend/

# Frontend (TypeScript/React)
semgrep scan --config=p/javascript --config=p/typescript frontend/

# Quick full scan
semgrep scan --config=auto --text --output=results.txt
```

**IMPORTANT:**
- Fast (seconds to minutes) - run in foreground
- **Authenticate** with `semgrep login` for FastAPI/React Pro Rules
- CE (Community Edition) works without auth but **lacks framework-specific rules**
- See `.claude/SEMGREP_QUICKREF.md` for detailed commands

---

## ⚠️ Critical Rules

### Evidence Before Claims
- Never say "should work" - run commands and show output
- Tests: Show pytest/npm test output
- Builds: Show build output
- Always use verification-before-completion skill

### Option C Approach
- Fix **ALL issues**, not just Critical
- No issue gets ignored
- Re-validate after every fix batch

### REF MCP BEFORE Implementation
- Research best practices **BEFORE** writing code
- Compare plan against current documentation
- Identify issues early

### Pause After Every Task
- Complete Phase 1-6 of workflow
- Create verständlichen Bericht (Was/Wie/Warum)
- **STOP and wait for user OK**
- Never auto-continue to next task

---

## 📝 Tech Stack

### Backend
- **Framework:** FastAPI 0.109.0
- **Database:** PostgreSQL 16 (async with asyncpg)
- **ORM:** SQLAlchemy 2.0 (async)
- **Migrations:** Alembic 1.13.1
- **Task Queue:** ARQ (Redis-based)
- **Validation:** Pydantic 2.5.3
- **Testing:** pytest + pytest-asyncio

### Frontend
- **Framework:** React 18.2.0
- **Build Tool:** Vite 5.0.11
- **Language:** TypeScript 5.3.3 (strict mode)
- **Styling:** Tailwind CSS 3.4.1
- **State:** Zustand 4.5.0
- **Data Fetching:** TanStack Query 5.17.19
- **Tables:** TanStack Table 8.11.6
- **Testing:** Vitest 1.2.1

### Infrastructure
- **Database:** PostgreSQL 16 (Docker)
- **Cache/Queue:** Redis 7 (Docker)
- **Containers:** Docker Compose 3.9

---

## 🔗 Important Files

| File | Purpose |
|------|---------|
| `.claude/DEVELOPMENT_WORKFLOW.md` | **Main workflow documentation** |
| `.claude/thread-start-checks.sh` | **Automated thread start checks (run at every new thread!)** |
| `.claude/SEMGREP_QUICKREF.md` | **Semgrep CLI quick reference** |
| `docs/plans/2025-10-27-youtube-bookmarks-design.md` | Original design document |
| `docs/plans/2025-10-27-initial-implementation.md` | Detailed implementation plan |
| `backend/app/main.py` | FastAPI application entry |
| `backend/alembic/env.py` | Database migrations config |
| `frontend/src/main.tsx` | React application entry |
| `docker-compose.yml` | Development services |

---

## 🎓 Conventions

### Commit Messages
Format: `<type>: <subject>`

Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `test:` - Tests
- `chore:` - Build/tooling

Always include:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Code Style
- **Backend:** PEP 8, type hints, docstrings
- **Frontend:** ESLint, Prettier, strict TypeScript
- **Tests:** Descriptive names, AAA pattern (Arrange-Act-Assert)

---

## 📞 Help & Resources

### If Stuck
1. Read `.claude/DEVELOPMENT_WORKFLOW.md`
2. Check `docs/plans/` for requirements
3. Use `Skill(superpowers:systematic-debugging)`
4. Ask user for clarification

### Git Worktree Info
- **Location:** `.worktrees/initial-implementation/`
- **Strategy:** Isolated feature branch development
- **Cleanup:** Use `superpowers:finishing-a-development-branch`

---

## 🔄 Thread Handoff Checklist

When starting new thread:
- [ ] Read `.claude/DEVELOPMENT_WORKFLOW.md`
- [ ] Read this CLAUDE.md
- [ ] Load `superpowers:using-superpowers`
- [ ] **Run automated thread start checks:**
  ```bash
  ./.claude/thread-start-checks.sh
  ```
  This checks:
  - Git status & recent commits
  - Semgrep authentication (Pro Rules for FastAPI/React)
  - CodeRabbit authentication
  - Python/Node versions
  - Docker services status
  - Summary with action items
- [ ] Check current task status from plan
- [ ] Continue with workflow Phase 1

---

**Last Updated:** 2025-10-28
**Version:** 1.3
**Branch:** feature/initial-implementation (worktree)

**Changes in v1.3:**
- Added automated thread start checks script (`.claude/thread-start-checks.sh`)
- Updated Thread Handoff Checklist to use automated checks
- Added tool authentication verification for new threads
- Ensures semgrep Pro Rules availability is checked automatically

**Changes in v1.2:**
- Added comprehensive Semgrep CLI documentation
- Created `.claude/SEMGREP_QUICKREF.md` quick reference guide
- Updated workflow with Semgrep commands for FastAPI/React
- Added language-specific security scanning instructions

**Changes in v1.1:**
- Added CodeRabbit CLI setup and usage instructions
- Updated workflow documentation with CodeRabbit integration
