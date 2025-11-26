import { useState, useEffect } from 'react'
import { CategoryModal } from './CategoryModal'

interface CategoryTag {
  id: string
  name: string
  color?: string | null
}

export interface ChannelInfoProps {
  channelName: string | null | undefined
  channelAvatarUrl?: string | null
  currentCategory: CategoryTag | null
  onCategoryChange: (categoryId: string | null, restoreBackup?: boolean) => void
  isCategoryMutating?: boolean
  onChannelClick?: () => void
}

/**
 * YouTube-style channel info display with avatar, name, and category.
 *
 * Layout:
 * [Avatar] Channel Name
 *          Category (clickable)
 */
export function ChannelInfo({
  channelName,
  channelAvatarUrl,
  currentCategory,
  onCategoryChange,
  isCategoryMutating = false,
  onChannelClick,
}: ChannelInfoProps) {
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Reset image error when URL changes
  useEffect(() => {
    setImageError(false)
  }, [channelAvatarUrl])

  // Get initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?'
    return name.charAt(0).toUpperCase()
  }

  // Show fallback if no URL or image failed to load
  const showFallback = !channelAvatarUrl || imageError

  return (
    <>
      <div className="flex items-start gap-3">
        {/* Channel Avatar - 46px to align with channel name + category */}
        {!showFallback ? (
          <img
            src={channelAvatarUrl!}
            alt={channelName || 'Channel'}
            className="rounded-full object-cover flex-shrink-0"
            style={{ width: 46, height: 46 }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className="rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"
            style={{ width: 46, height: 46 }}
          >
            <span className="text-gray-600 font-medium text-base">
              {getInitials(channelName)}
            </span>
          </div>
        )}

        {/* Channel Name & Category */}
        <div className="flex flex-col min-w-0">
          {/* Channel Name */}
          {channelName && (
            <button
              onClick={onChannelClick}
              className="text-base font-medium text-gray-900 hover:text-gray-700 text-left truncate"
            >
              {channelName}
            </button>
          )}

          {/* Category (clickable to open modal) */}
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="text-sm text-gray-500 hover:text-gray-700 text-left flex items-center gap-1.5 mt-0.5"
          >
            {currentCategory ? (
              <>
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: currentCategory.color || '#6b7280' }}
                />
                <span>{currentCategory.name}</span>
              </>
            ) : (
              <span className="italic">Kategorie wählen</span>
            )}
          </button>
        </div>
      </div>

      {/* Category Selection Modal */}
      <CategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        currentCategoryId={currentCategory?.id ?? null}
        onCategoryChange={onCategoryChange}
        isMutating={isCategoryMutating}
      />
    </>
  )
}
