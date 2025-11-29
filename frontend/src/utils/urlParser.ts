/**
 * URL Parser Utilities for Drag & Drop Video Import
 *
 * Handles parsing of various YouTube URL formats and file types
 */

/**
 * Extracts the YouTube video ID from various URL formats
 *
 * Supported formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 *
 * @param url - The URL to parse
 * @returns The 11-character video ID or null if not found/invalid
 */
export const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;

  // YouTube video ID is always 11 characters: [a-zA-Z0-9_-]
  const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

  // Pattern 1: youtube.com/watch?v=ID or youtube.com/watch?...&v=ID
  const watchMatch = url.match(
    /(?:youtube\.com\/watch\?.*?v=)([a-zA-Z0-9_-]+)/
  );
  if (watchMatch?.[1] && VIDEO_ID_REGEX.test(watchMatch[1])) {
    return watchMatch[1];
  }

  // Pattern 2: youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch?.[1] && VIDEO_ID_REGEX.test(shortMatch[1])) {
    return shortMatch[1];
  }

  // Pattern 3: youtube.com/embed/ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch?.[1] && VIDEO_ID_REGEX.test(embedMatch[1])) {
    return embedMatch[1];
  }

  // Pattern 4: youtube.com/v/ID
  const vMatch = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]+)/);
  if (vMatch?.[1] && VIDEO_ID_REGEX.test(vMatch[1])) {
    return vMatch[1];
  }

  // Pattern 5: youtube.com/shorts/ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch?.[1] && VIDEO_ID_REGEX.test(shortsMatch[1])) {
    return shortsMatch[1];
  }

  return null;
};

/**
 * Parses multiple YouTube URLs from text
 *
 * Supports various separators:
 * - Newlines (\n, \r\n)
 * - Commas
 * - Semicolons
 * - Spaces
 *
 * Automatically filters out non-YouTube URLs and deduplicates by video ID.
 *
 * @param text - Text containing YouTube URLs
 * @returns Array of unique YouTube URLs
 */
export const parseUrlsFromText = (text: string): string[] => {
  if (!text.trim()) return [];

  // Split by common separators: newlines, commas, semicolons, spaces
  // Use regex to split on any of these (handling \r\n as well)
  const parts = text.split(/[\r\n,;]+|\s+/);

  // Track seen video IDs for deduplication
  const seenVideoIds = new Set<string>();
  const validUrls: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check if it looks like a URL
    if (!(trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
      continue;
    }

    // Try to extract YouTube ID
    const videoId = extractYouTubeId(trimmed);
    if (videoId && !seenVideoIds.has(videoId)) {
      seenVideoIds.add(videoId);
      validUrls.push(trimmed);
    }
  }

  return validUrls;
};

/**
 * Parses a macOS .webloc file and extracts the URL
 *
 * .webloc files are XML-based plist files created by Safari
 * when dragging a URL to the desktop.
 *
 * @param file - The .webloc File object
 * @returns The URL from the file or null if parsing fails
 */
/**
 * Reads file content as text using FileReader (works in all environments)
 */
const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export const parseWeblocFile = async (file: File): Promise<string | null> => {
  try {
    const text = await readFileAsText(file);
    if (!text.trim()) return null;

    // .webloc files have a simple structure:
    // <key>URL</key>
    // <string>https://...</string>
    // Use regex to extract the URL after the URL key
    const urlMatch = text.match(/<key>URL<\/key>\s*<string>([^<]*)<\/string>/i);
    if (urlMatch?.[1]) {
      const url = urlMatch[1].trim();
      return url || null;
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Parses a CSV file and extracts YouTube URLs
 *
 * Looks for a column named "url" or "URL" and extracts valid YouTube URLs.
 * Automatically filters out non-YouTube URLs and deduplicates by video ID.
 *
 * @param file - The CSV File object
 * @returns Array of unique YouTube URLs
 */
export const parseUrlsFromCSV = async (file: File): Promise<string[]> => {
  try {
    const text = await readFileAsText(file);
    if (!text.trim()) return [];

    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return []; // Need at least header + 1 data row

    // Parse header to find url column index
    const headerLine = lines[0];
    if (!headerLine) return [];

    const headers = parseCSVLine(headerLine);
    const urlColumnIndex = headers.findIndex((h) => h.toLowerCase() === "url");

    if (urlColumnIndex === -1) return [];

    // Extract URLs from data rows
    const seenVideoIds = new Set<string>();
    const validUrls: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;

      const line = rawLine.trim();
      if (!line) continue;

      const columns = parseCSVLine(line);
      const url = columns[urlColumnIndex]?.trim();

      if (url) {
        const videoId = extractYouTubeId(url);
        if (videoId && !seenVideoIds.has(videoId)) {
          seenVideoIds.add(videoId);
          validUrls.push(url);
        }
      }
    }

    return validUrls;
  } catch {
    return [];
  }
};

/**
 * Creates a CSV Blob from an array of URLs
 *
 * @param urls - Array of YouTube URLs
 * @returns Blob containing CSV data with 'url' header
 */
export const createCSVFromUrls = (urls: string[]): Blob => {
  const header = "url";
  const content = urls.length > 0 ? `${header}\n${urls.join("\n")}` : header;
  return new Blob([content], { type: "text/csv" });
};

/**
 * Simple CSV line parser that handles quoted values
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};
