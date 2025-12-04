import { useEffect, useState } from "react";
import { UI_STRINGS } from "@/constants/ui";
import { getOptimizedAvatarUrl } from "@/utils/avatarUrl";
import { CategoryModal } from "./CategoryModal";

interface CategoryTag {
  id: string;
  name: string;
  color?: string | null;
}

export interface ChannelInfoProps {
  channelName: string | null | undefined;
  channelAvatarUrl?: string | null;
  currentCategory: CategoryTag | null;
  onCategoryChange: (
    categoryId: string | null,
    restoreBackup?: boolean
  ) => void;
  isCategoryMutating?: boolean;
  onChannelClick?: () => void;
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
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset image error when URL changes
  useEffect(() => {
    setImageError(false);
  }, []);

  // Get initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  // Show fallback if no URL or image failed to load
  const showFallback = !channelAvatarUrl || imageError;

  return (
    <>
      <div className="flex items-start gap-3">
        {/* Channel Avatar - 46px to align with channel name + category */}
        {showFallback ? (
          <div
            className="flex flex-shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
            style={{ width: 46, height: 46 }}
          >
            <span className="font-medium text-base text-gray-600 dark:text-gray-300">
              {getInitials(channelName)}
            </span>
          </div>
        ) : (
          <img
            alt={channelName || "Channel"}
            className="flex-shrink-0 rounded-full object-cover"
            height={46}
            onError={() => setImageError(true)}
            src={
              getOptimizedAvatarUrl(channelAvatarUrl, 46) ||
              channelAvatarUrl ||
              ""
            }
            width={46}
          />
        )}

        {/* Channel Name & Category */}
        <div className="flex min-w-0 flex-col">
          {/* Channel Name */}
          {channelName && (
            <button
              className="truncate text-left font-medium text-base text-gray-900 hover:text-gray-700 dark:text-gray-100 dark:hover:text-gray-300"
              onClick={onChannelClick}
            >
              {channelName}
            </button>
          )}

          {/* Category (clickable to open modal) */}
          <button
            className="mt-0.5 flex items-center gap-1.5 text-left text-gray-500 text-sm hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={() => setCategoryModalOpen(true)}
          >
            {currentCategory ? (
              <>
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{
                    backgroundColor: currentCategory.color || "#6b7280",
                  }}
                />
                <span>{currentCategory.name}</span>
              </>
            ) : (
              <span className="italic">
                {UI_STRINGS.channel.chooseCategory}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Category Selection Modal */}
      <CategoryModal
        currentCategoryId={currentCategory?.id ?? null}
        isMutating={isCategoryMutating}
        onCategoryChange={onCategoryChange}
        onOpenChange={setCategoryModalOpen}
        open={categoryModalOpen}
      />
    </>
  );
}
