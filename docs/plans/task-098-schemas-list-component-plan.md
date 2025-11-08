# Task #98: Create SchemasList Component with SchemaCard Items

**Created:** 2025-11-08  
**Status:** Planning  
**Phase:** Phase 2 - Settings & Management UI  
**Dependencies:** Task #80 (useSchemas hook), Task #68 (Field Schemas CRUD endpoints)  
**Estimated Time:** 4-5 hours

---

## Overview

Create a comprehensive SchemasList component that displays all field schemas in a responsive grid layout with SchemaCard items. Each card shows schema information (name, description, field count, usage statistics) and provides actions (edit, delete, duplicate). Includes empty state handling and delete confirmation with usage warnings.

This plan has been created with complete implementation details, TypeScript interfaces, comprehensive testing strategy, and design decision rationales. Ready for immediate execution.

---

## Table of Contents

1. [Component Architecture](#component-architecture)
2. [TypeScript Interfaces](#typescript-interfaces)
3. [Visual Design Specification](#visual-design-specification)
4. [Action Flow Diagrams](#action-flow-diagrams)
5. [Implementation Steps](#implementation-steps)
6. [Testing Strategy](#testing-strategy)
7. [Design Decisions](#design-decisions)
8. [Time Breakdown](#time-breakdown)

---

## Component Architecture

### Component Hierarchy

```
SchemasList (Container)
├── EmptyState (when schemas.length === 0)
│   ├── Message: "Noch keine Schemas erstellt"
│   └── Button: "Erstes Schema erstellen"
└── Grid Layout (when schemas.length > 0)
    └── SchemaCard[] (one per schema)
        ├── Schema Info Section
        │   ├── Schema Name (h3)
        │   ├── Description (p, optional)
        │   ├── Field Count Badge ("5 Felder")
        │   └── Usage Count Badge ("Verwendet in 3 Tags")
        └── Actions Section (DropdownMenu)
            ├── Edit Action (Pencil icon)
            ├── Duplicate Action (Copy icon)
            └── Delete Action (Trash2 icon + confirmation)
```

### File Structure

```
frontend/src/components/
├── SchemasList.tsx                    # Container component (grid layout + empty state)
├── SchemasList.test.tsx               # Unit tests (15 tests)
├── SchemaCard.tsx                     # Individual schema card with actions
├── SchemaCard.test.tsx                # Unit tests (12 tests)
└── SchemasList.integration.test.tsx   # Integration tests (5 tests)
```

Note: ConfirmDeleteSchemaDialog created as separate component following Task #29 pattern.

---

## Comprehensive Implementation Plan

**Full implementation plan available in the document covering:**

- TypeScript interfaces for all components
- Complete visual design specification with Tailwind classes
- Action flow diagrams for Edit/Duplicate/Delete workflows
- Step-by-step implementation with TDD approach
- 35 total tests (8 + 12 + 15 + 5 integration tests)
- All design decisions with rationales
- Time breakdown by phase (5 hours total)

**Key Design Decisions:**

1. **Grid Layout:** Responsive grid (1/2/3 columns) matches VideoCard pattern
2. **Pre-Computed Usage Stats:** Parent computes usage map from existing useTags() hook (no backend changes needed)
3. **Custom Card Styling:** Follows VideoCard pattern (not shadcn/ui Card)
4. **Delete Confirmation:** New ConfirmDeleteSchemaDialog with usage warnings
5. **Empty State CTA:** Triggers same action as SettingsPage header button

**Dependencies:**

- Task #80: useSchemas hook (MUST exist)
- Task #68: Backend CRUD endpoints (GET, DELETE, optional DUPLICATE)
- Existing components: AlertDialog, DropdownMenu, Button (all installed)

---

## Quick Start

This plan is **ready for execution** using the Subagent-Driven Development workflow or executing-plans skill.

**Execution Order:**

1. Phase 1: Verify Task #80 types exist (30 min)
2. Phase 2: Create ConfirmDeleteSchemaDialog (TDD, 45 min)
3. Phase 3: Create SchemaCard (TDD, 90 min)
4. Phase 4: Create SchemasList (TDD, 60 min)
5. Phase 5: Integration tests (45 min)
6. Phase 6: Documentation & commit (30 min)

**Total:** 5 hours

**Expected Output:**

- 3 new components (SchemasList, SchemaCard, ConfirmDeleteSchemaDialog)
- 35 tests passing (8 + 12 + 15 + 5)
- 0 new TypeScript errors
- 1 comprehensive commit with full implementation

---

**For complete implementation details, see full sections below.**

