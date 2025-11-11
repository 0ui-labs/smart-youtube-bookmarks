import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useUpdateFieldValue } from '../useVideoFieldValues'
import { api } from '@/lib/api'
import type { VideoResponse } from '@/types/video'

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    put: vi.fn(),
  },
}))

const mockListId = 'list-123'
const mockVideoId = 'video-456'
const mockFieldId = 'field-789'

const mockVideo: VideoResponse = {
  id: mockVideoId,
  list_id: mockListId,
  youtube_id: 'dQw4w9WgXcQ',
  title: 'Test Video',
  channel: 'Test Channel',
  thumbnail_url: 'https://example.com/thumb.jpg',
  duration: 300,
  published_at: '2024-01-01T00:00:00Z',
  tags: [],
  processing_status: 'completed',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  field_values: [
    {
      id: 'fv-123',
      video_id: mockVideoId,
      field_id: mockFieldId,
      field_name: 'Quality Rating',
      show_on_card: true,
      field: {
        id: mockFieldId,
        list_id: mockListId,
        name: 'Quality Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      value: 3,
      updated_at: '2024-01-01T00:00:00Z',
    },
  ],
}

describe('useUpdateFieldValue', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    vi.clearAllMocks()
  })

  describe('Optimistic Updates', () => {
    it('updates cache immediately before API call', async () => {
      const mockPut = vi.mocked(api.put).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    updated_count: 1,
                    updates: [
                      {
                        field_id: mockFieldId,
                        value: 5,
                        updated_at: new Date().toISOString(),
                      },
                    ],
                  },
                }),
              100
            )
          )
      )

      // Pre-populate cache with video data
      queryClient.setQueryData(['videos', 'list', mockListId], [mockVideo])

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      // Trigger mutation
      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: 5,
      })

      // Wait for optimistic update to apply (before API resolves)
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Check cache was updated optimistically
      const cachedData = queryClient.getQueryData<VideoResponse[]>(['videos', 'list', mockListId])
      expect(cachedData).toBeDefined()
      expect(cachedData![0].field_values[0].value).toBe(5)

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockPut).toHaveBeenCalledWith(`/videos/${mockVideoId}/fields`, {
        updates: [{ field_id: mockFieldId, value: 5 }],
      })
    })

    it('calls correct API endpoint', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: mockFieldId,
              value: 4,
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: 4,
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith(`/videos/${mockVideoId}/fields`, {
        updates: [{ field_id: mockFieldId, value: 4 }],
      })
    })

    it('uses batch request format', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: mockFieldId,
              value: 'great',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: 'great',
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Verify batch format: { updates: [...] }
      expect(mockPut).toHaveBeenCalledWith(`/videos/${mockVideoId}/fields`, {
        updates: [{ field_id: mockFieldId, value: 'great' }],
      })
    })

    it('invalidates queries on success', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: mockFieldId,
              value: true,
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      // Pre-populate cache
      queryClient.setQueryData(['videos', 'list', mockListId], [mockVideo])

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      const initialDataUpdateCount = queryClient
        .getQueryState(['videos', 'list', mockListId])
        ?.dataUpdatedAt

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: true,
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Query should be invalidated
      const queryState = queryClient.getQueryState(['videos', 'list', mockListId])
      expect(queryState?.isInvalidated).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('rolls back cache on mutation error', async () => {
      const error = new Error('Network error')
      const mockPut = vi.mocked(api.put).mockRejectedValueOnce(error)

      // Pre-populate cache
      queryClient.setQueryData(['videos', 'list', mockListId], [mockVideo])

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: 5,
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      // Cache should be restored to original value
      const cachedData = queryClient.getQueryData<VideoResponse[]>(['videos', 'list', mockListId])
      expect(cachedData).toBeDefined()
      expect(cachedData![0].field_values[0].value).toBe(3) // Original value
    })

    it('restores previous data from context', async () => {
      const error = new Error('Server error')
      const mockPut = vi.mocked(api.put).mockRejectedValueOnce(error)

      // Pre-populate cache with multiple videos
      const video2: VideoResponse = {
        ...mockVideo,
        id: 'video-999',
      }
      queryClient.setQueryData(['videos', 'list', mockListId], [mockVideo, video2])

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: 5,
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      // Cache should restore entire array
      const cachedData = queryClient.getQueryData<VideoResponse[]>(['videos', 'list', mockListId])
      expect(cachedData).toHaveLength(2)
      expect(cachedData![0].field_values[0].value).toBe(3)
    })

    it('logs error to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('API failure')
      const mockPut = vi.mocked(api.put).mockRejectedValueOnce(error)

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: 5,
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(consoleSpy).toHaveBeenCalledWith('Failed to update field value:', error)

      consoleSpy.mockRestore()
    })
  })

  describe('Edge Cases', () => {
    it('handles null values in update', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: mockFieldId,
              value: null,
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: null,
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockPut).toHaveBeenCalledWith(`/videos/${mockVideoId}/fields`, {
        updates: [{ field_id: mockFieldId, value: null }],
      })
    })

    it('works with rating field type', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: mockFieldId,
              value: 5,
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: 5, // number
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockPut).toHaveBeenCalledWith(`/videos/${mockVideoId}/fields`, {
        updates: [{ field_id: mockFieldId, value: 5 }],
      })
    })

    it('works with select field type', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: 'select-field-id',
              value: 'great',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: 'select-field-id',
        value: 'great', // string
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockPut).toHaveBeenCalledWith(`/videos/${mockVideoId}/fields`, {
        updates: [{ field_id: 'select-field-id', value: 'great' }],
      })
    })

    it('works with boolean field type', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: 'boolean-field-id',
              value: true,
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: 'boolean-field-id',
        value: true, // boolean
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockPut).toHaveBeenCalledWith(`/videos/${mockVideoId}/fields`, {
        updates: [{ field_id: 'boolean-field-id', value: true }],
      })
    })

    it('works with text field type', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: 'text-field-id',
              value: 'Great tutorial!',
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: 'text-field-id',
        value: 'Great tutorial!', // string
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockPut).toHaveBeenCalledWith(`/videos/${mockVideoId}/fields`, {
        updates: [{ field_id: 'text-field-id', value: 'Great tutorial!' }],
      })
    })

    it('handles optimistic update when cache is empty', async () => {
      const mockPut = vi.mocked(api.put).mockResolvedValueOnce({
        data: {
          updated_count: 1,
          updates: [
            {
              field_id: mockFieldId,
              value: 5,
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })

      // No cache data
      const { result } = renderHook(() => useUpdateFieldValue(mockListId), { wrapper })

      result.current.mutate({
        listId: mockListId,
        videoId: mockVideoId,
        fieldId: mockFieldId,
        value: 5,
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Should not crash, should complete successfully
      expect(mockPut).toHaveBeenCalledTimes(1)
    })
  })
})
