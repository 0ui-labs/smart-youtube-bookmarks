# Task #89: Create CustomFieldsPreview Component for VideoCard (Max 3 Fields)

**Plan Task:** #89
**Wave/Phase:** Phase 1 MVP - Frontend Components (Custom Fields System)
**Dependencies:** Task #71 (Backend VideoFieldValue API), Task #78 (TypeScript field types)

---

## 🎯 Ziel

Create a `CustomFieldsPreview` component that displays up to 3 custom field values inline on the VideoCard, supports inline editing for all 4 field types (rating, select, boolean, text), uses optimistic UI updates with React Query mutations, and shows a "More fields" indicator when a video has more than 3 fields marked with `show_on_card=true`.

## 📋 Acceptance Criteria

- [ ] CustomFieldsPreview component displays max 3 fields filtered by `show_on_card=true`
- [ ] Inline editing works for all 4 field types (Rating stars, Select dropdown, Boolean checkbox, Text input)
- [ ] Optimistic UI updates using React Query mutations (instant feedback)
- [ ] "More fields" indicator appears when total fields > 3 (with count badge)
- [ ] Integration into existing VideoCard component without layout breaks
- [ ] Component uses shadcn/ui Badge for field labels and values
- [ ] Proper TypeScript types for VideoFieldValue with discriminated unions
- [ ] Keyboard navigation support (Tab, Enter, Escape) for accessibility
- [ ] 8+ unit tests covering max 3 limit, inline editing, field types, error handling
- [ ] Tests passing with 100% coverage for CustomFieldsPreview
- [ ] Visual regression tests for all field type rendering
- [ ] Code reviewed and follows project conventions (CLAUDE.md)

**Evidence:**
- `npm test -- CustomFieldsPreview` passes with 100% coverage
- VideoCard displays custom fields in Grid view
- Inline edits immediately update UI before backend response
- "More fields" badge appears when video has >3 fields

---

## 🛠️ Implementation Steps

### 1. Create TypeScript Types for VideoFieldValue
**Files:** `frontend/src/types/video.ts`
**Action:** Extend VideoResponse interface with field_values property using discriminated union types

```typescript
// frontend/src/types/video.ts
import type { Tag } from './tag'

// Discriminated union for field values based on field_type
export type VideoFieldValue =
  | {
      field_id: string
      field: {
        name: string
        field_type: 'rating'
        config: { max_rating: number }
      }
      value: number | null
      schema_name: string
      show_on_card: boolean
    }
  | {
      field_id: string
      field: {
        name: string
        field_type: 'select'
        config: { options: string[] }
      }
      value: string | null
      schema_name: string
      show_on_card: boolean
    }
  | {
      field_id: string
      field: {
        name: string
        field_type: 'boolean'
        config: Record<string, never> // empty object
      }
      value: boolean | null
      schema_name: string
      show_on_card: boolean
    }
  | {
      field_id: string
      field: {
        name: string
        field_type: 'text'
        config: { max_length?: number }
      }
      value: string | null
      schema_name: string
      show_on_card: boolean
    }

export interface VideoResponse {
  id: string
  list_id: string
  youtube_id: string

  // YouTube Metadata (from Backend Tasks 1-2)
  title: string | null
  channel: string | null
  thumbnail_url: string | null
  duration: number | null  // Seconds
  published_at: string | null  // ISO 8601

  // Tags (many-to-many relationship)
  tags: Tag[]

  // Custom Fields (Task #89 - NEW)
  field_values: VideoFieldValue[]

  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface VideoCreate {
  url: string
}

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'

// Helper type guards for field value discrimination
export const isRatingField = (fv: VideoFieldValue): fv is Extract<VideoFieldValue, { field: { field_type: 'rating' } }> =>
  fv.field.field_type === 'rating'

export const isSelectField = (fv: VideoFieldValue): fv is Extract<VideoFieldValue, { field: { field_type: 'select' } }> =>
  fv.field.field_type === 'select'

export const isBooleanField = (fv: VideoFieldValue): fv is Extract<VideoFieldValue, { field: { field_type: 'boolean' } }> =>
  fv.field.field_type === 'boolean'

export const isTextField = (fv: VideoFieldValue): fv is Extract<VideoFieldValue, { field: { field_type: 'text' } }> =>
  fv.field.field_type === 'text'
```

### 2. Create useUpdateFieldValue Hook for Optimistic Updates
**Files:** `frontend/src/hooks/useVideoFieldValues.ts`
**Action:** Create React Query mutation hook with optimistic UI updates

```typescript
// frontend/src/hooks/useVideoFieldValues.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { videoKeys } from '@/hooks/useVideos'
import type { VideoResponse, VideoFieldValue } from '@/types/video'

export interface UpdateFieldValueRequest {
  videoId: string
  fieldId: string
  value: string | number | boolean | null
}

export interface UpdateFieldValueResponse {
  field_id: string
  value: string | number | boolean | null
  updated_at: string
}

/**
 * Hook to update a single field value for a video with optimistic UI updates
 *
 * Pattern: Optimistic update → API call → Rollback on error
 *
 * @example
 * ```tsx
 * const updateField = useUpdateFieldValue()
 * updateField.mutate({
 *   videoId: 'uuid',
 *   fieldId: 'field-uuid',
 *   value: 4
 * })
 * ```
 */
export const useUpdateFieldValue = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ videoId, fieldId, value }: UpdateFieldValueRequest) => {
      const { data } = await api.put<UpdateFieldValueResponse>(
        `/videos/${videoId}/fields/${fieldId}`,
        { value }
      )
      return data
    },

    // Optimistic update: immediately update cache before API call
    onMutate: async ({ videoId, fieldId, value }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: videoKeys.all })

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueriesData<VideoResponse[]>({
        queryKey: videoKeys.all
      })

      // Optimistically update ALL video queries
      queryClient.setQueriesData<VideoResponse[]>(
        { queryKey: videoKeys.all },
        (old) => {
          if (!old) return old
          return old.map(video => {
            if (video.id !== videoId) return video

            return {
              ...video,
              field_values: video.field_values.map(fv =>
                fv.field_id === fieldId
                  ? { ...fv, value: value as any } // TypeScript cast - validated by discriminated union
                  : fv
              )
            }
          })
        }
      )

      return { previousData }
    },

    // Rollback on error
    onError: (err, _variables, context) => {
      console.error('Failed to update field value:', err)

      // Restore previous cache state
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },

    // Refetch to ensure consistency on success
    onSuccess: (_data, variables) => {
      // Only invalidate queries containing this specific video
      queryClient.invalidateQueries({
        queryKey: videoKeys.all,
        refetchType: 'active' // Only refetch active queries
      })
    }
  })
}
```

### 3. Create RatingStars Component for Rating Field Display
**Files:** `frontend/src/components/fields/RatingStars.tsx`
**Action:** Create interactive star rating component with inline editing

```typescript
// frontend/src/components/fields/RatingStars.tsx
import { useState } from 'react'

interface RatingStarsProps {
  value: number | null
  maxRating: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Interactive star rating component with hover preview
 *
 * Accessibility:
 * - Keyboard navigation (Arrow keys to change rating)
 * - ARIA labels for screen readers
 * - Focus management
 *
 * Design:
 * - Yellow filled stars for current rating
 * - Gray outline stars for empty
 * - Hover preview shows potential rating
 */
export const RatingStars = ({
  value,
  maxRating,
  onChange,
  readonly = false,
  size = 'sm'
}: RatingStarsProps) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null)

  const displayRating = hoverRating ?? value ?? 0

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (readonly || !onChange) return

    if (e.key === 'ArrowRight' && index < maxRating - 1) {
      e.preventDefault()
      onChange(index + 2)
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      onChange(index)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onChange(index + 1)
    }
  }

  return (
    <div
      className="inline-flex gap-0.5 items-center"
      role="radiogroup"
      aria-label={`Rating: ${value ?? 0} out of ${maxRating}`}
      onMouseLeave={() => setHoverRating(null)}
    >
      {Array.from({ length: maxRating }, (_, i) => {
        const starValue = i + 1
        const isFilled = starValue <= displayRating

        return (
          <button
            key={i}
            type="button"
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => !readonly && setHoverRating(starValue)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            disabled={readonly}
            role="radio"
            aria-checked={starValue === value}
            aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
            className={`${sizeClasses[size]} transition-colors ${
              readonly
                ? 'cursor-default'
                : 'cursor-pointer hover:scale-110'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill={isFilled ? '#FBBF24' : 'none'}
              stroke={isFilled ? '#FBBF24' : '#D1D5DB'}
              strokeWidth="2"
              className="w-full h-full"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
```

### 4. Create SelectBadge Component for Select Field Display
**Files:** `frontend/src/components/fields/SelectBadge.tsx`
**Action:** Create dropdown badge component for select fields

```typescript
// frontend/src/components/fields/SelectBadge.tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-react'

interface SelectBadgeProps {
  value: string | null
  options: string[]
  onChange?: (value: string) => void
  readonly?: boolean
}

/**
 * Badge-style dropdown for select field values
 *
 * Design:
 * - Shows current value as a badge
 * - Dropdown menu on click (if not readonly)
 * - ChevronDown icon indicates interactivity
 *
 * Pattern follows shadcn/ui Badge with asChild for dropdown trigger
 */
export const SelectBadge = ({
  value,
  options,
  onChange,
  readonly = false
}: SelectBadgeProps) => {
  if (readonly || !onChange) {
    return (
      <Badge variant="secondary" className="text-xs">
        {value || 'Not set'}
      </Badge>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="outline"
          className="text-xs cursor-pointer hover:bg-accent gap-1"
        >
          <span>{value || 'Select...'}</span>
          <ChevronDown className="w-3 h-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => onChange(option)}
            className={value === option ? 'bg-accent' : ''}
          >
            {option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### 5. Create BooleanCheckbox Component for Boolean Field Display
**Files:** `frontend/src/components/fields/BooleanCheckbox.tsx`
**Action:** Create checkbox component with label

```typescript
// frontend/src/components/fields/BooleanCheckbox.tsx
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface BooleanCheckboxProps {
  checked: boolean | null
  onChange?: (checked: boolean) => void
  readonly?: boolean
  fieldName: string
}

/**
 * Checkbox for boolean field values
 *
 * Design:
 * - Uses shadcn/ui Checkbox component
 * - Label shows field name
 * - Null value treated as false
 */
export const BooleanCheckbox = ({
  checked,
  onChange,
  readonly = false,
  fieldName
}: BooleanCheckboxProps) => {
  const handleChange = (newChecked: boolean) => {
    if (!readonly && onChange) {
      onChange(newChecked)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={`checkbox-${fieldName}`}
        checked={checked ?? false}
        onCheckedChange={handleChange}
        disabled={readonly}
      />
      <Label
        htmlFor={`checkbox-${fieldName}`}
        className="text-xs cursor-pointer"
      >
        {fieldName}
      </Label>
    </div>
  )
}
```

### 6. Create TextSnippet Component for Text Field Display
**Files:** `frontend/src/components/fields/TextSnippet.tsx`
**Action:** Create inline editable text snippet with max length truncation

```typescript
// frontend/src/components/fields/TextSnippet.tsx
import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface TextSnippetProps {
  value: string | null
  maxLength?: number
  onChange?: (value: string) => void
  readonly?: boolean
  placeholder?: string
}

/**
 * Inline editable text snippet with click-to-edit pattern
 *
 * States:
 * - Display mode: Shows truncated text as badge
 * - Edit mode: Shows input field on click
 *
 * Behavior:
 * - Click badge to enter edit mode
 * - Enter or blur to save
 * - Escape to cancel
 */
export const TextSnippet = ({
  value,
  maxLength = 50,
  onChange,
  readonly = false,
  placeholder = 'Click to edit...'
}: TextSnippetProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleSave = () => {
    if (onChange && editValue !== value) {
      onChange(editValue)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value ?? '')
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (isEditing && !readonly) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        className="h-6 text-xs py-0 px-2 w-32"
      />
    )
  }

  const displayValue = value
    ? value.length > 30
      ? `${value.slice(0, 30)}...`
      : value
    : placeholder

  return (
    <Badge
      variant="secondary"
      className={`text-xs ${readonly ? '' : 'cursor-pointer hover:bg-accent'}`}
      onClick={() => !readonly && setIsEditing(true)}
    >
      {displayValue}
    </Badge>
  )
}
```

### 7. Create FieldDisplay Component for Field Type Routing
**Files:** `frontend/src/components/fields/FieldDisplay.tsx`
**Action:** Create router component that selects correct field renderer

```typescript
// frontend/src/components/fields/FieldDisplay.tsx
import type { VideoFieldValue } from '@/types/video'
import { RatingStars } from './RatingStars'
import { SelectBadge } from './SelectBadge'
import { BooleanCheckbox } from './BooleanCheckbox'
import { TextSnippet } from './TextSnippet'
import { isRatingField, isSelectField, isBooleanField, isTextField } from '@/types/video'

interface FieldDisplayProps {
  fieldValue: VideoFieldValue
  onChange?: (value: string | number | boolean) => void
  readonly?: boolean
}

/**
 * Field type router component using discriminated unions
 *
 * Pattern: Type-safe field rendering based on field_type
 *
 * Uses TypeScript type guards to narrow union types
 */
export const FieldDisplay = ({ fieldValue, onChange, readonly = false }: FieldDisplayProps) => {
  // Rating field
  if (isRatingField(fieldValue)) {
    return (
      <RatingStars
        value={fieldValue.value}
        maxRating={fieldValue.field.config.max_rating}
        onChange={onChange ? (val) => onChange(val) : undefined}
        readonly={readonly}
        size="sm"
      />
    )
  }

  // Select field
  if (isSelectField(fieldValue)) {
    return (
      <SelectBadge
        value={fieldValue.value}
        options={fieldValue.field.config.options}
        onChange={onChange ? (val) => onChange(val) : undefined}
        readonly={readonly}
      />
    )
  }

  // Boolean field
  if (isBooleanField(fieldValue)) {
    return (
      <BooleanCheckbox
        checked={fieldValue.value}
        fieldName={fieldValue.field.name}
        onChange={onChange ? (val) => onChange(val) : undefined}
        readonly={readonly}
      />
    )
  }

  // Text field
  if (isTextField(fieldValue)) {
    return (
      <TextSnippet
        value={fieldValue.value}
        maxLength={fieldValue.field.config.max_length}
        onChange={onChange ? (val) => onChange(val) : undefined}
        readonly={readonly}
        placeholder={`Enter ${fieldValue.field.name.toLowerCase()}...`}
      />
    )
  }

  // Fallback for unknown field types
  return <span className="text-xs text-muted-foreground">Unknown field type</span>
}
```

### 8. Create CustomFieldsPreview Component
**Files:** `frontend/src/components/fields/CustomFieldsPreview.tsx`
**Action:** Create main preview component with max 3 fields and "More" indicator

```typescript
// frontend/src/components/fields/CustomFieldsPreview.tsx
import { Badge } from '@/components/ui/badge'
import { FieldDisplay } from './FieldDisplay'
import { useUpdateFieldValue } from '@/hooks/useVideoFieldValues'
import type { VideoFieldValue } from '@/types/video'

interface CustomFieldsPreviewProps {
  videoId: string
  fieldValues: VideoFieldValue[]
  onMoreClick?: () => void
}

/**
 * Displays up to 3 custom fields inline on VideoCard
 *
 * Features:
 * - Max 3 fields filtered by show_on_card=true
 * - Inline editing with optimistic updates
 * - "More fields" indicator when total > 3
 *
 * Layout:
 * - Wrapping flex container
 * - Each field as label + value badge
 * - More indicator at end
 */
export const CustomFieldsPreview = ({
  videoId,
  fieldValues,
  onMoreClick
}: CustomFieldsPreviewProps) => {
  const updateField = useUpdateFieldValue()

  // Filter to only show_on_card fields, max 3
  const cardFields = fieldValues
    .filter(fv => fv.show_on_card)
    .slice(0, 3)

  const totalFields = fieldValues.length
  const hasMoreFields = totalFields > 3

  const handleFieldChange = (fieldId: string, value: string | number | boolean) => {
    updateField.mutate({ videoId, fieldId, value })
  }

  if (cardFields.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {cardFields.map((fv) => (
        <div key={fv.field_id} className="flex items-center gap-1.5">
          {/* Field Label */}
          <span className="text-xs text-muted-foreground font-medium">
            {fv.field.name}:
          </span>

          {/* Field Value (inline editable) */}
          <FieldDisplay
            fieldValue={fv}
            onChange={(value) => handleFieldChange(fv.field_id, value)}
          />
        </div>
      ))}

      {/* More Fields Indicator */}
      {hasMoreFields && (
        <Badge
          variant="outline"
          className="text-xs cursor-pointer hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation() // Prevent VideoCard click
            onMoreClick?.()
          }}
        >
          +{totalFields - 3} more
        </Badge>
      )}
    </div>
  )
}
```

### 9. Integrate CustomFieldsPreview into VideoCard
**Files:** `frontend/src/components/VideoCard.tsx`
**Action:** Add CustomFieldsPreview between tags and bottom of card

```typescript
// frontend/src/components/VideoCard.tsx
import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'
import { VideoThumbnail } from './VideosPage'
import { CustomFieldsPreview } from './fields/CustomFieldsPreview'

interface VideoCardProps {
  video: VideoResponse
  onClick?: (video: VideoResponse) => void
  onDelete?: (videoId: string) => void
}

/**
 * VideoCard Component - Grid view card for video display
 *
 * REF MCP Improvements Applied:
 * #2 - Reuses VideoThumbnail component (url, title props) - no recreation
 * #3 - Complete keyboard navigation (Enter, Space, Focus Management)
 * #4 - Duration overlay with shadow-lg and border for readability
 * #7 - Radix UI asChild pattern for DropdownMenu (better accessibility)
 *
 * Custom Fields Integration (Task #89):
 * - Shows CustomFieldsPreview component after tags
 * - Max 3 fields with inline editing
 * - "More fields" opens modal (placeholder for future task)
 *
 * Design Patterns:
 * - Responsive card with hover effects (shadow-lg transition)
 * - Clickable card with keyboard support (role="button", onKeyDown)
 * - Three-dot menu with stopPropagation (defense-in-depth)
 * - Native lazy loading via VideoThumbnail (already implemented)
 * - YouTube-inspired design (16:9 thumbnail, line-clamp-2 title, tag chips)
 * - WCAG 2.1 Level AA compliant (ARIA labels, keyboard navigation)
 */
export const VideoCard = ({ video, onClick, onDelete }: VideoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const handleCardClick = () => {
    onClick?.(video)
  }

  // REF MCP #3: Complete keyboard navigation (Enter, Space)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  const handleMoreFieldsClick = () => {
    setShowDetailsModal(true)
    // TODO: Task #90 - VideoDetailsModal implementation
    console.log('Open video details modal for:', video.id)
  }

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      // REF MCP #3: ARIA label with channel name for screen readers
      aria-label={`Video: ${video.title} von ${(video as any).channel_name || video.channel || 'Unbekannt'}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="video-card group cursor-pointer rounded-lg border bg-card transition-shadow duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {/* Thumbnail Container with Duration Overlay */}
      <div className="relative">
        {/* REF MCP #2: Reuse VideoThumbnail with correct API (url, title) */}
        {/* Task #35 Fix: Use useFullWidth={true} for Grid mode (container-adapted sizing) */}
        <VideoThumbnail url={video.thumbnail_url} title={video.title || 'Untitled'} useFullWidth={true} />

        {/* Duration Overlay (bottom-right corner) */}
        {/* REF MCP #4: Enhanced readability with shadow-lg and border */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white shadow-lg border border-white/20">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-2">
        {/* Header: Title + Menu */}
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-sm font-semibold line-clamp-2 leading-tight">
            {video.title}
          </h3>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                }
              }}
              tabIndex={-1}
              className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              aria-label="Aktionen"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(video.id)
                }}
                className="text-red-600 focus:text-red-700 cursor-pointer"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Channel Name */}
        {((video as any).channel_name || video.channel) && (
          <p className="text-xs text-muted-foreground truncate">
            {(video as any).channel_name || video.channel}
          </p>
        )}

        {/* Tags */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {tag.color && (
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span>{tag.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Custom Fields Preview (Task #89 - NEW) */}
        {video.field_values && video.field_values.length > 0 && (
          <CustomFieldsPreview
            videoId={video.id}
            fieldValues={video.field_values}
            onMoreClick={handleMoreFieldsClick}
          />
        )}
      </div>
    </div>
  )
}
```

### 10. Update VideoResponse Zod Schema in useVideos
**Files:** `frontend/src/hooks/useVideos.ts`
**Action:** Add field_values validation to VideoResponseSchema

```typescript
// frontend/src/hooks/useVideos.ts
// ... existing imports ...
import type { VideoResponse, VideoCreate, VideoFieldValue } from '@/types/video'

// Field value schemas for validation
const RatingFieldValueSchema = z.object({
  field_id: z.string().uuid(),
  field: z.object({
    name: z.string(),
    field_type: z.literal('rating'),
    config: z.object({
      max_rating: z.number()
    })
  }),
  value: z.number().nullable(),
  schema_name: z.string(),
  show_on_card: z.boolean()
})

const SelectFieldValueSchema = z.object({
  field_id: z.string().uuid(),
  field: z.object({
    name: z.string(),
    field_type: z.literal('select'),
    config: z.object({
      options: z.array(z.string())
    })
  }),
  value: z.string().nullable(),
  schema_name: z.string(),
  show_on_card: z.boolean()
})

const BooleanFieldValueSchema = z.object({
  field_id: z.string().uuid(),
  field: z.object({
    name: z.string(),
    field_type: z.literal('boolean'),
    config: z.object({})
  }),
  value: z.boolean().nullable(),
  schema_name: z.string(),
  show_on_card: z.boolean()
})

const TextFieldValueSchema = z.object({
  field_id: z.string().uuid(),
  field: z.object({
    name: z.string(),
    field_type: z.literal('text'),
    config: z.object({
      max_length: z.number().optional()
    })
  }),
  value: z.string().nullable(),
  schema_name: z.string(),
  show_on_card: z.boolean()
})

const VideoFieldValueSchema = z.discriminatedUnion('field.field_type', [
  RatingFieldValueSchema,
  SelectFieldValueSchema,
  BooleanFieldValueSchema,
  TextFieldValueSchema
])

const VideoResponseSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  youtube_id: z.string().length(11),

  // YouTube Metadata (optional fields from API)
  title: z.string().nullable(),
  channel: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  duration: z.number().nullable(),
  published_at: z.string().nullable(),

  // Tags (many-to-many relationship)
  tags: z.array(TagSchema).default([]),

  // Custom Fields (Task #89 - NEW)
  field_values: z.array(VideoFieldValueSchema).default([]),

  processing_status: z.enum(['pending', 'processing', 'completed', 'failed']),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

// ... rest of the file remains the same ...
```

### 11. Create Unit Tests for CustomFieldsPreview
**Files:** `frontend/src/components/fields/CustomFieldsPreview.test.tsx`
**Action:** Create comprehensive unit tests with 100% coverage

```typescript
// frontend/src/components/fields/CustomFieldsPreview.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomFieldsPreview } from './CustomFieldsPreview'
import type { VideoFieldValue } from '@/types/video'

// Mock useUpdateFieldValue hook
vi.mock('@/hooks/useVideoFieldValues', () => ({
  useUpdateFieldValue: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  })
}))

const createRatingField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  field_id: 'rating-123',
  field: {
    name: 'Quality Rating',
    field_type: 'rating',
    config: { max_rating: 5 }
  },
  value: 4,
  schema_name: 'Video Quality',
  show_on_card: true,
  ...overrides
} as VideoFieldValue)

const createSelectField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  field_id: 'select-456',
  field: {
    name: 'Presentation',
    field_type: 'select',
    config: { options: ['bad', 'good', 'great'] }
  },
  value: 'great',
  schema_name: 'Video Quality',
  show_on_card: true,
  ...overrides
} as VideoFieldValue)

const createBooleanField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  field_id: 'bool-789',
  field: {
    name: 'Verified',
    field_type: 'boolean',
    config: {}
  },
  value: true,
  schema_name: 'Metadata',
  show_on_card: true,
  ...overrides
} as VideoFieldValue)

const createTextField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  field_id: 'text-101',
  field: {
    name: 'Notes',
    field_type: 'text',
    config: { max_length: 50 }
  },
  value: 'Great tutorial',
  schema_name: 'Metadata',
  show_on_card: true,
  ...overrides
} as VideoFieldValue)

const renderWithQuery = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('CustomFieldsPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when no field values provided', () => {
    const { container } = renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all fields have show_on_card=false', () => {
    const fields = [
      createRatingField({ show_on_card: false }),
      createSelectField({ show_on_card: false })
    ]
    const { container } = renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('displays max 3 fields when more than 3 have show_on_card=true', () => {
    const fields = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
      createTextField(),
      createRatingField({ field_id: 'rating-999', field: { name: 'Rating 5', field_type: 'rating', config: { max_rating: 5 } } })
    ]

    renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )

    // Should show exactly 3 field labels
    expect(screen.getByText('Quality Rating:')).toBeInTheDocument()
    expect(screen.getByText('Presentation:')).toBeInTheDocument()
    expect(screen.getByText('Verified:')).toBeInTheDocument()

    // Should NOT show 4th and 5th fields
    expect(screen.queryByText('Notes:')).not.toBeInTheDocument()
    expect(screen.queryByText('Rating 5:')).not.toBeInTheDocument()
  })

  it('shows "More fields" indicator when total > 3', () => {
    const fields = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
      createTextField(),
      createRatingField({ field_id: 'rating-999' })
    ]

    renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )

    const moreButton = screen.getByText('+2 more')
    expect(moreButton).toBeInTheDocument()
    expect(moreButton).toHaveClass('cursor-pointer')
  })

  it('does not show "More fields" indicator when total <= 3', () => {
    const fields = [
      createRatingField(),
      createSelectField(),
      createBooleanField()
    ]

    renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )

    expect(screen.queryByText(/more/i)).not.toBeInTheDocument()
  })

  it('calls onMoreClick when "More fields" badge is clicked', async () => {
    const onMoreClick = vi.fn()
    const user = userEvent.setup()

    const fields = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
      createTextField()
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fields}
        onMoreClick={onMoreClick}
      />
    )

    const moreButton = screen.getByText('+1 more')
    await user.click(moreButton)

    expect(onMoreClick).toHaveBeenCalledTimes(1)
  })

  it('prevents event propagation when "More fields" is clicked', async () => {
    const onMoreClick = vi.fn()
    const onParentClick = vi.fn()
    const user = userEvent.setup()

    const fields = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
      createTextField()
    ]

    const { container } = renderWithQuery(
      <div onClick={onParentClick}>
        <CustomFieldsPreview
          videoId="video-123"
          fieldValues={fields}
          onMoreClick={onMoreClick}
        />
      </div>
    )

    const moreButton = screen.getByText('+1 more')
    await user.click(moreButton)

    expect(onMoreClick).toHaveBeenCalledTimes(1)
    // Parent click should NOT be called due to stopPropagation
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('renders rating field with stars', () => {
    const fields = [createRatingField()]

    renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )

    expect(screen.getByText('Quality Rating:')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: /Rating: 4 out of 5/i })).toBeInTheDocument()
  })

  it('renders select field with badge dropdown', () => {
    const fields = [createSelectField()]

    renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )

    expect(screen.getByText('Presentation:')).toBeInTheDocument()
    expect(screen.getByText('great')).toBeInTheDocument()
  })

  it('renders boolean field with checkbox', () => {
    const fields = [createBooleanField()]

    renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )

    expect(screen.getByText('Verified:')).toBeInTheDocument()
    const checkbox = screen.getByRole('checkbox', { name: /Verified/i })
    expect(checkbox).toBeChecked()
  })

  it('renders text field with snippet badge', () => {
    const fields = [createTextField()]

    renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )

    expect(screen.getByText('Notes:')).toBeInTheDocument()
    expect(screen.getByText('Great tutorial')).toBeInTheDocument()
  })

  it('handles null values gracefully', () => {
    const fields = [
      createRatingField({ value: null }),
      createSelectField({ value: null }),
      createBooleanField({ value: null }),
      createTextField({ value: null })
    ]

    renderWithQuery(
      <CustomFieldsPreview videoId="video-123" fieldValues={fields} />
    )

    // Should still render field labels
    expect(screen.getByText('Quality Rating:')).toBeInTheDocument()
    expect(screen.getByText('Presentation:')).toBeInTheDocument()
    expect(screen.getByText('Verified:')).toBeInTheDocument()
  })
})
```

### 12. Create Integration Test for VideoCard with Custom Fields
**Files:** `frontend/src/components/VideoCard.customfields.integration.test.tsx`
**Action:** Create integration test for complete flow

```typescript
// frontend/src/components/VideoCard.customfields.integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VideoCard } from './VideoCard'
import type { VideoResponse } from '@/types/video'
import * as api from '@/lib/api'

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    put: vi.fn()
  }
}))

const mockVideoWithFields: VideoResponse = {
  id: 'video-123',
  youtube_id: 'dQw4w9WgXcQ',
  title: 'Test Video',
  channel: 'Test Channel',
  duration: 240,
  thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  published_at: '2025-01-01T00:00:00Z',
  tags: [],
  list_id: 'list-123',
  processing_status: 'completed',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  field_values: [
    {
      field_id: 'rating-123',
      field: {
        name: 'Quality',
        field_type: 'rating',
        config: { max_rating: 5 }
      },
      value: 4,
      schema_name: 'Video Quality',
      show_on_card: true
    },
    {
      field_id: 'select-456',
      field: {
        name: 'Presentation',
        field_type: 'select',
        config: { options: ['bad', 'good', 'great'] }
      },
      value: 'great',
      schema_name: 'Video Quality',
      show_on_card: true
    },
    {
      field_id: 'bool-789',
      field: {
        name: 'Verified',
        field_type: 'boolean',
        config: {}
      },
      value: true,
      schema_name: 'Metadata',
      show_on_card: true
    },
    {
      field_id: 'text-101',
      field: {
        name: 'Notes',
        field_type: 'text',
        config: { max_length: 50 }
      },
      value: 'Great tutorial',
      schema_name: 'Metadata',
      show_on_card: false // Not shown on card
    }
  ]
}

const renderWithQuery = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('VideoCard - Custom Fields Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays custom fields preview below tags', () => {
    renderWithQuery(<VideoCard video={mockVideoWithFields} />)

    // Should show first 3 fields (show_on_card=true)
    expect(screen.getByText('Quality:')).toBeInTheDocument()
    expect(screen.getByText('Presentation:')).toBeInTheDocument()
    expect(screen.getByText('Verified:')).toBeInTheDocument()

    // Should NOT show 4th field (show_on_card=false)
    expect(screen.queryByText('Notes:')).not.toBeInTheDocument()
  })

  it('allows inline editing of rating field with optimistic update', async () => {
    const user = userEvent.setup()
    const mockPut = vi.mocked(api.api.put).mockResolvedValue({
      data: { field_id: 'rating-123', value: 5, updated_at: new Date().toISOString() }
    })

    renderWithQuery(<VideoCard video={mockVideoWithFields} />)

    // Find and click 5th star
    const stars = screen.getAllByRole('radio')
    const fifthStar = stars.find(star => star.getAttribute('aria-label') === '5 stars')

    await user.click(fifthStar!)

    // Should call API with correct payload
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/videos/video-123/fields/rating-123',
        { value: 5 }
      )
    })
  })

  it('allows inline editing of select field', async () => {
    const user = userEvent.setup()
    const mockPut = vi.mocked(api.api.put).mockResolvedValue({
      data: { field_id: 'select-456', value: 'good', updated_at: new Date().toISOString() }
    })

    renderWithQuery(<VideoCard video={mockVideoWithFields} />)

    // Click on select badge to open dropdown
    const selectBadge = screen.getByText('great')
    await user.click(selectBadge)

    // Select different option
    const goodOption = await screen.findByText('good')
    await user.click(goodOption)

    // Should call API with correct payload
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/videos/video-123/fields/select-456',
        { value: 'good' }
      )
    })
  })

  it('does not trigger video onClick when editing field', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()

    renderWithQuery(<VideoCard video={mockVideoWithFields} onClick={onClick} />)

    // Click on checkbox (should not trigger video click)
    const checkbox = screen.getByRole('checkbox', { name: /Verified/i })
    await user.click(checkbox)

    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows video with no custom fields without errors', () => {
    const videoNoFields = { ...mockVideoWithFields, field_values: [] }

    renderWithQuery(<VideoCard video={videoNoFields} />)

    // Should render normally
    expect(screen.getByText('Test Video')).toBeInTheDocument()

    // Should not show custom fields section
    expect(screen.queryByText(/:/)).not.toBeInTheDocument()
  })
})
```

---

## 🧪 Testing Strategy

**Unit Tests:**
- CustomFieldsPreview renders nothing when no fields - verify null return
- CustomFieldsPreview shows max 3 fields - verify slice(0, 3) logic
- CustomFieldsPreview filters by show_on_card=true - verify filter predicate
- CustomFieldsPreview shows "More fields" when total > 3 - verify badge appears
- CustomFieldsPreview calls onMoreClick handler - verify callback invoked
- CustomFieldsPreview prevents event propagation on "More" click - verify stopPropagation
- FieldDisplay routes to correct component for each field type - verify 4 types
- RatingStars allows keyboard navigation - verify Arrow keys, Enter, Space
- SelectBadge opens dropdown and selects option - verify DropdownMenu interaction
- BooleanCheckbox toggles state - verify checked/unchecked
- TextSnippet switches to edit mode on click - verify input focus
- TextSnippet saves on Enter and cancels on Escape - verify keyboard events
- useUpdateFieldValue performs optimistic update - verify cache manipulation
- useUpdateFieldValue rolls back on error - verify context restoration

**Integration Tests:**
- VideoCard displays CustomFieldsPreview with real field data - verify component integration
- VideoCard inline edit updates field value via API - verify complete mutation flow
- VideoCard shows "More fields" indicator for videos with >3 fields - verify UI state
- VideoCard field editing does not trigger video onClick - verify event isolation
- VideoCard handles videos with no field_values gracefully - verify defensive code

**Manual Testing:**
1. Open VideosPage in Grid view - expect VideoCards to show custom fields below tags
2. Hover over rating stars - expect yellow hover preview
3. Click 5th star on rating field - expect immediate UI update (optimistic)
4. Click select dropdown badge - expect dropdown menu to open
5. Select different option - expect badge to update immediately
6. Click checkbox for boolean field - expect immediate toggle
7. Click text snippet badge - expect input field to appear with focus
8. Type new text and press Enter - expect badge to update with new text
9. Create video with 5 fields (all show_on_card=true) - expect "+2 more" badge
10. Click "+2 more" badge - expect console log (modal placeholder)
11. Network throttle to Slow 3G - expect optimistic updates still instant
12. Disconnect network and edit field - expect error rollback after retry

**Visual Regression Tests:**
- VideoCard with 0 custom fields - baseline screenshot
- VideoCard with 1 custom field (rating) - verify stars render
- VideoCard with 3 custom fields - verify layout doesn't break
- VideoCard with "More fields" indicator - verify badge positioning
- Rating field hover state - verify yellow preview
- Select field dropdown open - verify menu alignment
- Boolean checkbox checked/unchecked - verify visual state
- Text field in edit mode - verify input styling

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 361-377 (CustomFieldsPreview spec)
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 671-687 (Test cases)
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 263-293 (API response structure)
- `CLAUDE.md` - Lines 174-194 (Custom Fields System architecture)
- `CLAUDE.md` - Lines 196-214 (VideoFieldValue model details)

**Related Code:**
- Similar component: `frontend/src/components/TagNavigation.tsx` - Badge usage pattern
- Pattern to follow: `frontend/src/hooks/useVideos.ts` - Optimistic updates pattern (lines 155-184)
- Type guards pattern: `frontend/src/types/video.ts` - Discriminated unions (to be created)
- VideoCard integration: `frontend/src/components/VideoCard.tsx` - Existing structure

**Design Decisions:**

1. **Why max 3 fields?**
   - Prevents VideoCard from becoming cluttered
   - Matches design spec from lines 361-377 of design doc
   - "More fields" indicator directs users to full details modal

2. **Why optimistic updates?**
   - Instant user feedback (perceived performance)
   - Follows TanStack Query best practices for mutations
   - Existing pattern in useVideos.ts (lines 155-184)
   - Rollback on error maintains data consistency

3. **Why discriminated union for VideoFieldValue?**
   - Type-safe value types (number for rating, string for select, etc.)
   - Enables TypeScript narrowing with type guards
   - Prevents invalid value assignments (e.g., string for rating field)
   - Better IDE autocomplete and error detection

4. **Why separate components for each field type?**
   - Single Responsibility Principle (each component does one thing)
   - Easier testing (isolated unit tests)
   - Reusable across CustomFieldsPreview and future VideoDetailsModal
   - Follows design pattern from lines 379-394 of design doc

5. **Why click-to-edit pattern for text fields?**
   - Saves space on VideoCard
   - Common pattern (GitHub issue titles, Notion properties)
   - Keyboard accessible (Tab, Enter, Escape)
   - Research: RSuite InlineEdit component uses same pattern

6. **Why shadcn/ui Badge for field values?**
   - Consistent with existing tag chips in VideoCard
   - Built-in variants (secondary, outline, etc.)
   - Accessible (proper ARIA attributes)
   - Research: shadcn/ui docs recommend Badge for compact labels

**REF MCP Findings:**

1. **Inline Editing Best Practices (RSuite InlineEdit):**
   - Click-to-edit pattern with state toggle
   - Save on blur/Enter, cancel on Escape
   - Show controls (save/cancel buttons) optional
   - Custom input components via children prop
   - Source: https://rsuitejs.com/components/inline-edit/

2. **shadcn/ui Badge Component:**
   - 4 variants: default, secondary, destructive, outline
   - asChild prop for composing with other components (e.g., Link)
   - Customizable via className prop
   - Rounded-full for count badges
   - Source: https://ui.shadcn.com/docs/components/badge

3. **Optimistic Updates with React Query:**
   - Pattern: onMutate → cancelQueries → snapshot → update → return context
   - Rollback in onError using context
   - Invalidate in onSuccess to sync with server
   - Use setQueriesData for updating multiple cache entries
   - Source: https://github.com/TanStack/query/blob/main/docs/framework/solid/guides/optimistic-updates.md

4. **YouTube Video Card UI Patterns:**
   - Compact metadata below thumbnail (channel, duration, views)
   - Line-clamp-2 for title truncation
   - Badge/chip style for categories and tags
   - Hover effects for interactivity
   - Note: No inline editing in YouTube UI (view-only)

**Time Estimate:** 6-8 hours
- TypeScript types (30 min)
- useUpdateFieldValue hook (45 min)
- 4 field display components (2 hours)
- FieldDisplay router (30 min)
- CustomFieldsPreview component (1 hour)
- VideoCard integration (30 min)
- Unit tests (2 hours)
- Integration tests (1 hour)
- Manual testing and fixes (1 hour)
