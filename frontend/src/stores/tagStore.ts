/**
 * Tag Store - Zustand state management for tag filtering
 *
 * Manages multi-select tag filtering with OR logic.
 * Users can select multiple tags to filter videos.
 * Selected tags are persisted in localStorage.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Tag } from "@/types/tag";

/**
 * Tag store state and actions
 */
interface TagStore {
  /** All available tags from API */
  tags: Tag[];

  /** IDs of currently selected tags for filtering */
  selectedTagIds: string[];

  /** Set all available tags (populated from API) */
  setTags: (tags: Tag[]) => void;

  /** Set selected tag IDs (for URL sync) */
  setSelectedTagIds: (tagIds: string[]) => void;

  /** Toggle tag selection (add if not selected, remove if selected) */
  toggleTag: (tagId: string) => void;

  /** Clear all selected tags */
  clearTags: () => void;
}

/**
 * Tag store hook with localStorage persistence
 *
 * Persists selectedTagIds so tag filters survive page reloads.
 * Note: tags array is NOT persisted (always loaded fresh from API)
 *
 * @example
 * ```tsx
 * const { tags, selectedTagIds, toggleTag, clearTags } = useTagStore();
 * ```
 */
export const useTagStore = create<TagStore>()(
  persist(
    (set) => ({
      tags: [],
      selectedTagIds: [],

      setTags: (tags) => set({ tags }),

      setSelectedTagIds: (tagIds) => set({ selectedTagIds: tagIds }),

      toggleTag: (tagId) =>
        set((state) => ({
          selectedTagIds: state.selectedTagIds.includes(tagId)
            ? state.selectedTagIds.filter((id) => id !== tagId)
            : [...state.selectedTagIds, tagId],
        })),

      clearTags: () => set({ selectedTagIds: [] }),
    }),
    {
      name: "tag-filter-selection", // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist selectedTagIds, not the full tags array
      partialize: (state) => ({ selectedTagIds: state.selectedTagIds }),
    }
  )
);
