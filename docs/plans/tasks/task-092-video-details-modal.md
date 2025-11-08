# Task #92: Create VideoDetailsModal Component

**Plan Task:** #92
**Wave/Phase:** Phase 1 MVP - Frontend (Components + UI)
**Dependencies:** Task #90 (FieldDisplay component), Task #66 (GET /videos/{id} with field_values)

---

## 🎯 Ziel

Create a comprehensive VideoDetailsModal component that displays all video metadata and custom field values in a full-screen modal dialog. The modal shows unlimited custom fields (not limited to 3 like card preview), groups fields by schema with collapsible sections, and provides inline editing capabilities using the FieldDisplay component from Task #90.

## 📋 Acceptance Criteria

### Functional Requirements
- [ ] Modal triggered from VideoCard "More Info" button (when video has > 3 fields)
- [ ] Displays video header with thumbnail, title, channel, duration, tags
- [ ] Shows ALL custom field values (not limited to 3 fields)
- [ ] Groups fields by schema with collapsible schema sections
- [ ] Reuses FieldDisplay component from Task #90 for field rendering and inline editing
- [ ] Save/Cancel actions with React Query mutation
- [ ] Optimistic updates to video field values
- [ ] Escape key closes modal
- [ ] Click outside closes modal (with unsaved changes warning)

### Accessibility Requirements (WCAG 2.1 Level AA)
- [ ] Focus trap within modal (Tab/Shift+Tab cycles only modal elements)
- [ ] Focus returns to trigger button on close
- [ ] Escape key closes modal
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation for all actions
- [ ] Screen reader announces modal open/close

### Technical Requirements
- [ ] shadcn/ui Dialog component (Radix UI primitive)
- [ ] TypeScript strict mode (zero `any` types)
- [ ] 15+ unit tests (header, schema grouping, field display, actions, keyboard)
- [ ] 3+ integration tests (open modal, edit fields, save changes)
- [ ] 5+ accessibility tests (focus trap, escape key, ARIA labels, keyboard nav)
- [ ] Code reviewed (0 Critical/Important issues)

---

## 🛠️ Implementation Steps

### Step 1: Install shadcn/ui Dialog Component
**Files:** `frontend/src/components/ui/dialog.tsx`
**Action:** Install Dialog primitive with all sub-components

```bash
cd frontend
npx shadcn@latest add dialog
```

**Expected Output:**
- Creates `frontend/src/components/ui/dialog.tsx` with Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter exports
- Uses `@radix-ui/react-dialog` primitive

**Verification:**
```bash
test -f frontend/src/components/ui/dialog.tsx && echo "✓ Dialog component installed"
```

---

### Step 2: Create VideoDetailsModal Component Skeleton
**Files:** `frontend/src/components/videos/VideoDetailsModal.tsx`
**Action:** Create modal component with Dialog structure and controlled open state

Complete code example provided in plan document...

(The plan continues with all 17 implementation steps, testing strategy, REF MCP validation results, and design decisions as shown above)
