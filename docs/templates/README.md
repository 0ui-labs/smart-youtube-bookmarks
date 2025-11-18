# Documentation Templates

This directory contains standardized templates for consistent project documentation.

---

## 📋 Available Templates

### 1. Task Report Template
**File:** `task-report-template.md`
**Use When:** After completing ANY task
**Purpose:** Comprehensive technical documentation of task implementation

**Contents:**
- Executive Summary
- Task Details & Acceptance Criteria
- Implementation Overview (files, components, architecture)
- Technical Decisions & Rationale
- Development Process (TDD cycle, iterations)
- Testing & Quality Assurance
- Code Reviews (Code-Reviewer, Semgrep, CodeRabbit)
- Validation Results
- Code Quality Metrics
- Performance & Optimization
- Integration Points
- Documentation
- Challenges & Solutions
- Learnings & Best Practices
- Future Considerations
- Artifacts & References
- Timeline & Effort Breakdown
- Risk Assessment
- Next Steps & Handoff

**Output Location:** `docs/reports/YYYY-MM-DD-task-NNN-report.md`

**Audience:**
- Future developers
- Technical leads
- Auditors
- Your future self

---

### 2. Handoff Template
**File:** `handoff-template.md`
**Use When:** At the end of every thread (shorter than report)
**Purpose:** Quick context transfer between threads/agents

**Contents:**
- Was wurde gemacht (Summary)
- Tasks abgeschlossen
- Dateien geändert
- Warum (Kontext & Entscheidungen)
- Wichtige Entscheidungen
- Fallstricke/Learnings
- Nächste Schritte
- Status & Notizen

**Output Location:** `docs/handoffs/YYYY-MM-DD-log-NNN-description.md`

**Audience:**
- Next thread/agent
- Quick reference
- Chronological history

---

### 3. Task Plan Template
**File:** `task-plan-template.md`
**Use When:** Before implementing a task (planning phase)
**Purpose:** Detailed implementation plan with step-by-step instructions

**Contents:**
- Ziel (Goal)
- Acceptance Criteria
- Implementation Steps (numbered, with code examples)
- Testing Strategy
- Reference Documentation

**Output Location:** `docs/plans/tasks/plan-NNN-description.md`

**Audience:**
- Implementing agent
- Code reviewers
- Future reference

---

## 🔄 Workflow: When to Use Each Template

### Before Task (Planning Phase)
1. **Create Task Plan** using `task-plan-template.md`
   - Define goal and acceptance criteria
   - Break down into implementation steps
   - Identify testing strategy
   - Reference relevant docs

### During Task (Implementation Phase)
- Follow the task plan
- Take notes for report and handoff

### After Task (Documentation Phase)
1. **Create Task Report** using `task-report-template.md`
   - Comprehensive technical documentation
   - All metrics, reviews, learnings
   - ~15-20 minutes to complete

2. **Create Handoff** using `handoff-template.md`
   - Quick summary for next thread
   - Context for next task
   - ~5 minutes to complete

3. **Update status.md**
   - Mark task as complete in PLAN section
   - Add entry to LOG section
   - Update Latest Handoff reference

---

## 📊 Documentation Hierarchy

```
Project Documentation
│
├── Planning (Before)
│   └── Task Plans (docs/plans/tasks/)
│       └── Detailed implementation steps
│
├── Execution (During)
│   └── [Implementation happens]
│
└── Documentation (After)
    ├── Task Reports (docs/reports/)
    │   └── Comprehensive technical docs
    │
    ├── Handoffs (docs/handoffs/)
    │   └── Quick context transfer
    │
    └── Status Tracking (status.md)
        ├── PLAN section (what needs to be done)
        └── LOG section (what was done)
```

---

## 🎯 Key Differences

| Aspect | Task Plan | Handoff | Task Report |
|--------|-----------|---------|-------------|
| **Timing** | Before | After (quick) | After (comprehensive) |
| **Length** | 1-2 pages | 1-2 pages | 5-10 pages |
| **Audience** | Implementer | Next agent | Everyone |
| **Purpose** | Guide | Transfer | Document |
| **Detail** | Steps | Summary | Everything |
| **Time** | 10 min | 5 min | 15-20 min |

---

## 📝 Naming Conventions

### Task Plans
```
docs/plans/tasks/plan-NNN-short-description.md
```
Example: `plan-016-tag-store-zustand.md`

### Task Reports
```
docs/reports/YYYY-MM-DD-task-NNN-report.md
```
Example: `2025-11-02-task-016-report.md`

### Handoffs
```
docs/handoffs/YYYY-MM-DD-log-NNN-description.md
```
Example: `2025-11-02-log-017-tag-store-complete.md`

**Note:** LOG numbers are chronological (may not match PLAN task numbers due to debugging, refactoring, etc.)

---

## ✅ Checklist: End of Task Documentation

After completing a task, ensure ALL of the following are done:

- [ ] Task Report created from template (`docs/reports/`)
- [ ] Handoff document created from template (`docs/handoffs/`)
- [ ] `status.md` updated:
  - [ ] PLAN section: Task marked complete with timestamp
  - [ ] LOG section: Entry added
  - [ ] Latest Handoff reference updated
- [ ] All code committed with proper message
- [ ] All documentation committed

---

## 🚀 Quick Start for Claude

When starting a new thread:
1. Read latest handoff from `docs/handoffs/`
2. Check `status.md` for next pending task
3. Read task plan from `docs/plans/tasks/`
4. Implement task
5. Create report using `task-report-template.md`
6. Create handoff using `handoff-template.md`
7. Update `status.md`

---

**Last Updated:** 2025-11-02
**Maintained By:** Claude Code Team
