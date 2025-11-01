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
          // Data is considered fresh for 60 seconds
          staleTime: 60 * 1000,
          // Unused data is garbage collected after 5 minutes
          gcTime: 5 * 60 * 1000,
          // Don't refetch when user returns to window (avoid unnecessary requests)
          refetchOnWindowFocus: false,
          // Retry failed requests once before giving up
          retry: 1,
        },
      },
    })
  }
  return queryClient
}
