import { describe, it, expect } from 'vitest'
import {
  extractYouTubeId,
  parseUrlsFromText,
  parseWeblocFile,
  parseUrlsFromCSV,
  createCSVFromUrls,
} from './urlParser'

describe('extractYouTubeId', () => {
  describe('valid formats', () => {
    it('extracts ID from youtube.com/watch?v=ID', () => {
      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
    })

    it('extracts ID from youtube.com/watch?v=ID without www', () => {
      expect(extractYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
    })

    it('extracts ID from youtu.be/ID', () => {
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('extracts ID from youtube.com/embed/ID', () => {
      expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
    })

    it('extracts ID with additional query parameters', () => {
      expect(
        extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s')
      ).toBe('dQw4w9WgXcQ')
    })

    it('extracts ID with v parameter not first', () => {
      expect(
        extractYouTubeId('https://www.youtube.com/watch?list=PLtest&v=dQw4w9WgXcQ')
      ).toBe('dQw4w9WgXcQ')
    })

    it('extracts ID from http URLs (non-HTTPS)', () => {
      expect(extractYouTubeId('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
    })

    it('extracts ID from youtube.com/v/ID format', () => {
      expect(extractYouTubeId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
    })

    it('extracts ID from youtube.com/shorts/ID format', () => {
      expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      )
    })
  })

  describe('invalid formats', () => {
    it('returns null for non-YouTube URLs', () => {
      expect(extractYouTubeId('https://vimeo.com/123456')).toBeNull()
    })

    it('returns null for invalid YouTube URLs', () => {
      expect(extractYouTubeId('https://youtube.com/invalid')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(extractYouTubeId('')).toBeNull()
    })

    it('returns null for malformed URLs', () => {
      expect(extractYouTubeId('not-a-url')).toBeNull()
    })

    it('returns null for YouTube URLs without video ID', () => {
      expect(extractYouTubeId('https://youtube.com/watch')).toBeNull()
    })

    it('returns null for YouTube channel URLs', () => {
      expect(extractYouTubeId('https://youtube.com/@username')).toBeNull()
    })

    it('returns null for IDs that are too short', () => {
      expect(extractYouTubeId('https://youtube.com/watch?v=short')).toBeNull()
    })

    it('returns null for IDs that are too long', () => {
      expect(
        extractYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQextra')
      ).toBeNull()
    })
  })
})

describe('parseUrlsFromText', () => {
  describe('single URL', () => {
    it('parses single YouTube URL', () => {
      expect(parseUrlsFromText('https://youtube.com/watch?v=abc12345678')).toEqual([
        'https://youtube.com/watch?v=abc12345678',
      ])
    })

    it('handles URL with surrounding whitespace', () => {
      expect(parseUrlsFromText('  https://youtube.com/watch?v=abc12345678  ')).toEqual([
        'https://youtube.com/watch?v=abc12345678',
      ])
    })
  })

  describe('multiple URLs', () => {
    it('parses newline-separated URLs', () => {
      const text = `https://youtube.com/watch?v=abc12345678
https://youtube.com/watch?v=def12345678`
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(2)
      expect(result).toContain('https://youtube.com/watch?v=abc12345678')
      expect(result).toContain('https://youtube.com/watch?v=def12345678')
    })

    it('parses comma-separated URLs', () => {
      const text =
        'https://youtube.com/watch?v=abc12345678, https://youtube.com/watch?v=def12345678'
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(2)
    })

    it('parses semicolon-separated URLs', () => {
      const text =
        'https://youtube.com/watch?v=abc12345678; https://youtube.com/watch?v=def12345678'
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(2)
    })

    it('parses space-separated URLs', () => {
      const text =
        'https://youtube.com/watch?v=abc12345678 https://youtube.com/watch?v=def12345678'
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(2)
    })

    it('handles mixed separators', () => {
      const text = `https://youtube.com/watch?v=abc12345678
https://youtube.com/watch?v=def12345678, https://youtu.be/ghi12345678`
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(3)
    })
  })

  describe('filtering', () => {
    it('filters out non-YouTube URLs', () => {
      const text = `https://youtube.com/watch?v=abc12345678
https://google.com
https://youtube.com/watch?v=def12345678`
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(2)
      expect(result).not.toContain('https://google.com')
    })

    it('filters out invalid YouTube URLs', () => {
      const text = `https://youtube.com/watch?v=abc12345678
https://youtube.com/invalid
https://youtube.com/watch?v=def12345678`
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(2)
    })
  })

  describe('deduplication', () => {
    it('deduplicates identical URLs', () => {
      const text = `https://youtube.com/watch?v=abc12345678
https://youtube.com/watch?v=abc12345678`
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(1)
    })

    it('deduplicates URLs with same video ID but different formats', () => {
      const text = `https://youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
https://www.youtube.com/embed/dQw4w9WgXcQ`
      const result = parseUrlsFromText(text)
      // Should deduplicate based on video ID
      expect(result).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    it('handles empty text', () => {
      expect(parseUrlsFromText('')).toEqual([])
    })

    it('handles text with no URLs', () => {
      expect(parseUrlsFromText('hello world')).toEqual([])
    })

    it('handles text with only non-YouTube URLs', () => {
      expect(parseUrlsFromText('https://google.com https://vimeo.com/123')).toEqual([])
    })

    it('handles Windows-style line endings', () => {
      const text =
        'https://youtube.com/watch?v=abc12345678\r\nhttps://youtube.com/watch?v=def12345678'
      const result = parseUrlsFromText(text)
      expect(result).toHaveLength(2)
    })
  })
})

describe('parseWeblocFile', () => {
  const createWeblocFile = (content: string): File => {
    return new File([content], 'test.webloc', { type: 'text/xml' })
  }

  describe('valid .webloc files', () => {
    it('parses valid .webloc file with YouTube URL', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>https://www.youtube.com/watch?v=dQw4w9WgXcQ</string>
</dict>
</plist>`
      const file = createWeblocFile(xml)
      const result = await parseWeblocFile(file)
      expect(result).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    })

    it('parses .webloc without XML declaration', async () => {
      const xml = `<plist version="1.0">
<dict>
    <key>URL</key>
    <string>https://youtu.be/dQw4w9WgXcQ</string>
</dict>
</plist>`
      const file = createWeblocFile(xml)
      const result = await parseWeblocFile(file)
      expect(result).toBe('https://youtu.be/dQw4w9WgXcQ')
    })

    it('parses .webloc with different whitespace', async () => {
      const xml = `<plist version="1.0"><dict><key>URL</key><string>https://youtube.com/watch?v=dQw4w9WgXcQ</string></dict></plist>`
      const file = createWeblocFile(xml)
      const result = await parseWeblocFile(file)
      expect(result).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ')
    })
  })

  describe('invalid .webloc files', () => {
    it('returns null for invalid XML', async () => {
      const file = createWeblocFile('not valid xml at all')
      const result = await parseWeblocFile(file)
      expect(result).toBeNull()
    })

    it('returns null for .webloc without URL key', async () => {
      const xml = `<plist version="1.0">
<dict>
    <key>SomeOtherKey</key>
    <string>some value</string>
</dict>
</plist>`
      const file = createWeblocFile(xml)
      const result = await parseWeblocFile(file)
      expect(result).toBeNull()
    })

    it('returns null for empty .webloc', async () => {
      const file = createWeblocFile('')
      const result = await parseWeblocFile(file)
      expect(result).toBeNull()
    })

    it('returns null for .webloc with empty URL', async () => {
      const xml = `<plist version="1.0">
<dict>
    <key>URL</key>
    <string></string>
</dict>
</plist>`
      const file = createWeblocFile(xml)
      const result = await parseWeblocFile(file)
      expect(result).toBeNull()
    })
  })
})

describe('parseUrlsFromCSV', () => {
  const createCSVFile = (content: string): File => {
    return new File([content], 'test.csv', { type: 'text/csv' })
  }

  describe('valid CSV files', () => {
    it('parses CSV with url header', async () => {
      const csv = `url
https://youtube.com/watch?v=abc12345678
https://youtube.com/watch?v=def12345678`
      const file = createCSVFile(csv)
      const result = await parseUrlsFromCSV(file)
      expect(result).toHaveLength(2)
      expect(result).toContain('https://youtube.com/watch?v=abc12345678')
      expect(result).toContain('https://youtube.com/watch?v=def12345678')
    })

    it('parses CSV with URL header (uppercase)', async () => {
      const csv = `URL
https://youtube.com/watch?v=abc12345678`
      const file = createCSVFile(csv)
      const result = await parseUrlsFromCSV(file)
      expect(result).toHaveLength(1)
    })

    it('parses CSV with multiple columns', async () => {
      const csv = `title,url,description
Video 1,https://youtube.com/watch?v=abc12345678,A video
Video 2,https://youtube.com/watch?v=def12345678,Another video`
      const file = createCSVFile(csv)
      const result = await parseUrlsFromCSV(file)
      expect(result).toHaveLength(2)
    })

    it('handles CSV with quoted values', async () => {
      const csv = `title,url
"Video, with comma","https://youtube.com/watch?v=abc12345678"`
      const file = createCSVFile(csv)
      const result = await parseUrlsFromCSV(file)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://youtube.com/watch?v=abc12345678')
    })

    it('filters out non-YouTube URLs', async () => {
      const csv = `url
https://youtube.com/watch?v=abc12345678
https://vimeo.com/123456
https://youtube.com/watch?v=def12345678`
      const file = createCSVFile(csv)
      const result = await parseUrlsFromCSV(file)
      expect(result).toHaveLength(2)
    })

    it('deduplicates URLs', async () => {
      const csv = `url
https://youtube.com/watch?v=abc12345678
https://youtube.com/watch?v=abc12345678`
      const file = createCSVFile(csv)
      const result = await parseUrlsFromCSV(file)
      expect(result).toHaveLength(1)
    })
  })

  describe('invalid CSV files', () => {
    it('returns empty array for empty file', async () => {
      const file = createCSVFile('')
      const result = await parseUrlsFromCSV(file)
      expect(result).toEqual([])
    })

    it('returns empty array for CSV without url column', async () => {
      const csv = `title,description
Video 1,A video`
      const file = createCSVFile(csv)
      const result = await parseUrlsFromCSV(file)
      expect(result).toEqual([])
    })

    it('returns empty array for header-only CSV', async () => {
      const csv = `url`
      const file = createCSVFile(csv)
      const result = await parseUrlsFromCSV(file)
      expect(result).toEqual([])
    })
  })
})

describe('createCSVFromUrls', () => {
  const readBlobAsText = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
  }

  it('creates CSV with header and single URL', async () => {
    const urls = ['https://youtube.com/watch?v=abc12345678']
    const blob = createCSVFromUrls(urls)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/csv')

    const text = await readBlobAsText(blob)
    expect(text).toBe('url\nhttps://youtube.com/watch?v=abc12345678')
  })

  it('creates CSV with multiple URLs', async () => {
    const urls = [
      'https://youtube.com/watch?v=abc12345678',
      'https://youtube.com/watch?v=def12345678',
    ]
    const blob = createCSVFromUrls(urls)
    const text = await readBlobAsText(blob)

    const lines = text.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('url')
    expect(lines[1]).toBe('https://youtube.com/watch?v=abc12345678')
    expect(lines[2]).toBe('https://youtube.com/watch?v=def12345678')
  })

  it('creates header-only CSV for empty array', async () => {
    const blob = createCSVFromUrls([])
    const text = await readBlobAsText(blob)
    expect(text).toBe('url')
  })
})
