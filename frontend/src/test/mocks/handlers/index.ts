import { customFieldsHandlers } from "./customFields";
import { schemasHandlers } from "./schemas";
import { chatHandlers, subscriptionsHandlers } from "./subscriptions";
import { tagsHandlers } from "./tags";
import { videosHandlers } from "./videos";

export const handlers = [
  ...schemasHandlers,
  ...videosHandlers,
  ...tagsHandlers,
  ...customFieldsHandlers,
  ...subscriptionsHandlers,
  ...chatHandlers,
];
