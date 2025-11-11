import { schemasHandlers } from './schemas'
import { videosHandlers } from './videos'
import { tagsHandlers } from './tags'

export const handlers = [
  ...schemasHandlers,
  ...videosHandlers,
  ...tagsHandlers,
  // Add other handlers here as needed
]
