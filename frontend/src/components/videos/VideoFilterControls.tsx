import React from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { ViewMode } from "@/stores/tableSettingsStore";
import { TableSettingsDropdown } from "../TableSettingsDropdown";
import { ViewModeToggle } from "../ViewModeToggle";
import { FilterBar } from "./FilterBar";
import { FilterSettingsModal } from "./FilterSettingsModal";

// Tag Carousel Component with conditional arrow display
const TagCarousel = () => {
  const dummyTags = [
    "Python",
    "JavaScript",
    "React",
    "Machine Learning",
    "Web Development",
    "Tutorial",
    "Backend",
    "Database",
    "API",
    "DevOps",
    "Security",
    "Testing",
  ];
  const [api, setApi] = React.useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  React.useEffect(() => {
    if (!api) return;

    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    updateScrollState();
    api.on("select", updateScrollState);
    api.on("reInit", updateScrollState);

    return () => {
      api.off("select", updateScrollState);
      api.off("reInit", updateScrollState);
    };
  }, [api]);

  return (
    <Carousel
      className="w-full max-w-[calc(100vw-400px)]"
      opts={{
        align: "start",
        slidesToScroll: 3,
      }}
      setApi={setApi}
    >
      <div className="flex items-center gap-2">
        {canScrollPrev && (
          <CarouselPrevious className="static h-8 w-8 flex-shrink-0 translate-y-0" />
        )}
        <CarouselContent className="-ml-2">
          {dummyTags.map((tag) => (
            <CarouselItem className="basis-auto pl-2" key={tag}>
              <button className="whitespace-nowrap rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground text-sm transition-colors hover:bg-accent">
                {tag}
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {canScrollNext && (
          <CarouselNext className="static h-8 w-8 flex-shrink-0 translate-y-0" />
        )}
      </div>
    </Carousel>
  );
};

export function VideoFilterControls({
  listId,
  selectedTagIds,
  viewMode,
  setViewMode,
}: {
  listId: string;
  selectedTagIds: string[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}) {
  return (
    <>
      {/* Filter and View Controls Bar - Hidden on mobile */}
      <div className="mb-6 hidden items-center gap-4 md:flex">
        {/* Left side - Tag filters with carousel */}
        <div className="min-w-0 flex-1">
          <TagCarousel />
        </div>

        {/* Right side - View controls */}
        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          {/* Filter Settings Modal - Field-based filters */}
          <FilterSettingsModal
            listId={listId}
            selectedTagIds={selectedTagIds}
          />
          {/* View Mode Toggle - Task #32 */}
          <ViewModeToggle onToggle={setViewMode} viewMode={viewMode} />
          {/* Table Settings Dropdown - Task #35 */}
          <TableSettingsDropdown />
        </div>
      </div>

      {/* Field-Based Filter Bar - Task #145 */}
      <FilterBar listId={listId} />
    </>
  );
}
