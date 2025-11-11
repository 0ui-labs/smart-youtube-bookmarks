# Task #26: Implement TableSettingsDropdown Component (IMPROVED with REF MCP)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Create a settings dropdown UI component that connects to the tableSettingsStore, allowing users to control thumbnail size and column visibility with real-time updates and localStorage persistence.

**Architecture:** shadcn/ui DropdownMenu with Radix UI primitives, connected to Zustand tableSettingsStore from Task #25. Settings apply immediately (no save button needed due to store's automatic persistence).

**Tech Stack:** React, TypeScript, Radix UI Dropdown Menu, shadcn/ui patterns, Zustand store integration, Vitest for testing.

**REF MCP Improvements Applied:**
1. ✅ Type Casting replaced with Runtime Validation + Type Narrowing
2. ✅ DropdownMenuSeparator added between sections
3. ✅ CheckboxItem API corrected (checked prop, onCheckedChange handler)
4. ✅ Test Isolation improved with beforeEach + afterEach
5. ✅ Store Import from central /stores index
6. ✅ Keyboard Navigation test added
7. ✅ Responsive width with max-w constraint

---

## 🎯 Ziel

Implementiere eine benutzerfreundliche Settings-Dropdown Komponente, die es ermöglicht:
1. Thumbnail-Größe zu wählen (3 Radio-Optionen: Klein, Mittel, Groß)
2. Spalten-Sichtbarkeit zu togglen (4 Checkboxen für aktuelle Spalten)
3. Settings persistent über localStorage (automatisch via Store)

Erwartetes Ergebnis: Ein funktionales Settings-Icon in der VideosPage, das beim Klick ein Dropdown mit allen Settings öffnet. Änderungen werden sofort angewendet und persistent gespeichert.

---

## 📋 Acceptance Criteria

- [ ] **Komponente existiert**: `frontend/src/components/TableSettingsDropdown.tsx` exportiert TableSettingsDropdown Komponente
- [ ] **shadcn/ui installiert**: `npx shadcn@latest add dropdown-menu` erfolgreich ausgeführt
- [ ] **Thumbnail Size Selector**: 3 Radio-Optionen (Klein, Mittel, Groß) mit `DropdownMenuRadioGroup`
- [ ] **Column Visibility Toggles**: 4 Checkboxen (thumbnail, title, duration, actions) mit `DropdownMenuCheckboxItem`
- [ ] **Visual Separator**: `DropdownMenuSeparator` zwischen Thumbnail Size und Column Visibility Sektionen
- [ ] **Store Integration**: Komponente liest und schreibt `useTableSettingsStore` state
- [ ] **Settings Icon**: Settings-Icon (⚙️) in VideosPage header neben anderen UI-Elementen
- [ ] **Immediate Apply**: Änderungen werden sofort angewendet (kein Save-Button nötig)
- [ ] **Tests passing**: 8+ Tests für Komponente (render, interactions, store integration, keyboard navigation)
- [ ] **Type Safety**: No type assertions (as casting) - use runtime validation + type narrowing
- [ ] **Accessibility**: Full keyboard navigation support tested
- [ ] **Code reviewed**: Subagent Code-Reviewer approval
- [ ] **Documentation updated**: JSDoc comments, inline explanations für komplexe Logik

---

## 🛠️ Implementation Steps

### Task 1: Install shadcn/ui DropdownMenu Component

**Files:**
- Create: `frontend/src/components/ui/dropdown-menu.tsx`
- Modify: `frontend/package.json` (adds @radix-ui/react-dropdown-menu dependency)

**Action:** Install shadcn/ui dropdown-menu component via CLI

**Commands:**
```bash
cd frontend
npx shadcn@latest add dropdown-menu

# Verification
ls src/components/ui/dropdown-menu.tsx
grep "react-dropdown-menu" package.json
```

**Why:** shadcn/ui provides well-tested, accessible Radix UI wrapper that handles keyboard navigation, focus management, and ARIA attributes automatically.

**Commit:**
```bash
git add src/components/ui/dropdown-menu.tsx package.json package-lock.json
git commit -m "chore: add shadcn/ui dropdown-menu component

- Install via shadcn CLI (npx shadcn@latest add dropdown-menu)
- Adds Radix UI dropdown-menu primitives
- Provides accessible dropdown implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create TableSettingsDropdown with TDD - Basic Render

**Files:**
- Create: `frontend/src/components/TableSettingsDropdown.test.tsx`
- Create: `frontend/src/components/TableSettingsDropdown.tsx`

**Action:** Write failing test first, then implement basic component with Settings icon trigger

**Test Code (with IMPROVED test isolation):**
```tsx
// frontend/src/components/TableSettingsDropdown.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSettingsDropdown } from './TableSettingsDropdown';
import { useTableSettingsStore } from '@/stores'; // REF MCP: Central import

// Mock the store
vi.mock('@/stores');

describe('TableSettingsDropdown', () => {
  // REF MCP Improvement #4: Test Isolation with beforeEach + afterEach
  beforeEach(() => {
    // Reset ALL mocks before each test
    vi.clearAllMocks();

    // Setup default mock implementation
    vi.mocked(useTableSettingsStore).mockReturnValue({
      thumbnailSize: 'small',
      visibleColumns: {
        thumbnail: true,
        title: true,
        duration: true,
        actions: true,
      },
      setThumbnailSize: vi.fn(),
      toggleColumn: vi.fn(),
    });
  });

  afterEach(() => {
    // Cleanup after each test
    vi.restoreAllMocks();
  });

  it('renders settings icon trigger button', () => {
    render(<TableSettingsDropdown />);

    // Settings button should be accessible
    const trigger = screen.getByRole('button', { name: /einstellungen/i });
    expect(trigger).toBeInTheDocument();
  });
});
```

**Component Code:**
```tsx
// frontend/src/components/TableSettingsDropdown.tsx
/**
 * TableSettingsDropdown Component
 *
 * Provides UI controls for table display settings (thumbnail size, column visibility).
 * Connected to tableSettingsStore for state management and localStorage persistence.
 *
 * Settings apply immediately - no save button needed due to automatic store persistence.
 *
 * @example
 * ```tsx
 * <TableSettingsDropdown />
 * ```
 */
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const TableSettingsDropdown = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Einstellungen"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)]" // REF MCP Improvement #7: Responsive width
      >
        {/* Content will be added in next tasks */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

**Run Test:**
```bash
cd frontend
npm test -- TableSettingsDropdown.test.tsx --run
```

**Expected:** PASS after component implementation

**Why:**
- TDD Red-Green-Refactor approach
- `asChild` on Trigger allows Button to be the trigger (better accessibility)
- `variant="ghost"` matches existing UI patterns in the app
- `size="icon"` provides consistent 40x40px clickable area
- `aria-label` makes button accessible to screen readers
- `align="end"` aligns dropdown to right edge (natural for top-right icon)
- REF MCP #7: `max-w-[calc(100vw-2rem)]` ensures dropdown doesn't overflow on small screens

**Commit:**
```bash
git add src/components/TableSettingsDropdown.tsx src/components/TableSettingsDropdown.test.tsx
git commit -m "feat: add TableSettingsDropdown basic component with tests

- Create component with Settings icon trigger
- Add initial test suite with proper test isolation (beforeEach/afterEach)
- Use central store import from @/stores
- Responsive width constraint for mobile support

Tests: 1/1 passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Implement Thumbnail Size Radio Group with TDD

**Files:**
- Modify: `frontend/src/components/TableSettingsDropdown.test.tsx`
- Modify: `frontend/src/components/TableSettingsDropdown.tsx`

**Action:** Write failing tests for thumbnail size selection, then implement Radio Group with IMPROVED type safety (no type casting)

**Test Code:**
```tsx
// Add to TableSettingsDropdown.test.tsx
import userEvent from '@testing-library/user-event';

describe('TableSettingsDropdown', () => {
  // ... existing tests

  describe('Thumbnail Size Selection', () => {
    it('shows thumbnail size options when opened', async () => {
      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /einstellungen/i });
      await user.click(trigger);

      // Verify thumbnail size section exists
      expect(screen.getByText('Thumbnail-Größe')).toBeInTheDocument();

      // Verify 3 size options
      expect(screen.getByRole('menuitemradio', { name: /klein/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /mittel/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /groß/i })).toBeInTheDocument();
    });

    it('calls setThumbnailSize when size option clicked', async () => {
      const setThumbnailSize = vi.fn();
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'small',
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize,
        toggleColumn: vi.fn(),
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown and click "Mittel"
      await user.click(screen.getByRole('button', { name: /einstellungen/i }));
      await user.click(screen.getByRole('menuitemradio', { name: /mittel/i }));

      // Verify store action was called with correct value
      expect(setThumbnailSize).toHaveBeenCalledWith('medium');
    });

    it('shows current thumbnail size as selected', async () => {
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'large', // Set to large
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        toggleColumn: vi.fn(),
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Verify "Groß" is checked
      const largeOption = screen.getByRole('menuitemradio', { name: /groß/i });
      expect(largeOption).toHaveAttribute('aria-checked', 'true');
    });
  });
});
```

**Component Code (with REF MCP Improvement #1: No type casting):**
```tsx
// frontend/src/components/TableSettingsDropdown.tsx
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTableSettingsStore } from '@/stores'; // REF MCP Improvement #5: Central import
import type { ThumbnailSize } from '@/stores'; // Import type

export const TableSettingsDropdown = () => {
  const { thumbnailSize, setThumbnailSize } = useTableSettingsStore();

  // REF MCP Improvement #1: Runtime validation + Type narrowing (NO type casting!)
  const handleThumbnailSizeChange = (value: string) => {
    // Type guard function - TypeScript narrows the type automatically
    if (value === 'small' || value === 'medium' || value === 'large') {
      setThumbnailSize(value); // TypeScript knows value is ThumbnailSize here
    } else {
      console.warn(`Invalid thumbnail size value: ${value}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Einstellungen">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
        {/* Thumbnail Size Section */}
        <DropdownMenuLabel>Thumbnail-Größe</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={thumbnailSize}
          onValueChange={handleThumbnailSizeChange} // Use type-safe handler
        >
          <DropdownMenuRadioItem value="small">Klein</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="medium">Mittel</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="large">Groß</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

**Run Test:**
```bash
npm test -- TableSettingsDropdown.test.tsx --run
```

**Expected:** PASS - all thumbnail size tests pass (4 tests total)

**Why REF MCP Improvement #1 is better:**
- **No Type Assertions**: TypeScript narrows the type automatically through the if-check
- **Runtime Safety**: Invalid values are caught and logged (defensive programming)
- **Explicit Intention**: Code clearly shows which values are valid
- **Maintainability**: If ThumbnailSize type changes, TypeScript will error

**Commit:**
```bash
git add src/components/TableSettingsDropdown.tsx src/components/TableSettingsDropdown.test.tsx
git commit -m "feat: add thumbnail size selection to TableSettingsDropdown

- Implement RadioGroup with 3 size options (Klein, Mittel, Groß)
- Use runtime validation + type narrowing (NO type casting)
- Add comprehensive tests for size selection
- Store integration with useTableSettingsStore

Tests: 4/4 passing (3 new tests)

REF MCP: Runtime validation instead of type assertions for better safety

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Implement Column Visibility Checkboxes with TDD

**Files:**
- Modify: `frontend/src/components/TableSettingsDropdown.test.tsx`
- Modify: `frontend/src/components/TableSettingsDropdown.tsx`

**Action:** Write failing tests for column visibility toggles, then implement CheckboxItems with CORRECT Radix API + visual separator

**Test Code:**
```tsx
// Add to TableSettingsDropdown.test.tsx

describe('TableSettingsDropdown', () => {
  // ... existing tests

  describe('Column Visibility', () => {
    it('shows column visibility checkboxes when opened', async () => {
      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Verify section label
      expect(screen.getByText('Sichtbare Spalten')).toBeInTheDocument();

      // Verify 4 column checkboxes exist
      expect(screen.getByRole('menuitemcheckbox', { name: /thumbnail/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemcheckbox', { name: /titel/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemcheckbox', { name: /dauer/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemcheckbox', { name: /aktionen/i })).toBeInTheDocument();
    });

    it('calls toggleColumn when checkbox clicked', async () => {
      const toggleColumn = vi.fn();
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'small',
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        toggleColumn,
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: /dauer/i }));

      expect(toggleColumn).toHaveBeenCalledWith('duration');
    });

    it('shows current column visibility state', async () => {
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'small',
        visibleColumns: {
          thumbnail: true,
          title: false, // Hidden
          duration: true,
          actions: true
        },
        setThumbnailSize: vi.fn(),
        toggleColumn: vi.fn(),
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Verify title checkbox is unchecked
      const titleCheckbox = screen.getByRole('menuitemcheckbox', { name: /titel/i });
      expect(titleCheckbox).toHaveAttribute('aria-checked', 'false');

      // Verify thumbnail checkbox is checked
      const thumbnailCheckbox = screen.getByRole('menuitemcheckbox', { name: /thumbnail/i });
      expect(thumbnailCheckbox).toHaveAttribute('aria-checked', 'true');
    });
  });
});
```

**Component Code (with REF MCP Improvements #2 and #3):**
```tsx
// frontend/src/components/TableSettingsDropdown.tsx
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem, // ADD THIS
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator, // REF MCP Improvement #2: Add separator
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTableSettingsStore } from '@/stores';
import type { ThumbnailSize } from '@/stores';

export const TableSettingsDropdown = () => {
  const { thumbnailSize, setThumbnailSize, visibleColumns, toggleColumn } = useTableSettingsStore();

  const handleThumbnailSizeChange = (value: string) => {
    if (value === 'small' || value === 'medium' || value === 'large') {
      setThumbnailSize(value);
    } else {
      console.warn(`Invalid thumbnail size value: ${value}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Einstellungen">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
        {/* Thumbnail Size Section */}
        <DropdownMenuLabel>Thumbnail-Größe</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={thumbnailSize}
          onValueChange={handleThumbnailSizeChange}
        >
          <DropdownMenuRadioItem value="small">Klein</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="medium">Mittel</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="large">Groß</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {/* REF MCP Improvement #2: Visual separator between sections */}
        <DropdownMenuSeparator />

        {/* Column Visibility Section */}
        <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>

        {/* REF MCP Improvement #3: Correct Radix API - checked prop + onCheckedChange */}
        <DropdownMenuCheckboxItem
          checked={visibleColumns.thumbnail}
          onCheckedChange={() => toggleColumn('thumbnail')}
        >
          Thumbnail
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={visibleColumns.title}
          onCheckedChange={() => toggleColumn('title')}
        >
          Titel
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={visibleColumns.duration}
          onCheckedChange={() => toggleColumn('duration')}
        >
          Dauer
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={visibleColumns.actions}
          onCheckedChange={() => toggleColumn('actions')}
        >
          Aktionen
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

**Run Test:**
```bash
npm test -- TableSettingsDropdown.test.tsx --run
```

**Expected:** PASS - all tests pass (7 tests total)

**Why REF MCP Improvements #2 and #3:**
- **#2 Separator**: Visual hierarchy makes sections scannable (UX best practice)
- **#3 Correct API**: `checked` + `onCheckedChange` is the correct Radix UI pattern (not `value` + `onChange`)

**Commit:**
```bash
git add src/components/TableSettingsDropdown.tsx src/components/TableSettingsDropdown.test.tsx
git commit -m "feat: add column visibility toggles to TableSettingsDropdown

- Implement CheckboxItems for 4 columns (thumbnail, title, duration, actions)
- Add visual separator between Thumbnail Size and Column Visibility sections
- Use correct Radix API (checked + onCheckedChange)
- Add comprehensive tests for checkbox interactions

Tests: 7/7 passing (3 new tests)

REF MCP: Visual separator for better UX, correct CheckboxItem API

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Add Keyboard Navigation Test (Accessibility)

**Files:**
- Modify: `frontend/src/components/TableSettingsDropdown.test.tsx`

**Action:** Add test to verify keyboard navigation works (REF MCP Improvement #6)

**Test Code:**
```tsx
// Add to TableSettingsDropdown.test.tsx

describe('TableSettingsDropdown', () => {
  // ... existing tests

  describe('Keyboard Navigation (Accessibility)', () => {
    // REF MCP Improvement #6: Test keyboard navigation
    it('supports keyboard navigation with Enter and Arrow keys', async () => {
      const setThumbnailSize = vi.fn();
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'small',
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize,
        toggleColumn: vi.fn(),
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      const trigger = screen.getByRole('button', { name: /einstellungen/i });

      // Open dropdown with keyboard
      trigger.focus();
      await user.keyboard('{Enter}');

      // Verify dropdown opened
      expect(screen.getByText('Thumbnail-Größe')).toBeInTheDocument();

      // Navigate with Arrow keys (Radix handles focus automatically)
      await user.keyboard('{ArrowDown}');

      // Select with Space (on first radio item "Klein")
      await user.keyboard(' ');

      // Close with Escape
      await user.keyboard('{Escape}');

      // Verify dropdown closed
      expect(screen.queryByText('Thumbnail-Größe')).not.toBeInTheDocument();
    });

    it('closes dropdown with Escape key', async () => {
      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /einstellungen/i });
      await user.click(trigger);

      expect(screen.getByText('Thumbnail-Größe')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Verify dropdown closed
      expect(screen.queryByText('Thumbnail-Größe')).not.toBeInTheDocument();
    });
  });
});
```

**Run Test:**
```bash
npm test -- TableSettingsDropdown.test.tsx --run
```

**Expected:** PASS - all tests pass (9 tests total)

**Why REF MCP Improvement #6:**
- Accessibility: Verifies keyboard navigation works for screen reader users
- Radix UI provides full keyboard support, but tests confirm it's not broken
- WAI-ARIA compliance check

**Commit:**
```bash
git add src/components/TableSettingsDropdown.test.tsx
git commit -m "test: add keyboard navigation tests for accessibility

- Test keyboard open (Enter), navigation (Arrow keys), close (Escape)
- Verify WAI-ARIA keyboard interactions work correctly
- Ensure accessibility for screen reader users

Tests: 9/9 passing (2 new tests)

REF MCP: Accessibility testing for keyboard-only users

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Integrate TableSettingsDropdown into VideosPage

**Files:**
- Modify: `frontend/src/components/VideosPage.tsx`

**Action:** Add TableSettingsDropdown component to VideosPage header

**Code Changes:**
```tsx
// In VideosPage.tsx, add import at top:
import { TableSettingsDropdown } from './TableSettingsDropdown';

// Find the header section (around line 200-250) and add TableSettingsDropdown:
// Look for the section with buttons like CSV upload, add after those buttons:

{/* Table Settings Dropdown */}
<TableSettingsDropdown />
```

**Verification:**
- Start dev server: `npm run dev`
- Navigate to Videos page
- Verify Settings icon appears in header
- Click icon and verify dropdown opens
- Test thumbnail size selection
- Test column visibility toggles
- Verify settings persist after page reload

**Commit:**
```bash
git add src/components/VideosPage.tsx
git commit -m "feat: integrate TableSettingsDropdown into VideosPage

- Add TableSettingsDropdown to VideosPage header
- Settings icon appears next to other action buttons
- Dropdown provides thumbnail size and column visibility controls
- Settings automatically persist via tableSettingsStore

Task #26 integration complete

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## ✅ Task Completion Checklist

After all implementation tasks:

- [ ] All tests passing (9+ tests)
- [ ] Manual browser testing completed
- [ ] Settings persist across page reloads
- [ ] Keyboard navigation works
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Code reviewed by superpowers:code-reviewer
- [ ] Documentation updated

---

## 📊 Success Metrics

**Tests:** 9+ tests passing
- 1 basic render test
- 3 thumbnail size tests
- 3 column visibility tests
- 2 keyboard navigation tests

**Code Quality:**
- No type assertions (as casting) - ✅ Runtime validation
- Proper test isolation - ✅ beforeEach + afterEach
- Correct Radix UI API - ✅ checked + onCheckedChange
- Visual hierarchy - ✅ Separator between sections
- Accessibility - ✅ Keyboard navigation tested

**REF MCP Improvements Applied:** 7/7
1. ✅ Type Casting → Runtime Validation + Type Narrowing
2. ✅ Visual Separator added
3. ✅ CheckboxItem API corrected
4. ✅ Test Isolation improved
5. ✅ Central Store Import
6. ✅ Keyboard Navigation test
7. ✅ Responsive width

---

## 🔗 Related Tasks

- **Task #25**: Table Settings Store (foundation for this task)
- **Task #27**: Apply thumbnail size to actual video thumbnails in VideosPage
- **Task #28**: Apply column visibility to TanStack Table columns

---

## 📝 Notes

**REF MCP Validation:**
All 7 REF MCP improvements from plan review have been incorporated into this implementation plan.

**Why Subagent-Driven Development:**
- Fresh context per task (no pollution)
- Code review after each task (catch issues early)
- TDD naturally followed by subagents
- Faster iteration with quality gates

**Test-Driven Development:**
Every task follows Red-Green-Refactor:
1. Write failing test
2. Implement minimum code to pass
3. Refactor for quality

**Type Safety:**
No type assertions (`as` casting) used. All type narrowing is done through runtime validation, making code safer and more maintainable.
