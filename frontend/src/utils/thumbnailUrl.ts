/**
 * YouTube thumbnail quality levels
 */
export type ThumbnailQuality = "default" | "mq" | "hq" | "sd" | "maxres";

/**
 * YouTube thumbnail dimensions by quality
 */
export const THUMBNAIL_DIMENSIONS = {
  default: { width: 120, height: 90 },
  mq: { width: 320, height: 180 },
  hq: { width: 480, height: 360 },
  sd: { width: 640, height: 480 },
  maxres: { width: 1280, height: 720 },
} as const;

/**
 * LocalStorage cache key for thumbnail quality availability
 * Structure: { [youtubeId]: "maxres" | "sd" | "hq" } - highest known working quality
 */
const THUMBNAIL_QUALITY_CACHE_KEY = "yt-thumbnail-quality-cache";

/**
 * Get cached known-good quality for a video
 */
export function getCachedQuality(youtubeId: string): ThumbnailQuality | null {
  if (typeof window === "undefined") return null;
  try {
    const cache = JSON.parse(
      localStorage.getItem(THUMBNAIL_QUALITY_CACHE_KEY) || "{}"
    );
    return cache[youtubeId] || null;
  } catch {
    return null;
  }
}

/**
 * Cache the highest working quality for a video
 */
export function setCachedQuality(
  youtubeId: string,
  quality: ThumbnailQuality
): void {
  if (typeof window === "undefined") return;
  try {
    const cache = JSON.parse(
      localStorage.getItem(THUMBNAIL_QUALITY_CACHE_KEY) || "{}"
    );
    cache[youtubeId] = quality;
    // Limit cache size to ~1000 entries to prevent localStorage bloat
    const keys = Object.keys(cache);
    if (keys.length > 1000) {
      // Remove oldest 100 entries (FIFO approximation)
      keys.slice(0, 100).forEach((k) => delete cache[k]);
    }
    localStorage.setItem(THUMBNAIL_QUALITY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Map target width to appropriate YouTube quality
 * Accounts for Retina displays with 1.5x multiplier
 *
 * Note: sddefault and maxresdefault are NOT available for all videos
 * (especially older videos or shorts). Use getCachedQuality() to check
 * if a lower quality is known to be the best available.
 */
export function getQualityForWidth(targetWidth: number): ThumbnailQuality {
  // Adjust for Retina displays
  const pixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const effectiveWidth = targetWidth * (pixelRatio > 1 ? 1.5 : 1);

  if (effectiveWidth <= 120) return "default";
  if (effectiveWidth <= 320) return "mq";
  if (effectiveWidth <= 480) return "hq";
  if (effectiveWidth <= 640) return "sd";
  return "maxres";
}

/**
 * Get the best quality to try first for a video, considering cache
 * Returns the optimal quality OR a lower cached quality if we know higher ones fail
 */
export function getBestQualityForVideo(
  youtubeId: string,
  targetWidth: number
): ThumbnailQuality {
  const optimalQuality = getQualityForWidth(targetWidth);
  const cachedQuality = getCachedQuality(youtubeId);

  if (!cachedQuality) {
    // No cache entry - try optimal quality
    return optimalQuality;
  }

  // Quality ranking for comparison
  const qualityRank: Record<ThumbnailQuality, number> = {
    default: 1,
    mq: 2,
    hq: 3,
    sd: 4,
    maxres: 5,
  };

  // Use the lower of optimal and cached (cached is known to work)
  if (qualityRank[cachedQuality] < qualityRank[optimalQuality]) {
    return cachedQuality;
  }

  return optimalQuality;
}

/**
 * Get fallback quality when primary quality fails (404)
 * Falls back to the next lower quality that's guaranteed to exist
 */
export function getFallbackQuality(
  quality: ThumbnailQuality
): ThumbnailQuality | null {
  switch (quality) {
    case "maxres":
      return "sd";
    case "sd":
      return "hq"; // hq is guaranteed to exist
    default:
      return null; // hq, mq, default are guaranteed to exist, no fallback needed
  }
}

/**
 * Generated thumbnail URLs for WebP and JPEG
 */
export interface ThumbnailUrls {
  webp: string;
  jpeg: string;
}

/**
 * Generate YouTube thumbnail URLs for a specific quality
 */
export function getThumbnailUrlsForQuality(
  youtubeId: string,
  quality: ThumbnailQuality
): ThumbnailUrls {
  return {
    webp: `https://i.ytimg.com/vi_webp/${youtubeId}/${quality}default.webp`,
    jpeg: `https://i.ytimg.com/vi/${youtubeId}/${quality}default.jpg`,
  };
}

/**
 * Generate YouTube thumbnail URLs for given youtube_id and target width
 */
export function getThumbnailUrls(
  youtubeId: string,
  targetWidth: number
): ThumbnailUrls {
  const quality = getQualityForWidth(targetWidth);
  return getThumbnailUrlsForQuality(youtubeId, quality);
}

/**
 * Calculate target thumbnail width based on view settings
 */
export function calculateThumbnailWidth(
  viewMode: "list" | "grid",
  thumbnailSize: "small" | "medium" | "large" | "xlarge",
  gridColumns: 2 | 3 | 4 | 5
): number {
  if (viewMode === "list") {
    const listSizeMap = {
      small: 128,
      medium: 160,
      large: 192,
      xlarge: 500,
    } as const;
    return listSizeMap[thumbnailSize];
  }

  // Grid view: estimate card width based on columns
  const gridWidthMap = {
    5: 200,
    4: 280,
    3: 380,
    2: 580,
  } as const;
  return gridWidthMap[gridColumns];
}
