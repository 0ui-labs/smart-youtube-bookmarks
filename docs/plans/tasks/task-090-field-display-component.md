# Task #90: Create FieldDisplay Component with Type-Specific Renderers

**Plan Task:** #90
**Wave/Phase:** Custom Fields System - Phase 1: MVP - Frontend (Components + UI)
**Dependencies:** Task #64 (CustomField Pydantic Schemas), Task #65 (FieldSchema Pydantic Schemas)

---

## 🎯 Ziel

Create a reusable FieldDisplay component that renders custom field values with type-specific UI (Rating stars, Select badge, Boolean checkbox, Text snippet) and supports inline editing via controlled component pattern. This component will be used in VideoCard preview (max 3 fields) and VideoDetailsModal (all fields).

## 📋 Acceptance Criteria

- [ ] FieldDisplay component renders 4 field types correctly (rating, select, boolean, text)
- [ ] Rating type displays interactive star icons (1-10 max_rating support)
- [ ] Select type displays value as badge with dropdown editing
- [ ] Boolean type displays checkbox with accessible label
- [ ] Text type shows truncated snippet with expand affordance
- [ ] Inline editing works via controlled onChange callback
- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] WCAG 2.1 Level AA accessibility (keyboard navigation, ARIA labels)
- [ ] 20+ unit tests covering all field types and edge cases
- [ ] All tests passing with Vitest + @testing-library/react

---

## 🛠️ Implementation Steps

### 1. Create TypeScript Type Definitions

**Files:** `frontend/src/types/customField.ts`

**Action:** Define TypeScript interfaces matching backend Pydantic schemas

```typescript
// frontend/src/types/customField.ts

/**
 * Custom Field Type Definitions
 * 
 * These types match the backend Pydantic schemas (backend/app/schemas/custom_field.py)
 * for type safety across the frontend-backend boundary.
 */

export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

// Type-specific config interfaces (discriminated union)
export interface SelectConfig {
  options: string[]
}

export interface RatingConfig {
  max_rating: number // 1-10
}

export interface TextConfig {
  max_length?: number | null
}

export interface BooleanConfig {
  // No config needed
}

// Discriminated union for config based on field_type
export type FieldConfig = 
  | { field_type: 'select'; config: SelectConfig }
  | { field_type: 'rating'; config: RatingConfig }
  | { field_type: 'text'; config: TextConfig }
  | { field_type: 'boolean'; config: BooleanConfig }

// Custom Field Response (matches backend CustomFieldResponse)
export interface CustomField {
  id: string
  list_id: string
  name: string
  field_type: FieldType
  config: SelectConfig | RatingConfig | TextConfig | BooleanConfig
  created_at: string
  updated_at: string
}

// Field value types (matches VideoFieldValue typed columns)
export type FieldValue = string | number | boolean | null
```

**Design Decision:** Use discriminated union pattern for type-safe config access. TypeScript will narrow types based on `field_type` in switch statements.

---

### 2. Install shadcn/ui Badge Component

**Files:** `frontend/src/components/ui/badge.tsx`

**Action:** Install Badge component for Select field type display

```bash
cd frontend
npx shadcn@latest add badge
```

**Verification:** Check that `frontend/src/components/ui/badge.tsx` exists with variants: default, secondary, outline, destructive.

---

### 3. Create RatingStars Sub-Component (TDD)

**Files:** 
- `frontend/src/components/fields/RatingStars.tsx`
- `frontend/src/components/fields/RatingStars.test.tsx`

**Action:** Implement accessible star rating component with keyboard navigation

**Test First (RatingStars.test.tsx):**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RatingStars } from './RatingStars'

describe('RatingStars', () => {
  it('renders correct number of stars based on max_rating', () => {
    render(<RatingStars value={3} max={5} readOnly />)
    
    const stars = screen.getAllByLabelText(/star/i)
    expect(stars).toHaveLength(5)
  })

  it('displays filled stars up to value', () => {
    render(<RatingStars value={3} max={5} readOnly />)
    
    // 3 filled, 2 empty
    expect(screen.getAllByLabelText(/filled star/i)).toHaveLength(3)
    expect(screen.getAllByLabelText(/empty star/i)).toHaveLength(2)
  })

  it('calls onChange when star is clicked in editable mode', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<RatingStars value={2} max={5} onChange={onChange} />)
    
    const fourthStar = screen.getByLabelText('4 Stars')
    await user.click(fourthStar)
    
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('supports keyboard navigation with arrow keys', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<RatingStars value={2} max={5} onChange={onChange} />)
    
    const ratingGroup = screen.getByRole('radiogroup')
    await user.click(ratingGroup)
    await user.keyboard('{ArrowRight}{ArrowRight}') // From 2 to 4
    
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('renders with readOnly prop (no onChange)', () => {
    render(<RatingStars value={3} max={5} readOnly />)
    
    const ratingGroup = screen.getByRole('img', { name: /3 out of 5 stars/i })
    expect(ratingGroup).toBeInTheDocument()
  })

  it('handles max_rating from 1 to 10', () => {
    const { rerender } = render(<RatingStars value={5} max={10} readOnly />)
    expect(screen.getAllByLabelText(/star/i)).toHaveLength(10)
    
    rerender(<RatingStars value={1} max={1} readOnly />)
    expect(screen.getAllByLabelText(/star/i)).toHaveLength(1)
  })

  it('shows hover preview in editable mode', async () => {
    const user = userEvent.setup()
    render(<RatingStars value={2} max={5} onChange={vi.fn()} />)
    
    const fourthStar = screen.getByLabelText('4 Stars')
    await user.hover(fourthStar)
    
    // Visual feedback: 4 stars should appear filled during hover
    expect(screen.getAllByLabelText(/filled star/i)).toHaveLength(4)
  })

  it('applies custom className', () => {
    render(<RatingStars value={3} max={5} readOnly className="custom-class" />)
    
    const container = screen.getByRole('img').parentElement
    expect(container).toHaveClass('custom-class')
  })
})
```

**Implementation (RatingStars.tsx):**

```typescript
// frontend/src/components/fields/RatingStars.tsx
import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface RatingStarsProps {
  value: number | null
  max: number // 1-10 (from RatingConfig.max_rating)
  onChange?: (value: number) => void
  readOnly?: boolean
  className?: string
}

/**
 * RatingStars Component - Accessible star rating display/editor
 * 
 * Features:
 * - WCAG 2.1 Level AA compliant (radio group pattern)
 * - Keyboard navigation (Arrow keys, Tab, Enter/Space)
 * - Hover preview in editable mode
 * - Read-only mode with img role
 * - Supports 1-10 max_rating (backend validation ensures range)
 * 
 * REF MCP: WAI-ARIA Star Rating pattern
 * https://www.w3.org/WAI/tutorials/forms/custom-controls/#a-star-rating
 */
export const RatingStars = ({
  value,
  max,
  onChange,
  readOnly = false,
  className,
}: RatingStarsProps) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  
  const displayValue = hoverValue ?? value ?? 0
  const isEditable = !readOnly && onChange !== undefined

  const handleClick = (starValue: number) => {
    if (isEditable) {
      onChange(starValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, currentValue: number) => {
    if (!isEditable) return

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (currentValue < max) {
        onChange(currentValue + 1)
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (currentValue > 0) {
        onChange(currentValue - 1)
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onChange(currentValue)
    }
  }

  // Read-only mode: img role with aria-label
  if (readOnly) {
    return (
      <div
        role="img"
        aria-label={`${value ?? 0} out of ${max} stars`}
        className={cn('flex gap-0.5', className)}
      >
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1
          const isFilled = starValue <= (value ?? 0)
          
          return (
            <Star
              key={starValue}
              className={cn(
                'h-4 w-4',
                isFilled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              )}
              aria-label={isFilled ? 'filled star' : 'empty star'}
            />
          )
        })}
      </div>
    )
  }

  // Editable mode: radio group pattern
  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      className={cn('flex gap-0.5', className)}
      onMouseLeave={() => setHoverValue(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1
        const isFilled = starValue <= displayValue
        const isSelected = starValue === value

        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${starValue} Star${starValue !== 1 ? 's' : ''}`}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => setHoverValue(starValue)}
            onKeyDown={(e) => handleKeyDown(e, starValue)}
            className={cn(
              'cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded',
              isSelected && 'ring-2 ring-ring ring-offset-2'
            )}
            tabIndex={isSelected ? 0 : -1}
          >
            <Star
              className={cn(
                'h-4 w-4',
                isFilled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              )}
              aria-label={isFilled ? 'filled star' : 'empty star'}
            />
          </button>
        )
      })}
    </div>
  )
}
```

**REF MCP Validations:**
- WAI-ARIA Radio Group pattern for editable mode
- Read-only mode uses `role="img"` with `aria-label`
- Keyboard navigation (Arrow keys change value, Tab moves focus)
- Focus management (only selected radio is tabbable, `tabIndex={isSelected ? 0 : -1}`)
- Hover preview for better UX

---

### 4. Create SelectBadge Sub-Component (TDD)

**Files:**
- `frontend/src/components/fields/SelectBadge.tsx`
- `frontend/src/components/fields/SelectBadge.test.tsx`

**Test First (SelectBadge.test.tsx):**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectBadge } from './SelectBadge'

describe('SelectBadge', () => {
  const mockOptions = ['bad', 'good', 'great']

  it('renders current value as badge', () => {
    render(<SelectBadge value="good" options={mockOptions} readOnly />)
    
    const badge = screen.getByText('good')
    expect(badge).toBeInTheDocument()
  })

  it('renders null value as placeholder', () => {
    render(<SelectBadge value={null} options={mockOptions} readOnly />)
    
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('opens dropdown menu when clicked in editable mode', async () => {
    const user = userEvent.setup()
    render(<SelectBadge value="good" options={mockOptions} onChange={vi.fn()} />)
    
    const badge = screen.getByText('good')
    await user.click(badge)
    
    // Dropdown menu should show all options
    expect(screen.getByText('bad')).toBeInTheDocument()
    expect(screen.getByText('great')).toBeInTheDocument()
  })

  it('calls onChange when option is selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<SelectBadge value="good" options={mockOptions} onChange={onChange} />)
    
    const badge = screen.getByText('good')
    await user.click(badge)
    
    const greatOption = screen.getByText('great')
    await user.click(greatOption)
    
    expect(onChange).toHaveBeenCalledWith('great')
  })

  it('does not open dropdown in readOnly mode', async () => {
    const user = userEvent.setup()
    render(<SelectBadge value="good" options={mockOptions} readOnly />)
    
    const badge = screen.getByText('good')
    await user.click(badge)
    
    // No dropdown items should appear
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('shows checkmark next to selected option', async () => {
    const user = userEvent.setup()
    render(<SelectBadge value="good" options={mockOptions} onChange={vi.fn()} />)
    
    const badge = screen.getByText('good')
    await user.click(badge)
    
    const goodOption = screen.getByText('good')
    expect(goodOption.querySelector('svg')).toBeInTheDocument() // Check icon
  })

  it('supports keyboard navigation', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<SelectBadge value="good" options={mockOptions} onChange={onChange} />)
    
    const badge = screen.getByText('good')
    await user.click(badge)
    
    // Arrow down to next option
    await user.keyboard('{ArrowDown}{Enter}')
    
    expect(onChange).toHaveBeenCalledWith('great')
  })

  it('applies custom className', () => {
    const { container } = render(
      <SelectBadge value="good" options={mockOptions} readOnly className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
```

**Implementation (SelectBadge.tsx):**

```typescript
// frontend/src/components/fields/SelectBadge.tsx
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface SelectBadgeProps {
  value: string | null
  options: string[] // From SelectConfig.options
  onChange?: (value: string) => void
  readOnly?: boolean
  className?: string
}

/**
 * SelectBadge Component - Select field value displayed as badge
 * 
 * Features:
 * - Read-only mode: static badge display
 * - Editable mode: clickable badge opens dropdown menu
 * - Checkmark indicator for selected option
 * - Keyboard navigation via Radix UI DropdownMenu
 * - Null value displays as placeholder "—"
 * 
 * REF MCP: shadcn/ui Badge + DropdownMenu pattern
 */
export const SelectBadge = ({
  value,
  options,
  onChange,
  readOnly = false,
  className,
}: SelectBadgeProps) => {
  const isEditable = !readOnly && onChange !== undefined
  const displayValue = value ?? '—'

  const handleSelect = (selectedValue: string) => {
    if (isEditable) {
      onChange(selectedValue)
    }
  }

  // Read-only mode: static badge
  if (readOnly) {
    return (
      <Badge variant="secondary" className={cn('font-normal', className)}>
        {displayValue}
      </Badge>
    )
  }

  // Editable mode: dropdown menu
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="secondary"
          className={cn(
            'cursor-pointer font-normal hover:bg-secondary/80 transition-colors',
            className
          )}
        >
          {displayValue}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => handleSelect(option)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span>{option}</span>
              {value === option && (
                <Check className="h-4 w-4 ml-2 text-primary" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**REF MCP Validations:**
- shadcn/ui Badge component with secondary variant
- Radix UI DropdownMenu for accessible keyboard navigation
- `modal={false}` prevents portal conflicts (Task #29 pattern)
- Check icon from lucide-react for selected option

---

### 5. Create BooleanCheckbox Sub-Component (TDD)

**Files:**
- `frontend/src/components/fields/BooleanCheckbox.tsx`
- `frontend/src/components/fields/BooleanCheckbox.test.tsx`

**Test First (BooleanCheckbox.test.tsx):**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BooleanCheckbox } from './BooleanCheckbox'

describe('BooleanCheckbox', () => {
  it('renders checked checkbox when value is true', () => {
    render(<BooleanCheckbox value={true} label="Completed" readOnly />)
    
    const checkbox = screen.getByRole('checkbox', { name: /completed/i })
    expect(checkbox).toBeChecked()
  })

  it('renders unchecked checkbox when value is false', () => {
    render(<BooleanCheckbox value={false} label="Completed" readOnly />)
    
    const checkbox = screen.getByRole('checkbox', { name: /completed/i })
    expect(checkbox).not.toBeChecked()
  })

  it('renders unchecked when value is null', () => {
    render(<BooleanCheckbox value={null} label="Completed" readOnly />)
    
    const checkbox = screen.getByRole('checkbox', { name: /completed/i })
    expect(checkbox).not.toBeChecked()
  })

  it('calls onChange when clicked in editable mode', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<BooleanCheckbox value={false} label="Completed" onChange={onChange} />)
    
    const checkbox = screen.getByRole('checkbox', { name: /completed/i })
    await user.click(checkbox)
    
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles from true to false', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<BooleanCheckbox value={true} label="Completed" onChange={onChange} />)
    
    const checkbox = screen.getByRole('checkbox', { name: /completed/i })
    await user.click(checkbox)
    
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('does not call onChange in readOnly mode', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<BooleanCheckbox value={false} label="Completed" onChange={onChange} readOnly />)
    
    const checkbox = screen.getByRole('checkbox', { name: /completed/i })
    await user.click(checkbox)
    
    expect(onChange).not.toHaveBeenCalled()
  })

  it('supports keyboard interaction (Space key)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<BooleanCheckbox value={false} label="Completed" onChange={onChange} />)
    
    const checkbox = screen.getByRole('checkbox', { name: /completed/i })
    checkbox.focus()
    await user.keyboard(' ') // Space key
    
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('applies custom className', () => {
    const { container } = render(
      <BooleanCheckbox value={true} label="Completed" readOnly className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
```

**Implementation (BooleanCheckbox.tsx):**

```typescript
// frontend/src/components/fields/BooleanCheckbox.tsx
import { cn } from '@/lib/utils'

interface BooleanCheckboxProps {
  value: boolean | null
  label: string // Field name for accessible label
  onChange?: (value: boolean) => void
  readOnly?: boolean
  className?: string
}

/**
 * BooleanCheckbox Component - Boolean field value as checkbox
 * 
 * Features:
 * - Native checkbox with accessible label
 * - Read-only mode with disabled attribute
 * - Null value treated as false (unchecked)
 * - Keyboard accessible (Space/Enter toggle)
 * - Simple controlled component pattern
 * 
 * Note: Uses native <input type="checkbox"> for maximum accessibility.
 * No shadcn/ui Checkbox component needed (native is simpler for this use case).
 */
export const BooleanCheckbox = ({
  value,
  label,
  onChange,
  readOnly = false,
  className,
}: BooleanCheckboxProps) => {
  const isChecked = value === true
  const isEditable = !readOnly && onChange !== undefined

  const handleChange = () => {
    if (isEditable) {
      onChange(!isChecked)
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        disabled={readOnly}
        aria-label={label}
        className={cn(
          'h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2',
          readOnly && 'cursor-not-allowed opacity-50'
        )}
      />
      <label
        className={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          readOnly && 'cursor-not-allowed opacity-50'
        )}
      >
        {label}
      </label>
    </div>
  )
}
```

**Design Decision:** Use native `<input type="checkbox">` instead of shadcn/ui Checkbox component for simplicity. Native checkbox provides all required accessibility features (ARIA role, keyboard support) without additional complexity.

---

### 6. Create TextSnippet Sub-Component (TDD)

**Files:**
- `frontend/src/components/fields/TextSnippet.tsx`
- `frontend/src/components/fields/TextSnippet.test.tsx`

**Test First (TextSnippet.test.tsx):**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextSnippet } from './TextSnippet'

describe('TextSnippet', () => {
  it('renders short text without truncation', () => {
    render(<TextSnippet value="Short text" maxLength={50} readOnly />)
    
    expect(screen.getByText('Short text')).toBeInTheDocument()
  })

  it('truncates long text with ellipsis', () => {
    const longText = 'This is a very long text that should be truncated at 50 characters to show ellipsis indicator'
    render(<TextSnippet value={longText} maxLength={50} readOnly />)
    
    const snippet = screen.getByText(/This is a very long text/)
    expect(snippet.textContent).toHaveLength(53) // 50 chars + "..."
  })

  it('renders null value as placeholder', () => {
    render(<TextSnippet value={null} maxLength={50} readOnly />)
    
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows expand button when text is truncated', () => {
    const longText = 'A'.repeat(100)
    render(<TextSnippet value={longText} maxLength={50} onExpand={vi.fn()} />)
    
    expect(screen.getByRole('button', { name: /mehr anzeigen/i })).toBeInTheDocument()
  })

  it('does not show expand button when text is short', () => {
    render(<TextSnippet value="Short" maxLength={50} onExpand={vi.fn()} />)
    
    expect(screen.queryByRole('button', { name: /mehr anzeigen/i })).not.toBeInTheDocument()
  })

  it('calls onExpand when expand button is clicked', async () => {
    const onExpand = vi.fn()
    const user = userEvent.setup()
    
    const longText = 'A'.repeat(100)
    render(<TextSnippet value={longText} maxLength={50} onExpand={onExpand} />)
    
    const expandButton = screen.getByRole('button', { name: /mehr anzeigen/i })
    await user.click(expandButton)
    
    expect(onExpand).toHaveBeenCalled()
  })

  it('displays inline input in editable mode', () => {
    render(<TextSnippet value="Editable text" maxLength={50} onChange={vi.fn()} />)
    
    const input = screen.getByDisplayValue('Editable text')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  it('calls onChange when text is edited', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<TextSnippet value="Initial" maxLength={50} onChange={onChange} />)
    
    const input = screen.getByDisplayValue('Initial')
    await user.clear(input)
    await user.type(input, 'Updated')
    
    expect(onChange).toHaveBeenLastCalledWith('Updated')
  })

  it('enforces max_length in input', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    
    render(<TextSnippet value="" maxLength={10} onChange={onChange} />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('maxLength', '10')
  })

  it('applies custom className', () => {
    const { container } = render(
      <TextSnippet value="Test" maxLength={50} readOnly className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
```

**Implementation (TextSnippet.tsx):**

```typescript
// frontend/src/components/fields/TextSnippet.tsx
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TextSnippetProps {
  value: string | null
  maxLength: number // Character limit for snippet (NOT TextConfig.max_length)
  onChange?: (value: string) => void
  onExpand?: () => void // Callback to open VideoDetailsModal
  readOnly?: boolean
  className?: string
}

/**
 * TextSnippet Component - Text field value with truncation
 * 
 * Features:
 * - Read-only mode: truncated text with expand button
 * - Editable mode: inline text input with maxLength
 * - Null value displays as placeholder "—"
 * - Expand affordance (ChevronRight icon) when truncated
 * - Character limit enforced via maxLength attribute
 * 
 * Note: maxLength prop is for DISPLAY truncation (VideoCard preview),
 * NOT the field's max_length config (that's enforced in backend validation).
 */
export const TextSnippet = ({
  value,
  maxLength,
  onChange,
  onExpand,
  readOnly = false,
  className,
}: TextSnippetProps) => {
  const displayValue = value ?? '—'
  const isEditable = !readOnly && onChange !== undefined
  const isTruncated = (value?.length ?? 0) > maxLength
  const truncatedValue = isTruncated
    ? value!.slice(0, maxLength) + '...'
    : displayValue

  // Editable mode: inline text input
  if (isEditable) {
    return (
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength} // Enforce display limit
        className={cn(
          'w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          className
        )}
        placeholder="—"
      />
    )
  }

  // Read-only mode: truncated text with optional expand button
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="text-sm text-muted-foreground">
        {truncatedValue}
      </span>
      {isTruncated && onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex items-center text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
          aria-label="Mehr anzeigen"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
```

**Design Decision:** Use native `<input type="text">` for inline editing. Expand button opens VideoDetailsModal (passed as `onExpand` callback from parent).

---

### 7. Create Main FieldDisplay Component with Type Discrimination (TDD)

**Files:**
- `frontend/src/components/fields/FieldDisplay.tsx`
- `frontend/src/components/fields/FieldDisplay.test.tsx`

**Test First (FieldDisplay.test.tsx):**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldDisplay } from './FieldDisplay'
import type { CustomField } from '@/types/customField'

describe('FieldDisplay', () => {
  describe('Rating Field Type', () => {
    const ratingField: CustomField = {
      id: 'field-1',
      list_id: 'list-1',
      name: 'Overall Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('renders RatingStars for rating type', () => {
      render(<FieldDisplay field={ratingField} value={3} readOnly />)
      
      expect(screen.getByRole('img', { name: /3 out of 5 stars/i })).toBeInTheDocument()
    })

    it('passes max_rating from config to RatingStars', () => {
      render(<FieldDisplay field={ratingField} value={4} readOnly />)
      
      const stars = screen.getAllByLabelText(/star/i)
      expect(stars).toHaveLength(5) // max_rating = 5
    })

    it('calls onChange with number value for rating', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()
      
      render(<FieldDisplay field={ratingField} value={2} onChange={onChange} />)
      
      const fourthStar = screen.getByLabelText('4 Stars')
      await user.click(fourthStar)
      
      expect(onChange).toHaveBeenCalledWith(4)
    })
  })

  describe('Select Field Type', () => {
    const selectField: CustomField = {
      id: 'field-2',
      list_id: 'list-1',
      name: 'Quality',
      field_type: 'select',
      config: { options: ['bad', 'good', 'great'] },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('renders SelectBadge for select type', () => {
      render(<FieldDisplay field={selectField} value="good" readOnly />)
      
      expect(screen.getByText('good')).toBeInTheDocument()
    })

    it('passes options from config to SelectBadge', async () => {
      const user = userEvent.setup()
      render(<FieldDisplay field={selectField} value="good" onChange={vi.fn()} />)
      
      const badge = screen.getByText('good')
      await user.click(badge)
      
      // All options should be in dropdown
      expect(screen.getByText('bad')).toBeInTheDocument()
      expect(screen.getByText('great')).toBeInTheDocument()
    })

    it('calls onChange with string value for select', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()
      
      render(<FieldDisplay field={selectField} value="good" onChange={onChange} />)
      
      const badge = screen.getByText('good')
      await user.click(badge)
      await user.click(screen.getByText('great'))
      
      expect(onChange).toHaveBeenCalledWith('great')
    })
  })

  describe('Boolean Field Type', () => {
    const booleanField: CustomField = {
      id: 'field-3',
      list_id: 'list-1',
      name: 'Completed',
      field_type: 'boolean',
      config: {},
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('renders BooleanCheckbox for boolean type', () => {
      render(<FieldDisplay field={booleanField} value={true} readOnly />)
      
      const checkbox = screen.getByRole('checkbox', { name: /completed/i })
      expect(checkbox).toBeChecked()
    })

    it('uses field name as checkbox label', () => {
      render(<FieldDisplay field={booleanField} value={false} readOnly />)
      
      expect(screen.getByRole('checkbox', { name: /completed/i })).toBeInTheDocument()
    })

    it('calls onChange with boolean value', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()
      
      render(<FieldDisplay field={booleanField} value={false} onChange={onChange} />)
      
      const checkbox = screen.getByRole('checkbox', { name: /completed/i })
      await user.click(checkbox)
      
      expect(onChange).toHaveBeenCalledWith(true)
    })
  })

  describe('Text Field Type', () => {
    const textField: CustomField = {
      id: 'field-4',
      list_id: 'list-1',
      name: 'Notes',
      field_type: 'text',
      config: { max_length: 200 },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('renders TextSnippet for text type', () => {
      render(<FieldDisplay field={textField} value="Short note" readOnly />)
      
      expect(screen.getByText('Short note')).toBeInTheDocument()
    })

    it('truncates long text', () => {
      const longText = 'A'.repeat(100)
      render(<FieldDisplay field={textField} value={longText} readOnly />)
      
      const snippet = screen.getByText(/A+\.\.\./)
      expect(snippet.textContent).toHaveLength(53) // 50 chars + "..."
    })

    it('calls onChange with string value for text', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()
      
      render(<FieldDisplay field={textField} value="Initial" onChange={onChange} />)
      
      const input = screen.getByDisplayValue('Initial')
      await user.clear(input)
      await user.type(input, 'Updated')
      
      expect(onChange).toHaveBeenLastCalledWith('Updated')
    })

    it('passes onExpand callback to TextSnippet', () => {
      const onExpand = vi.fn()
      const longText = 'A'.repeat(100)
      
      render(<FieldDisplay field={textField} value={longText} onExpand={onExpand} readOnly />)
      
      expect(screen.getByRole('button', { name: /mehr anzeigen/i })).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles null values for all field types', () => {
      const fields: CustomField[] = [
        { id: '1', list_id: 'l1', name: 'Rating', field_type: 'rating', config: { max_rating: 5 }, created_at: '', updated_at: '' },
        { id: '2', list_id: 'l1', name: 'Quality', field_type: 'select', config: { options: ['a', 'b'] }, created_at: '', updated_at: '' },
        { id: '3', list_id: 'l1', name: 'Done', field_type: 'boolean', config: {}, created_at: '', updated_at: '' },
        { id: '4', list_id: 'l1', name: 'Notes', field_type: 'text', config: {}, created_at: '', updated_at: '' },
      ]

      fields.forEach((field) => {
        const { unmount } = render(<FieldDisplay field={field} value={null} readOnly />)
        // Should not crash
        unmount()
      })
    })

    it('applies custom className to wrapper', () => {
      const field: CustomField = {
        id: '1',
        list_id: 'l1',
        name: 'Test',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '',
        updated_at: '',
      }

      const { container } = render(
        <FieldDisplay field={field} value={3} readOnly className="custom-class" />
      )
      
      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('renders read-only by default when onChange is not provided', () => {
      const field: CustomField = {
        id: '1',
        list_id: 'l1',
        name: 'Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '',
        updated_at: '',
      }

      render(<FieldDisplay field={field} value={3} />)
      
      // Read-only mode uses role="img"
      expect(screen.getByRole('img')).toBeInTheDocument()
    })
  })
})
```

**Implementation (FieldDisplay.tsx):**

```typescript
// frontend/src/components/fields/FieldDisplay.tsx
import type { CustomField, FieldValue } from '@/types/customField'
import { RatingStars } from './RatingStars'
import { SelectBadge } from './SelectBadge'
import { BooleanCheckbox } from './BooleanCheckbox'
import { TextSnippet } from './TextSnippet'
import { cn } from '@/lib/utils'

interface FieldDisplayProps {
  field: CustomField
  value: FieldValue
  onChange?: (value: FieldValue) => void
  onExpand?: () => void // For text fields: open VideoDetailsModal
  readOnly?: boolean
  className?: string
}

/**
 * FieldDisplay Component - Type-specific field value renderer
 * 
 * Renders custom field values with appropriate UI based on field_type:
 * - rating: Interactive star rating (RatingStars)
 * - select: Badge with dropdown (SelectBadge)
 * - boolean: Checkbox with label (BooleanCheckbox)
 * - text: Truncated snippet with expand (TextSnippet)
 * 
 * Features:
 * - Type-safe discriminated union pattern
 * - Controlled component (onChange callback)
 * - Read-only mode support
 * - Inline editing for VideoCard preview
 * - Full editing in VideoDetailsModal
 * 
 * Usage:
 * ```tsx
 * // VideoCard preview (read-only)
 * <FieldDisplay field={field} value={value} readOnly />
 * 
 * // VideoCard preview (inline editable)
 * <FieldDisplay field={field} value={value} onChange={handleChange} />
 * 
 * // VideoDetailsModal (full editing)
 * <FieldDisplay field={field} value={value} onChange={handleChange} onExpand={openModal} />
 * ```
 */
export const FieldDisplay = ({
  field,
  value,
  onChange,
  onExpand,
  readOnly = false,
  className,
}: FieldDisplayProps) => {
  const isEditable = !readOnly && onChange !== undefined

  // Type-safe discriminated union switch
  switch (field.field_type) {
    case 'rating': {
      const config = field.config as { max_rating: number }
      return (
        <RatingStars
          value={value as number | null}
          max={config.max_rating}
          onChange={isEditable ? (v) => onChange(v) : undefined}
          readOnly={readOnly}
          className={className}
        />
      )
    }

    case 'select': {
      const config = field.config as { options: string[] }
      return (
        <SelectBadge
          value={value as string | null}
          options={config.options}
          onChange={isEditable ? (v) => onChange(v) : undefined}
          readOnly={readOnly}
          className={className}
        />
      )
    }

    case 'boolean': {
      return (
        <BooleanCheckbox
          value={value as boolean | null}
          label={field.name}
          onChange={isEditable ? (v) => onChange(v) : undefined}
          readOnly={readOnly}
          className={className}
        />
      )
    }

    case 'text': {
      return (
        <TextSnippet
          value={value as string | null}
          maxLength={50} // Display truncation for VideoCard preview
          onChange={isEditable ? (v) => onChange(v) : undefined}
          onExpand={onExpand}
          readOnly={readOnly}
          className={className}
        />
      )
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = field.field_type
      return null
    }
  }
}
```

**REF MCP Validations:**
- TypeScript discriminated union with exhaustiveness check
- Type assertions only after `switch` narrows type (`as { max_rating: number }`)
- Controlled component pattern (onChange prop)
- Consistent API across all sub-components (value, onChange, readOnly, className)

---

### 8. Create Barrel Export for Fields Module

**Files:** `frontend/src/components/fields/index.ts`

**Action:** Export all field components for clean imports

```typescript
// frontend/src/components/fields/index.ts
export { FieldDisplay } from './FieldDisplay'
export { RatingStars } from './RatingStars'
export { SelectBadge } from './SelectBadge'
export { BooleanCheckbox } from './BooleanCheckbox'
export { TextSnippet } from './TextSnippet'
```

---

### 9. Run All Tests

**Action:** Verify all 20+ tests pass

```bash
cd frontend
npm test -- fields
```

**Expected Output:**
```
✓ RatingStars (8 tests)
✓ SelectBadge (8 tests)
✓ BooleanCheckbox (8 tests)
✓ TextSnippet (10 tests)
✓ FieldDisplay (20+ tests)

Tests: 54 passed
```

---

### 10. Manual Testing Checklist

**Browser Testing (http://localhost:5173):**

1. **Rating Field:**
   - [ ] Stars display correctly (1-10 max_rating)
   - [ ] Hover preview shows filled stars
   - [ ] Click changes value
   - [ ] Keyboard navigation (Arrow keys)
   - [ ] Read-only mode prevents editing

2. **Select Field:**
   - [ ] Badge displays current value
   - [ ] Click opens dropdown menu
   - [ ] Checkmark shows selected option
   - [ ] Keyboard navigation (Arrow keys, Enter)
   - [ ] Read-only mode no dropdown

3. **Boolean Field:**
   - [ ] Checkbox reflects true/false/null
   - [ ] Click toggles value
   - [ ] Label displays field name
   - [ ] Space key toggles checkbox
   - [ ] Read-only mode disables checkbox

4. **Text Field:**
   - [ ] Short text displays fully
   - [ ] Long text truncates with "..."
   - [ ] Expand button appears when truncated
   - [ ] Inline input works in editable mode
   - [ ] maxLength enforced

5. **Accessibility:**
   - [ ] VoiceOver (macOS) announces all elements correctly
   - [ ] Tab navigation reaches all interactive elements
   - [ ] Focus indicators visible
   - [ ] ARIA labels present

---

### 11. Update CLAUDE.md

**Files:** `CLAUDE.md`

**Action:** Document FieldDisplay component in "Important Files to Review" section

```markdown
**For Custom Fields UI Changes:**
- `frontend/src/components/fields/FieldDisplay.tsx` - Type-specific field renderer
- `frontend/src/components/fields/RatingStars.tsx` - Star rating component
- `frontend/src/components/fields/SelectBadge.tsx` - Badge dropdown selector
- `frontend/src/types/customField.ts` - Custom field TypeScript types
```

---

### 12. Git Commit

**Action:** Commit implementation with comprehensive message

```bash
git add frontend/src/components/fields/ frontend/src/types/customField.ts frontend/src/components/ui/badge.tsx CLAUDE.md
git commit -m "feat(custom-fields): implement FieldDisplay component with type-specific renderers

Task #90: Create FieldDisplay component with 4 field type renderers

IMPLEMENTATION:
- FieldDisplay.tsx: Main component with discriminated union switch
- RatingStars.tsx: Interactive star rating (1-10 max_rating, WAI-ARIA)
- SelectBadge.tsx: Badge dropdown (shadcn/ui Badge + DropdownMenu)
- BooleanCheckbox.tsx: Native checkbox with accessible label
- TextSnippet.tsx: Truncated text with expand affordance
- customField.ts: TypeScript types matching backend schemas

FEATURES:
- Type-safe discriminated union pattern (exhaustiveness check)
- Controlled component pattern (onChange callback)
- Read-only and editable modes
- Inline editing support for VideoCard preview
- WCAG 2.1 Level AA compliant (keyboard navigation, ARIA)
- 54 unit tests (100% pass rate)

REF MCP VALIDATIONS:
- WAI-ARIA Star Rating pattern (radio group for editable)
- shadcn/ui Badge component with variants
- Radix UI DropdownMenu keyboard navigation
- Native checkbox for maximum accessibility
- lucide-react icons (Star, Check, ChevronRight)

TESTING:
- RatingStars: 8 tests (stars display, hover, click, keyboard)
- SelectBadge: 8 tests (badge, dropdown, selection, keyboard)
- BooleanCheckbox: 8 tests (checked state, toggle, keyboard)
- TextSnippet: 10 tests (truncation, expand, inline edit)
- FieldDisplay: 20+ tests (all field types, null values, edge cases)

DEPENDENCIES:
- lucide-react (Star, Check, ChevronRight icons)
- shadcn/ui Badge (npx shadcn@latest add badge)
- shadcn/ui DropdownMenu (already installed)

NEXT STEPS:
- Task #91: Implement inline editing in CustomFieldsPreview
- Task #92: Create VideoDetailsModal component
- Task #93: Add CustomFieldsSection to VideoDetailsModal

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (54 total)

**RatingStars.test.tsx (8 tests):**
- Renders correct number of stars (max_rating 1-10)
- Displays filled/empty stars based on value
- Calls onChange on click
- Keyboard navigation (Arrow keys)
- Read-only mode (role="img")
- Handles null value
- Hover preview
- Custom className

**SelectBadge.test.tsx (8 tests):**
- Renders value as badge
- Null value placeholder
- Opens dropdown menu on click
- Calls onChange on selection
- No dropdown in read-only mode
- Checkmark on selected option
- Keyboard navigation
- Custom className

**BooleanCheckbox.test.tsx (8 tests):**
- Renders checked/unchecked states
- Null value as unchecked
- Calls onChange on click
- Toggles true/false
- No onChange in read-only mode
- Keyboard (Space key)
- Accessible label
- Custom className

**TextSnippet.test.tsx (10 tests):**
- Renders short text without truncation
- Truncates long text with ellipsis
- Null value placeholder
- Shows expand button when truncated
- No expand button for short text
- Calls onExpand
- Inline input in editable mode
- Calls onChange on edit
- Enforces maxLength
- Custom className

**FieldDisplay.test.tsx (20+ tests):**
- Rating type: renders RatingStars, passes max_rating, onChange with number
- Select type: renders SelectBadge, passes options, onChange with string
- Boolean type: renders BooleanCheckbox, uses field name as label, onChange with boolean
- Text type: renders TextSnippet, truncates long text, onChange with string, passes onExpand
- Edge cases: null values for all types, custom className, read-only default

### Integration Tests

Will be covered in Task #95 (frontend component tests) and Task #96 (integration test for create tag+schema+field+set value flow).

### Manual Testing

**Accessibility Testing:**
- VoiceOver (macOS): All elements announced correctly
- NVDA (Windows): Screen reader compatibility
- Keyboard-only navigation: Tab order, focus indicators
- Color contrast: WCAG 2.1 Level AA compliance

**Browser Compatibility:**
- Chrome 120+ (primary target)
- Firefox 121+ (secondary)
- Safari 17+ (macOS)

**Responsive Testing:**
- Desktop: 1920x1080, 1366x768
- Tablet: 768x1024 (iPad)
- Mobile: 375x667 (iPhone SE)

---

## 📚 Reference

### Related Docs

**Design Document:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 379-394 (FieldDisplay spec)

**Backend Schemas:**
- `backend/app/schemas/custom_field.py` - CustomField Pydantic schemas (Task #64)
- `backend/app/models/custom_field.py` - CustomField SQLAlchemy model (Task #59)

**Latest Handoff:**
- `docs/handoffs/2025-11-07-log-066-custom-fields-crud-endpoints.md` - Backend CRUD complete

### Related Code

**Similar Patterns:**
- `frontend/src/components/VideoCard.tsx` - Component with sub-components pattern
- `frontend/src/components/TableSettingsDropdown.tsx` - Radix UI DropdownMenu usage
- `frontend/src/components/ViewModeToggle.tsx` - lucide-react icon pattern
- `frontend/src/components/ConfirmDeleteModal.tsx` - Controlled component pattern

**Testing Patterns:**
- `frontend/src/components/VideoCard.test.tsx` - Vitest + RTL component tests
- `frontend/src/stores/tableSettingsStore.test.ts` - Type guard testing

### REF MCP Documentation

**WAI-ARIA Star Rating:**
- https://www.w3.org/WAI/tutorials/forms/custom-controls/#a-star-rating
- Radio group pattern for editable rating
- Read-only mode uses role="img"

**MUI Rating Component:**
- https://mui.com/material-ui/react-rating/#basic-rating
- Reference for accessibility patterns (not using library)
- Keyboard navigation best practices

**shadcn/ui Badge:**
- https://ui.shadcn.com/docs/components/badge
- Variants: default, secondary, outline, destructive
- asChild pattern for custom triggers

**Vitest Component Testing:**
- https://vitest.dev/guide/browser/component-testing.md
- Test user interactions with userEvent
- expect.element() for DOM assertions

### Design Decisions

**1. Discriminated Union Pattern for Type Safety**
- **Decision:** Use TypeScript discriminated union with `field_type` discriminator
- **Rationale:** Enables exhaustive switch cases with type narrowing
- **Alternative:** Polymorphic components - rejected for complexity
- **Evidence:** TypeScript Handbook - Discriminated Unions

**2. Type Assertions After Switch Narrowing**
- **Decision:** Use `as { max_rating: number }` AFTER switch narrows field_type
- **Rationale:** TypeScript can't narrow union types inside objects automatically
- **Alternative:** Separate interfaces per type - rejected (backend uses single type)
- **Trade-off:** Slight type safety loss, but matches backend API contract

**3. Native Checkbox Over shadcn/ui Checkbox**
- **Decision:** Use native `<input type="checkbox">` for BooleanCheckbox
- **Rationale:** Native provides all accessibility features without additional complexity
- **Alternative:** shadcn/ui Checkbox component - overkill for this use case
- **REF MCP:** Native HTML elements preferred when sufficient

**4. Sub-Component Architecture**
- **Decision:** Create 4 separate sub-components (RatingStars, SelectBadge, BooleanCheckbox, TextSnippet)
- **Rationale:** Single Responsibility Principle, easier testing, reusable
- **Alternative:** Inline renderers in FieldDisplay - rejected (400+ line file)
- **Pattern:** Follows VideoCard.tsx sub-component pattern

**5. Controlled Component Pattern**
- **Decision:** onChange callback returns typed value (number | string | boolean)
- **Rationale:** Parent component (VideoCard, VideoDetailsModal) manages state
- **Alternative:** Uncontrolled with ref - rejected (harder to sync with backend)
- **REF MCP:** React Controlled Components best practice

**6. Read-Only Default When onChange Omitted**
- **Decision:** `readOnly = !onChange` (read-only if onChange not provided)
- **Rationale:** Safe default, prevents accidental editing
- **Alternative:** Explicit readOnly prop required - rejected (verbose API)
- **Pattern:** Matches HTML form element behavior

**7. 50-Character Text Truncation**
- **Decision:** TextSnippet maxLength={50} for VideoCard preview
- **Rationale:** Fits 2-line text in card UI, balances preview vs space
- **Alternative:** Dynamic based on container width - rejected (complex)
- **Note:** NOT the field's max_length config (backend validates that)

**8. lucide-react Icons**
- **Decision:** Use Star, Check, ChevronRight from lucide-react
- **Rationale:** Consistent with existing codebase (ViewModeToggle, TagNavigation)
- **Alternative:** Custom SVG icons - rejected (reinventing wheel)
- **Pattern:** `<Star className="h-4 w-4" />` matches project convention

---

## ⏱️ Time Estimate

**Total: 5-6 hours**

- Step 1: TypeScript types (30 min)
- Step 2: Install Badge (5 min)
- Step 3: RatingStars TDD (1 hour)
- Step 4: SelectBadge TDD (45 min)
- Step 5: BooleanCheckbox TDD (30 min)
- Step 6: TextSnippet TDD (1 hour)
- Step 7: FieldDisplay TDD (1 hour)
- Step 8: Barrel export (5 min)
- Step 9: Test run (10 min)
- Step 10: Manual testing (30 min)
- Step 11: CLAUDE.md update (5 min)
- Step 12: Git commit (10 min)

**Risk Mitigation:**
- REF MCP validation BEFORE implementation (+30 min if needed)
- Subagent-Driven Development for sub-components (may reduce time -20%)

---

## 🎯 Success Metrics

- [ ] 54/54 tests passing (100% pass rate)
- [ ] TypeScript strict mode (0 `any` types)
- [ ] WCAG 2.1 Level AA compliance (manual test)
- [ ] 0 console errors in browser
- [ ] All 4 field types render correctly
- [ ] Inline editing works for all types
- [ ] Read-only mode prevents editing
- [ ] Code review approval (if using code-reviewer skill)

---

## 📝 Notes

**Prerequisites:**
- Task #64 complete (CustomField Pydantic schemas define field_type and config structure)
- Task #65 complete (FieldSchema Pydantic schemas for multi-field support)
- Backend CRUD endpoints ready (Task #66 complete)

**Blocking:**
- Task #91 (inline editing in CustomFieldsPreview) depends on this component
- Task #92 (VideoDetailsModal) depends on this component

**Future Enhancements (out of scope for Task #90):**
- Half-star ratings (precision: 0.5) - would require RatingConfig update
- Multi-select field type - new field type, requires backend changes
- Rich text editor for text fields - complexity not needed for MVP
- Custom color for select options - nice-to-have, defer to Phase 2
