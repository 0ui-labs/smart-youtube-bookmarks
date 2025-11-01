import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { getQueryClient } from './queryClient'

describe('getQueryClient', () => {
  beforeEach(() => {
    // Reset the module state between tests
    vi.resetModules()
  })

  it('should return a QueryClient instance', () => {
    const client = getQueryClient()
    expect(client).toBeInstanceOf(QueryClient)
  })

  it('should return the same instance on multiple calls (singleton pattern)', () => {
    const instance1 = getQueryClient()
    const instance2 = getQueryClient()
    const instance3 = getQueryClient()

    expect(instance1).toBe(instance2)
    expect(instance2).toBe(instance3)
  })

  it('should have correct default staleTime configuration', () => {
    const client = getQueryClient()
    const defaults = client.getDefaultOptions()

    expect(defaults.queries?.staleTime).toBe(60 * 1000) // 60 seconds
  })

  it('should have correct default gcTime configuration', () => {
    const client = getQueryClient()
    const defaults = client.getDefaultOptions()

    expect(defaults.queries?.gcTime).toBe(5 * 60 * 1000) // 5 minutes
  })

  it('should have correct default refetchOnWindowFocus configuration', () => {
    const client = getQueryClient()
    const defaults = client.getDefaultOptions()

    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
  })

  it('should have correct default retry configuration', () => {
    const client = getQueryClient()
    const defaults = client.getDefaultOptions()

    expect(defaults.queries?.retry).toBe(1)
  })
})
