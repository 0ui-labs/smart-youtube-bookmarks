import { useState } from 'react'
import { useBulkUploadVideos, type BulkUploadResponse } from '@/hooks/useVideos'

interface CSVUploadProps {
  listId: string
  onCancel: () => void
  onSuccess: () => void
}

export const CSVUpload = ({ listId, onCancel, onSuccess }: CSVUploadProps) => {
  const [file, setFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null)
  const bulkUpload = useBulkUploadVideos(listId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.csv')) {
        alert('Bitte wählen Sie eine CSV-Datei aus')
        return
      }
      setFile(selectedFile)
      setUploadResult(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      alert('Bitte wählen Sie eine Datei aus')
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
    } catch (error: any) {
      if (error.response?.status === 422) {
        alert('Ungültige CSV-Datei. Bitte überprüfen Sie das Format.')
      } else {
        alert('Fehler beim Hochladen der Datei. Bitte versuchen Sie es erneut.')
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
