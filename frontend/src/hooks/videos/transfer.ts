import { api } from "@/lib/api";
import type { VideoSelectionRequest } from "./selection";

export const exportVideosCSV = async (
  listId: string,
  selection?: VideoSelectionRequest
) => {
  const response = selection
    ? await api.post<Blob>(`/lists/${listId}/export/csv`, selection, {
        responseType: "blob",
      })
    : await api.get<Blob>(`/lists/${listId}/export/csv`, {
        responseType: "blob",
      });

  // Validate response is actually a Blob
  if (!(response.data instanceof Blob)) {
    throw new Error(
      "Invalid response type: Expected Blob but received " +
        typeof response.data
    );
  }

  // Create download link
  const blob = new Blob([response.data], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `videos_${listId}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const parseValidationError = (error: any): string => {
  if (error.response?.status === 422) {
    const detail = error.response.data?.detail;

    if (detail?.errors && Array.isArray(detail.errors)) {
      return detail.errors[0]?.error || "Validierungsfehler";
    }

    if (detail?.message) {
      return detail.message;
    }
  }

  return "Fehler beim Speichern. Bitte versuchen Sie es erneut.";
};
