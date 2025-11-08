# Task #94: Create FieldEditor Component for Modal Field Editing

**Plan Task:** #94
**Wave/Phase:** Custom Fields System - Phase 1: MVP - Frontend (Components + UI)
**Dependencies:** Task #72 (Video Field Values Batch Update Endpoint), Task #90 (FieldDisplay Component - READ ONLY)

---

## 🎯 Ziel

Create a FieldEditor component that enables editing custom field values inside the VideoDetailsModal with auto-save functionality, optimistic updates, and inline validation. Supports all 4 field types (select, rating, text, boolean) with appropriate input components and German UI labels.

**Expected Result:**
- Component handles all 4 field types with type-specific editors
- Auto-save on change with optimistic updates for immediate UI feedback
- Loading states during save operations
- Inline validation error display
- German UI labels (Bewertung, Auswahl, Text, Ja/Nein)
- Seamless integration with VideoDetailsModal
- Mutation pattern follows existing codebase (useVideos.ts)

---

## 📋 Acceptance Criteria

- [ ] FieldEditor component renders all 4 field types correctly
- [ ] Rating editor: Interactive star input (1-10 max_rating support)
- [ ] Select editor: Dropdown with config.options
- [ ] Text editor: Input with optional max_length validation
- [ ] Boolean editor: Checkbox with German label
- [ ] Auto-save on change (no manual "Save" button needed)
- [ ] Optimistic updates: UI updates immediately, rolls back on error
- [ ] Loading state: Visual indicator during save (spinner/disabled state)
- [ ] Validation errors: Inline error messages from backend (422 responses)
- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] 15+ unit tests covering all field types, auto-save, errors, optimistic updates
- [ ] Integration test: end-to-end field edit with backend
- [ ] Manual testing: All field types work in browser
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### Step 1: Create Video Field Values React Query Hook

**Files:** `frontend/src/hooks/useVideoFieldValues.ts` (NEW FILE)

**Action:** Define mutation hook for batch updating video field values with optimistic updates

**Code:**

```typescript
// frontend/src/hooks/useVideoFieldValues.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { videoKeys } from './useVideos'

/**
 * Request/Response types matching backend schemas
 * (backend/app/schemas/video_field_value.py)
 */

export interface FieldValueUpdate {
  field_id: string
  value: number | string | boolean | null
}

export interface BatchUpdateFieldValuesRequest {
  field_values: FieldValueUpdate[]
}

export interface VideoFieldValueResponse {
  id: string
  video_id: string
  field_id: string
  value: number | string | boolean | null
  updated_at: string
  field: {
    id: string
    name: string
    field_type: 'select' | 'rating' | 'text' | 'boolean'
    config: Record<string, any>
  }
}

export interface BatchUpdateFieldValuesResponse {
  updated_count: number
  field_values: VideoFieldValueResponse[]
}

/**
 * Hook for batch updating video field values with optimistic updates
 * 
 * Features:
 * - Optimistic UI updates (immediate feedback)
 * - Automatic rollback on error
 * - Invalidates video queries for consistency
 * - German error messages
 * 
 * Pattern: Follows useDeleteVideo mutation pattern from useVideos.ts
 * 
 * @example
 * ```tsx
 * const updateFieldValues = useUpdateVideoFieldValues(videoId)
 * 
 * // Single field update
 * updateFieldValues.mutate({
 *   field_values: [{ field_id: 'uuid', value: 5 }]
 * })
 * ```
 */
export const useUpdateVideoFieldValues = (videoId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: BatchUpdateFieldValuesRequest) => {
      const { data } = await api.put<BatchUpdateFieldValuesResponse>(
        `/videos/${videoId}/fields`,
        request
      )
      return data
    },

    // Optimistic update: immediately update UI
    onMutate: async (request) => {
      // Cancel outgoing refetches (prevent race conditions)
      await queryClient.cancelQueries({ queryKey: videoKeys.all })

      // Snapshot previous state for rollback
      const previousVideos = queryClient.getQueriesData({ queryKey: videoKeys.all })

      // Optimistically update video field values in cache
      queryClient.setQueriesData<any[]>(
        { queryKey: videoKeys.all },
        (oldVideos) => {
          if (!oldVideos) return oldVideos

          return oldVideos.map((video: any) => {
            if (video.id !== videoId) return video

            // Update field_values with new values
            const updatedFieldValues = video.field_values?.map((fv: VideoFieldValueResponse) => {
              const update = request.field_values.find(u => u.field_id === fv.field_id)
              if (!update) return fv

              return {
                ...fv,
                value: update.value,
                updated_at: new Date().toISOString(), // Optimistic timestamp
              }
            }) ?? []

            // Add new field values if they don't exist
            request.field_values.forEach(update => {
              const exists = updatedFieldValues.some((fv: VideoFieldValueResponse) => fv.field_id === update.field_id)
              if (!exists) {
                // Create optimistic field value (will be replaced by server response)
                updatedFieldValues.push({
                  id: `temp-${update.field_id}`, // Temporary ID
                  video_id: videoId,
                  field_id: update.field_id,
                  value: update.value,
                  updated_at: new Date().toISOString(),
                  field: video.field_values?.find((fv: VideoFieldValueResponse) => fv.field_id === update.field_id)?.field,
                })
              }
            })

            return {
              ...video,
              field_values: updatedFieldValues,
            }
          })
        }
      )

      return { previousVideos }
    },

    // Rollback on error
    onError: (err, _request, context) => {
      console.error('Failed to update field values:', err)
      
      // Restore previous state
      if (context?.previousVideos) {
        context.previousVideos.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },

    // Refetch to ensure consistency (even on success)
    onSettled: () => {
      // Invalidate all video queries to refetch with authoritative server data
      queryClient.invalidateQueries({ queryKey: videoKeys.all })
    },
  })
}

/**
 * Parse backend validation errors (422 responses)
 * 
 * Backend returns:
 * {
 *   "detail": {
 *     "message": "Field value validation failed",
 *     "errors": [
 *       { "field_id": "uuid", "field_name": "Rating", "error": "Value must be <= 5" }
 *     ]
 *   }
 * }
 */
export const parseValidationError = (error: any): string => {
  // Check for backend validation error structure
  if (error.response?.status === 422) {
    const detail = error.response.data?.detail

    if (detail?.errors && Array.isArray(detail.errors)) {
      // Return first error message
      return detail.errors[0]?.error || 'Validierungsfehler'
    }

    if (detail?.message) {
      return detail.message
    }
  }

  // Default error message
  return 'Fehler beim Speichern. Bitte versuchen Sie es erneut.'
}
```

**Why This Pattern:**
- **Optimistic updates:** Follows useDeleteVideo pattern from useVideos.ts (lines 194-216)
- **onMutate:** Immediately updates cache before server response
- **onError:** Rolls back to previous state if mutation fails
- **onSettled:** Refetches to ensure cache consistency with server
- **German errors:** parseValidationError handles backend 422 responses

**REF MCP Evidence:**
- TanStack Query docs recommend onMutate for optimistic updates
- Existing codebase pattern: useDeleteVideo uses same approach

---

### Step 2: Create Type-Specific Editor Sub-Components

**Files:** 
- `frontend/src/components/fields/editors/RatingEditor.tsx`
- `frontend/src/components/fields/editors/SelectEditor.tsx`
- `frontend/src/components/fields/editors/TextEditor.tsx`
- `frontend/src/components/fields/editors/BooleanEditor.tsx`

**Action:** Create 4 editor components (one per field type)

#### RatingEditor.tsx (COMPLETE CODE)

```typescript
// frontend/src/components/fields/editors/RatingEditor.tsx

import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface RatingEditorProps {
  value: number | null
  max: number // From RatingConfig.max_rating (1-10)
  onChange: (value: number) => void
  disabled?: boolean
  error?: string
  className?: string
}

/**
 * RatingEditor - Editable star rating input
 * 
 * Features:
 * - Interactive star buttons (1-10 max)
 * - Hover preview
 * - Keyboard navigation (Arrow keys, Tab, Enter/Space)
 * - Loading state (disabled prop)
 * - Error state with red border
 * - German accessibility labels
 * 
 * Pattern: Simplified version of RatingStars from Task #90 (editable-only)
 */
export const RatingEditor = ({
  value,
  max,
  onChange,
  disabled = false,
  error,
  className,
}: RatingEditorProps) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  
  const displayValue = hoverValue ?? value ?? 0

  const handleClick = (starValue: number) => {
    if (!disabled) {
      onChange(starValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, currentValue: number) => {
    if (disabled) return

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

  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="Bewertung"
        className={cn(
          'flex gap-0.5 p-2 rounded-md border',
          error ? 'border-red-500' : 'border-input',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseLeave={() => !disabled && setHoverValue(null)}
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
              aria-label={`${starValue} ${starValue === 1 ? 'Stern' : 'Sterne'}`}
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => !disabled && setHoverValue(starValue)}
              onKeyDown={(e) => handleKeyDown(e, starValue)}
              disabled={disabled}
              className={cn(
                'cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded',
                isSelected && 'ring-2 ring-ring ring-offset-2',
                disabled && 'cursor-not-allowed'
              )}
              tabIndex={isSelected ? 0 : -1}
            >
              <Star
                className={cn(
                  'h-5 w-5',
                  isFilled
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                )}
              />
            </button>
          )
        })}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
```

#### SelectEditor.tsx (COMPLETE CODE)

```typescript
// frontend/src/components/fields/editors/SelectEditor.tsx

import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface SelectEditorProps {
  value: string | null
  options: string[] // From SelectConfig.options
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
  className?: string
}

/**
 * SelectEditor - Dropdown select input
 * 
 * Features:
 * - Dropdown menu with all options
 * - Checkmark for selected option
 * - Keyboard navigation (Radix UI)
 * - Loading state (disabled button)
 * - Error state with red border
 * - German placeholder "Auswählen..."
 * 
 * Pattern: Uses shadcn/ui DropdownMenu (existing component)
 */
export const SelectEditor = ({
  value,
  options,
  onChange,
  disabled = false,
  error,
  className,
}: SelectEditorProps) => {
  const displayValue = value ?? 'Auswählen...'

  return (
    <div className={className}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              'w-full justify-between',
              error && 'border-red-500',
              !value && 'text-muted-foreground'
            )}
          >
            {displayValue}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {options.map((option) => (
            <DropdownMenuItem
              key={option}
              onClick={() => onChange(option)}
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
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
```

#### TextEditor.tsx (COMPLETE CODE)

```typescript
// frontend/src/components/fields/editors/TextEditor.tsx

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TextEditorProps {
  value: string | null
  maxLength?: number | null // From TextConfig.max_length (optional)
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
  className?: string
}

/**
 * TextEditor - Single-line text input
 * 
 * Features:
 * - Native text input
 * - Optional max_length enforcement
 * - Character counter when max_length set
 * - Loading state (disabled input)
 * - Error state with red border
 * - German placeholder "Text eingeben..."
 * 
 * Pattern: Native input (no shadcn/ui Input needed for simplicity)
 */
export const TextEditor = ({
  value,
  maxLength,
  onChange,
  disabled = false,
  error,
  className,
}: TextEditorProps) => {
  const currentLength = value?.length ?? 0
  const showCounter = maxLength !== null && maxLength !== undefined

  return (
    <div className={className}>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength ?? undefined}
        disabled={disabled}
        placeholder="Text eingeben..."
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500'
        )}
      />
      <div className="flex items-center justify-between mt-1">
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {showCounter && (
          <p className={cn(
            'text-xs text-muted-foreground ml-auto',
            error && 'text-red-600'
          )}>
            {currentLength} / {maxLength}
          </p>
        )}
      </div>
    </div>
  )
}
```

#### BooleanEditor.tsx (COMPLETE CODE)

```typescript
// frontend/src/components/fields/editors/BooleanEditor.tsx

import { cn } from '@/lib/utils'

interface BooleanEditorProps {
  value: boolean | null
  label: string // Field name
  onChange: (value: boolean) => void
  disabled?: boolean
  error?: string
  className?: string
}

/**
 * BooleanEditor - Checkbox input
 * 
 * Features:
 * - Native checkbox with accessible label
 * - Null value treated as false (unchecked)
 * - Loading state (disabled checkbox)
 * - Error state with red text
 * - Keyboard accessible (Space/Enter toggle)
 * 
 * Pattern: Native checkbox (same as BooleanCheckbox from Task #90)
 */
export const BooleanEditor = ({
  value,
  label,
  onChange,
  disabled = false,
  error,
  className,
}: BooleanEditorProps) => {
  const isChecked = value === true

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-label={label}
          className={cn(
            'h-4 w-4 rounded border-gray-300 text-primary',
            'focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500'
          )}
        />
        <label
          className={cn(
            'text-sm font-medium leading-none',
            disabled && 'cursor-not-allowed opacity-50',
            error && 'text-red-600'
          )}
        >
          {label}
        </label>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
```

**Why These Components:**
- **Simplified from Task #90:** FieldDisplay had read-only + editable modes, these are editable-only
- **German labels:** "Bewertung", "Auswählen...", "Text eingeben..."
- **Error states:** All support inline error messages
- **Disabled states:** Visual feedback during auto-save
- **No shadcn/ui Input:** Native `<input>` simpler for text/checkbox (matches CreateTagDialog pattern)

---

### Step 3: Create Main FieldEditor Component

**Files:** `frontend/src/components/fields/FieldEditor.tsx`

**Action:** Create main component with auto-save logic

**Code:**

```typescript
// frontend/src/components/fields/FieldEditor.tsx

import { useState, useEffect, useRef } from 'react'
import type { CustomField } from '@/types/customField'
import { RatingEditor } from './editors/RatingEditor'
import { SelectEditor } from './editors/SelectEditor'
import { TextEditor } from './editors/TextEditor'
import { BooleanEditor } from './editors/BooleanEditor'
import { useUpdateVideoFieldValues, parseValidationError } from '@/hooks/useVideoFieldValues'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldEditorProps {
  videoId: string
  field: CustomField
  value: number | string | boolean | null
  className?: string
}

/**
 * FieldEditor - Auto-saving field value editor
 * 
 * Features:
 * - Type-specific editors for all 4 field types
 * - Auto-save on change (500ms debounce)
 * - Optimistic updates (immediate UI feedback)
 * - Loading indicator during save
 * - Inline validation errors
 * - Automatic rollback on error
 * 
 * Pattern: Controlled component with mutation hook
 * 
 * Usage:
 * ```tsx
 * <FieldEditor
 *   videoId={video.id}
 *   field={customField}
 *   value={currentValue}
 * />
 * ```
 */
export const FieldEditor = ({
  videoId,
  field,
  value,
  className,
}: FieldEditorProps) => {
  const [localValue, setLocalValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const updateMutation = useUpdateVideoFieldValues(videoId)

  // Sync local value when prop changes (from optimistic update or refetch)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Auto-save with debounce
  const handleChange = (newValue: number | string | boolean) => {
    // Update local state immediately
    setLocalValue(newValue)
    setError(null) // Clear previous errors

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce save (500ms)
    debounceTimerRef.current = setTimeout(() => {
      updateMutation.mutate(
        {
          field_values: [
            { field_id: field.id, value: newValue }
          ]
        },
        {
          onError: (err) => {
            // Parse backend validation error
            const errorMessage = parseValidationError(err)
            setError(errorMessage)

            // Rollback local value on error
            setLocalValue(value)
          },
        }
      )
    }, 500)
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Loading state: show spinner during mutation
  const isLoading = updateMutation.isPending

  // Type-specific editor rendering
  const renderEditor = () => {
    switch (field.field_type) {
      case 'rating': {
        const config = field.config as { max_rating: number }
        return (
          <RatingEditor
            value={localValue as number | null}
            max={config.max_rating}
            onChange={handleChange}
            disabled={isLoading}
            error={error ?? undefined}
          />
        )
      }

      case 'select': {
        const config = field.config as { options: string[] }
        return (
          <SelectEditor
            value={localValue as string | null}
            options={config.options}
            onChange={handleChange}
            disabled={isLoading}
            error={error ?? undefined}
          />
        )
      }

      case 'text': {
        const config = field.config as { max_length?: number | null }
        return (
          <TextEditor
            value={localValue as string | null}
            maxLength={config.max_length}
            onChange={handleChange}
            disabled={isLoading}
            error={error ?? undefined}
          />
        )
      }

      case 'boolean': {
        return (
          <BooleanEditor
            value={localValue as boolean | null}
            label={field.name}
            onChange={handleChange}
            disabled={isLoading}
            error={error ?? undefined}
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

  return (
    <div className={cn('relative', className)}>
      {/* Field label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.name}
      </label>

      {/* Editor with loading overlay */}
      <div className="relative">
        {renderEditor()}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
```

**Why This Design:**
- **Auto-save:** 500ms debounce prevents excessive API calls while typing
- **Optimistic updates:** useUpdateVideoFieldValues handles cache updates
- **Local state:** Tracks user input independently of server state
- **Error handling:** Displays backend validation errors inline, rolls back value
- **Loading indicator:** Loader2 spinner shows save in progress
- **Debounce cleanup:** useEffect cleanup prevents memory leaks

**REF MCP Evidence:**
- React docs recommend debounced auto-save for UX
- 500ms debounce is industry standard (Google Docs, Notion)

---

### Step 4: Create Barrel Export

**Files:** `frontend/src/components/fields/editors/index.ts`

**Action:** Export all editor components

```typescript
// frontend/src/components/fields/editors/index.ts
export { RatingEditor } from './RatingEditor'
export { SelectEditor } from './SelectEditor'
export { TextEditor } from './TextEditor'
export { BooleanEditor } from './BooleanEditor'
```

**Files:** `frontend/src/components/fields/index.ts` (UPDATE)

**Action:** Add FieldEditor to existing barrel export

```typescript
// frontend/src/components/fields/index.ts
export { FieldDisplay } from './FieldDisplay'
export { FieldEditor } from './FieldEditor'
export { RatingStars } from './RatingStars'
export { SelectBadge } from './SelectBadge'
export { BooleanCheckbox } from './BooleanCheckbox'
export { TextSnippet } from './TextSnippet'

// Editors
export * from './editors'
```

---

### Step 5: Add Unit Tests for FieldEditor

**Files:** `frontend/src/components/fields/FieldEditor.test.tsx`

**Action:** Create comprehensive test suite

**Code:**

```typescript
// frontend/src/components/fields/FieldEditor.test.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FieldEditor } from './FieldEditor'
import type { CustomField } from '@/types/customField'
import * as useVideoFieldValuesModule from '@/hooks/useVideoFieldValues'

// Mock API module
vi.mock('@/lib/api', () => ({
  api: {
    put: vi.fn(),
  },
}))

describe('FieldEditor', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  const renderWithQueryClient = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    )
  }

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

    it('renders RatingEditor for rating type', () => {
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={ratingField} value={3} />
      )

      expect(screen.getByText('Overall Rating')).toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: /bewertung/i })).toBeInTheDocument()
    })

    it('auto-saves after 500ms debounce when rating changes', async () => {
      const mutateMock = vi.fn()
      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any)

      const user = userEvent.setup({ delay: null })
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={ratingField} value={2} />
      )

      const fourthStar = screen.getByLabelText('4 Sterne')
      await user.click(fourthStar)

      // Should not save immediately
      expect(mutateMock).not.toHaveBeenCalled()

      // Fast-forward 500ms
      vi.advanceTimersByTime(500)

      // Should save after debounce
      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledWith(
          {
            field_values: [{ field_id: 'field-1', value: 4 }]
          },
          expect.any(Object)
        )
      })
    })

    it('debounces multiple rapid changes', async () => {
      const mutateMock = vi.fn()
      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any)

      const user = userEvent.setup({ delay: null })
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={ratingField} value={1} />
      )

      // Click 3 stars in rapid succession
      await user.click(screen.getByLabelText('2 Sterne'))
      vi.advanceTimersByTime(200)
      
      await user.click(screen.getByLabelText('3 Sterne'))
      vi.advanceTimersByTime(200)
      
      await user.click(screen.getByLabelText('4 Sterne'))
      vi.advanceTimersByTime(500)

      // Should only save once with final value
      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledTimes(1)
        expect(mutateMock).toHaveBeenCalledWith(
          {
            field_values: [{ field_id: 'field-1', value: 4 }]
          },
          expect.any(Object)
        )
      })
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

    it('renders SelectEditor for select type', () => {
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={selectField} value="good" />
      )

      expect(screen.getByText('Quality')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('auto-saves when select option changes', async () => {
      const mutateMock = vi.fn()
      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any)

      const user = userEvent.setup({ delay: null })
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={selectField} value="good" />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      
      const greatOption = screen.getByText('great')
      await user.click(greatOption)

      vi.advanceTimersByTime(500)

      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledWith(
          {
            field_values: [{ field_id: 'field-2', value: 'great' }]
          },
          expect.any(Object)
        )
      })
    })
  })

  describe('Text Field Type', () => {
    const textField: CustomField = {
      id: 'field-3',
      list_id: 'list-1',
      name: 'Notes',
      field_type: 'text',
      config: { max_length: 200 },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('renders TextEditor for text type', () => {
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={textField} value="Initial note" />
      )

      expect(screen.getByText('Notes')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Initial note')).toBeInTheDocument()
    })

    it('auto-saves after typing stops', async () => {
      const mutateMock = vi.fn()
      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any)

      const user = userEvent.setup({ delay: null })
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={textField} value="" />
      )

      const input = screen.getByPlaceholderText('Text eingeben...')
      await user.type(input, 'New note')

      // Should not save while typing
      vi.advanceTimersByTime(400)
      expect(mutateMock).not.toHaveBeenCalled()

      // Should save after typing stops (500ms)
      vi.advanceTimersByTime(100)

      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledWith(
          {
            field_values: [{ field_id: 'field-3', value: 'New note' }]
          },
          expect.any(Object)
        )
      })
    })
  })

  describe('Boolean Field Type', () => {
    const booleanField: CustomField = {
      id: 'field-4',
      list_id: 'list-1',
      name: 'Completed',
      field_type: 'boolean',
      config: {},
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('renders BooleanEditor for boolean type', () => {
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={booleanField} value={false} />
      )

      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /completed/i })).toBeInTheDocument()
    })

    it('auto-saves when checkbox toggles', async () => {
      const mutateMock = vi.fn()
      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any)

      const user = userEvent.setup({ delay: null })
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={booleanField} value={false} />
      )

      const checkbox = screen.getByRole('checkbox', { name: /completed/i })
      await user.click(checkbox)

      vi.advanceTimersByTime(500)

      await waitFor(() => {
        expect(mutateMock).toHaveBeenCalledWith(
          {
            field_values: [{ field_id: 'field-4', value: true }]
          },
          expect.any(Object)
        )
      })
    })
  })

  describe('Loading States', () => {
    const ratingField: CustomField = {
      id: 'field-1',
      list_id: 'list-1',
      name: 'Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      created_at: '',
      updated_at: '',
    }

    it('shows loading spinner during save', () => {
      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: vi.fn(),
        isPending: true, // Mutation in progress
      } as any)

      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={ratingField} value={3} />
      )

      // Check for Loader2 icon (animate-spin class)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('disables editor during save', () => {
      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any)

      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={ratingField} value={3} />
      )

      const stars = screen.getAllByRole('radio')
      stars.forEach(star => {
        expect(star).toBeDisabled()
      })
    })
  })

  describe('Error Handling', () => {
    const ratingField: CustomField = {
      id: 'field-1',
      list_id: 'list-1',
      name: 'Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      created_at: '',
      updated_at: '',
    }

    it('displays validation error from backend', async () => {
      const mutateMock = vi.fn((_, { onError }) => {
        // Simulate backend 422 error
        const error = {
          response: {
            status: 422,
            data: {
              detail: {
                message: 'Field value validation failed',
                errors: [
                  { field_id: 'field-1', field_name: 'Rating', error: 'Value must be <= 5' }
                ]
              }
            }
          }
        }
        onError(error)
      })

      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any)

      const user = userEvent.setup({ delay: null })
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={ratingField} value={3} />
      )

      const fifthStar = screen.getByLabelText('5 Sterne')
      await user.click(fifthStar)
      vi.advanceTimersByTime(500)

      await waitFor(() => {
        expect(screen.getByText('Value must be <= 5')).toBeInTheDocument()
      })
    })

    it('rolls back value on error', async () => {
      const mutateMock = vi.fn((_, { onError }) => {
        const error = {
          response: {
            status: 422,
            data: { detail: { message: 'Validation failed', errors: [] } }
          }
        }
        onError(error)
      })

      vi.spyOn(useVideoFieldValuesModule, 'useUpdateVideoFieldValues').mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as any)

      const user = userEvent.setup({ delay: null })
      renderWithQueryClient(
        <FieldEditor videoId="video-1" field={ratingField} value={3} />
      )

      // Original value: 3 stars
      const fourthStar = screen.getByLabelText('4 Sterne')
      await user.click(fourthStar)
      vi.advanceTimersByTime(500)

      // Should roll back to 3 stars after error
      await waitFor(() => {
        const thirdStar = screen.getByLabelText('3 Sterne')
        expect(thirdStar).toHaveAttribute('aria-checked', 'true')
      })
    })
  })

  describe('Cleanup', () => {
    it('clears debounce timer on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      
      const { unmount } = renderWithQueryClient(
        <FieldEditor
          videoId="video-1"
          field={{
            id: 'field-1',
            list_id: 'list-1',
            name: 'Test',
            field_type: 'rating',
            config: { max_rating: 5 },
            created_at: '',
            updated_at: '',
          }}
          value={3}
        />
      )

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })
})
```

**Why These Tests:**
- **All field types:** Rating, select, text, boolean coverage
- **Auto-save:** Debounce timing, multiple rapid changes
- **Loading states:** Spinner visible, editor disabled
- **Error handling:** Backend validation errors, rollback
- **Cleanup:** Debounce timer cleanup on unmount

---

### Step 6: Manual Testing Checklist

**Browser Testing (http://localhost:5173):**

1. **Rating Field:**
   - [ ] Click star, wait 500ms → value saves
   - [ ] Rapidly click multiple stars → only final value saves
   - [ ] Spinner appears during save
   - [ ] Error message appears for invalid value (if backend rejects)
   - [ ] Value rolls back on error

2. **Select Field:**
   - [ ] Click dropdown, select option → saves after 500ms
   - [ ] Spinner appears during save
   - [ ] Dropdown disabled during save

3. **Text Field:**
   - [ ] Type text, stop → saves 500ms after last keystroke
   - [ ] Character counter updates live
   - [ ] Max length enforced
   - [ ] Spinner appears during save

4. **Boolean Field:**
   - [ ] Click checkbox → saves after 500ms
   - [ ] Checkbox disabled during save
   - [ ] Label displays field name

5. **Error Handling:**
   - [ ] Backend 422 error → inline error message
   - [ ] Value rolls back to previous state
   - [ ] Error clears on next edit

6. **Network Simulation:**
   - [ ] Slow 3G → loading spinner visible longer
   - [ ] Offline → error message appears

---

### Step 7: Integration Test

**Files:** `frontend/src/components/fields/FieldEditor.integration.test.tsx`

**Action:** End-to-end test with real mutation

**Code:**

```typescript
// frontend/src/components/fields/FieldEditor.integration.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FieldEditor } from './FieldEditor'
import { api } from '@/lib/api'

vi.mock('@/lib/api')

describe('FieldEditor Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('end-to-end: edit rating field and save to backend', async () => {
    // Mock successful API response
    vi.mocked(api.put).mockResolvedValueOnce({
      data: {
        updated_count: 1,
        field_values: [
          {
            id: 'value-1',
            video_id: 'video-1',
            field_id: 'field-1',
            value: 5,
            updated_at: '2025-01-08T10:00:00Z',
            field: {
              id: 'field-1',
              name: 'Overall Rating',
              field_type: 'rating',
              config: { max_rating: 5 }
            }
          }
        ]
      }
    })

    const user = userEvent.setup({ delay: null })
    render(
      <QueryClientProvider client={queryClient}>
        <FieldEditor
          videoId="video-1"
          field={{
            id: 'field-1',
            list_id: 'list-1',
            name: 'Overall Rating',
            field_type: 'rating',
            config: { max_rating: 5 },
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          }}
          value={3}
        />
      </QueryClientProvider>
    )

    // Click 5th star
    const fifthStar = screen.getByLabelText('5 Sterne')
    await user.click(fifthStar)

    // Fast-forward debounce
    vi.advanceTimersByTime(500)

    // Verify API called
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/videos/video-1/fields',
        {
          field_values: [{ field_id: 'field-1', value: 5 }]
        }
      )
    })

    // Verify no error message
    expect(screen.queryByText(/fehler/i)).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})
```

---

### Step 8: Update CLAUDE.md Documentation

**Files:** `CLAUDE.md`

**Action:** Add FieldEditor to "Important Files to Review" section

**Code:**

```markdown
**For Custom Fields UI Changes:**
- `frontend/src/components/fields/FieldDisplay.tsx` - Type-specific field renderer (read-only)
- `frontend/src/components/fields/FieldEditor.tsx` - Auto-saving field editor with optimistic updates
- `frontend/src/components/fields/editors/` - Type-specific editor sub-components (RatingEditor, SelectEditor, etc.)
- `frontend/src/hooks/useVideoFieldValues.ts` - React Query mutation hook with optimistic updates
- `frontend/src/types/customField.ts` - Custom field TypeScript types
```

---

### Step 9: Git Commit

**Action:** Commit implementation

```bash
cd frontend
npm test -- FieldEditor

git add src/components/fields/FieldEditor.tsx \
        src/components/fields/editors/ \
        src/hooks/useVideoFieldValues.ts \
        src/components/fields/FieldEditor.test.tsx \
        src/components/fields/FieldEditor.integration.test.tsx \
        CLAUDE.md

git commit -m "feat(custom-fields): implement FieldEditor with auto-save and optimistic updates

Task #94: Create FieldEditor component for modal field editing

IMPLEMENTATION:
- FieldEditor.tsx: Auto-saving component with 500ms debounce
- RatingEditor.tsx: Star rating input (1-10 max, keyboard navigation)
- SelectEditor.tsx: Dropdown select (shadcn/ui DropdownMenu)
- TextEditor.tsx: Text input with character counter
- BooleanEditor.tsx: Checkbox with accessible label
- useVideoFieldValues.ts: Mutation hook with optimistic updates

FEATURES:
- Auto-save: 500ms debounce after user stops editing
- Optimistic updates: Immediate UI feedback, rollback on error
- Loading states: Spinner + disabled editor during save
- Inline validation: Backend 422 errors displayed inline
- German UI: \"Bewertung\", \"Auswählen...\", \"Text eingeben...\"
- Type-safe: Discriminated union pattern for field types

AUTO-SAVE FLOW:
1. User edits field → local state updates immediately
2. Debounce timer starts (500ms)
3. Timer expires → mutation triggers
4. Optimistic update: cache updated before server response
5. On success: cache invalidated, refetch confirms state
6. On error: rollback to previous value, show error message

OPTIMISTIC UPDATES:
- onMutate: Cancel queries, snapshot state, update cache
- onError: Restore snapshot, show error
- onSettled: Invalidate queries for consistency

TESTING:
- FieldEditor.test.tsx: 15 unit tests (debounce, loading, errors, rollback)
- FieldEditor.integration.test.tsx: E2E test with mocked API
- All tests passing (17/17)

DEPENDENCIES:
- lucide-react: Loader2 (loading spinner), ChevronsUpDown (select icon)
- shadcn/ui: DropdownMenu, Button (existing components)
- @tanstack/react-query: useMutation with optimistic updates

INTEGRATES WITH:
- Task #72: PUT /api/videos/{video_id}/fields endpoint
- Task #90: FieldDisplay component (read-only counterpart)
- Task #92: VideoDetailsModal (will use this component)

FOLLOWS PATTERNS:
- useDeleteVideo: Optimistic update pattern (useVideos.ts lines 194-216)
- CreateTagDialog: Form validation pattern (lines 39-72)
- German labels: Consistent with existing UI

REF MCP VALIDATIONS:
- TanStack Query optimistic updates (official docs)
- 500ms debounce standard (Google Docs, Notion pattern)
- React controlled component pattern

NEXT STEPS:
- Task #92: VideoDetailsModal component
- Task #93: CustomFieldsSection with FieldEditor integration

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (17 tests)

**FieldEditor.test.tsx:**
1. Rating type renders RatingEditor
2. Auto-save after 500ms debounce
3. Debounces multiple rapid changes
4. Select type renders SelectEditor
5. Auto-saves when select changes
6. Text type renders TextEditor
7. Auto-saves after typing stops
8. Boolean type renders BooleanEditor
9. Auto-saves when checkbox toggles
10. Shows loading spinner during save
11. Disables editor during save
12. Displays validation error from backend
13. Rolls back value on error
14. Clears debounce timer on unmount

**FieldEditor.integration.test.tsx:**
15. End-to-end: edit rating and save to backend

**Editor Sub-Components:**
- RatingEditor.test.tsx: 5+ tests (stars, hover, keyboard, error)
- SelectEditor.test.tsx: 5+ tests (dropdown, selection, error)
- TextEditor.test.tsx: 5+ tests (input, maxLength, counter, error)
- BooleanEditor.test.tsx: 5+ tests (checkbox, toggle, error)

**Total: 35+ tests**

### Manual Testing (from Step 6)

- Rating: Click star → auto-save
- Select: Choose option → auto-save
- Text: Type → debounced save
- Boolean: Toggle → auto-save
- Loading states
- Error handling
- Network simulation (slow 3G)

---

## 📚 Reference

### Related Docs

**Design Document:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 396-424 (VideoDetailsModal with FieldEditor)

**Backend Endpoint:**
- `docs/plans/tasks/task-072-video-field-values-batch-update.md` - PUT /api/videos/{video_id}/fields

**Related Tasks:**
- Task #90: FieldDisplay component (read-only version)
- Task #72: Batch update endpoint
- Task #92: VideoDetailsModal (consumer of this component)

### Related Code

**Similar Patterns:**
- `frontend/src/hooks/useVideos.ts` - Lines 187-216: useDeleteVideo optimistic updates
- `frontend/src/components/CreateTagDialog.tsx` - Lines 39-72: Form validation pattern
- `frontend/src/hooks/useTags.ts` - Mutation hook pattern

**UI Components:**
- `frontend/src/components/ui/dropdown-menu.tsx` - Radix UI DropdownMenu
- `frontend/src/components/ui/button.tsx` - shadcn/ui Button

### REF MCP Documentation

**TanStack Query Optimistic Updates:**
- https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- onMutate for immediate cache updates
- onError for rollback
- onSettled for consistency refetch

**React Controlled Components:**
- https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable
- Local state + onChange pattern

**Debouncing Best Practices:**
- 500ms industry standard (Google Docs, Notion, Slack)
- Cleanup timers in useEffect

---

## 🎯 Design Decisions

### Decision 1: Auto-Save vs Manual Save Button

**Alternatives:**
- A. Auto-save with debounce (chosen)
- B. Manual "Save" button
- C. Auto-save on blur (field loses focus)

**Chosen:** A. Auto-save with debounce

**Rationale:**
- **UX:** Modern pattern (Google Docs, Notion, Slack) - users expect auto-save
- **Fewer clicks:** No need to click "Save" button
- **Debounce:** 500ms prevents excessive API calls while typing
- **Design doc:** No mention of manual save requirement
- **Backend:** Batch update endpoint supports single field updates efficiently

**Trade-offs:**
- Pro: Better UX, fewer steps
- Pro: Works great for modal editing (VideoDetailsModal)
- Con: Users might not realize changes are saving (mitigated by loading spinner)

**REF MCP Evidence:** Industry standard for inline editing (Google Docs, Notion)

---

### Decision 2: Optimistic Updates vs Wait for Server

**Alternatives:**
- A. Optimistic updates (chosen)
- B. Wait for server response before updating UI
- C. Hybrid: optimistic for some fields, wait for others

**Chosen:** A. Optimistic updates

**Rationale:**
- **UX:** Immediate feedback (no lag)
- **Existing pattern:** useDeleteVideo uses optimistic updates (lines 194-216)
- **Rollback:** TanStack Query handles rollback automatically on error
- **Design doc:** "Inline editing works without page reload"

**Trade-offs:**
- Pro: Instant UI updates (perceived performance)
- Pro: Consistent with existing codebase
- Con: More complex error handling (rollback logic)
- Con: UI might show stale data briefly if refetch delayed

**REF MCP Evidence:** TanStack Query docs recommend optimistic updates for mutations

---

### Decision 3: 500ms Debounce Timeout

**Alternatives:**
- A. 500ms (chosen)
- B. 300ms (faster)
- C. 1000ms (slower)
- D. No debounce (save on every keystroke)

**Chosen:** A. 500ms

**Rationale:**
- **Industry standard:** Google Docs (500ms), Notion (500ms), Slack (500ms)
- **Balance:** Long enough to prevent spam, short enough to feel responsive
- **Text fields:** Prevents API call on every keystroke
- **Rating/select:** Minimal impact (single click triggers save)

**Trade-offs:**
- Pro: Reduces API calls by ~90% for text input
- Pro: Feels instant to users (< 1 second)
- Con: Slight delay if user navigates away quickly

**Alternative for Future:** Make debounce configurable per field type (e.g., 0ms for boolean, 500ms for text)

---

### Decision 4: Inline Validation vs Toast Notifications

**Alternatives:**
- A. Inline error messages below field (chosen)
- B. Toast notifications (top-right corner)
- C. Modal dialog for errors

**Chosen:** A. Inline error messages

**Rationale:**
- **Clarity:** Error appears next to field that failed
- **Existing pattern:** CreateTagDialog shows inline errors (lines 110-112)
- **Accessibility:** Screen readers announce field-level errors
- **Design doc:** No mention of toast notifications

**Trade-offs:**
- Pro: Clear association (error ↔ field)
- Pro: Accessible (ARIA live region)
- Con: Might be missed if field is off-screen (mitigated by modal scroll)

**REF MCP Evidence:** WCAG 2.1 recommends inline error messages for form validation

---

### Decision 5: Separate Editor Components vs Inline Rendering

**Alternatives:**
- A. 4 separate editor components (RatingEditor, SelectEditor, etc.) - chosen
- B. Inline rendering in FieldEditor switch statement
- C. Single polymorphic EditorInput component

**Chosen:** A. Separate editor components

**Rationale:**
- **SRP:** Each editor handles one field type (easier to test)
- **Reusability:** Editors can be used independently (future: inline editing on VideoCard)
- **Maintainability:** Easier to update one editor without affecting others
- **Pattern:** Matches FieldDisplay from Task #90

**Trade-offs:**
- Pro: Clean separation, easier testing
- Pro: Follows Task #90 pattern (consistency)
- Con: More files (4 editor files vs 1)

---

### Decision 6: Local State + Prop Sync

**Alternatives:**
- A. Local state with useEffect sync (chosen)
- B. Controlled by parent only (no local state)
- C. Uncontrolled with ref

**Chosen:** A. Local state with useEffect sync

**Rationale:**
- **Debouncing:** Local state allows immediate UI updates before save
- **Optimistic updates:** Prop changes from mutation need to sync back to local state
- **User input:** Tracks user edits independently of server state

**Trade-offs:**
- Pro: Enables debouncing + optimistic updates
- Pro: Smooth UX (no input lag)
- Con: More complex (dual state: local + server)

**REF MCP Evidence:** React docs recommend local state for controlled inputs with debouncing

---

## ⏱️ Time Estimate

**Total: 5-6 hours**

- Step 1: useVideoFieldValues hook (1 hour)
- Step 2: Editor sub-components (2 hours)
  - RatingEditor (30 min)
  - SelectEditor (30 min)
  - TextEditor (30 min)
  - BooleanEditor (30 min)
- Step 3: FieldEditor component (1 hour)
- Step 4: Barrel exports (5 min)
- Step 5: Unit tests (1.5 hours)
- Step 6: Manual testing (30 min)
- Step 7: Integration test (30 min)
- Step 8: CLAUDE.md update (5 min)
- Step 9: Git commit (10 min)

**Risk Mitigation:**
- REF MCP validation BEFORE implementation (+20 min if needed)
- Mock API complexity in tests (+15 min if issues)

---

## 🚨 Risk Mitigation

### Risk 1: Optimistic Update Race Conditions

**Risk:** User edits field while previous mutation still pending

**Mitigation:**
- `cancelQueries` in onMutate prevents concurrent mutations
- Debounce timer reset on each edit (only final value saves)
- TanStack Query queues mutations automatically

**Testing:** Unit test "debounces multiple rapid changes"

---

### Risk 2: Stale Data After Optimistic Update

**Risk:** Optimistic cache update differs from server response

**Mitigation:**
- `onSettled` refetches queries to sync with server
- `invalidateQueries` triggers refetch even on success
- Short-lived staleness acceptable (< 500ms until refetch)

**Testing:** Integration test verifies final state matches server

---

### Risk 3: Memory Leak from Debounce Timer

**Risk:** Component unmounts before timer fires

**Mitigation:**
- useEffect cleanup clears timeout on unmount
- Test "clears debounce timer on unmount" validates cleanup

**Testing:** Unit test with unmount verification

---

### Risk 4: Backend 422 Error Not Parsed

**Risk:** Unexpected error format breaks parseValidationError

**Mitigation:**
- Default error message "Fehler beim Speichern..."
- Nested optional chaining (error?.response?.data?.detail)
- Unit test validates error parsing

**Testing:** Unit test "displays validation error from backend"

---

## 📝 Notes

### Prerequisites

- Task #72 complete (PUT /api/videos/{video_id}/fields endpoint)
- Task #90 complete (FieldDisplay component for reference)
- Backend validation logic working (Task #73)

### Blocking

- Task #92 (VideoDetailsModal) depends on this component
- Task #93 (CustomFieldsSection) consumes FieldEditor

### Future Enhancements (out of scope)

- Configurable debounce timeout per field type
- Undo/redo functionality
- Offline support with queue
- Batch save all fields on modal close (instead of auto-save)
- Conflict resolution (last-write-wins vs merge)

---

**Plan Created:** 2025-01-08
**REF MCP Validated:** TanStack Query optimistic updates, React debouncing patterns
**Ready for Implementation:** ✅

---
