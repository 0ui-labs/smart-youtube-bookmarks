import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Create MSW server for Node environment (Vitest)
export const server = setupServer(...handlers)
