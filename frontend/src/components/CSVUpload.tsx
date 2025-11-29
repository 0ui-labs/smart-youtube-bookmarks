import axios from "axios";
import { useState } from "react";
import {
  type BulkUploadResponse,
  useBulkUploadVideos,
} from "@/hooks/useVideos";

interface CSVUploadProps {
  listId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * CSV Upload Component for bulk importing YouTube videos
 *
 * Allows users to upload a CSV file containing YouTube URLs to add multiple
 * videos to a list at once. Validates file format, size, and MIME type before
 * upload. Displays detailed success/failure information after processing.
 *
 * @example
 * ```tsx
 * <CSVUpload
 *   listId="123e4567-e89b-12d3-a456-426614174000"
 *   onCancel={() => setShowUpload(false)}
 *   onSuccess={() => {
 *     setShowUpload(false)
 *     toast.success('Videos uploaded')
 *   }}
 * />
 * ```
 */

export const CSVUpload = ({ listId, onCancel, onSuccess }: CSVUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const bulkUpload = useBulkUploadVideos(listId);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
  const VALID_MIME_TYPES = ["text/csv", "application/vnd.ms-excel"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setUploadResult(null);

    if (selectedFile) {
      // Validate file extension
      if (!selectedFile.name.endsWith(".csv")) {
        setError("Bitte wählen Sie eine CSV-Datei aus");
        return;
      }

      // Validate MIME type
      if (!VALID_MIME_TYPES.includes(selectedFile.type)) {
        setError("Ungültiger Dateityp. Nur CSV-Dateien sind erlaubt.");
        return;
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError("Datei ist zu groß. Maximale Größe: 10MB");
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Bitte wählen Sie eine Datei aus");
      return;
    }

    try {
      const result = await bulkUpload.mutateAsync(file);
      setUploadResult(result);

      // If all succeeded, close form
      if (result.failed_count === 0) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      // Type assertion for axios error structure
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 422) {
          // Display server validation error if available
          const detail = err.response?.data?.detail;
          setError(
            typeof detail === "string"
              ? detail
              : "Ungültige CSV-Datei. Bitte überprüfen Sie das Format."
          );
        } else {
          // Display server error message if available, fallback to generic
          const detail = err.response?.data?.detail;
          setError(
            typeof detail === "string"
              ? detail
              : "Fehler beim Hochladen der Datei. Bitte versuchen Sie es erneut."
          );
        }
      } else {
        // Non-axios error
        setError("Ein unerwarteter Fehler ist aufgetreten.");
      }
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-lg">CSV-Datei hochladen</h2>

      <form className="space-y-4" onSubmit={handleUpload}>
        <div>
          <label
            className="mb-1 block font-medium text-gray-700 text-sm"
            htmlFor="csv-file"
          >
            CSV-Datei auswählen
          </label>
          <input
            accept=".csv"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            id="csv-file"
            onChange={handleFileChange}
            type="file"
          />
          <p className="mt-1 text-gray-500 text-sm">
            Format: Eine Spalte "url" mit YouTube-URLs (eine pro Zeile)
          </p>
          <p className="mt-1 text-gray-400 text-xs">
            Beispiel: https://www.youtube.com/watch?v=VIDEO_ID
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {uploadResult && (
          <div
            className={`rounded-lg p-4 ${
              uploadResult.failed_count === 0
                ? "border border-green-200 bg-green-50"
                : "border border-yellow-200 bg-yellow-50"
            }`}
          >
            <p className="mb-2 font-semibold">
              {uploadResult.created_count} Video
              {uploadResult.created_count !== 1 ? "s" : ""} erfolgreich
              hinzugefügt
            </p>
            {uploadResult.failed_count > 0 && (
              <>
                <p className="mb-2 text-sm text-yellow-800">
                  {uploadResult.failed_count} Fehler:
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-yellow-700">
                  {uploadResult.failures.map((failure, idx) => (
                    <li key={idx}>
                      Zeile {failure.row}: {failure.error} ({failure.url})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:bg-gray-400"
            disabled={!file || bulkUpload.isPending}
            type="submit"
          >
            {bulkUpload.isPending ? "Wird hochgeladen..." : "Hochladen"}
          </button>
          <button
            className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400"
            onClick={onCancel}
            type="button"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
};
