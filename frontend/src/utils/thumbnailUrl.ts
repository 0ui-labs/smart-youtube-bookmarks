/**
 * YouTube thumbnail quality levels
 */
export type ThumbnailQuality = 'default' | 'mq' | 'hq' | 'sd' | 'maxres'

/**
 * YouTube thumbnail dimensions by quality
 */
export const THUMBNAIL_DIMENSIONS = {
  default: { width: 120, height: 90 },
  mq: { width: 320, height: 180 },
  hq: { width: 480, height: 360 },
  sd: { width: 640, height: 480 },
  maxres: { width: 1280, height: 720 },
} as const

/**
 * Map target width to appropriate YouTube quality
 * Accounts for Retina displays with 1.5x multiplier
 */
export function getQualityForWidth(targetWidth: number): ThumbnailQuality {
  // Adjust for Retina displays
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  const effectiveWidth = targetWidth * (pixelRatio > 1 ? 1.5 : 1)

  if (effectiveWidth <= 120) return 'default'
  if (effectiveWidth <= 320) return 'mq'
  if (effectiveWidth <= 480) return 'hq'
  if (effectiveWidth <= 640) return 'sd'
  return 'maxres'
}

/**
 * Generated thumbnail URLs for WebP and JPEG
 */
export interface ThumbnailUrls {
  webp: string
  jpeg: string
}

/**
 * Generate YouTube thumbnail URLs for given youtube_id and target width
 */
export function getThumbnailUrls(
  youtubeId: string,
  targetWidth: number
): ThumbnailUrls {
  const quality = getQualityForWidth(targetWidth)

  return {
    webp: `https://i.ytimg.com/vi_webp/${youtubeId}/${quality}default.webp`,
    jpeg: `https://i.ytimg.com/vi/${youtubeId}/${quality}default.jpg`,
  }
}
