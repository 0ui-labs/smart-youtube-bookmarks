import { customFieldsHandlers } from "./customFields";
import { schemasHandlers } from "./schemas";
import { tagsHandlers } from "./tags";
import { videosHandlers } from "./videos";

export const handlers = [
  ...schemasHandlers,
  ...videosHandlers,
  ...tagsHandlers,
  ...customFieldsHandlers,
  // Add other handlers here as needed
];
