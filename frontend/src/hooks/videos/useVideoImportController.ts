import { useCallback, useEffect, useState } from "react";
import type { ParsedDropData } from "@/hooks/useVideoDropZone";
import { useAssignTags, useBulkUploadVideos } from "@/hooks/useVideos";
import { useImportDropStore } from "@/stores/importDropStore";
import { createCSVFromUrls } from "@/utils/urlParser";
export function useVideoImportController(
  listId: string,
  setPendingVideoIds: (ids: string[]) => void
) {
  const bulkUpload = useBulkUploadVideos(listId);
  const assignTags = useAssignTags();
  // Drag & Drop Import state (Steps 19-23)
  const [importPreviewModal, setImportPreviewModal] = useState<{
    open: boolean;
    urls: string[];
  }>({
    open: false,
    urls: [],
  });

  // Drag & Drop handler: called when videos are detected
  const handleVideosDetected = useCallback((data: ParsedDropData) => {
    if (data.urls.length === 0) {
      return;
    }

    // Open import preview modal with detected URLs
    setImportPreviewModal({
      open: true,
      urls: data.urls,
    });
  }, []);

  // Drag & Drop handler: called when import is confirmed
  const handleImportConfirm = useCallback(
    async (urls: string[], categoryId?: string) => {
      try {
        // Close modal first
        setImportPreviewModal({ open: false, urls: [] });

        if (urls.length === 0) {
          return;
        }

        // Create CSV blob from URLs
        const csvBlob = createCSVFromUrls(urls);
        const csvFile = new File([csvBlob], "import.csv", { type: "text/csv" });

        // Upload via bulk upload API
        const result = await bulkUpload.mutateAsync(csvFile);

        // Start polling for real-time updates after successful import
        if (result.created_video_ids.length > 0) {
          console.log(
            "[Import] Starting polling for",
            result.created_video_ids.length,
            "videos:",
            result.created_video_ids
          );
          setPendingVideoIds(result.created_video_ids);
        }

        // If category was selected, assign it to all imported videos
        if (categoryId && result.created_video_ids.length > 0) {
          await Promise.all(
            result.created_video_ids.map((videoId) =>
              assignTags.mutateAsync({ videoId, tagIds: [categoryId] })
            )
          );
        }
      } catch (error) {
        console.error("Failed to import videos:", error);
        // TODO: Add toast notification for error
      }
    },
    [bulkUpload, assignTags, setPendingVideoIds]
  );

  // Listen for pending imports from TagNavigation drops
  const pendingImport = useImportDropStore((state) => state.pendingImport);
  const clearPendingImport = useImportDropStore(
    (state) => state.clearPendingImport
  );

  // Handle pending imports from TagNavigation drops
  useEffect(() => {
    if (pendingImport) {
      // If category was preselected (dropped on a tag), auto-import without modal
      if (pendingImport.preselectedCategoryId) {
        handleImportConfirm(
          pendingImport.urls,
          pendingImport.preselectedCategoryId
        );
        clearPendingImport();
      } else {
        // No category preselected - show modal for selection
        setImportPreviewModal({
          open: true,
          urls: pendingImport.urls,
        });
      }
    }
  }, [pendingImport, handleImportConfirm, clearPendingImport]);

  return {
    importPreviewModal,
    setImportPreviewModal,
    handleVideosDetected,
    handleImportConfirm,
    pendingImport,
    clearPendingImport,
    assignTags,
  };
}
