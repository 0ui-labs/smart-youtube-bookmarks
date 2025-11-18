import { describe, it, expect } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('0:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(930)).toBe('15:30')
  })

  it('formats hours, minutes, seconds', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('pads single digits correctly', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('handles null', () => {
    expect(formatDuration(null)).toBe('-')
  })

  it('handles zero', () => {
    // Zero seconds should display as "0:00" (valid duration), not "-" (invalid/null)
    expect(formatDuration(0)).toBe('0:00')
  })

  it('handles invalid values', () => {
    expect(formatDuration(NaN)).toBe('-')
    expect(formatDuration(Infinity)).toBe('-')
    expect(formatDuration(-Infinity)).toBe('-')
    expect(formatDuration(-10)).toBe('-')
  })
})
