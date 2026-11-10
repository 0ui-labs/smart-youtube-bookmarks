import type React from "react";
import { useEffect, useState } from "react";
import { useTableSettingsStore } from "@/stores/tableSettingsStore";
import {
  calculateThumbnailWidth,
  getBestQualityForVideo,
  getQualityForWidth,
  getThumbnailUrlsForQuality,
  setCachedQuality,
  type ThumbnailQuality,
} from "@/utils/thumbnailUrl";

export const VideoThumbnail = ({
  youtubeId,
  fallbackUrl,
  title,
  useFullWidth = false,
}: {
  youtubeId: string;
  fallbackUrl?: string | null;
  title: string;
  useFullWidth?: boolean;
}) => {
  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize);
  const viewMode = useTableSettingsStore((state) => state.viewMode);
  const gridColumns = useTableSettingsStore((state) => state.gridColumns);

  // Calculate target width and initial quality (considering cache)
  const targetWidth = calculateThumbnailWidth(
    useFullWidth ? "grid" : viewMode,
    thumbnailSize,
    gridColumns as 2 | 3 | 4 | 5
  );
  // Use cached quality if available, otherwise use optimal quality for view size
  const initialQuality = getBestQualityForVideo(youtubeId, targetWidth);

  const [currentQuality, setCurrentQuality] =
    useState<ThumbnailQuality>(initialQuality);
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);

  // Reset when dependencies change (e.g., switching views)
  useEffect(() => {
    setCurrentQuality(getBestQualityForVideo(youtubeId, targetWidth));
    setUseFallbackUrl(false);
  }, [youtubeId, targetWidth]);

  // Get next fallback quality (maxres → sd → hq)
  const getNextQuality = (
    quality: ThumbnailQuality
  ): ThumbnailQuality | null => {
    switch (quality) {
      case "maxres":
        return "sd";
      case "sd":
        return "hq";
      default:
        return null; // hq, mq, default are guaranteed
    }
  };

  // Handle image load - check if it's a placeholder and fallback if needed
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth } = e.currentTarget;
    const expectedWidth = {
      maxres: 1280,
      sd: 640,
      hq: 480,
      mq: 320,
      default: 120,
    }[currentQuality];

    // If image is too small, it's YouTube's gray placeholder - fallback to next quality
    if (naturalWidth < expectedWidth * 0.5) {
      const nextQuality = getNextQuality(currentQuality);
      if (nextQuality) {
        setCurrentQuality(nextQuality);
      } else {
        // All qualities failed, use fallbackUrl
        setCachedQuality(youtubeId, "hq");
        setUseFallbackUrl(true);
      }
      return;
    }

    // Image loaded successfully - cache this quality if we had to fall back
    const optimalQuality = getQualityForWidth(targetWidth);
    if (currentQuality !== optimalQuality) {
      setCachedQuality(youtubeId, currentQuality);
    }
  };

  // REF MCP Improvement #3: Full class strings for Tailwind PurgeCSS
  // Object mapping ensures all classes are detected at build time (no dynamic concatenation)
  // xlarge uses w-[500px] for YouTube's standard list view thumbnail size (500x280)
  // Task #35 Fix: List mode uses thumbnailSize, Grid mode uses w-full (container-adapted)
  const sizeClasses = {
    small: "w-32 aspect-video object-cover rounded shadow-sm",
    medium: "w-40 aspect-video object-cover rounded shadow-sm",
    large: "w-48 aspect-video object-cover rounded shadow-sm",
    xlarge: "w-[500px] aspect-video object-cover rounded shadow-sm",
  } as const;

  const placeholderSizeClasses = {
    small:
      "w-32 aspect-video bg-gray-100 rounded flex items-center justify-center",
    medium:
      "w-40 aspect-video bg-gray-100 rounded flex items-center justify-center",
    large:
      "w-48 aspect-video bg-gray-100 rounded flex items-center justify-center",
    xlarge:
      "w-[500px] aspect-video bg-gray-100 rounded flex items-center justify-center",
  } as const;

  // Task #35 Fix: Grid mode uses w-full for container-adapted sizing
  const fullWidthClasses = "w-full aspect-video object-cover rounded shadow-sm";
  const fullWidthPlaceholderClasses =
    "w-full aspect-video bg-gray-100 rounded flex items-center justify-center";

  // Generate URLs for current quality
  const urls = getThumbnailUrlsForQuality(youtubeId, currentQuality);

  // Placeholder class based on size
  const placeholderClass = useFullWidth
    ? fullWidthPlaceholderClasses
    : placeholderSizeClasses[thumbnailSize];

  // Fallback to fallbackUrl or placeholder if primary fails
  if (useFallbackUrl) {
    if (fallbackUrl) {
      return (
        <img
          alt={title}
          className={
            useFullWidth ? fullWidthClasses : sizeClasses[thumbnailSize]
          }
          loading="lazy"
          src={fallbackUrl}
        />
      );
    }
    // Inline placeholder to avoid nested component definition
    return (
      <div className={placeholderClass}>
        <svg
          aria-hidden="true"
          className="h-8 w-8 text-gray-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </div>
    );
  }

  // Primary: render current quality, handleLoad detects placeholders and triggers fallback
  return (
    <img
      alt={title}
      className={useFullWidth ? fullWidthClasses : sizeClasses[thumbnailSize]}
      loading="lazy"
      onError={() => setUseFallbackUrl(true)}
      onLoad={handleLoad}
      src={urls.webp}
    />
  );
};
