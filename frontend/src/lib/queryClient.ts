import { QueryClient } from '@tanstack/react-query'

let queryClient: QueryClient | undefined = undefined

/**
 * Get or create a singleton QueryClient instance.
 *
 * This pattern prevents creating multiple QueryClient instances
 * when React 18 Strict Mode causes components to mount/unmount
 * during initial render.
 *
 * @returns The singleton QueryClient instance
 */
export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Data is considered fresh for 5 minutes (lists don't change often)
          staleTime: 5 * 60 * 1000,
          // Unused data is garbage collected after 10 minutes (longer than staleTime)
          gcTime: 10 * 60 * 1000,
          // Retry failed requests 3 times to handle transient network failures
          retry: 3,
          // Enable multi-tab synchronization (refetch when user returns to window)
          refetchOnWindowFocus: true,
        },
        mutations: {
          // Don't retry mutations to avoid duplicate operations
          retry: 0,
        },
      },
    })
  }
  return queryClient
}
