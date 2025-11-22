/**
 * CategorySelector Component
 * Phase 5 Step 5.1-5.3, 5.7
 *
 * Dropdown component for selecting a video's category.
 * Categories are tags with is_video_type=true (only one per video).
 *
 * Features:
 * - Select from available categories
 * - Clear button to remove category
 * - Loading states for data fetch and mutations
 * - Color indicators for categories
 * - Warning dialog when changing/removing category (Step 5.7)
 */
import { useState } from 'react'
import { useCategories } from '@/hooks/useTags'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X, Loader2 } from 'lucide-react'
import { CategoryChangeWarning } from './CategoryChangeWarning'

export interface CategorySelectorProps {
  videoId: string
  currentCategoryId: string | null
  onCategoryChange: (categoryId: string | null, restoreBackup?: boolean) => void
  disabled?: boolean
  isMutating?: boolean
}

export function CategorySelector({
  currentCategoryId,
  onCategoryChange,
  disabled = false,
  isMutating = false,
}: CategorySelectorProps) {
  const { data: categories, isLoading } = useCategories()

  // Warning dialog state (Step 5.7)
  const [showWarning, setShowWarning] = useState(false)
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null)

  // Find selected category
  const selectedCategory = categories?.find(c => c.id === currentCategoryId)

  // Find pending category for warning dialog
  const pendingCategory = pendingCategoryId
    ? categories?.find(c => c.id === pendingCategoryId) ?? null
    : null

  // Handle selection change
  const handleValueChange = (value: string) => {
    const newCategoryId = value === '__none__' ? null : value

    // If no current category, assign directly (no warning needed)
    if (currentCategoryId === null) {
      onCategoryChange(newCategoryId)
      return
    }

    // If same category, do nothing
    if (newCategoryId === currentCategoryId) {
      return
    }

    // Otherwise show warning dialog
    setPendingCategoryId(newCategoryId)
    setShowWarning(true)
  }

  // Handle clear button click
  const handleClear = () => {
    // Show warning when removing category
    setPendingCategoryId(null)
    setShowWarning(true)
  }

  // Handle warning dialog confirm
  const handleConfirm = (restoreBackup: boolean) => {
    onCategoryChange(pendingCategoryId, restoreBackup)
    setShowWarning(false)
    setPendingCategoryId(null)
  }

  // Handle warning dialog cancel
  const handleCancel = () => {
    setShowWarning(false)
    setPendingCategoryId(null)
  }

  // Loading state - fetching categories
  if (isLoading) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Kategorie</label>
        <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Kategorien...
        </div>
      </div>
    )
  }

  // Mutating state
  if (isMutating) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Kategorie</label>
        <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ändere Kategorie...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Kategorie</label>
      <div className="relative flex items-center gap-2">
        <Select
          value={currentCategoryId || '__none__'}
          onValueChange={handleValueChange}
          disabled={disabled}
        >
          <SelectTrigger
            className="w-full"
            aria-label="Kategorie auswählen"
          >
            <SelectValue placeholder="Keine Kategorie">
              {selectedCategory ? (
                <span className="flex items-center gap-2">
                  <span
                    data-testid="category-color-dot"
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: selectedCategory.color || '#888' }}
                  />
                  {selectedCategory.name}
                </span>
              ) : (
                'Keine Kategorie'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Keine Kategorie</SelectItem>
            {categories?.map(category => (
              <SelectItem key={category.id} value={category.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color || '#888' }}
                  />
                  {category.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear button - only shown when category is selected */}
        {currentCategoryId && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Kategorie entfernen"
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Warning dialog (Step 5.7) */}
      <CategoryChangeWarning
        open={showWarning}
        onOpenChange={setShowWarning}
        oldCategory={selectedCategory ?? null}
        newCategory={pendingCategory}
        fieldValuesToBackup={[]} // TODO: Get from API
        fieldValuesThatPersist={[]} // TODO: Get from API
        hasBackup={false} // TODO: Get from API
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
}
