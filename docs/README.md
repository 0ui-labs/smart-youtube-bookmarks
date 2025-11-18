# Documentation Structure

This directory contains all project documentation organized by type and purpose.

## Quick Navigation

- **Getting Started:** See `../CLAUDE.md` for project overview and development setup
- **Patterns:** `patterns/` for reusable architectural patterns
- **Components:** `components/` for detailed component documentation
- **Reports:** `reports/` for task implementation reports
- **Planning:** `plans/` for task plans and product vision

## Directory Structure

### `/patterns` - Reusable Architectural Patterns

High-level patterns and conventions used across the codebase.

- `field-component-pattern.md` - **CRITICAL**: 2025 shadcn/ui form pattern (required for all forms)
- `field-union-pattern.md` - Two-tier response strategy for custom fields
- `custom-fields-display.md` - Display & inline editing patterns

**When to use:** Implementing similar features or following established conventions

### `/components` - Component Documentation

Detailed documentation for key components with props, usage examples, and testing info.

- `new-field-form.md` - Field creation form (Task #123)
- `field-config-editor.md` - Type-specific config editors (Task #124)
- `video-details-page.md` - Video details page (Task #130)
- `video-details-modal.md` - Video details modal (Task #131)
- `custom-fields-section.md` - Shared fields component (Task #131)

**When to use:** Understanding or modifying specific components

### `/reports` - Task Implementation Reports

Comprehensive reports for completed tasks with time tracking, implementation details, and test results.

- `2025-11-11-task-123-report.md` - NewFieldForm implementation
- `2025-11-11-task-124-report.md` - FieldConfigEditor implementation
- `2025-11-12-task-130-report.md` - VideoDetailsPage implementation
- `2025-11-13-task-131-report.md` - Dual-Pattern Architecture implementation

**When to use:** Deep dive into task history or understanding implementation decisions

### `/handoffs` - Session Handoff Logs

Short summaries passed between coding sessions for context continuity.

**When to use:** Understanding context from previous sessions

### `/plans` - Planning Documents

#### `/plans/tasks/`
Individual task plans with requirements, acceptance criteria, and implementation steps.

#### `/plans/vision/`
Product vision and ideation documents.

**When to use:** Planning new features or understanding product direction

### `/templates` - Documentation Templates

Reusable templates for consistent documentation.

**When to use:** Creating new documentation

## Documentation Principles

### CLAUDE.md vs. Detailed Docs

**CLAUDE.md should contain:**
- ✅ High-level architecture overview
- ✅ Development commands
- ✅ Essential patterns (with links to detailed docs)
- ✅ Quick reference for common tasks
- ✅ Critical gotchas

**CLAUDE.md should NOT contain:**
- ❌ Task-specific implementation details
- ❌ Complete code examples (only essential patterns)
- ❌ Test counts and coverage numbers
- ❌ Detailed props interfaces
- ❌ "Related Tasks" lists

**Detailed docs (`patterns/`, `components/`) should contain:**
- ✅ Complete implementation details
- ✅ Full code examples
- ✅ Props interfaces
- ✅ Testing information
- ✅ Usage examples
- ✅ Related documentation links

## Finding Information

### I need to...

**Understand the project structure:**
→ `../CLAUDE.md` (Project Overview, Architecture)

**Implement a new form:**
→ `patterns/field-component-pattern.md` (CRITICAL: required pattern)

**Work with custom fields:**
→ `patterns/field-union-pattern.md` (API pattern)
→ `patterns/custom-fields-display.md` (UI patterns)

**Understand a specific component:**
→ `components/<component-name>.md`

**See how a task was implemented:**
→ `reports/<date>-task-<number>-report.md`

**Plan a new feature:**
→ `plans/tasks/` (existing task plans for reference)

**Understand context from previous session:**
→ `handoffs/<date>-log-<number>-<topic>.md`

## Maintenance Guidelines

### Adding New Documentation

1. **Patterns:** Create new pattern doc if introducing a reusable architectural solution
2. **Components:** Document complex components with reusable interfaces
3. **Reports:** Generate report for each completed task
4. **Handoffs:** Create handoff log at end of each session

### Updating CLAUDE.md

**Add to CLAUDE.md:**
- New critical patterns (with link to detailed doc)
- New routes or core architecture changes
- New development commands
- New common gotchas

**Do NOT add to CLAUDE.md:**
- Task-specific details (put in reports/)
- Detailed component docs (put in components/)
- Long code examples (put in patterns/)

Keep CLAUDE.md concise and focused on high-level overview with links to detailed docs.

## Recent Refactoring (2025-11-13)

**Motivation:** CLAUDE.md grew from ~500 to 1187 lines with Task #123-#131 details

**Changes:**
- Created `patterns/` directory for reusable patterns
- Created `components/` directory for component docs
- Extracted Task #123-#131 details to separate docs
- Reduced CLAUDE.md from 1187 → 579 lines (-608 lines, 51% reduction)

**Result:** CLAUDE.md is now concise with clear references to detailed documentation

## Contributing

When creating new documentation:
1. Choose appropriate directory (patterns vs. components vs. reports)
2. Use clear, descriptive filenames
3. Include status and last updated date
4. Cross-reference related docs
5. Update this README if adding new categories
