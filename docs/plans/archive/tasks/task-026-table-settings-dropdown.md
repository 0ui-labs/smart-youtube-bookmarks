Looking at the codebase context, I can see this is a Smart YouTube Bookmarks application with React/TypeScript frontend and FastAPI backend. The plan you've provided looks well-structured for implementing a TableSettingsDropdown component. After reviewing the codebase structure and existing patterns, here's the complete adapted plan:

# Task #26: Implement TableSettingsDropdown Component

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a settings dropdown UI component that connects to the tableSettingsStore, allowing users to control thumbnail size and column visibility with real-time updates and localStorage persistence.

**Architecture:** shadcn/ui DropdownMenu with Radix UI primitives, connected to Zustand tableSettingsStore from Task #25. Settings apply immediately (no save button needed due to store's automatic persistence).

**Tech Stack:** React, TypeScript, Radix UI Dropdown Menu, shadcn/ui patterns, Zustand store integration, Vitest for testing.

---

## 🎯 Ziel

Implementiere eine benutzerfreundliche Settings-Dropdown Komponente, die es ermöglicht:
1. Thumbnail-Größe zu wählen (3 Radio-Optionen: Klein, Mittel, Groß)
2. Spalten-Sichtbarkeit zu togglen (4 Checkboxen für aktuelle Spalten)
3. Settings persistent über localStorage (automatisch via Store)

Erwartetes Ergebnis: Ein funktionales Settings-Icon in der VideosPage, das beim Klick ein Dropdown mit allen Settings öffnet. Änderungen werden sofort angewendet und persistent gespeichert.

## 📋 Acceptance Criteria

- [ ] **Komponente existiert**: `frontend/src/components/TableSettingsDropdown.tsx` exportiert TableSettingsDropdown Komponente
- [ ] **shadcn/ui installiert**: `npx shadcn@latest add dropdown-menu` erfolgreich ausgeführt
- [ ] **Thumbnail Size Selector**: 3 Radio-Optionen (Klein, Mittel, Groß) mit `DropdownMenuRadioGroup`
- [ ] **Column Visibility Toggles**: 4 Checkboxen (thumbnail, title, duration, actions) mit `DropdownMenuCheckboxItem`
- [ ] **Store Integration**: Komponente liest und schreibt `useTableSettingsStore` state
- [ ] **Settings Icon**: Settings-Icon (⚙️) in VideosPage header neben anderen UI-Elementen
- [ ] **Immediate Apply**: Änderungen werden sofort angewendet (kein Save-Button nötig)
- [ ] **Tests passing**: 6+ Tests für Komponente (render, interactions, store integration)
- [ ] **Code reviewed**: Subagent Code-Reviewer + Semgrep + CodeRabbit approval
- [ ] **Documentation updated**: JSDoc comments, inline explanations für komplexe Logik

---

## 🛠️ Implementation Steps

### Step 1: Install shadcn/ui DropdownMenu Component

**Files:**
- Create: `frontend/src/components/ui/dropdown-menu.tsx`
- Modify: `frontend/package.json` (adds @radix-ui/react-dropdown-menu dependency)

**Action:** Install shadcn/ui dropdown-menu component via CLI

**Command:**
```bash
cd frontend
npx shadcn@latest add dropdown-menu
```

**Expected Output:**
```
✔ Installing dependencies...
✔ Created dropdown-menu component at src/components/ui/dropdown-menu.tsx
✔ Added @radix-ui/react-dropdown-menu to dependencies
```

**Verification:**
```bash
# Check that file was created
ls frontend/src/components/ui/dropdown-menu.tsx

# Check that dependency was added
grep "react-dropdown-menu" frontend/package.json
```

**Why:** shadcn/ui provides well-tested, accessible Radix UI wrapper that handles keyboard navigation, focus management, and ARIA attributes automatically. Don't reinvent the wheel - use battle-tested components.

**Commit:**
```bash
git add frontend/src/components/ui/dropdown-menu.tsx frontend/package.json frontend/package-lock.json
git commit -m "chore: add shadcn/ui dropdown-menu component

- Install via shadcn CLI (npx shadcn@latest add dropdown-menu)
- Adds Radix UI dropdown-menu primitives
- Provides accessible dropdown implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Step 2: Write Failing Test - Component Renders with Settings Icon

**Files:**
- Create: `frontend/src/components/TableSettingsDropdown.test.tsx`

**Action:** Write test that verifies component renders with accessible settings icon

**Code:**
```tsx
// frontend/src/components/TableSettingsDropdown.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSettingsDropdown } from './TableSettingsDropdown';
import { useTableSettingsStore } from '@/stores/tableSettingsStore';

// Mock the store
vi.mock('@/stores/tableSettingsStore');

describe('TableSettingsDropdown', () => {
  beforeEach(() => {
    // Reset store mock before each test
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

  it('renders settings icon trigger button', () => {
    render(<TableSettingsDropdown />);

    // Settings button should be accessible
    const trigger = screen.getByRole('button', { name: /einstellungen/i });
    expect(trigger).toBeInTheDocument();
  });
});
```

**Run Test:**
```bash
cd frontend
npm test -- TableSettingsDropdown.test.tsx --run
```

**Expected:** FAIL with "Cannot find module './TableSettingsDropdown'"

**Why:** TDD Red phase - write failing test first to ensure test actually tests something. If test passes without implementation, test is broken.

---

### Step 3: Implement Basic TableSettingsDropdown Component

**Files:**
- Create: `frontend/src/components/TableSettingsDropdown.tsx`

**Action:** Create component with Settings icon trigger and empty dropdown content

**Code:**
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

      <DropdownMenuContent align="end" className="w-64">
        {/* Content will be added in next steps */}
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

**Expected:** PASS - basic render test passes

**Why:**
- `asChild` on Trigger allows Button to be the trigger (better accessibility)
- `variant="ghost"` matches existing UI patterns in the app
- `size="icon"` provides consistent 40x40px clickable area
- `aria-label` makes button accessible to screen readers
- `align="end"` aligns dropdown to right edge (natural for top-right icon)
- `className="w-64"` provides comfortable width for settings (256px)

---

### Step 4: Write Failing Test - Thumbnail Size Radio Group

**Files:**
- Modify: `frontend/src/components/TableSettingsDropdown.test.tsx`

**Action:** Add test for thumbnail size selection

**Code:**
```tsx
// Add to TableSettingsDropdown.test.tsx
import userEvent from '@testing-library/user-event';

describe('TableSettingsDropdown', () => {
  // ... existing tests

  it('shows thumbnail size options when opened', async () => {
    const user = userEvent.setup();
    render(<TableSettingsDropdown />);

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /einstellungen/i });
    await user.click(trigger);

    // Verify thumbnail size section exists
    expect(screen.getByText('Thumbnail-Größe')).toBeInTheDocument();

    // Verify 3 size options
    expect(screen.getByRole('radio', { name: /klein/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /mittel/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /groß/i })).toBeInTheDocument();
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
    await user.click(screen.getByRole('radio', { name: /mittel/i }));

    // Verify store action was called
    expect(setThumbnailSize).toHaveBeenCalledWith('medium');
  });
});
```

**Run Test:**
```bash
cd frontend
npm test -- TableSettingsDropdown.test.tsx --run
```

**Expected:** FAIL - thumbnail size options not rendered yet

**Why:** TDD Red-Green-Refactor - add next test before implementation to ensure test catches missing functionality.

---

### Step 5: Implement Thumbnail Size Radio Group

**Files:**
- Modify: `frontend/src/components/TableSettingsDropdown.tsx`

**Action:** Add thumbnail size section with RadioGroup

**Code:**
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
import { useTableSettingsStore } from '@/stores/tableSettingsStore';

export const TableSettingsDropdown = () => {
  const { thumbnailSize, setThumbnailSize } = useTableSettingsStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Einstellungen">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {/* Thumbnail Size Section */}
        <DropdownMenuLabel>Thumbnail-Größe</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={thumbnailSize}
          onValueChange={(value) => setThumbnailSize(value as 'small' | 'medium' | 'large')}
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
cd frontend
npm test -- TableSettingsDropdown.test.tsx --run
```

**Expected:** PASS - both thumbnail size tests pass

**Why:**
- `DropdownMenuLabel` provides semantic heading for radio group (accessibility)
- `DropdownMenuRadioGroup` ensures only one option selected at a time
- `value={thumbnailSize}` syncs UI with store state (controlled component)
- `onValueChange` type cast ensures TypeScript safety (RadioGroup emits string)
- German labels match app language (Klein/Mittel/Groß)

---

### Step 6: Write Failing Test - Column Visibility Checkboxes

**Files:**
- Modify: `frontend/src/components/TableSettingsDropdown.test.tsx`

**Action:** Add tests for column visibility toggles

**Code:**
```tsx
// Add to TableSettingsDropdown.test.tsx

describe('TableSettingsDropdown',