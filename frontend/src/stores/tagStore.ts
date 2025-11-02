/**
 * Tag Store - Zustand state management for tag filtering
 *
 * Manages multi-select tag filtering with OR logic.
 * Users can select multiple tags to filter videos.
 */
import { create } from 'zustand';
import type { Tag } from '@/types/tag';

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

  /** Toggle tag selection (add if not selected, remove if selected) */
  toggleTag: (tagId: string) => void;

  /** Clear all selected tags */
  clearTags: () => void;
}

/**
 * Tag store hook
 *
 * @example
 * ```tsx
 * const { tags, selectedTagIds, toggleTag, clearTags } = useTagStore();
 * ```
 */
export const useTagStore = create<TagStore>((set) => ({
  tags: [],
  selectedTagIds: [],

  setTags: (tags) => set({ tags }),

  toggleTag: (tagId) =>
    set((state) => ({
      selectedTagIds: state.selectedTagIds.includes(tagId)
        ? state.selectedTagIds.filter((id) => id !== tagId)
        : [...state.selectedTagIds, tagId],
    })),

  clearTags: () => set({ selectedTagIds: [] }),
}));
