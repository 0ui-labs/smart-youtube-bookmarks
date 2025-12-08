/**
 * Utility functions for optimizing YouTube channel avatar URLs
 *
 * YouTube avatar URLs typically look like:
 * https://yt3.ggpht.com/XXXXX=s800-c-k-c0x00ffffff-no-rj
 *
 * The =sXXX parameter controls the size. We can replace it
 * to load appropriately sized images instead of 800x800.
 */

/**
 * Standard avatar sizes for YouTube
 * Based on common YouTube avatar size options
 */
export const AVATAR_SIZES = {
  small: 48, // Navigation, small lists
  medium: 88, // Default size (like YouTube uses)
  large: 176, // Channels page (for Retina)
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * Regex to match YouTube avatar size parameter
 * Matches patterns like =s88, =s176, =s800, etc.
 */
const SIZE_PATTERN = /=s\d+/;

/**
 * Get optimized avatar URL for the target display size
 *
 * @param url - Original avatar URL (from YouTube API)
 * @param targetSize - Target display size in CSS pixels
 * @returns Optimized URL with correct size parameter
 *
 * @example
 * getOptimizedAvatarUrl("https://yt3.ggpht.com/XXX=s800-c-k", 80)
 * // Returns: "https://yt3.ggpht.com/XXX=s176-c-k" (2x for Retina)
 */
export function getOptimizedAvatarUrl(
  url: string | null | undefined,
  targetSize: number
): string | null {
  if (!url) return null;

  // Calculate size accounting for Retina displays (2x)
  const pixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const optimalSize = Math.ceil(targetSize * Math.min(pixelRatio, 2));

  // Round up to nearest standard size for better caching
  const standardSizes = [48, 88, 176, 240, 400, 800];
  const finalSize =
    standardSizes.find((s) => s >= optimalSize) || standardSizes.at(-1);

  // Check if this is a Google/YouTube image URL that supports size params
  if (url.includes("ggpht.com") || url.includes("googleusercontent.com")) {
    // Replace existing size parameter or add one
    if (SIZE_PATTERN.test(url)) {
      return url.replace(SIZE_PATTERN, `=s${finalSize}`);
    }
    // If no size param exists, try to add it before other params
    // YouTube URLs typically have format: base=sXXX-other-params
    const dashIndex = url.lastIndexOf("-");
    if (dashIndex > url.lastIndexOf("/")) {
      return `${url.slice(0, dashIndex)}=s${finalSize}${url.slice(dashIndex)}`;
    }
    // Fallback: append size param
    return `${url}=s${finalSize}`;
  }

  // For non-YouTube URLs, return as-is
  return url;
}

/**
 * Preset function for common avatar sizes
 */
export function getSmallAvatarUrl(
  url: string | null | undefined
): string | null {
  return getOptimizedAvatarUrl(url, AVATAR_SIZES.small);
}

export function getMediumAvatarUrl(
  url: string | null | undefined
): string | null {
  return getOptimizedAvatarUrl(url, AVATAR_SIZES.medium);
}

export function getLargeAvatarUrl(
  url: string | null | undefined
): string | null {
  return getOptimizedAvatarUrl(url, AVATAR_SIZES.large);
}
