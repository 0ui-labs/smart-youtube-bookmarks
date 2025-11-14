# Task #143.1: SuggestionAlert UI Component & NewFieldForm Integration

**Plan Task:** #143.1 (UI Integration for AI Duplicate Detection)
**Wave/Phase:** Phase 3 - Advanced Features (Custom Fields System)
**Dependencies:** Task #143 (AI Duplicate Detection - Backend + Hook complete)
**Parent Task:** Task #143

---

## 🎯 Ziel

Create the visual feedback component (SuggestionAlert) that displays duplicate field warnings to users and integrate it into the NewFieldForm component, completing the end-to-end user experience for AI-powered duplicate detection.

**Expected Outcome:** Users see real-time, color-coded duplicate warnings with actionable "Use This" buttons while typing field names, reducing accidental duplicate creation by 80%+.

---

## 📋 Acceptance Criteria

**Functional:**
- [ ] SuggestionAlert component displays up to 3 ranked suggestions
- [ ] Three alert types with distinct visual styles:
  - Red (⚠️): Exact match warning (100% score)
  - Yellow (💡): Typo detection (80-99% score)
  - Blue (🤖): Semantic similarity (60-79% score)
- [ ] Each alert shows: icon, similarity type, score, explanation, field details
- [ ] "Use This" button selects existing field instead of creating duplicate
- [ ] Alerts appear/disappear dynamically based on input (500ms debounce)
- [ ] Integration in NewFieldForm with real-time checking

**UX/Design:**
- [ ] Color-coded backgrounds (red-50, yellow-50, blue-50) with matching borders
- [ ] Responsive layout (works on mobile + desktop)
- [ ] Loading state ("Checking..." indicator) during API calls
- [ ] Empty input clears all alerts
- [ ] Maximum 3 alerts to prevent information overload

**Accessibility (WCAG 2.1 AA):**
- [ ] Color contrast ≥ 4.5:1 for all text/background combinations
- [ ] ARIA labels on "Use This" buttons
- [ ] Keyboard navigation (Tab to buttons, Enter to activate)
- [ ] Screen reader announces alerts with role="alert"
- [ ] Focus visible on interactive elements

**Testing:**
- [ ] Component tests: Rendering all 3 alert types (6+ tests)
- [ ] Component tests: "Use This" button interaction (3+ tests)
- [ ] Component tests: Empty state, loading state (2+ tests)
- [ ] Integration tests: NewFieldForm + SuggestionAlert flow (5+ tests)
- [ ] Visual regression: Screenshots for each alert type

**Evidence:**
- All tests passing: `npm test -- SuggestionAlert`
- NewFieldForm integration test passing
- Manual testing: Typing shows alerts, clicking "Use This" works
- Screenshot documentation of all 3 alert types

---

## 🛠️ Implementation Steps

### Step 1: Create SuggestionAlert Component

**File:** `frontend/src/components/fields/SuggestionAlert.tsx` (NEW)

**Component Props:**
```typescript
interface SuggestionAlertProps {
  suggestions: SmartSuggestion[];  // From useSmartDuplicateCheck hook
  onUseExisting?: (fieldId: string) => void;  // Callback when "Use This" clicked
}
```

**Key Features:**
1. **Filter Top 3:** Only show 3 highest-scored suggestions
2. **Alert Type Mapping:**
   - exact → Red alert with ⚠️ icon
   - levenshtein → Yellow alert with 💡 icon
   - semantic → Blue alert with 🤖 icon
3. **Alert Structure:** Icon + Type Label + Score + Explanation + Field Details + Action Button
4. **Conditional Rendering:** Return null if suggestions array empty

**Visual Design:**
- Container: `space-y-2` (8px gap between alerts)
- Alert Box: `border rounded-md p-3` with type-specific colors
- Layout: Flexbox with space-between for content vs button
- Button: `px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50`

**Accessibility:**
- Alert divs: `role="alert"` for screen reader announcements
- Buttons: `aria-label="Use existing field {fieldName}"`
- Icon emojis: `aria-hidden="true"` (decorative only)

---

### Step 2: Create Component Tests

**File:** `frontend/src/components/fields/SuggestionAlert.test.tsx` (NEW)

**Test Categories:**

**Rendering Tests (6 tests):**
1. Renders exact match alert (red background, ⚠️ icon, 100% score)
2. Renders levenshtein alert (yellow background, 💡 icon, 92% score)
3. Renders semantic alert (blue background, 🤖 icon, 72% score)
4. Renders multiple alerts (max 3, sorted by score)
5. Renders field details (name, type) in each alert
6. Renders explanation text correctly

**Interaction Tests (3 tests):**
1. Clicking "Use This" calls onUseExisting with correct fieldId
2. Multiple "Use This" buttons work independently
3. onUseExisting optional (no crash if undefined)

**Edge Cases (2 tests):**
1. Empty suggestions array renders nothing (null)
2. More than 3 suggestions only shows top 3

**Accessibility Tests (2 tests):**
1. All alerts have role="alert"
2. All buttons have aria-label with field name

**Test Patterns:**
- Use `userEvent.setup({ delay: null })` for fast tests
- Mock data with inline factories (no separate mockData.ts)
- `afterEach(() => { vi.clearAllMocks() })`
- Test button clicks with `await user.click(button)`

---

### Step 3: Update NewFieldForm Component

**File:** `frontend/src/components/fields/NewFieldForm.tsx` (MODIFY)

**Assumptions about NewFieldForm:**
- Has text input for field name
- Has field type selector
- Has "Create Field" submit button
- May or may not exist yet (create if needed)

**Changes to Make:**

1. **Add useSmartDuplicateCheck Hook:**
   ```typescript
   const {
     suggestions,
     isChecking,
     debouncedCheck,
     hasExactMatch
   } = useSmartDuplicateCheck({
     listId,
     mode: 'smart',
     enabled: true
   });
   ```

2. **Add Field Name Change Handler:**
   - Call `debouncedCheck(fieldName)` on input change
   - Clear suggestions if input empty

3. **Add Loading Indicator:**
   - Show "Checking..." text when `isChecking === true`
   - Position: next to field name input

4. **Add SuggestionAlert Component:**
   - Position: below field name input, above field type selector
   - Pass `suggestions` and `onUseExisting` callback

5. **Implement onUseExisting Handler:**
   - When user clicks "Use This":
     - Switch from "create mode" to "use existing mode"
     - Populate form with existing field details
     - Disable name/type inputs (read-only)
     - Change button text to "Use Existing Field"

6. **Disable Create Button on Exact Match:**
   - If `hasExactMatch === true`, disable "Create Field" button
   - Add tooltip: "This field already exists - use it instead"

**Layout Example:**
```jsx
<div className="space-y-4">
  {/* Field Name Input */}
  <div>
    <label>Field Name</label>
    <div className="relative">
      <input
        value={fieldName}
        onChange={handleNameChange}
        className={hasExactMatch ? 'border-red-500' : ''}
      />
      {isChecking && (
        <span className="text-sm text-gray-500 ml-2">Checking...</span>
      )}
    </div>
  </div>

  {/* Duplicate Warnings */}
  <SuggestionAlert
    suggestions={suggestions}
    onUseExisting={handleUseExisting}
  />

  {/* Field Type Selector */}
  <div>
    <label>Field Type</label>
    <select {...} />
  </div>

  {/* Submit Button */}
  <button
    type="submit"
    disabled={hasExactMatch}
    title={hasExactMatch ? "Field already exists" : undefined}
  >
    {isUsingExisting ? "Use Existing Field" : "Create Field"}
  </button>
</div>
```

---

### Step 4: Create Integration Tests

**File:** `frontend/src/components/fields/NewFieldForm.integration.test.tsx` (NEW)

**Test Scenarios:**

**Happy Path (3 tests):**
1. User types field name → sees suggestions after 500ms
2. User clicks "Use This" → form switches to "use existing" mode
3. User submits form with existing field → correct API call

**Typo Detection Flow (2 tests):**
1. User types "Presentaton" → sees yellow alert
2. User clicks "Use This" → field name changes to "Presentation Quality"

**Exact Match Prevention (2 tests):**
1. User types exact match → red alert appears + create button disabled
2. User changes name to non-duplicate → button re-enabled

**Loading States (1 test):**
1. User types → "Checking..." appears → alerts appear after API response

**Edge Cases (2 tests):**
1. User clears input → alerts disappear
2. API error → graceful error message (not crash)

**Mocking Strategy:**
- Mock `useSmartDuplicateCheck` hook with predefined suggestions
- Use `vi.useFakeTimers()` to control 500ms debounce
- Mock API calls to `/custom-fields/check-duplicate`

---

### Step 5: Visual Documentation (Screenshots)

**File:** `docs/components/suggestion-alert.md` (NEW)

**Content:**
1. Component overview and purpose
2. Screenshots of all 3 alert types:
   - Red exact match example
   - Yellow typo example
   - Blue semantic example
3. Interactive flow diagram (typing → checking → alerts → action)
4. Integration example in NewFieldForm
5. Props documentation
6. Accessibility features

**Screenshot Capture:**
- Use browser dev tools or Storybook
- Show realistic field names and suggestions
- Annotate important UI elements

---

### Step 6: Update Documentation

**File:** `CLAUDE.md` (MODIFY)

**Section:** Add to "AI-Powered Duplicate Detection (Task #143)" section (line ~310)

**Content to Add:**
```markdown
**Frontend UI (Task #143.1):**
- Component: `frontend/src/components/fields/SuggestionAlert.tsx` (120 lines)
  - Color-coded alerts (Red/Yellow/Blue) for visual hierarchy
  - "Use This" action buttons for quick field selection
  - Top 3 suggestions to prevent information overload
  - WCAG 2.1 AA accessible (role="alert", keyboard nav, color contrast)
- Integration: `frontend/src/components/fields/NewFieldForm.tsx` (modified)
  - Real-time checking with 500ms debounce
  - Loading indicator during API calls
  - Disabled create button on exact match
  - "Use existing" mode when suggestion selected
- Tests: 18/18 component + integration tests passing
```

**File:** `docs/components/suggestion-alert.md` (NEW - created in Step 5)

---

### Step 7: Manual Testing & Edge Cases

**Test Cases:**

**Typing Flow:**
1. Open NewFieldForm (create new custom field)
2. Type slowly: "P" → "Pr" → "Pre" → "Pres"
   - Expected: "Checking..." appears after 500ms pause
   - Expected: Alerts appear if similar fields found
3. Type fast: "Presentation" (no pauses)
   - Expected: Only one "Checking..." + alert at end
4. Delete all text
   - Expected: Alerts disappear immediately

**Alert Types:**
1. Type exact match: "Video Rating" (exists)
   - Expected: Red alert with ⚠️ icon, 100% score
2. Type typo: "Presentaton" (→ "Presentation Quality" exists)
   - Expected: Yellow alert with 💡 icon, 92% score
3. Type semantic: "Overall Score" (→ "Video Rating" exists)
   - Expected: Blue alert with 🤖 icon, 72% score

**Actions:**
1. Click "Use This" button
   - Expected: Form switches to read-only mode
   - Expected: Field name/type populated with existing field
   - Expected: Button text changes to "Use Existing Field"
2. Submit form after "Use This"
   - Expected: API call uses existing field ID (not create new)

**Edge Cases:**
1. No similar fields found
   - Expected: No alerts, green checkmark (or just clean UI)
2. API timeout
   - Expected: Error message, "Checking..." disappears
3. Network offline
   - Expected: Graceful fallback, no crash

**Accessibility:**
1. Tab navigation through alerts
   - Expected: Focus visible on "Use This" buttons
2. Screen reader test (VoiceOver/NVDA)
   - Expected: Alerts announced when they appear
   - Expected: Button labels include field name

---

### Step 8: Cleanup & Final Review

**Pre-Merge Checklist:**
- [ ] All component tests passing (18/18)
- [ ] TypeScript compilation successful (no errors)
- [ ] ESLint passing (no warnings)
- [ ] Visual review: All 3 alert types look correct
- [ ] Accessibility audit: Lighthouse score ≥ 95
- [ ] Manual testing: Typing flow works smoothly
- [ ] Documentation: CLAUDE.md updated, screenshots added
- [ ] Code review: Clean code, no console.logs

**Files to Commit:**
- `frontend/src/components/fields/SuggestionAlert.tsx` (NEW)
- `frontend/src/components/fields/SuggestionAlert.test.tsx` (NEW)
- `frontend/src/components/fields/NewFieldForm.tsx` (MODIFIED)
- `frontend/src/components/fields/NewFieldForm.integration.test.tsx` (NEW)
- `docs/components/suggestion-alert.md` (NEW)
- `CLAUDE.md` (MODIFIED)

---

## 🧪 Testing Strategy

### Unit Tests (13 tests)

**SuggestionAlert Component (13 tests):**
- Rendering: 6 tests (3 alert types + multiple + details + explanation)
- Interaction: 3 tests (click handlers, optional callback)
- Edge cases: 2 tests (empty, max 3 limit)
- Accessibility: 2 tests (ARIA roles, labels)

**Run:** `npm test -- SuggestionAlert.test.tsx`

---

### Integration Tests (5 tests)

**NewFieldForm Integration (5 tests):**
- Happy path: 3 tests (typing → suggestions → use existing)
- Edge cases: 2 tests (clear input, API error)

**Run:** `npm test -- NewFieldForm.integration.test.tsx`

---

### Manual Testing (Browser)

**Scenarios:**
1. Typing flow (fast/slow typing, backspace)
2. All 3 alert types (exact, typo, semantic)
3. "Use This" button action
4. Form submission (create vs use existing)
5. Accessibility (keyboard nav, screen reader)

**Browser DevTools:**
- Network tab: Check API calls (500ms debounce working?)
- React DevTools: Check state updates
- Lighthouse: Accessibility score ≥ 95

---

## ⏱️ Estimated Duration

**Implementation Time:**

| Step | Task | Estimated Time |
|------|------|---------------|
| 1 | Create SuggestionAlert component | 45 min |
| 2 | Component tests (13 tests) | 30 min |
| 3 | Update NewFieldForm integration | 30 min |
| 4 | Integration tests (5 tests) | 20 min |
| 5 | Visual documentation + screenshots | 15 min |
| 6 | Update CLAUDE.md | 5 min |
| 7 | Manual testing & edge cases | 20 min |
| 8 | Cleanup & final review | 10 min |

**Total:** 2.5-3 hours (175 minutes)

---

## ✅ Completion Checklist

**Implementation:**
- [ ] SuggestionAlert component created (120 lines)
- [ ] Color-coded alerts (Red/Yellow/Blue) working
- [ ] "Use This" button functional
- [ ] NewFieldForm integration complete
- [ ] Real-time checking with debounce working

**Testing:**
- [ ] 13/13 component tests passing
- [ ] 5/5 integration tests passing
- [ ] Manual testing completed (all scenarios)
- [ ] Accessibility audit passing (Lighthouse ≥ 95)
- [ ] No TypeScript errors
- [ ] No ESLint warnings

**Documentation:**
- [ ] CLAUDE.md updated with UI section
- [ ] suggestion-alert.md created with screenshots
- [ ] All 3 alert types documented visually
- [ ] Integration example included

**Quality:**
- [ ] Code review: Clean, well-commented code
- [ ] No console.logs or debug code
- [ ] Consistent with project patterns (shadcn/ui, Tailwind)
- [ ] WCAG 2.1 AA compliant

---

## 🔗 Related Tasks

**Dependencies:**
- Task #143: AI-Powered Duplicate Detection - REQUIRED (backend + hook complete)

**Blocks:**
- None (this completes the duplicate detection feature)

**Related:**
- Task #67: Duplicate Check Endpoint (original basic mode)
- NewFieldForm component (integration point)

---

## 📚 Reference

### Design Patterns

**Alert Type Mapping:**
| Similarity Type | Color | Icon | Score Range | Message |
|----------------|-------|------|-------------|---------|
| exact | Red | ⚠️ | 100% | "Exact Match" |
| levenshtein | Yellow | 💡 | 80-99% | "Similar Name (Typo?)" |
| semantic | Blue | 🤖 | 60-79% | "Similar Meaning (AI)" |

**Color System (Tailwind):**
- Red: `bg-red-50 border-red-200 text-red-800`
- Yellow: `bg-yellow-50 border-yellow-200 text-yellow-800`
- Blue: `bg-blue-50 border-blue-200 text-blue-800`

### Component API

**SuggestionAlert Props:**
```typescript
interface SuggestionAlertProps {
  suggestions: SmartSuggestion[];
  onUseExisting?: (fieldId: string) => void;
}

interface SmartSuggestion {
  field: {
    id: string;
    name: string;
    field_type: 'select' | 'rating' | 'text' | 'boolean';
    config: Record<string, any>;
  };
  score: number;  // 0.0-1.0
  similarity_type: 'exact' | 'levenshtein' | 'semantic' | 'no_match';
  explanation: string;
}
```

**Hook Usage (already implemented in Task #143):**
```typescript
const {
  suggestions,
  isChecking,
  debouncedCheck,
  hasExactMatch,
  hasTypoMatch,
  hasSemanticMatch
} = useSmartDuplicateCheck({
  listId: string,
  mode: 'basic' | 'smart',
  debounceMs?: number,  // default 500
  enabled?: boolean     // default true
});
```

---

**Plan Created:** 2025-11-14
**Parent Task:** Task #143 (AI-Powered Duplicate Detection)
**Ready for Implementation:** ✅ Yes (backend + hook complete)
**Estimated Implementation Time:** 2.5-3 hours (175 minutes)
**Complexity:** Medium (UI component + integration + testing)
