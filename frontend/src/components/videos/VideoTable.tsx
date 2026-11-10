import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type React from "react";
import { useMemo, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTableSettingsStore } from "@/stores/tableSettingsStore";
import type { VideoResponse } from "@/types/video";
import { formatDuration } from "@/utils/formatDuration";
import { VideoThumbnail } from "./VideoThumbnail";

// Note: VideoResponse type has optional field_values, but TanStack Table needs explicit type
// Using Partial to handle cases where backend doesn't return all fields in list view
type VideoListItem = Omit<
  VideoResponse,
  "field_values" | "available_fields"
> & {
  field_values?: VideoResponse["field_values"];
  available_fields?: VideoResponse["available_fields"];
};

const columnHelper = createColumnHelper<VideoListItem>();

interface Props {
  videos: VideoResponse[];
  sortBy?: string;
  sortOrder: "asc" | "desc";
  handleSortChange: (column: string, order: "asc" | "desc") => void;
  handleClearSort: () => void;
  onDeleteVideo: (video: VideoResponse) => void;
  onVideoClick: (video: VideoResponse) => void;
}
export function VideoTable({
  videos,
  sortBy,
  sortOrder,
  handleSortChange,
  handleClearSort,
  onDeleteVideo,
  onVideoClick,
}: Props) {
  // Get column visibility settings from store
  const visibleColumns = useTableSettingsStore((state) => state.visibleColumns);

  const deleteHandler = useRef(onDeleteVideo);
  deleteHandler.current = onDeleteVideo;
  const columns = useMemo(() => {
    const allColumns = [
      // Column 1: Thumbnail (with Aspect Ratio + Loading State)
      columnHelper.accessor("thumbnail_url", {
        id: "thumbnail",
        header: "Vorschau",
        enableSorting: false, // TASK 5: Disable sorting on thumbnail
        cell: (info) => {
          const thumbnailUrl = info.getValue();
          const row = info.row.original;
          const title = row.title || `Video ${row.youtube_id}`;

          return (
            <VideoThumbnail
              fallbackUrl={thumbnailUrl}
              title={title}
              youtubeId={row.youtube_id}
            />
          );
        },
      }),

      // Column 2: Title + Channel
      columnHelper.accessor("title", {
        id: "title",
        header: ({ column }) => (
          <button
            className="flex items-center gap-2 transition-colors hover:text-blue-600"
            onClick={column.getToggleSortingHandler()}
          >
            Titel
            {column.getIsSorted() && (
              <span
                aria-label={
                  column.getIsSorted() === "asc"
                    ? "Aufsteigend sortiert"
                    : "Absteigend sortiert"
                }
                role="img"
              >
                {column.getIsSorted() === "asc" ? "↑" : "↓"}
              </span>
            )}
          </button>
        ),
        enableSorting: true, // TASK 5: Enable sorting on title
        cell: (info) => {
          const row = info.row.original;
          const title = info.getValue() || `Video ${row.youtube_id}`;
          const channel = row.channel;

          return (
            <div className="flex min-w-[200px] max-w-[400px] flex-col gap-1">
              <span
                className="line-clamp-2 font-medium text-gray-900 leading-tight dark:text-gray-100"
                title={title}
              >
                {title}
              </span>
              {channel && (
                <span className="truncate text-gray-600 text-sm dark:text-gray-400">
                  {channel}
                </span>
              )}
            </div>
          );
        },
      }),

      // Column 3: Duration
      columnHelper.accessor("duration", {
        id: "duration",
        header: ({ column }) => (
          <button
            className="flex items-center gap-2 transition-colors hover:text-blue-600"
            onClick={column.getToggleSortingHandler()}
          >
            Dauer
            {column.getIsSorted() && (
              <span
                aria-label={
                  column.getIsSorted() === "asc"
                    ? "Aufsteigend sortiert"
                    : "Absteigend sortiert"
                }
                role="img"
              >
                {column.getIsSorted() === "asc" ? "↑" : "↓"}
              </span>
            )}
          </button>
        ),
        enableSorting: true, // TASK 5: Enable sorting on duration
        cell: (info) => {
          const duration = info.getValue();
          return (
            <span className="font-mono text-gray-700 text-sm tabular-nums dark:text-gray-300">
              {formatDuration(duration)}
            </span>
          );
        },
      }),

      // Column 4: Three-dot menu
      columnHelper.accessor("id", {
        id: "menu",
        header: "", // No header text - just icon column
        cell: (info) => (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label="Aktionen"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                }
              }}
              tabIndex={-1}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  const row = info.row.original;
                  // REF MCP #3: Smart video title with fallback chain

                  deleteHandler.current(row as VideoResponse);
                }}
              >
                <svg
                  aria-hidden="true"
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ];

    // Filter columns based on visibility settings
    return allColumns.filter((column) => {
      const columnId = column.id as "thumbnail" | "title" | "duration" | "menu";

      // Map 'menu' column id to 'actions' in store
      if (columnId === "menu") {
        return visibleColumns.actions;
      }

      return visibleColumns[columnId];
    });
  }, [visibleColumns]);

  // TASK 5: Configure TanStack Table with manual sorting
  const table = useReactTable({
    data: videos as VideoListItem[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    sortDescFirst: false,
    manualSorting: true, // Backend handles sorting
    state: {
      sorting: sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : [],
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function"
          ? updater(sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : [])
          : updater;

      if (newSorting.length > 0) {
        const sort = newSorting[0];
        if (sort) {
          handleSortChange(sort.id, sort.desc ? "desc" : "asc");
        }
      } else {
        handleClearSort();
      }
    },
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  className="px-6 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
                  key={header.id}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {table.getRowModel().rows.map((row) => {
            const video = row.original;

            const handleRowClick = () => onVideoClick(video as VideoResponse);

            const handleKeyDown = (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRowClick();
              }
            };

            return (
              <tr
                className="cursor-pointer transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                key={row.id}
                onClick={handleRowClick}
                onKeyDown={handleKeyDown}
                role="button"
                tabIndex={0}
              >
                {row.getVisibleCells().map((cell) => (
                  <td className="px-6 py-4" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
