import { List, Play } from "lucide-react";
import { useMemo } from "react";
import { findActiveChapter, formatChapterTime } from "@/lib/enrichmentUtils";
import type { Chapter } from "@/types/enrichment";

interface ChapterListProps {
  chapters: Chapter[] | null | undefined;
  currentTime?: number;
  onChapterClick?: (chapter: Chapter) => void;
  className?: string;
}

/**
 * Displays a list of video chapters with active chapter highlighting.
 *
 * Features:
 * - Highlights the currently active chapter based on playback time
 * - Click handler to seek to chapter start time
 * - Shows chapter duration
 * - Compact or expanded layouts
 *
 * @example
 * ```tsx
 * const { data: enrichment } = useVideoEnrichment(videoId)
 *
 * <ChapterList
 *   chapters={enrichment?.chapters}
 *   currentTime={playerTime}
 *   onChapterClick={(chapter) => player.seek(chapter.start)}
 * />
 * ```
 */
export function ChapterList({
  chapters,
  currentTime = 0,
  onChapterClick,
  className = "",
}: ChapterListProps) {
  // Find the active chapter based on current playback time
  const activeChapter = useMemo(
    () => findActiveChapter(chapters, currentTime),
    [chapters, currentTime]
  );

  if (!chapters || chapters.length === 0) {
    return null;
  }

  return (
    <div className={`chapter-list ${className}`}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <List className="h-4 w-4 text-gray-500" />
        <h3 className="font-semibold text-gray-700 text-sm">
          Chapters ({chapters.length})
        </h3>
      </div>

      {/* Chapter Items */}
      <div className="space-y-1">
        {chapters.map((chapter, index) => {
          const isActive =
            activeChapter?.start === chapter.start &&
            activeChapter?.end === chapter.end;

          return (
            <ChapterItem
              chapter={chapter}
              index={index}
              isActive={isActive}
              key={`${chapter.start}-${index}`}
              onClick={onChapterClick}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ChapterItemProps {
  chapter: Chapter;
  index: number;
  isActive: boolean;
  onClick?: (chapter: Chapter) => void;
}

function ChapterItem({ chapter, index, isActive, onClick }: ChapterItemProps) {
  const duration = chapter.end - chapter.start;

  return (
    <button
      aria-current={isActive ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 ${
        isActive
          ? "border border-blue-200 bg-blue-50"
          : "border border-transparent hover:bg-gray-50"
      }
      `}
      onClick={() => onClick?.(chapter)}
    >
      {/* Chapter Number / Play Icon */}
      <div
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-medium text-xs ${isActive ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}
        `}
      >
        {isActive ? <Play className="h-3 w-3" /> : index + 1}
      </div>

      {/* Chapter Info */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${
            isActive ? "font-semibold text-blue-900" : "text-gray-900"
          }`}
        >
          {chapter.title}
        </p>
        <p className="text-gray-500 text-xs">
          {formatChapterTime(chapter.start)}
          {duration > 0 && (
            <span className="ml-2 text-gray-400">
              ({formatChapterTime(duration)})
            </span>
          )}
        </p>
      </div>
    </button>
  );
}

/**
 * Compact chapter navigation for the video player.
 * Shows only current/next chapter with prev/next buttons.
 */
export function ChapterNavigation({
  chapters,
  currentTime = 0,
  onSeek,
}: {
  chapters: Chapter[] | null | undefined;
  currentTime?: number;
  onSeek?: (time: number) => void;
}) {
  if (!chapters || chapters.length === 0) {
    return null;
  }

  const currentIndex = chapters.findIndex(
    (ch) => currentTime >= ch.start && currentTime < ch.end
  );
  const currentChapter = currentIndex >= 0 ? chapters[currentIndex] : null;
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Previous Button */}
      <button
        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
        disabled={!prevChapter}
        onClick={() => prevChapter && onSeek?.(prevChapter.start)}
        title={
          prevChapter ? `Previous: ${prevChapter.title}` : "No previous chapter"
        }
      >
        ←
      </button>

      {/* Current Chapter */}
      <span className="flex-1 truncate text-center font-medium">
        {currentChapter?.title || "No chapter"}
      </span>

      {/* Next Button */}
      <button
        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
        disabled={!nextChapter}
        onClick={() => nextChapter && onSeek?.(nextChapter.start)}
        title={nextChapter ? `Next: ${nextChapter.title}` : "No next chapter"}
      >
        →
      </button>
    </div>
  );
}
