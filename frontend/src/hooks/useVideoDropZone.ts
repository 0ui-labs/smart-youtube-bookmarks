import { useCallback } from 'react'
import { useDropzone, DropEvent } from 'react-dropzone'
import {
  parseUrlsFromText,
  parseWeblocFile,
  parseUrlsFromCSV,
} from '@/utils/urlParser'

/**
 * Parsed data from a drop event
 */
export interface ParsedDropData {
  type: 'youtube-urls' | 'webloc-files' | 'csv-file'
  urls: string[]
  file?: File
}

export interface UseVideoDropZoneOptions {
  onVideosDetected: (data: ParsedDropData) => void
  disabled?: boolean
}

export interface UseVideoDropZoneResult {
  isDragging: boolean
  getRootProps: ReturnType<typeof useDropzone>['getRootProps']
  getInputProps: ReturnType<typeof useDropzone>['getInputProps']
}

/**
 * Hook for handling video drag & drop imports
 *
 * Supports:
 * - YouTube URLs from browser (text/plain)
 * - .webloc files (macOS Safari bookmarks)
 * - .csv files with URL column
 */
export const useVideoDropZone = (
  options: UseVideoDropZoneOptions
): UseVideoDropZoneResult => {
  const { onVideosDetected, disabled } = options

  const onDrop = useCallback(
    async (acceptedFiles: File[], _rejectedFiles: unknown, event?: DropEvent) => {
      // 1. Handle .webloc files (prioritize files over text data)
      // When dragging webloc files, macOS includes text/plain which would cause early return
      const weblocFiles = acceptedFiles.filter((f) => f.name.endsWith('.webloc'))
      if (weblocFiles.length > 0) {
        const urls = await Promise.all(weblocFiles.map(parseWeblocFile))
        const validUrls = urls.filter((url): url is string => url !== null)
        if (validUrls.length > 0) {
          onVideosDetected({ type: 'webloc-files', urls: validUrls })
        }
        return
      }

      // 2. Handle .csv files
      const csvFiles = acceptedFiles.filter((f) => f.name.endsWith('.csv'))
      const csvFile = csvFiles[0]
      if (csvFile) {
        const urls = await parseUrlsFromCSV(csvFile)
        if (urls.length > 0) {
          onVideosDetected({ type: 'csv-file', urls, file: csvFile })
        }
        return
      }

      // 3. Check for text/URL data (browser URL drag - only if no files)
      if (event && 'dataTransfer' in event && event.dataTransfer) {
        const text =
          event.dataTransfer.getData('text/plain') ||
          event.dataTransfer.getData('text/uri-list')

        if (text) {
          const urls = parseUrlsFromText(text)
          if (urls.length > 0) {
            onVideosDetected({ type: 'youtube-urls', urls })
            return
          }
        }
      }
    },
    [onVideosDetected]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    disabled,
  })

  return {
    isDragging: isDragActive,
    getRootProps,
    getInputProps,
  }
}
