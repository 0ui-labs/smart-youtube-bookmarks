import DOMPurify from "dompurify";
import { Loader2, Play, Search, X } from "lucide-react";
import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useTranscriptSearch } from "@/hooks/useTranscriptSearch";
import type { SearchResult } from "@/types/search";
import { formatDuration } from "@/utils/formatDuration";

interface TranscriptSearchProps {
  /** Optional list filter */
  listId?: string;
  /** Callback when a search result is clicked */
  onResultClick?: (result: SearchResult) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Class name for container */
  className?: string;
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
  placeholder = "Search transcripts...",
  className = "",
}: TranscriptSearchProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, isFetching } = useTranscriptSearch(debouncedQuery, {
    listId,
    enabled: debouncedQuery.length >= 2,
  });

  const showResults = debouncedQuery.length >= 2;
  const hasResults = data && data.results.length > 0;

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
        <input
          className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-10 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          type="text"
          value={query}
        />
        {query && (
          <button
            className="-translate-y-1/2 absolute top-1/2 right-3 p-1 text-gray-400 hover:text-gray-600"
            onClick={() => setQuery("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isFetching && (
          <Loader2 className="-translate-y-1/2 absolute top-1/2 right-10 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (
        <div className="absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
              <p>Searching...</p>
            </div>
          ) : hasResults ? (
            <>
              <div className="border-b px-3 py-2 text-gray-500 text-xs">
                {data.total} result{data.total !== 1 ? "s" : ""} for "
                {debouncedQuery}"
              </div>
              <div className="divide-y divide-gray-100">
                {data.results.map((result) => (
                  <SearchResultItem
                    key={result.video_id}
                    onClick={() => onResultClick?.(result)}
                    result={result}
                  />
                ))}
              </div>
              {data.total > data.results.length && (
                <div className="border-t px-3 py-2 text-center text-gray-500 text-xs">
                  Showing {data.results.length} of {data.total} results
                </div>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p>No results found for "{debouncedQuery}"</p>
              <p className="mt-1 text-xs">Try different keywords</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  onClick?: () => void;
}

function SearchResultItem({ result, onClick }: SearchResultItemProps) {
  return (
    <button
      className="flex w-full gap-3 p-3 text-left transition-colors hover:bg-gray-50"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded bg-gray-200">
        {result.thumbnail_url ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            src={result.thumbnail_url}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900 text-sm">
          {result.title || "Untitled Video"}
        </p>
        {result.channel && (
          <p className="truncate text-gray-500 text-xs">{result.channel}</p>
        )}
        <p
          className="mt-1 line-clamp-2 text-gray-600 text-xs"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              result.snippet
                .replace(/<b>/g, '<mark class="bg-yellow-200">')
                .replace(/<\/b>/g, "</mark>"),
              { ALLOWED_TAGS: ["mark"], ALLOWED_ATTR: ["class"] }
            ),
          }}
        />
      </div>

      {/* Duration */}
      {result.duration && (
        <div className="flex-shrink-0 text-gray-500 text-xs">
          {formatDuration(result.duration)}
        </div>
      )}
    </button>
  );
}

/**
 * Compact search button that opens a search modal/dialog.
 * Use for header navigation.
 */
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-gray-600 text-sm transition-colors hover:border-gray-400 hover:text-gray-900"
      onClick={onClick}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search transcripts</span>
      <kbd className="hidden items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs md:inline-flex">
        <span>⌘</span>K
      </kbd>
    </button>
  );
}
