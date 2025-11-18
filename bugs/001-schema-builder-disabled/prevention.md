# Prevention Strategy

## Root Cause to Prevent
**Incomplete integration after component development** - Components are built but never integrated into their intended parent components.

## Immediate Actions

### 1. Audit Remaining Placeholders
Search and fix all remaining placeholder messages:

```bash
# Search for Task references in user-facing code
grep -r "Task #" frontend/src/components/ | grep -v ".test.tsx" | grep -v "TODO"

# Search for "to be implemented" messages
grep -r "to be implemented\|wird.*implementiert" frontend/src/components/
```

**Action Items:**
- [ ] Review each finding
- [ ] Verify if component actually exists
- [ ] Either integrate or remove placeholder

### 2. Update Definition of Done

Add to project's Definition of Done checklist:

```markdown
## Definition of Done for Component Tasks

### Development
- [ ] Component implemented and passes tests
- [ ] TypeScript compilation succeeds
- [ ] ESLint passes

### Integration (NEW)
- [ ] Component integrated into parent component (if applicable)
- [ ] End-to-end user flow tested
- [ ] No placeholder messages remain in production code
- [ ] All TODO comments referencing this task removed or moved to backlog

### Testing
- [ ] Unit tests for component
- [ ] Integration tests for parent-child interaction (if applicable)
- [ ] Manual testing of complete user workflow

### Documentation
- [ ] JSDoc comments for public API
- [ ] Usage examples in code comments
- [ ] Update relevant documentation
```

### 3. Pre-Deployment Checklist

Add to pre-deployment checklist:

```markdown
## Pre-Deployment Checklist

### User-Facing Content
- [ ] No internal task numbers (e.g., "Task #XX") visible in UI
- [ ] No "to be implemented" or "coming soon" messages without dates
- [ ] No placeholder content masquerading as real features
- [ ] No TODO comments in user-facing text

### Integration Verification
- [ ] All dropdown options are functional (not placeholders)
- [ ] All tabs in tab interfaces have content
- [ ] All modal buttons trigger appropriate actions
- [ ] All form submissions have handlers
```

## Process Improvements

### 1. Integration Testing Requirements

**New Rule:** Components with parent-child relationships MUST have integration tests.

**Example for SchemaEditor:**
```tsx
// SchemaEditor.integration.test.tsx (should exist)
describe('SchemaEditor Integration', () => {
  describe('CreateTagDialog Integration', () => {
    it('integrates into CreateTagDialog for inline schema creation', () => {
      // Test the actual integration, not just the component in isolation
    })
  })

  describe('SchemaCreationDialog Integration', () => {
    it('integrates into "Start from Scratch" tab', () => {
      // Test the actual integration
    })
  })
})
```

### 2. Task Completion Verification

**New Rule:** Task closure requires demonstration of end-to-end functionality.

**Task Closure Template:**
```markdown
## Task #83: Integrate SchemaEditor

### Completed Work
- [x] SchemaEditor component developed
- [x] Tests written and passing
- [x] **Integrated into CreateTagDialog** (NEW REQUIREMENT)
- [x] **Integration tested end-to-end** (NEW REQUIREMENT)
- [x] **Placeholder removed** (NEW REQUIREMENT)

### Evidence
- Screenshot showing SchemaEditor rendering in CreateTagDialog
- Test results for integration tests
- User flow demonstration (video/gif/screenshot sequence)

### Verification Checklist
- [x] User can trigger feature from UI
- [x] User can complete workflow end-to-end
- [x] No error messages or placeholders
- [x] Matches acceptance criteria
```

### 3. Code Review Focus

**New Requirement:** Code reviewers MUST verify integration for component tasks.

**Reviewer Checklist:**
```markdown
## Code Review Checklist for Component Tasks

### Functionality
- [ ] Component works in isolation (unit tests)
- [ ] **Component works when integrated (integration tests)** (NEW)
- [ ] **End-to-end user workflow demonstrated** (NEW)

### Code Quality
- [ ] No TODO comments referencing completed tasks
- [ ] No placeholder messages in production code
- [ ] **All dropdown options are implemented** (NEW)
- [ ] **All tabs have content** (NEW)

### Testing
- [ ] Unit tests exist and pass
- [ ] **Integration tests exist and pass** (NEW)
- [ ] Manual testing performed

### User Experience
- [ ] No internal references visible to users (task numbers, etc.)
- [ ] All features advertised in UI are functional
- [ ] Error states handled gracefully
```

## Technical Prevention

### 1. Linting Rule for Placeholder Messages

Add ESLint rule to catch placeholder messages:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Prevent placeholder messages in JSX
    'no-restricted-syntax': [
      'error',
      {
        selector: 'JSXText[value=/Task #\\d+/]',
        message: 'User-facing text should not reference internal task numbers',
      },
      {
        selector: 'JSXText[value=/to be implemented/i]',
        message: 'User-facing text should not contain "to be implemented" placeholders',
      },
      {
        selector: 'JSXText[value=/wird.*implementiert/i]',
        message: 'User-facing text should not contain implementation placeholders',
      },
    ],
  },
}
```

### 2. TypeScript Strictness

Enable stricter TypeScript settings to catch integration issues:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 3. Integration Test Template

Create template for integration tests:

```tsx
// template-integration.test.tsx
/**
 * Integration Test Template
 *
 * Use this template when component A integrates component B.
 * This ensures the integration is tested, not just the components in isolation.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, userEvent } from '@testing-library/react'
import { ParentComponent } from './ParentComponent'
import { ChildComponent } from './ChildComponent'

describe('ParentComponent + ChildComponent Integration', () => {
  it('shows ChildComponent when user triggers action', async () => {
    const user = userEvent.setup()
    render(<ParentComponent />)

    // Trigger action that should show ChildComponent
    await user.click(screen.getByRole('button', { name: /trigger/i }))

    // Verify ChildComponent appears
    expect(screen.getByLabelText(/child component field/i)).toBeInTheDocument()

    // Verify placeholder does NOT appear
    expect(screen.queryByText(/to be implemented/i)).not.toBeInTheDocument()
  })

  it('handles ChildComponent onSave callback', async () => {
    const user = userEvent.setup()
    render(<ParentComponent />)

    // Trigger ChildComponent
    await user.click(screen.getByRole('button', { name: /trigger/i }))

    // Interact with ChildComponent
    await user.type(screen.getByLabelText(/field/i), 'test')
    await user.click(screen.getByRole('button', { name: /save/i }))

    // Verify parent state updated
    expect(screen.getByText(/test/i)).toBeInTheDocument()
  })

  it('handles ChildComponent onCancel callback', async () => {
    const user = userEvent.setup()
    render(<ParentComponent />)

    // Trigger ChildComponent
    await user.click(screen.getByRole('button', { name: /trigger/i }))

    // Cancel ChildComponent
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Verify ChildComponent disappears
    expect(screen.queryByLabelText(/child component field/i)).not.toBeInTheDocument()
  })
})
```

## Cultural Prevention

### 1. Team Communication

**New Practice:** Demo completed integrations in standup/reviews.

**Template:**
```markdown
## Standup Update for Task #83

**What I completed:**
- SchemaEditor component
- Integration into CreateTagDialog
- Integration into SchemaCreationDialog

**Demo:**
[Share screen showing]
1. Click "+" → Select "new schema" → SchemaEditor appears
2. Fill form → Click "erstellen" → Schema created
3. No placeholders or error messages

**Confidence:** High - End-to-end flow tested
```

### 2. Documentation Culture

**New Practice:** README includes integration points for each component.

**Example:**
```markdown
## SchemaEditor Component

### Purpose
Reusable form for creating/editing field schemas.

### Usage Locations
1. ✅ `CreateTagDialog` - Inline schema creation when creating tags
2. ✅ `SchemaCreationDialog` - "Start from Scratch" tab
3. ✅ `SettingsPage` - Edit existing schemas

### Integration Requirements
When integrating SchemaEditor:
- Provide `listId` prop
- Implement `onSave` handler (receives SchemaFormData)
- Implement `onCancel` handler
- Handle loading/error states from mutation
```

### 3. Quarterly Audits

**New Practice:** Quarterly "placeholder audit" to catch accumulated tech debt.

**Checklist:**
```markdown
## Quarterly Placeholder Audit

### Automated Checks
- [ ] Run grep for "Task #" in src/
- [ ] Run grep for "TODO" in src/
- [ ] Run grep for "FIXME" in src/
- [ ] Run grep for "to be implemented" in src/

### Manual Review
- [ ] Check all dropdown menus (no placeholder options)
- [ ] Check all tab interfaces (all tabs have content)
- [ ] Check all modal dialogs (all buttons work)
- [ ] Check settings pages (all features functional)

### Action Items
- Create tickets for any findings
- Prioritize based on user visibility
- Set deadline for completion
```

## Metrics to Track

### Code Quality Metrics
1. **TODO Density:** TODOs per 1000 lines of code
   - **Target:** < 5 per 1000 lines
   - **Alert:** > 10 per 1000 lines

2. **Placeholder Messages:** Count of placeholder text in components
   - **Target:** 0 in user-facing components
   - **Alert:** Any increase

3. **Integration Test Coverage:** % of parent-child relationships with integration tests
   - **Target:** > 80%
   - **Current:** ~40% (estimate)

### Process Metrics
1. **Task Closure Time:** Days from "component complete" to "integration complete"
   - **Target:** < 2 days
   - **Current:** Unknown (not tracked)

2. **Integration Defect Rate:** Bugs caused by incomplete integration
   - **Target:** < 5% of total bugs
   - **Current:** Bug #001 + SchemaCreationDialog = at least 2 instances

## Summary

### Prevention Hierarchy

**Level 1: Prevent at Development Time**
- Definition of Done includes integration verification
- Template for integration tests
- Linting rules catch placeholder messages

**Level 2: Prevent at Review Time**
- Code review checklist requires integration demo
- Reviewers verify end-to-end flows
- No merge without integration tests

**Level 3: Prevent at Deployment Time**
- Pre-deployment checklist checks for placeholders
- Automated tests run integration test suite
- Manual QA spot-checks advertised features

**Level 4: Detect After Deployment**
- Quarterly placeholder audits
- User feedback monitoring
- Metrics tracking

### Success Criteria

This prevention strategy succeeds when:
- ✅ No placeholder messages reach production for 6 months
- ✅ Integration test coverage > 80%
- ✅ All components in Definition of Done include integration
- ✅ Zero bugs caused by incomplete integration in next quarter

### Next Steps

1. **Immediate (This Week):**
   - [ ] Run placeholder audit on entire codebase
   - [ ] Fix any remaining placeholder messages
   - [ ] Add ESLint rule for placeholder detection

2. **Short Term (This Sprint):**
   - [ ] Update Definition of Done
   - [ ] Create integration test template
   - [ ] Update code review checklist

3. **Medium Term (This Quarter):**
   - [ ] Increase integration test coverage to 80%
   - [ ] Train team on integration testing practices
   - [ ] Establish quarterly audit cadence

4. **Long Term (Next Quarter):**
   - [ ] Track metrics on integration defects
   - [ ] Review and refine prevention strategy
   - [ ] Share learnings with broader team
