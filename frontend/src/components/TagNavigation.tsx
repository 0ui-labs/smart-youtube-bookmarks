import { useState, useCallback, useMemo } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Tag } from '@/types/tag'
import { parseUrlsFromText, parseWeblocFile, parseUrlsFromCSV } from '@/utils/urlParser'
import { FEATURE_FLAGS } from '@/config/featureFlags'

interface TagNavigationProps {
  tags: Tag[]
  selectedTagIds: string[]
  onTagSelect: (tagId: string) => void
  onTagCreate: () => void
  /** Callback when videos are dropped on a tag (Drag & Drop Import feature) */
  onVideosDropped?: (tagId: string, urls: string[]) => void
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
  onVideosDropped,
}: TagNavigationProps) => {
  // Track which tag is being dragged over (for visual feedback)
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null)

  // Mobile detection: Disable drag-drop on touch devices (Step 29)
  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  // Handle drag enter on a tag
  const handleDragEnter = useCallback((e: React.DragEvent, tagId: string) => {
    if (!FEATURE_FLAGS.DRAG_DROP_IMPORT || !onVideosDropped || isTouchDevice) return
    e.preventDefault()
    e.stopPropagation()
    setDragOverTagId(tagId)
  }, [onVideosDropped, isTouchDevice])

  // Handle drag over on a tag (required to allow drop)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!FEATURE_FLAGS.DRAG_DROP_IMPORT || !onVideosDropped || isTouchDevice) return
    e.preventDefault()
    e.stopPropagation()
  }, [onVideosDropped, isTouchDevice])

  // Handle drag leave on a tag
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!FEATURE_FLAGS.DRAG_DROP_IMPORT || !onVideosDropped || isTouchDevice) return
    e.preventDefault()
    e.stopPropagation()

    // Only clear if we're actually leaving the button (not entering a child element)
    const relatedTarget = e.relatedTarget as Node | null
    const currentTarget = e.currentTarget as Node
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverTagId(null)
    }
  }, [onVideosDropped, isTouchDevice])

  // Handle drop on a tag
  const handleDrop = useCallback(async (e: React.DragEvent, tagId: string) => {
    if (!FEATURE_FLAGS.DRAG_DROP_IMPORT || !onVideosDropped || isTouchDevice) return
    e.preventDefault()
    e.stopPropagation()
    setDragOverTagId(null)

    // 1. Check for text/URL data (browser URL drag)
    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list')
    if (text) {
      const urls = parseUrlsFromText(text)
      if (urls.length > 0) {
        onVideosDropped(tagId, urls)
        return
      }
    }

    // 2. Handle dropped files
    const files = Array.from(e.dataTransfer.files)

    // Handle .webloc files
    const weblocFiles = files.filter((f) => f.name.endsWith('.webloc'))
    if (weblocFiles.length > 0) {
      const urlPromises = weblocFiles.map(parseWeblocFile)
      const urls = (await Promise.all(urlPromises)).filter((url): url is string => url !== null)
      if (urls.length > 0) {
        onVideosDropped(tagId, urls)
      }
      return
    }

    // Handle .csv files
    const csvFiles = files.filter((f) => f.name.endsWith('.csv'))
    const csvFile = csvFiles[0]
    if (csvFile) {
      const urls = await parseUrlsFromCSV(csvFile)
      if (urls.length > 0) {
        onVideosDropped(tagId, urls)
      }
    }
  }, [onVideosDropped, isTouchDevice])

  return (
    <div className="tag-navigation p-4">
      {/* Header with title and create button */}
      <div className="flex items-center justify-between mb-4 px-3 gap-1">
        <h2 className="text-lg font-semibold">Kategorien</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onTagCreate}
          aria-label="Neue Kategorie erstellen"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Tag list */}
      <div className="space-y-1">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id)
          const isDragOver = dragOverTagId === tag.id

          return (
            <button
              key={tag.id}
              onClick={() => onTagSelect(tag.id)}
              onDragEnter={(e) => handleDragEnter(e, tag.id)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, tag.id)}
              aria-pressed={isSelected}
              aria-label={`Kategorie ${tag.name} ${isSelected ? 'abwählen' : 'auswählen'}`}
              data-testid={`tag-${tag.id}`}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                'hover:bg-accent',
                isSelected && 'bg-accent font-medium',
                isDragOver && 'ring-2 ring-primary bg-primary/10'
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
