/**
 * CategorySelector Component
 *
 * Dropdown selector for assigning/changing a video's category.
 * Categories are mutually exclusive - a video can only have one.
 *
 * Features:
 * - Shows CategoryChangeWarning dialog before category changes
 * - Displays which field values will be backed up
 * - Supports backup restoration (future feature)
 *
 * Uses:
 * - useCategories() to fetch available category tags
 * - useSetVideoCategory() mutation to change category
 *
 * @example
 * ```tsx
 * <CategorySelector
 *   videoId="video-uuid"
 *   currentCategoryId="category-uuid"
 *   fieldValues={video.field_values}
 *   onCategoryChange={(categoryId) => console.log('Changed to:', categoryId)}
 * />
 * ```
 */
import { useState } from 'react'
import { useCategories } from '@/hooks/useTags'
import { useSetVideoCategory } from '@/hooks/useVideos'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FolderOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CategoryChangeWarning } from './CategoryChangeWarning'
import type { VideoFieldValue } from '@/types/video'

interface FieldValueInfo {
  id: string
  fieldName: string
  value: string | number | boolean | null
}

interface CategorySelectorProps {
  /** Video ID to assign category to */
  videoId: string
  /** Current category ID (null if no category assigned) */
  currentCategoryId: string | null
  /** Current field values for the video */
  fieldValues?: VideoFieldValue[]
  /** Optional callback when category changes */
  onCategoryChange?: (categoryId: string | null) => void
  /** Whether the selector is disabled */
  disabled?: boolean
}

export function CategorySelector({
  videoId,
  currentCategoryId,
  fieldValues = [],
  onCategoryChange,
  disabled = false,
}: CategorySelectorProps) {
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const setCategory = useSetVideoCategory()

  // Warning dialog state
  const [warningOpen, setWarningOpen] = useState(false)
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null)

  const currentCategory = categories.find((c) => c.id === currentCategoryId) || null
  const newCategory = categories.find((c) => c.id === pendingCategoryId) || null

  /**
   * Calculate which fields belong to the current category (will be backed up)
   * vs workspace fields (will persist)
   */
  const calculateFieldInfo = () => {
    const fieldValuesToBackup: FieldValueInfo[] = []
    const fieldValuesThatPersist: FieldValueInfo[] = []

    // For now, treat all fields as category-specific if there's a current category
    // TODO: When workspace schemas are implemented, properly separate them
    fieldValues.forEach((fv) => {
      const fieldInfo: FieldValueInfo = {
        id: fv.id,
        fieldName: fv.field_name || fv.field?.name || 'Unbekannt',
        value: fv.value,
      }

      // Simple heuristic: if field has a value and we're changing categories,
      // it will be backed up
      if (fv.value !== null && currentCategoryId) {
        fieldValuesToBackup.push(fieldInfo)
      } else if (fv.value !== null) {
        fieldValuesThatPersist.push(fieldInfo)
      }
    })

    return { fieldValuesToBackup, fieldValuesThatPersist }
  }

  const handleValueChange = (value: string) => {
    const newCategoryId = value === 'none' ? null : value

    // Don't do anything if selecting the same category
    if (newCategoryId === currentCategoryId) return

    // If there's a current category with field values, show warning
    const hasFieldValues = fieldValues.some((fv) => fv.value !== null)

    if (currentCategoryId && hasFieldValues) {
      // Show warning dialog
      setPendingCategoryId(newCategoryId)
      setWarningOpen(true)
    } else {
      // No warning needed, proceed directly
      executeChange(newCategoryId)
    }
  }

  const executeChange = async (newCategoryId: string | null) => {
    try {
      await setCategory.mutateAsync({
        videoId,
        categoryId: newCategoryId,
      })
      onCategoryChange?.(newCategoryId)
    } catch (error) {
      console.error('Failed to set category:', error)
    }
  }

  const handleConfirm = async (_restoreBackup: boolean) => {
    setWarningOpen(false)
    // TODO: Pass _restoreBackup to backend when implemented
    await executeChange(pendingCategoryId)
    setPendingCategoryId(null)
  }

  const handleCancel = () => {
    setWarningOpen(false)
    setPendingCategoryId(null)
  }

  const isDisabled = disabled || categoriesLoading || setCategory.isPending

  const { fieldValuesToBackup, fieldValuesThatPersist } = calculateFieldInfo()

  return (
    <>
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentCategoryId || 'none'}
          onValueChange={handleValueChange}
          disabled={isDisabled}
        >
          <SelectTrigger className="w-[200px]" data-testid="category-selector">
            <SelectValue placeholder="Kategorie wählen">
              {currentCategory ? (
                <span className="flex items-center gap-2">
                  {currentCategory.color && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: currentCategory.color }}
                    />
                  )}
                  {currentCategory.name}
                </span>
              ) : (
                <span className="text-muted-foreground">Keine Kategorie</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">Keine Kategorie</span>
            </SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <span className="flex items-center gap-2">
                  {category.color && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                  )}
                  {category.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {setCategory.isPending && (
          <span className="text-sm text-muted-foreground">Speichert...</span>
        )}
      </div>

      {/* Category Change Warning Dialog */}
      <CategoryChangeWarning
        open={warningOpen}
        onOpenChange={setWarningOpen}
        oldCategory={currentCategory}
        newCategory={newCategory}
        fieldValuesToBackup={fieldValuesToBackup}
        fieldValuesThatPersist={fieldValuesThatPersist}
        hasBackup={false} // TODO: Check for existing backup
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isLoading={setCategory.isPending}
      />
    </>
  )
}

/**
 * CategoryBadge Component
 *
 * Displays the current category as a badge with icon.
 * Read-only display for contexts where editing is not needed.
 */
interface CategoryBadgeProps {
  /** Category name */
  name: string
  /** Category color (hex) */
  color?: string | null
}

export function CategoryBadge({ name, color }: CategoryBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="flex items-center gap-1.5"
      style={color ? { borderColor: color } : undefined}
    >
      <FolderOpen className="h-3 w-3" />
      {color && (
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {name}
    </Badge>
  )
}

/**
 * LabelBadge Component
 *
 * Displays a label tag as a badge.
 * Visually distinct from CategoryBadge.
 */
interface LabelBadgeProps {
  /** Label name */
  name: string
  /** Label color (hex) */
  color?: string | null
}

export function LabelBadge({ name, color }: LabelBadgeProps) {
  return (
    <Badge
      variant="secondary"
      style={color ? { backgroundColor: color, color: '#fff' } : undefined}
    >
      {name}
    </Badge>
  )
}
