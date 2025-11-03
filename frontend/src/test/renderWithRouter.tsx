/**
 * Test utility for rendering components with Router and Query Client context
 */
import { render, RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactElement } from 'react'

interface RouterRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial entries for the MemoryRouter history stack
   * @default ['/']
   */
  initialEntries?: string[]
}

/**
 * Renders a component with Router and Query Client context for testing
 *
 * @example
 * ```tsx
 * renderWithRouter(<VideosPage listId="test-id" />, {
 *   initialEntries: ['/videos']
 * })
 * ```
 */
export const renderWithRouter = (
  ui: ReactElement,
  { initialEntries = ['/'], ...renderOptions }: RouterRenderOptions = {}
) => {
  // Create a fresh Query Client for each test to prevent cache pollution
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // No retries in tests for faster feedback
        gcTime: 0,    // No caching between tests
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {}, // Suppress errors in tests
    },
  })

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  )

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient, // Expose for test assertions if needed
  }
}
