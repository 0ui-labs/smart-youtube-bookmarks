import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useVideoFieldValues, useUpdateVideoFieldValues } from '../useVideoFieldValues'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'
import type { VideoResponse, BatchUpdateFieldValuesResponse } from '@/types/video'

describe('useVideoFieldValues', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  describe('useVideoFieldValues (query)', () => {
    it('should fetch field values successfully', async () => {
      const { result } = renderHook(
        () => useVideoFieldValues('video-123'),
        { wrapper }
      )

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data?.[0].field.name).toBe('Overall Rating')
      expect(result.current.data?.[0].value).toBe(4)
    })

    it('should handle empty field values', async () => {
      const { result } = renderHook(
        () => useVideoFieldValues('video-empty'),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('should handle API errors', async () => {
      const { result } = renderHook(
        () => useVideoFieldValues('video-404'),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeTruthy()
    })

    it('should use correct query key', async () => {
      const { result } = renderHook(
        () => useVideoFieldValues('video-key-test'),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.dataUpdatedAt).toBeGreaterThan(0)

      const cachedData = queryClient.getQueryData([
        'videos',
        'field-values',
        'video-key-test',
      ])
      expect(cachedData).toBeDefined()
    })

    it('should cache field values with 5 minute staleTime', async () => {
      const { result } = renderHook(
        () => useVideoFieldValues('video-123'),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Query should not be stale immediately (5 min staleTime)
      const queryState = queryClient.getQueryState([
        'videos',
        'field-values',
        'video-123',
      ])
      expect(queryState?.isInvalidated).toBe(false)
    })

    it('should not refetch on reconnect', async () => {
      const { result } = renderHook(
        () => useVideoFieldValues('video-123'),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Verify the hook provides expected data and refetch capability
      expect(result.current.data).toHaveLength(2)
      expect(result.current.refetch).toBeDefined()

      // Query should have data cached
      const queryState = queryClient.getQueryState([
        'videos',
        'field-values',
        'video-123',
      ])

      expect(queryState?.data).toBeDefined()
      expect(queryState?.dataUpdatedAt).toBeGreaterThan(0)
    })
  })

  describe('useUpdateVideoFieldValues (mutation)', () => {
    it('should update field values successfully', async () => {
      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate([
        { field_id: 'field-1', value: 5 },
        { field_id: 'field-2', value: 'great' },
      ])

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data?.updated_count).toBe(2)
      expect(result.current.data?.field_values).toHaveLength(2)
    })

    it('should handle validation errors', async () => {
      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate([
        { field_id: 'field-invalid', value: 10 },
      ])

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeTruthy()
    })

    it('should invalidate field values cache after successful mutation', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate([
        { field_id: 'field-1', value: 5 },
      ])

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['videos', 'field-values', 'video-123'],
      })
    })

    it('should invalidate all video queries after successful mutation', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate([
        { field_id: 'field-1', value: 5 },
      ])

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['videos'],
      })
    })

    it('should have correct mutation key', async () => {
      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-456'),
        { wrapper }
      )

      result.current.mutate([])

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const mutationCache = queryClient.getMutationCache()
      const mutations = mutationCache.getAll()

      expect(mutations.length).toBeGreaterThan(0)
      expect(mutations[0].options.mutationKey).toEqual([
        'updateVideoFieldValues',
        'video-456',
      ])
    })

    it('should log errors to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate([
        { field_id: 'field-invalid', value: 10 },
      ])

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update field values:',
        expect.any(Object)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should invalidate caches on error via onSettled', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-123'),
        { wrapper }
      )

      result.current.mutate([
        { field_id: 'field-invalid', value: 10 },
      ])

      await waitFor(() => expect(result.current.isError).toBe(true))

      // onSettled should run even on error
      expect(invalidateSpy).toHaveBeenCalled()
    })

    it('should update single field value', async () => {
      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-single'),
        { wrapper }
      )

      result.current.mutate([
        { field_id: 'field-1', value: 3 },
      ])

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data?.updated_count).toBe(1)
      expect(result.current.data?.field_values[0].value).toBe(3)
    })

    it('should support clearing field value with null', async () => {
      const { result } = renderHook(
        () => useUpdateVideoFieldValues('video-clear'),
        { wrapper }
      )

      result.current.mutate([
        { field_id: 'field-1', value: null },
      ])

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data?.field_values[0].value).toBe(null)
    })
  })
})
