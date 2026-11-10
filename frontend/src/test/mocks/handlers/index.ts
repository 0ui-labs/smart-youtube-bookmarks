import { HttpResponse, http, ws } from "msw";
import { customFieldsHandlers } from "./customFields";
import { schemasHandlers } from "./schemas";
import { chatHandlers, subscriptionsHandlers } from "./subscriptions";
import { tagsHandlers } from "./tags";
import { videosHandlers } from "./videos";

const progressSocket = ws.link(/ws:\/\/.*\/api\/ws\/progress/);

export const handlers = [
  progressSocket.addEventListener("connection", ({ client }) => {
    client.send(
      JSON.stringify({ type: "auth_confirmed", authenticated: true })
    );
  }),
  http.get("/api/channels", () => HttpResponse.json([])),
  http.get("/api/lists", () => HttpResponse.json([])),
  ...schemasHandlers,
  ...videosHandlers,
  ...tagsHandlers,
  ...customFieldsHandlers,
  ...subscriptionsHandlers,
  ...chatHandlers,
];
