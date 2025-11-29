import { create } from "zustand";

interface PendingImport {
  urls: string[];
  preselectedCategoryId?: string;
}

interface ImportDropStore {
  pendingImport: PendingImport | null;
  setPendingImport: (urls: string[], categoryId?: string) => void;
  clearPendingImport: () => void;
}

/**
 * Store for managing drag & drop imports from TagNavigation
 *
 * When videos are dropped on a tag in the sidebar, the URLs are stored here
 * along with the preselected category ID. VideosPage listens to this store
 * and opens the ImportPreviewModal when there's a pending import.
 */
export const useImportDropStore = create<ImportDropStore>((set) => ({
  pendingImport: null,

  setPendingImport: (urls, categoryId) => {
    set({ pendingImport: { urls, preselectedCategoryId: categoryId } });
  },

  clearPendingImport: () => {
    set({ pendingImport: null });
  },
}));
