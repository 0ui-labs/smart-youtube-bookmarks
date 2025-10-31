/**
 * Format duration in seconds to human-readable string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (MM:SS or H:MM:SS)
 *
 * @example
 * formatDuration(90) // "1:30"
 * formatDuration(3661) // "1:01:01"
 * formatDuration(null) // "-"
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) {
    return '-'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
