import { schemasHandlers } from './schemas'
import { videosHandlers } from './videos'
import { tagsHandlers } from './tags'
import { customFieldsHandlers } from './customFields'

export const handlers = [
  ...schemasHandlers,
  ...videosHandlers,
  ...tagsHandlers,
  ...customFieldsHandlers,
  // Add other handlers here as needed
]
