import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Tag } from '@/types/tag'

interface TagNavigationProps {
  tags: Tag[]
  selectedTagIds: string[]
  onTagSelect: (tagId: string) => void
  onTagCreate: () => void
}

/**
 * TagNavigation Component
 *
 * Displays a list of tags with multi-select functionality.
 * Features:
 * - Visual selection state with background color
 * - Plus icon for creating new tags
 * - Full accessibility with ARIA attributes
 * - Keyboard navigation support
 *
 * @param tags - Array of tags to display
 * @param selectedTagIds - Array of currently selected tag IDs
 * @param onTagSelect - Callback when a tag is clicked (toggle selection)
 * @param onTagCreate - Callback when create tag button is clicked
 *
 * @example
 * ```tsx
 * <TagNavigation
 *   tags={tags}
 *   selectedTagIds={selectedTagIds}
 *   onTagSelect={(id) => toggleTag(id)}
 *   onTagCreate={() => openCreateDialog()}
 * />
 * ```
 */
export const TagNavigation = ({
  tags,
  selectedTagIds,
  onTagSelect,
  onTagCreate,
}: TagNavigationProps) => {
  return (
    <div className="tag-navigation p-4">
      {/* Header with title and create button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tags</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onTagCreate}
          aria-label="Neuen Tag erstellen"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Tag list */}
      <div className="space-y-1">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id)

          return (
            <button
              key={tag.id}
              onClick={() => onTagSelect(tag.id)}
              aria-pressed={isSelected}
              aria-label={`Tag ${tag.name} ${isSelected ? 'abwählen' : 'auswählen'}`}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                'hover:bg-accent',
                isSelected && 'bg-accent font-medium'
              )}
            >
              {/* Tag name */}
              <span className="flex-1 text-left">{tag.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
