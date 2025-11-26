import { useState } from 'react'
import { Search, X, Loader2, Play } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranscriptSearch } from '@/hooks/useTranscriptSearch'
import { formatDuration } from '@/utils/formatDuration'
import type { SearchResult } from '@/types/search'

interface TranscriptSearchProps {
  /** Optional list filter */
  listId?: string
  /** Callback when a search result is clicked */
  onResultClick?: (result: SearchResult) => void
  /** Placeholder text */
  placeholder?: string
  /** Class name for container */
  className?: string
}

/**
 * Transcript search component with debounced input and results list.
 *
 * Features:
 * - Debounced search input (300ms)
 * - Results with video thumbnail, title, and snippet
 * - Click to navigate to video
 * - Loading and empty states
 *
 * @example
 * ```tsx
 * <TranscriptSearch
 *   listId={currentListId}
 *   onResultClick={(result) => {
 *     navigate(`/lists/${result.list_id}/videos/${result.video_id}`)
 *   }}
 * />
 * ```
 */
export function TranscriptSearch({
  listId,
  onResultClick,
  placeholder = 'Search transcripts...',
  className = '',
}: TranscriptSearchProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const { data, isLoading, isFetching } = useTranscriptSearch(debouncedQuery, {
    listId,
    enabled: debouncedQuery.length >= 2,
  })

  const showResults = debouncedQuery.length >= 2
  const hasResults = data && data.results.length > 0

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isFetching && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Searching...</p>
            </div>
          ) : hasResults ? (
            <>
              <div className="px-3 py-2 text-xs text-gray-500 border-b">
                {data.total} result{data.total !== 1 ? 's' : ''} for "{debouncedQuery}"
              </div>
              <div className="divide-y divide-gray-100">
                {data.results.map((result) => (
                  <SearchResultItem
                    key={result.video_id}
                    result={result}
                    onClick={() => onResultClick?.(result)}
                  />
                ))}
              </div>
              {data.total > data.results.length && (
                <div className="px-3 py-2 text-xs text-gray-500 border-t text-center">
                  Showing {data.results.length} of {data.total} results
                </div>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p>No results found for "{debouncedQuery}"</p>
              <p className="text-xs mt-1">Try different keywords</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface SearchResultItemProps {
  result: SearchResult
  onClick?: () => void
}

function SearchResultItem({ result, onClick }: SearchResultItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 p-3 hover:bg-gray-50 text-left transition-colors"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-20 h-12 rounded overflow-hidden bg-gray-200">
        {result.thumbnail_url ? (
          <img
            src={result.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">
          {result.title || 'Untitled Video'}
        </p>
        {result.channel && (
          <p className="text-xs text-gray-500 truncate">{result.channel}</p>
        )}
        <p
          className="text-xs text-gray-600 mt-1 line-clamp-2"
          dangerouslySetInnerHTML={{
            __html: result.snippet
              .replace(/<b>/g, '<mark class="bg-yellow-200">')
              .replace(/<\/b>/g, '</mark>'),
          }}
        />
      </div>

      {/* Duration */}
      {result.duration && (
        <div className="flex-shrink-0 text-xs text-gray-500">
          {formatDuration(result.duration)}
        </div>
      )}
    </button>
  )
}

/**
 * Compact search button that opens a search modal/dialog.
 * Use for header navigation.
 */
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search transcripts</span>
      <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-gray-100 rounded">
        <span>⌘</span>K
      </kbd>
    </button>
  )
}
