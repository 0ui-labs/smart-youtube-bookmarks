# Task 124: Create FieldConfigEditor Sub-Components

**Plan Task:** 124
**Wave/Phase:** Phase 1: MVP - Frontend (Components + UI)
**Dependencies:** Task #123 (NewFieldForm component - will use this editor), Task #64 (CustomField Pydantic schemas for validation rules)

---

## 🎯 Ziel

Create a dynamic FieldConfigEditor component that renders type-specific configuration UI for custom fields. The editor will support 4 field types (Select with dynamic options management, Rating with 1-10 range, Text with optional max_length, Boolean with no config). The component will validate config per backend rules from `backend/app/schemas/custom_field.py` and handle empty states, edge cases, and accessibility requirements (WCAG 2.1 Level AA).

**Result:** Reusable FieldConfigEditor component that will be integrated into NewFieldForm (Task #123) for creating/editing custom fields with type-safe configuration validation.

## 📋 Acceptance Criteria

- [ ] FieldConfigEditor parent component with fieldType prop that conditionally renders sub-components
- [ ] SelectConfigEditor with dynamic options list (add/remove/reorder, min 1 option validation, duplicate detection)
- [ ] RatingConfigEditor with max_rating input (1-10 range validation, numeric input only)
- [ ] TextConfigEditor with optional max_length input (≥1 validation if provided, clear UX for optional state)
- [ ] Boolean type returns empty config object (no editor needed)
- [ ] Real-time validation matching backend rules (backend/app/schemas/custom_field.py)
- [ ] Accessible UI (WCAG 2.1 Level AA: keyboard navigation, ARIA labels, error announcements)
- [ ] Empty state handling (Select: "No options yet", Rating: default 5, Text: optional empty)
- [ ] All tests passing (21 unit tests: 5 parent + 7 select + 4 rating + 3 text + 2 integration)
- [ ] TypeScript strict mode with zero `any` types
- [ ] Code reviewed and approved

---

## 🛠️ Implementation Steps

### 1. Create Type Definitions for Field Configs
**Files:** `frontend/src/types/customFields.ts`
**Action:** Create TypeScript types matching backend Pydantic schemas

```typescript
// frontend/src/types/customFields.ts

/**
 * Field type definitions matching backend/app/schemas/custom_field.py
 */
export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

/**
 * Configuration for 'select' field type
 * Backend validation: options list with min_length=1, all non-empty strings
 */
export interface SelectConfig {
  options: string[]
}

/**
 * Configuration for 'rating' field type
 * Backend validation: max_rating between 1-10 (inclusive)
 */
export interface RatingConfig {
  max_rating: number
}

/**
 * Configuration for 'text' field type
 * Backend validation: optional max_length ≥1 if specified
 */
export interface TextConfig {
  max_length?: number
}

/**
 * Configuration for 'boolean' field type
 * Backend validation: empty config or no config
 */
export interface BooleanConfig {
  // Empty - no configuration needed
}

/**
 * Discriminated union of all possible field configs
 * Enables type-safe conditional rendering based on fieldType
 */
export type FieldConfig = SelectConfig | RatingConfig | TextConfig | BooleanConfig

/**
 * Type guard to check if config is SelectConfig
 */
export function isSelectConfig(config: FieldConfig): config is SelectConfig {
  return 'options' in config
}

/**
 * Type guard to check if config is RatingConfig
 */
export function isRatingConfig(config: FieldConfig): config is RatingConfig {
  return 'max_rating' in config
}

/**
 * Type guard to check if config is TextConfig
 */
export function isTextConfig(config: FieldConfig): config is TextConfig {
  return 'max_length' in config || Object.keys(config).length === 0
}
```

### 2. Create Parent FieldConfigEditor Component
**Files:** `frontend/src/components/fields/FieldConfigEditor.tsx`
**Action:** Create parent component that conditionally renders type-specific editors

```typescript
// frontend/src/components/fields/FieldConfigEditor.tsx

import { FieldType, FieldConfig } from '@/types/customFields'
import { SelectConfigEditor } from './SelectConfigEditor'
import { RatingConfigEditor } from './RatingConfigEditor'
import { TextConfigEditor } from './TextConfigEditor'

export interface FieldConfigEditorProps {
  /**
   * The field type determines which config editor to render
   */
  fieldType: FieldType
  
  /**
   * Current config value (controlled component)
   */
  config: FieldConfig
  
  /**
   * Callback when config changes (validation happens here)
   */
  onChange: (config: FieldConfig) => void
  
  /**
   * External error message (e.g., from form validation)
   */
  error?: string
}

/**
 * FieldConfigEditor - Parent component for type-specific config editors
 * 
 * Conditionally renders the appropriate sub-component based on fieldType:
 * - 'select' → SelectConfigEditor (dynamic options list)
 * - 'rating' → RatingConfigEditor (max_rating input 1-10)
 * - 'text' → TextConfigEditor (optional max_length input)
 * - 'boolean' → null (no config needed)
 * 
 * Validation is performed in each sub-component and bubbled up via onChange.
 * 
 * @example
 * ```tsx
 * <FieldConfigEditor
 *   fieldType="rating"
 *   config={{ max_rating: 5 }}
 *   onChange={(config) => setFormConfig(config)}
 *   error={validationError}
 * />
 * ```
 */
export function FieldConfigEditor({
  fieldType,
  config,
  onChange,
  error,
}: FieldConfigEditorProps) {
  switch (fieldType) {
    case 'select':
      return (
        <SelectConfigEditor
          config={config as SelectConfig}
          onChange={onChange}
          error={error}
        />
      )
    
    case 'rating':
      return (
        <RatingConfigEditor
          config={config as RatingConfig}
          onChange={onChange}
          error={error}
        />
      )
    
    case 'text':
      return (
        <TextConfigEditor
          config={config as TextConfig}
          onChange={onChange}
          error={error}
        />
      )
    
    case 'boolean':
      // Boolean fields have no configuration
      // onChange is called with empty object on mount
      if (Object.keys(config).length > 0) {
        onChange({}) // Ensure empty config for boolean
      }
      return null
    
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = fieldType
      return null
  }
}
```

### 3. Create SelectConfigEditor Component
**Files:** `frontend/src/components/fields/SelectConfigEditor.tsx`
**Action:** Create dynamic options list editor with add/remove/reorder functionality

```typescript
// frontend/src/components/fields/SelectConfigEditor.tsx

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, GripVertical } from 'lucide-react'
import type { SelectConfig } from '@/types/customFields'

export interface SelectConfigEditorProps {
  config: SelectConfig
  onChange: (config: SelectConfig) => void
  error?: string
}

/**
 * SelectConfigEditor - Manages dynamic options list for 'select' field type
 * 
 * Features:
 * - Add new options with inline input
 * - Remove individual options (min 1 required)
 * - Reorder options with drag handles (future: drag-drop)
 * - Real-time duplicate detection (case-insensitive)
 * - Auto-trim whitespace on blur
 * - Empty state with helpful message
 * 
 * Backend validation rules (from backend/app/schemas/custom_field.py):
 * - Minimum 1 option required
 * - All options must be non-empty strings
 * - Whitespace trimmed automatically
 * 
 * @example
 * ```tsx
 * <SelectConfigEditor
 *   config={{ options: ['bad', 'good', 'great'] }}
 *   onChange={(config) => setConfig(config)}
 * />
 * ```
 */
export function SelectConfigEditor({
  config,
  onChange,
  error,
}: SelectConfigEditorProps) {
  const [newOption, setNewOption] = useState('')
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  
  /**
   * Add new option to the list
   * Validates: non-empty, no duplicates (case-insensitive)
   */
  const handleAddOption = () => {
    const trimmed = newOption.trim()
    
    if (!trimmed) {
      setDuplicateError('Option darf nicht leer sein')
      return
    }
    
    // Check for duplicates (case-insensitive)
    const isDuplicate = config.options.some(
      (opt) => opt.toLowerCase() === trimmed.toLowerCase()
    )
    
    if (isDuplicate) {
      setDuplicateError('Diese Option existiert bereits')
      return
    }
    
    // Add option and clear input
    onChange({
      options: [...config.options, trimmed],
    })
    setNewOption('')
    setDuplicateError(null)
  }
  
  /**
   * Remove option by index
   * Validates: min 1 option must remain
   */
  const handleRemoveOption = (index: number) => {
    if (config.options.length <= 1) {
      // Cannot remove last option - this should be prevented by UI
      return
    }
    
    const updatedOptions = config.options.filter((_, i) => i !== index)
    onChange({ options: updatedOptions })
  }
  
  /**
   * Update existing option (for inline editing)
   */
  const handleUpdateOption = (index: number, value: string) => {
    const updatedOptions = [...config.options]
    updatedOptions[index] = value
    onChange({ options: updatedOptions })
  }
  
  /**
   * Handle Enter key in new option input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddOption()
    }
  }
  
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Optionen *
      </label>
      
      {/* Existing Options List */}
      <div className="space-y-2">
        {config.options.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            Noch keine Optionen. Fügen Sie mindestens eine Option hinzu.
          </p>
        )}
        
        {config.options.map((option, index) => (
          <div
            key={index}
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
          >
            {/* Drag Handle (visual only for now, drag-drop in future iteration) */}
            <GripVertical className="h-4 w-4 text-gray-400" aria-hidden="true" />
            
            {/* Option Value (inline editable) */}
            <input
              type="text"
              value={option}
              onChange={(e) => handleUpdateOption(index, e.target.value)}
              onBlur={(e) => {
                // Trim whitespace on blur
                const trimmed = e.target.value.trim()
                if (trimmed !== option) {
                  handleUpdateOption(index, trimmed)
                }
              }}
              className="flex-1 bg-transparent border-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              aria-label={`Option ${index + 1}`}
            />
            
            {/* Remove Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveOption(index)}
              disabled={config.options.length <= 1}
              aria-label={`Option ${index + 1} entfernen`}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        ))}
      </div>
      
      {/* Add New Option Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newOption}
          onChange={(e) => {
            setNewOption(e.target.value)
            setDuplicateError(null) // Clear error on typing
          }}
          onKeyDown={handleKeyDown}
          placeholder="Neue Option hinzufügen..."
          className={`flex-1 px-3 py-2 border ${
            duplicateError ? 'border-red-500' : 'border-gray-300'
          } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          aria-label="Neue Option"
          aria-invalid={!!duplicateError}
          aria-describedby={duplicateError ? 'option-error' : undefined}
        />
        
        <Button
          type="button"
          onClick={handleAddOption}
          variant="outline"
          size="sm"
          aria-label="Option hinzufügen"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Error Messages */}
      {duplicateError && (
        <p id="option-error" className="text-sm text-red-600" role="alert">
          {duplicateError}
        </p>
      )}
      
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      
      {/* Helper Text */}
      {!error && !duplicateError && (
        <p className="text-sm text-gray-500">
          Fügen Sie Optionen hinzu, die Benutzer auswählen können (z.B. "schlecht", "gut", "sehr gut")
        </p>
      )}
    </div>
  )
}
```

### 4. Create RatingConfigEditor Component
**Files:** `frontend/src/components/fields/RatingConfigEditor.tsx`
**Action:** Create max_rating input with 1-10 range validation

```typescript
// frontend/src/components/fields/RatingConfigEditor.tsx

import type { RatingConfig } from '@/types/customFields'

export interface RatingConfigEditorProps {
  config: RatingConfig
  onChange: (config: RatingConfig) => void
  error?: string
}

/**
 * RatingConfigEditor - Manages max_rating config for 'rating' field type
 * 
 * Features:
 * - Numeric input for max_rating (1-10 range)
 * - Real-time validation with visual feedback
 * - Keyboard navigation (arrow keys increment/decrement)
 * - Default value: 5 stars
 * 
 * Backend validation rules (from backend/app/schemas/custom_field.py):
 * - max_rating must be integer
 * - Range: 1 ≤ max_rating ≤ 10
 * 
 * @example
 * ```tsx
 * <RatingConfigEditor
 *   config={{ max_rating: 5 }}
 *   onChange={(config) => setConfig(config)}
 * />
 * ```
 */
export function RatingConfigEditor({
  config,
  onChange,
  error,
}: RatingConfigEditorProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  
  /**
   * Validate and update max_rating
   * Ensures: integer, 1-10 range
   */
  const handleChange = (value: string) => {
    // Allow empty string for typing experience
    if (value === '') {
      setLocalError('Bitte geben Sie eine Zahl zwischen 1 und 10 ein')
      return
    }
    
    const num = parseInt(value, 10)
    
    // Validate: is integer
    if (isNaN(num) || !Number.isInteger(num)) {
      setLocalError('Bitte geben Sie eine ganze Zahl ein')
      return
    }
    
    // Validate: 1-10 range
    if (num < 1 || num > 10) {
      setLocalError('Maximale Bewertung muss zwischen 1 und 10 liegen')
      return
    }
    
    // Valid - clear error and update
    setLocalError(null)
    onChange({ max_rating: num })
  }
  
  return (
    <div className="space-y-3">
      <label
        htmlFor="max-rating-input"
        className="block text-sm font-medium text-gray-700"
      >
        Maximale Bewertung *
      </label>
      
      <div className="flex items-center gap-3">
        <input
          id="max-rating-input"
          type="number"
          min={1}
          max={10}
          step={1}
          value={config.max_rating}
          onChange={(e) => handleChange(e.target.value)}
          className={`w-24 px-3 py-2 border ${
            localError || error ? 'border-red-500' : 'border-gray-300'
          } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          aria-invalid={!!(localError || error)}
          aria-describedby={
            localError || error ? 'rating-error rating-description' : 'rating-description'
          }
        />
        
        <span className="text-sm text-gray-600">
          (1-{config.max_rating} Sterne)
        </span>
      </div>
      
      {/* Error Messages */}
      {localError && (
        <p id="rating-error" className="text-sm text-red-600" role="alert">
          {localError}
        </p>
      )}
      
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      
      {/* Helper Text */}
      {!localError && !error && (
        <p id="rating-description" className="text-sm text-gray-500">
          Geben Sie die maximale Anzahl der Sterne ein (1-10). Standard: 5 Sterne.
        </p>
      )}
    </div>
  )
}
```

### 5. Create TextConfigEditor Component
**Files:** `frontend/src/components/fields/TextConfigEditor.tsx`
**Action:** Create optional max_length input with ≥1 validation

```typescript
// frontend/src/components/fields/TextConfigEditor.tsx

import { useState } from 'react'
import type { TextConfig } from '@/types/customFields'

export interface TextConfigEditorProps {
  config: TextConfig
  onChange: (config: TextConfig) => void
  error?: string
}

/**
 * TextConfigEditor - Manages optional max_length config for 'text' field type
 * 
 * Features:
 * - Optional max_length input (≥1 if specified)
 * - Clear UX for "unlimited" vs "limited" state
 * - Checkbox to toggle max_length constraint
 * - Numeric input only when enabled
 * 
 * Backend validation rules (from backend/app/schemas/custom_field.py):
 * - max_length is optional (undefined = unlimited)
 * - If specified: max_length ≥ 1
 * 
 * @example
 * ```tsx
 * // Unlimited text
 * <TextConfigEditor
 *   config={{}}
 *   onChange={(config) => setConfig(config)}
 * />
 * 
 * // Limited to 500 characters
 * <TextConfigEditor
 *   config={{ max_length: 500 }}
 *   onChange={(config) => setConfig(config)}
 * />
 * ```
 */
export function TextConfigEditor({
  config,
  onChange,
  error,
}: TextConfigEditorProps) {
  const hasMaxLength = config.max_length !== undefined
  const [localError, setLocalError] = useState<string | null>(null)
  
  /**
   * Toggle max_length constraint on/off
   */
  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Enable with default 500 characters
      onChange({ max_length: 500 })
    } else {
      // Disable (remove max_length)
      onChange({})
    }
    setLocalError(null)
  }
  
  /**
   * Update max_length value
   * Validates: ≥1 if specified
   */
  const handleChange = (value: string) => {
    // Allow empty for typing
    if (value === '') {
      setLocalError('Bitte geben Sie eine Zahl ≥ 1 ein')
      return
    }
    
    const num = parseInt(value, 10)
    
    // Validate: is integer
    if (isNaN(num) || !Number.isInteger(num)) {
      setLocalError('Bitte geben Sie eine ganze Zahl ein')
      return
    }
    
    // Validate: ≥1
    if (num < 1) {
      setLocalError('Maximale Länge muss mindestens 1 sein')
      return
    }
    
    // Valid - clear error and update
    setLocalError(null)
    onChange({ max_length: num })
  }
  
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Maximale Länge (optional)
      </label>
      
      {/* Toggle Checkbox */}
      <div className="flex items-center gap-2">
        <input
          id="max-length-toggle"
          type="checkbox"
          checked={hasMaxLength}
          onChange={(e) => handleToggle(e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
        <label htmlFor="max-length-toggle" className="text-sm text-gray-700">
          Zeichenlimit festlegen
        </label>
      </div>
      
      {/* Numeric Input (only shown when enabled) */}
      {hasMaxLength && (
        <div className="flex items-center gap-3 pl-6">
          <input
            id="max-length-input"
            type="number"
            min={1}
            step={1}
            value={config.max_length}
            onChange={(e) => handleChange(e.target.value)}
            className={`w-32 px-3 py-2 border ${
              localError || error ? 'border-red-500' : 'border-gray-300'
            } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            aria-label="Maximale Zeichenanzahl"
            aria-invalid={!!(localError || error)}
            aria-describedby={
              localError || error ? 'text-error text-description' : 'text-description'
            }
          />
          
          <span className="text-sm text-gray-600">Zeichen</span>
        </div>
      )}
      
      {/* Error Messages */}
      {localError && (
        <p id="text-error" className="text-sm text-red-600 pl-6" role="alert">
          {localError}
        </p>
      )}
      
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      
      {/* Helper Text */}
      {!localError && !error && (
        <p id="text-description" className="text-sm text-gray-500">
          {hasMaxLength
            ? `Benutzer können bis zu ${config.max_length} Zeichen eingeben`
            : 'Keine Längenbeschränkung - Benutzer können beliebig viel Text eingeben'}
        </p>
      )}
    </div>
  )
}
```

### 6. Create Barrel Export
**Files:** `frontend/src/components/fields/index.ts`
**Action:** Export all field config editor components

```typescript
// frontend/src/components/fields/index.ts

export { FieldConfigEditor } from './FieldConfigEditor'
export type { FieldConfigEditorProps } from './FieldConfigEditor'

export { SelectConfigEditor } from './SelectConfigEditor'
export type { SelectConfigEditorProps } from './SelectConfigEditor'

export { RatingConfigEditor } from './RatingConfigEditor'
export type { RatingConfigEditorProps } from './RatingConfigEditor'

export { TextConfigEditor } from './TextConfigEditor'
export type { TextConfigEditorProps } from './TextConfigEditor'
```

### 7. Create Unit Tests for FieldConfigEditor Parent
**Files:** `frontend/src/components/fields/FieldConfigEditor.test.tsx`
**Action:** Test parent component's conditional rendering logic

```typescript
// frontend/src/components/fields/FieldConfigEditor.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FieldConfigEditor } from './FieldConfigEditor'

describe('FieldConfigEditor', () => {
  it('renders SelectConfigEditor for select field type', () => {
    const onChange = vi.fn()
    render(
      <FieldConfigEditor
        fieldType="select"
        config={{ options: ['option1'] }}
        onChange={onChange}
      />
    )
    
    // SelectConfigEditor has "Optionen *" label
    expect(screen.getByText('Optionen *')).toBeInTheDocument()
  })
  
  it('renders RatingConfigEditor for rating field type', () => {
    const onChange = vi.fn()
    render(
      <FieldConfigEditor
        fieldType="rating"
        config={{ max_rating: 5 }}
        onChange={onChange}
      />
    )
    
    // RatingConfigEditor has "Maximale Bewertung *" label
    expect(screen.getByText('Maximale Bewertung *')).toBeInTheDocument()
  })
  
  it('renders TextConfigEditor for text field type', () => {
    const onChange = vi.fn()
    render(
      <FieldConfigEditor
        fieldType="text"
        config={{}}
        onChange={onChange}
      />
    )
    
    // TextConfigEditor has "Maximale Länge (optional)" label
    expect(screen.getByText('Maximale Länge (optional)')).toBeInTheDocument()
  })
  
  it('renders nothing for boolean field type', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FieldConfigEditor
        fieldType="boolean"
        config={{}}
        onChange={onChange}
      />
    )
    
    // Boolean fields have no config UI
    expect(container.firstChild).toBeNull()
  })
  
  it('calls onChange with empty config for boolean on mount if config is not empty', () => {
    const onChange = vi.fn()
    render(
      <FieldConfigEditor
        fieldType="boolean"
        config={{ someKey: 'value' } as any} // Invalid config
        onChange={onChange}
      />
    )
    
    // Should normalize to empty object
    expect(onChange).toHaveBeenCalledWith({})
  })
})
```

### 8. Create Unit Tests for SelectConfigEditor
**Files:** `frontend/src/components/fields/SelectConfigEditor.test.tsx`
**Action:** Test dynamic options list management

```typescript
// frontend/src/components/fields/SelectConfigEditor.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectConfigEditor } from './SelectConfigEditor'

describe('SelectConfigEditor', () => {
  it('renders existing options', () => {
    const onChange = vi.fn()
    render(
      <SelectConfigEditor
        config={{ options: ['option1', 'option2'] }}
        onChange={onChange}
      />
    )
    
    expect(screen.getByDisplayValue('option1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('option2')).toBeInTheDocument()
  })
  
  it('adds new option when clicking add button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <SelectConfigEditor
        config={{ options: ['existing'] }}
        onChange={onChange}
      />
    )
    
    const input = screen.getByPlaceholderText('Neue Option hinzufügen...')
    await user.type(input, 'new option')
    await user.click(screen.getByLabelText('Option hinzufügen'))
    
    expect(onChange).toHaveBeenCalledWith({
      options: ['existing', 'new option'],
    })
  })
  
  it('adds new option when pressing Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <SelectConfigEditor
        config={{ options: [] }}
        onChange={onChange}
      />
    )
    
    const input = screen.getByPlaceholderText('Neue Option hinzufügen...')
    await user.type(input, 'first option{Enter}')
    
    expect(onChange).toHaveBeenCalledWith({
      options: ['first option'],
    })
  })
  
  it('prevents adding empty option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <SelectConfigEditor
        config={{ options: ['existing'] }}
        onChange={onChange}
      />
    )
    
    const input = screen.getByPlaceholderText('Neue Option hinzufügen...')
    await user.type(input, '   ') // Only whitespace
    await user.click(screen.getByLabelText('Option hinzufügen'))
    
    // Should show error
    expect(screen.getByText('Option darf nicht leer sein')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
  
  it('prevents adding duplicate option (case-insensitive)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <SelectConfigEditor
        config={{ options: ['Existing Option'] }}
        onChange={onChange}
      />
    )
    
    const input = screen.getByPlaceholderText('Neue Option hinzufügen...')
    await user.type(input, 'existing option') // Different case
    await user.click(screen.getByLabelText('Option hinzufügen'))
    
    // Should show error
    expect(screen.getByText('Diese Option existiert bereits')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
  
  it('removes option when clicking remove button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <SelectConfigEditor
        config={{ options: ['option1', 'option2'] }}
        onChange={onChange}
      />
    )
    
    // Remove second option
    await user.click(screen.getByLabelText('Option 2 entfernen'))
    
    expect(onChange).toHaveBeenCalledWith({
      options: ['option1'],
    })
  })
  
  it('disables remove button when only one option remains', () => {
    const onChange = vi.fn()
    
    render(
      <SelectConfigEditor
        config={{ options: ['last option'] }}
        onChange={onChange}
      />
    )
    
    const removeButton = screen.getByLabelText('Option 1 entfernen')
    expect(removeButton).toBeDisabled()
  })
})
```

### 9. Create Unit Tests for RatingConfigEditor
**Files:** `frontend/src/components/fields/RatingConfigEditor.test.tsx`
**Action:** Test max_rating range validation

```typescript
// frontend/src/components/fields/RatingConfigEditor.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RatingConfigEditor } from './RatingConfigEditor'

describe('RatingConfigEditor', () => {
  it('renders with initial max_rating value', () => {
    const onChange = vi.fn()
    render(
      <RatingConfigEditor
        config={{ max_rating: 5 }}
        onChange={onChange}
      />
    )
    
    const input = screen.getByLabelText('Maximale Bewertung *')
    expect(input).toHaveValue(5)
  })
  
  it('updates max_rating when valid value entered', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <RatingConfigEditor
        config={{ max_rating: 5 }}
        onChange={onChange}
      />
    )
    
    const input = screen.getByLabelText('Maximale Bewertung *')
    await user.clear(input)
    await user.type(input, '8')
    
    expect(onChange).toHaveBeenCalledWith({ max_rating: 8 })
  })
  
  it('shows error when value is below 1', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <RatingConfigEditor
        config={{ max_rating: 5 }}
        onChange={onChange}
      />
    )
    
    const input = screen.getByLabelText('Maximale Bewertung *')
    await user.clear(input)
    await user.type(input, '0')
    
    expect(screen.getByText(/zwischen 1 und 10 liegen/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
  
  it('shows error when value is above 10', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <RatingConfigEditor
        config={{ max_rating: 5 }}
        onChange={onChange}
      />
    )
    
    const input = screen.getByLabelText('Maximale Bewertung *')
    await user.clear(input)
    await user.type(input, '15')
    
    expect(screen.getByText(/zwischen 1 und 10 liegen/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

### 10. Create Unit Tests for TextConfigEditor
**Files:** `frontend/src/components/fields/TextConfigEditor.test.tsx`
**Action:** Test optional max_length toggle and validation

```typescript
// frontend/src/components/fields/TextConfigEditor.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextConfigEditor } from './TextConfigEditor'

describe('TextConfigEditor', () => {
  it('renders with no max_length by default', () => {
    const onChange = vi.fn()
    render(
      <TextConfigEditor
        config={{}}
        onChange={onChange}
      />
    )
    
    const checkbox = screen.getByLabelText('Zeichenlimit festlegen')
    expect(checkbox).not.toBeChecked()
    expect(screen.queryByLabelText('Maximale Zeichenanzahl')).not.toBeInTheDocument()
  })
  
  it('shows input when checkbox is enabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <TextConfigEditor
        config={{}}
        onChange={onChange}
      />
    )
    
    const checkbox = screen.getByLabelText('Zeichenlimit festlegen')
    await user.click(checkbox)
    
    // Should enable with default 500
    expect(onChange).toHaveBeenCalledWith({ max_length: 500 })
    expect(screen.getByLabelText('Maximale Zeichenanzahl')).toBeInTheDocument()
  })
  
  it('removes max_length when checkbox is disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <TextConfigEditor
        config={{ max_length: 500 }}
        onChange={onChange}
      />
    )
    
    const checkbox = screen.getByLabelText('Zeichenlimit festlegen')
    await user.click(checkbox)
    
    // Should remove max_length
    expect(onChange).toHaveBeenCalledWith({})
  })
})
```

### 11. Create Integration Tests
**Files:** `frontend/src/components/fields/FieldConfigEditor.integration.test.tsx`
**Action:** Test full workflow with different field types

```typescript
// frontend/src/components/fields/FieldConfigEditor.integration.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldConfigEditor } from './FieldConfigEditor'

describe('FieldConfigEditor Integration', () => {
  it('switches between field types correctly', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    // Start with select type
    const { rerender } = render(
      <FieldConfigEditor
        fieldType="select"
        config={{ options: ['opt1'] }}
        onChange={onChange}
      />
    )
    
    expect(screen.getByText('Optionen *')).toBeInTheDocument()
    
    // Switch to rating type
    rerender(
      <FieldConfigEditor
        fieldType="rating"
        config={{ max_rating: 5 }}
        onChange={onChange}
      />
    )
    
    expect(screen.queryByText('Optionen *')).not.toBeInTheDocument()
    expect(screen.getByText('Maximale Bewertung *')).toBeInTheDocument()
    
    // Switch to text type
    rerender(
      <FieldConfigEditor
        fieldType="text"
        config={{}}
        onChange={onChange}
      />
    )
    
    expect(screen.getByText('Maximale Länge (optional)')).toBeInTheDocument()
    
    // Switch to boolean type (no UI)
    rerender(
      <FieldConfigEditor
        fieldType="boolean"
        config={{}}
        onChange={onChange}
      />
    )
    
    expect(screen.queryByText('Maximale Länge (optional)')).not.toBeInTheDocument()
  })
  
  it('validates select config with multiple operations', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    
    render(
      <FieldConfigEditor
        fieldType="select"
        config={{ options: [] }}
        onChange={onChange}
      />
    )
    
    // Add first option
    const input = screen.getByPlaceholderText('Neue Option hinzufügen...')
    await user.type(input, 'Option 1{Enter}')
    
    expect(onChange).toHaveBeenLastCalledWith({
      options: ['Option 1'],
    })
    
    // Try to add duplicate (should fail)
    onChange.mockClear()
    await user.type(input, 'option 1{Enter}') // Different case
    
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Diese Option existiert bereits')).toBeInTheDocument()
  })
})
```

### 12. Manual Testing Checklist
**Action:** Test all components in browser with various scenarios

**Select Config:**
- [ ] Add options via Enter key and button
- [ ] Remove options (verify min 1 enforcement)
- [ ] Try duplicate options (case-insensitive)
- [ ] Try empty option (validation)
- [ ] Edit existing options inline
- [ ] Verify whitespace trimming on blur

**Rating Config:**
- [ ] Enter valid values (1-10)
- [ ] Enter invalid values (0, 11, negative)
- [ ] Enter non-numeric values
- [ ] Use keyboard arrow keys to increment/decrement
- [ ] Verify error messages display correctly

**Text Config:**
- [ ] Toggle max_length on/off
- [ ] Enter valid max_length values (≥1)
- [ ] Enter invalid values (0, negative)
- [ ] Verify default 500 on enable
- [ ] Verify helper text changes

**Accessibility:**
- [ ] Tab through all inputs (keyboard navigation)
- [ ] Verify aria-labels on all interactive elements
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Verify error announcements (role="alert")
- [ ] Check color contrast (WCAG AA: 4.5:1 for text)

### 13. TypeScript Verification
**Action:** Verify strict mode compliance

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors (6-7 pre-existing errors from other files OK)

### 14. Update CLAUDE.md
**Files:** `CLAUDE.md`
**Action:** Document new components in Frontend section

```markdown
## Custom Fields System (Phase 1 MVP - Frontend Components)

**FieldConfigEditor Components (Task #124):**
- Location: `frontend/src/components/fields/`
- Parent: `FieldConfigEditor.tsx` - Conditional renderer for type-specific editors
- Sub-components:
  - `SelectConfigEditor.tsx` - Dynamic options list (add/remove/reorder, min 1 option)
  - `RatingConfigEditor.tsx` - max_rating input (1-10 range validation)
  - `TextConfigEditor.tsx` - Optional max_length input (≥1 validation)
- Types: `frontend/src/types/customFields.ts` - FieldType, FieldConfig discriminated unions
- Validation: Matches backend rules from `backend/app/schemas/custom_field.py`
- Accessibility: WCAG 2.1 Level AA compliant (ARIA labels, keyboard navigation, error announcements)
- Testing: 21 unit tests (5 parent + 7 select + 4 rating + 3 text + 2 integration)

**Integration with NewFieldForm (Task #123):**
```tsx
<NewFieldForm>
  {/* Field name input */}
  {/* Field type selector (select/rating/text/boolean) */}
  
  <FieldConfigEditor
    fieldType={selectedFieldType}
    config={fieldConfig}
    onChange={setFieldConfig}
    error={validationError}
  />
  
  {/* Save/Cancel buttons */}
</NewFieldForm>
```
```

### 15. Create Comprehensive Report
**Files:** `docs/reports/2025-11-07-task-124-report.md`
**Action:** Document implementation with REF MCP findings and design decisions

---

## 🧪 Testing Strategy

### Unit Tests (21 tests total)

**FieldConfigEditor Parent (5 tests):**
- Renders SelectConfigEditor for 'select' type
- Renders RatingConfigEditor for 'rating' type
- Renders TextConfigEditor for 'text' type
- Renders nothing for 'boolean' type
- Normalizes config to empty object for boolean type

**SelectConfigEditor (7 tests):**
- Renders existing options list
- Adds new option via button click
- Adds new option via Enter key
- Prevents adding empty option (whitespace validation)
- Prevents duplicate options (case-insensitive)
- Removes option via button
- Disables remove button when only 1 option remains

**RatingConfigEditor (4 tests):**
- Renders with initial max_rating value
- Updates max_rating when valid value entered (1-10)
- Shows error when value < 1
- Shows error when value > 10

**TextConfigEditor (3 tests):**
- Renders with no max_length by default (unchecked)
- Shows input when checkbox enabled (default 500)
- Removes max_length when checkbox disabled

**Integration Tests (2 tests):**
- Switches between field types correctly (type change UI updates)
- Validates select config with multiple operations (add, duplicate detection)

### Manual Testing

**Browser Testing:**
1. Test Select config: add/remove/edit options, duplicate detection
2. Test Rating config: enter valid/invalid values, keyboard arrows
3. Test Text config: toggle on/off, enter valid/invalid max_length
4. Test Boolean config: verify no UI renders

**Accessibility Testing (WCAG 2.1 Level AA):**
1. Keyboard navigation: Tab through all inputs
2. Screen reader: VoiceOver (macOS) / NVDA (Windows)
3. Error announcements: role="alert" on validation errors
4. Color contrast: Verify 4.5:1 ratio for text
5. ARIA labels: All interactive elements properly labeled

### Test Execution

```bash
cd frontend

# Run all tests
npm test

# Run specific test file
npm test -- FieldConfigEditor.test.tsx

# Run with coverage
npm run test:coverage
```

**Expected Coverage:**
- Line Coverage: >95%
- Branch Coverage: >90%
- Function Coverage: 100%

---

## 📚 Reference

### REF MCP Validation Results (5+ Findings)

**Finding #1: shadcn/ui Input Component Pattern**
- **Source:** https://ui.shadcn.com/docs/forms/react-hook-form#input
- **Finding:** Use `aria-invalid` for error states + `data-invalid` on parent Field
- **Applied:** All input fields have `aria-invalid={!!error}` and `aria-describedby` linking to error messages
- **Impact:** Better screen reader support, clear error associations

**Finding #2: Dynamic List Management Best Practice**
- **Source:** React patterns for array state management
- **Finding:** Use controlled component pattern with onChange callback (not local state mutations)
- **Applied:** SelectConfigEditor passes full new array to onChange, never mutates props.config.options
- **Impact:** Predictable state updates, easier debugging, follows React best practices

**Finding #3: Duplicate Detection Algorithm**
- **Source:** Common form validation patterns
- **Finding:** Case-insensitive comparison using `toLowerCase()` with `Array.some()`
- **Applied:** `config.options.some(opt => opt.toLowerCase() === trimmed.toLowerCase())`
- **Impact:** Prevents "Option" and "option" duplicates, matches backend validation

**Finding #4: Optional Field Toggle Pattern**
- **Source:** shadcn/ui form patterns, native checkbox behavior
- **Finding:** Use checkbox to toggle optional config fields with sensible defaults
- **Applied:** TextConfigEditor checkbox enables max_length with default 500, disabling removes it entirely
- **Impact:** Clear UX for "unlimited vs limited" state, matches user mental model

**Finding #5: Numeric Input Range Validation**
- **Source:** HTML5 input type="number" with validation
- **Finding:** Use `min`, `max`, `step` attributes + JavaScript validation for cross-browser consistency
- **Applied:** RatingConfigEditor uses `min={1} max={10} step={1}` + manual parseInt validation
- **Impact:** Prevents invalid values, works consistently across browsers

**Finding #6: ARIA Error Announcement Pattern**
- **Source:** WCAG 2.1 accessibility guidelines
- **Finding:** Use `role="alert"` on error messages + `aria-describedby` linking input to error
- **Applied:** All error messages have `role="alert"`, inputs have `aria-describedby` when errors present
- **Impact:** Screen readers announce errors immediately, meets WCAG 2.1 Level AA

**Finding #7: Keyboard Navigation Best Practices**
- **Source:** Web accessibility keyboard patterns
- **Finding:** Support Enter key in text inputs for form submission, arrow keys for numeric inputs
- **Applied:** SelectConfigEditor handles Enter key to add option, RatingConfigEditor supports arrow keys
- **Impact:** Faster data entry, better keyboard-only user experience

### Related Code Patterns

**Similar Component:** `CreateTagDialog.tsx`
- Pattern: Form with validation, error states, loading states
- Reused: AlertDialog pattern, German localization, error handling structure
- Difference: FieldConfigEditor is more complex (4 sub-components vs 1 form)

**Backend Validation Source:** `backend/app/schemas/custom_field.py`
- Validation rules implemented in frontend to match backend:
  - Select: `min_length=1` on options list, whitespace stripping
  - Rating: `ge=1, le=10` on max_rating
  - Text: `ge=1` on max_length if specified
  - Boolean: Empty config `{}`

### Design Decisions

**Decision 1: Discriminated Union for FieldConfig**
- **Rationale:** TypeScript discriminated unions enable type-safe conditional rendering
- **Alternative:** Single object with all possible keys (less type-safe)
- **Trade-off:** More complex types, but compile-time safety prevents runtime errors
- **Evidence:** TypeScript handbook: discriminated unions are recommended for type-based branching

**Decision 2: Parent Component with Switch Statement**
- **Rationale:** Centralized type dispatch logic, easy to extend with new types
- **Alternative:** Prop drilling with all sub-components rendered conditionally
- **Trade-off:** Single source of truth, but requires parent re-render on type change
- **Evidence:** React patterns recommend conditional rendering at parent level

**Decision 3: Controlled Components (onChange Callback)**
- **Rationale:** Follows React controlled component pattern for predictable state
- **Alternative:** Uncontrolled with refs (harder to validate, sync with parent)
- **Trade-off:** More boilerplate, but easier testing and validation integration
- **Evidence:** React docs: controlled components are preferred for forms

**Decision 4: Inline Validation with Local Error State**
- **Rationale:** Immediate user feedback, doesn't wait for parent form validation
- **Alternative:** All validation in parent (slower feedback loop)
- **Trade-off:** Duplicate validation logic (frontend + backend), but better UX
- **Evidence:** UX research: immediate validation reduces form errors

**Decision 5: Whitespace Trimming on Blur**
- **Rationale:** Matches backend validation behavior, prevents accidental whitespace
- **Alternative:** Trim on submit only (inconsistent with backend)
- **Trade-off:** User sees value change on blur (might be surprising), but prevents errors
- **Evidence:** Backend schemas strip whitespace, frontend should match

**Decision 6: Min 1 Option Enforcement in UI**
- **Rationale:** Disable remove button when only 1 option remains (prevents invalid state)
- **Alternative:** Allow removal and show error on submit (worse UX)
- **Trade-off:** Slightly more complex logic, but prevents user frustration
- **Evidence:** Backend validation requires min 1 option, UI prevents invalid submission

**Decision 7: Default Values on Enable**
- **Rationale:** Rating defaults to 5 stars, Text defaults to 500 chars (common use cases)
- **Alternative:** Force user to enter value (more friction)
- **Trade-off:** Assumes common use case, but user can change immediately
- **Evidence:** UX principle: provide sensible defaults to reduce cognitive load

### Component Architecture

```
FieldConfigEditor (parent)
├── SelectConfigEditor
│   ├── Options list (with drag handles)
│   ├── Add option input + button
│   └── Validation (min 1, no duplicates, no empty)
├── RatingConfigEditor
│   ├── Numeric input (1-10)
│   └── Validation (integer, range)
├── TextConfigEditor
│   ├── Checkbox toggle (optional)
│   ├── Numeric input (≥1)
│   └── Validation (integer, min 1)
└── Boolean (no UI)
```

### Estimated Effort

**Based on similar completed tasks:**
- Task #64 (CustomField Pydantic Schemas): 21 min implementation + 42 min report = 63 min
- Task #65 (FieldSchema Pydantic Schemas): 27 min implementation + 47 min report = 74 min
- Task #32 (VideoCard component): 5.5 hours (complex with 11 tests)

**Estimate for Task #124:**
- Component implementation: 2-3 hours (4 components + types)
- Unit tests: 1-1.5 hours (21 tests)
- Manual testing: 30 min (accessibility + browser testing)
- Documentation: 30 min (CLAUDE.md + report)
- **Total: 4.5-5.5 hours**

**Confidence:** Medium-High
- Similar complexity to Task #32 (multiple sub-components)
- Clear backend validation rules to follow
- REF MCP validation reduces unknowns
- TDD approach with comprehensive tests

---

## Related Documents

- Design Doc: `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 321-394 (Frontend Component Architecture)
- Backend Schemas: `backend/app/schemas/custom_field.py` - Validation rules reference
- Task #123 Plan: `docs/plans/tasks/task-123-new-field-form-component.md` - Parent component that will use FieldConfigEditor
- Task #64 Report: `docs/reports/2025-11-07-task-064-report.md` - Similar Pydantic schema validation patterns
- shadcn/ui Docs: https://ui.shadcn.com/docs/components/form - Form component patterns
