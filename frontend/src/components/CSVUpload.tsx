import { useState } from 'react'
import { useBulkUploadVideos, type BulkUploadResponse } from '@/hooks/useVideos'
import axios from 'axios'

interface CSVUploadProps {
  listId: string
  onCancel: () => void
  onSuccess: () => void
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
  const [file, setFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bulkUpload = useBulkUploadVideos(listId)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes
  const VALID_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel']

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError(null)
    setUploadResult(null)

    if (selectedFile) {
      // Validate file extension
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Bitte wählen Sie eine CSV-Datei aus')
        return
      }

      // Validate MIME type
      if (!VALID_MIME_TYPES.includes(selectedFile.type)) {
        setError('Ungültiger Dateityp. Nur CSV-Dateien sind erlaubt.')
        return
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError('Datei ist zu groß. Maximale Größe: 10MB')
        return
      }

      setFile(selectedFile)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError('Bitte wählen Sie eine Datei aus')
      return
    }

    try {
      const result = await bulkUpload.mutateAsync(file)
      setUploadResult(result)

      // If all succeeded, close form
      if (result.failed_count === 0) {
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }
    } catch (err) {
      // Type assertion for axios error structure
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 422) {
          // Display server validation error if available
          const detail = err.response?.data?.detail
          setError(
            typeof detail === 'string'
              ? detail
              : 'Ungültige CSV-Datei. Bitte überprüfen Sie das Format.'
          )
        } else {
          // Display server error message if available, fallback to generic
          const detail = err.response?.data?.detail
          setError(
            typeof detail === 'string'
              ? detail
              : 'Fehler beim Hochladen der Datei. Bitte versuchen Sie es erneut.'
          )
        }
      } else {
        // Non-axios error
        setError('Ein unerwarteter Fehler ist aufgetreten.')
      }
    }
  }

  return (
    <div className="mb-6 p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
      <h2 className="text-lg font-semibold mb-4">CSV-Datei hochladen</h2>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label
            htmlFor="csv-file"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            CSV-Datei auswählen
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Format: Eine Spalte "url" mit YouTube-URLs (eine pro Zeile)
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Beispiel: https://www.youtube.com/watch?v=VIDEO_ID
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {uploadResult && (
          <div className={`p-4 rounded-lg ${
            uploadResult.failed_count === 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <p className="font-semibold mb-2">
              {uploadResult.created_count} Video{uploadResult.created_count !== 1 ? 's' : ''} erfolgreich hinzugefügt
            </p>
            {uploadResult.failed_count > 0 && (
              <>
                <p className="text-sm text-yellow-800 mb-2">
                  {uploadResult.failed_count} Fehler:
                </p>
                <ul className="text-sm text-yellow-700 space-y-1 max-h-40 overflow-y-auto">
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
            type="submit"
            disabled={!file || bulkUpload.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {bulkUpload.isPending ? 'Wird hochgeladen...' : 'Hochladen'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}
