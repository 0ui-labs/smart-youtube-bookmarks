import { schemasHandlers } from './schemas'
import { videosHandlers } from './videos'

export const handlers = [
  ...schemasHandlers,
  ...videosHandlers,
  // Add other handlers here as needed
]
