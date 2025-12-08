/**
 * MSW handlers for subscription and chat API endpoints.
 */
import { HttpResponse, http } from "msw";
import type { SubscriptionResponse } from "@/api/generated/model";

// Simple UUID generator for tests
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Mock data
const mockSubscriptions: SubscriptionResponse[] = [];

// Reset function for test isolation
export function resetMockSubscriptions() {
  mockSubscriptions.length = 0;
}

export const subscriptionsHandlers = [
  // GET /api/subscriptions - Fetch all subscriptions
  http.get("/api/subscriptions", () => HttpResponse.json(mockSubscriptions)),

  // POST /api/subscriptions - Create subscription
  http.post("/api/subscriptions", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    const newSub: SubscriptionResponse = {
      id: generateUUID(),
      user_id: "test-user-id",
      list_id: body.list_id as string,
      name: (body.name as string) || "Neues Abo",
      channel_ids: (body.channel_ids as string[]) || null,
      keywords: (body.keywords as string[]) || null,
      filters: (body.filters as Record<string, unknown>) || {},
      poll_interval: (body.poll_interval as string) || "daily",
      is_active: true,
      match_count: 0,
      last_polled_at: null,
      next_poll_at: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockSubscriptions.push(newSub);
    return HttpResponse.json(newSub, { status: 201 });
  }),

  // GET /api/subscriptions/:id
  http.get("/api/subscriptions/:id", ({ params }) => {
    const sub = mockSubscriptions.find((s) => s.id === params.id);
    if (!sub) {
      return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    }
    return HttpResponse.json(sub);
  }),

  // PUT /api/subscriptions/:id
  http.put("/api/subscriptions/:id", async ({ params, request }) => {
    const subIndex = mockSubscriptions.findIndex((s) => s.id === params.id);
    if (subIndex === -1) {
      return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updated = {
      ...mockSubscriptions[subIndex],
      ...body,
      updated_at: new Date().toISOString(),
    };
    mockSubscriptions[subIndex] = updated as SubscriptionResponse;

    return HttpResponse.json(updated);
  }),

  // DELETE /api/subscriptions/:id
  http.delete("/api/subscriptions/:id", ({ params }) => {
    const subIndex = mockSubscriptions.findIndex((s) => s.id === params.id);
    if (subIndex === -1) {
      return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    }

    mockSubscriptions.splice(subIndex, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/subscriptions/:id/sync
  http.post("/api/subscriptions/:id/sync", ({ params }) => {
    const sub = mockSubscriptions.find((s) => s.id === params.id);
    if (!sub) {
      return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    }

    return HttpResponse.json({ new_videos: 0 });
  }),

  // GET /api/subscriptions/quota
  http.get("/api/subscriptions/quota", () =>
    HttpResponse.json({
      used: 100,
      remaining: 9900,
      limit: 10_000,
      percentage: 1.0,
    })
  ),
];

export const chatHandlers = [
  // POST /api/chat/subscription - Process chat message
  http.post("/api/chat/subscription", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const message = body.message as string;
    const currentConfig =
      (body.current_config as Record<string, unknown>) || {};
    const history =
      (body.conversation_history as Array<{ role: string; content: string }>) ||
      [];

    // Simple mock: Extract keywords from message
    const keywords: string[] = [];
    if (message.toLowerCase().includes("python")) keywords.push("Python");
    if (message.toLowerCase().includes("fastapi")) keywords.push("FastAPI");
    if (message.toLowerCase().includes("react")) keywords.push("React");

    const updatedConfig: Record<string, unknown> = {
      ...currentConfig,
      ...(keywords.length > 0 ? { keywords } : {}),
    };

    const assistantMessage =
      keywords.length > 0
        ? `Verstanden! Ich suche nach Videos zu: ${keywords.join(", ")}`
        : "Was für Videos möchtest du abonnieren?";

    const hasName = Boolean(updatedConfig.name);
    const hasKeywords = Boolean(updatedConfig.keywords);
    const hasChannels = Boolean(updatedConfig.channel_names);
    const isReady = hasName && (hasKeywords || hasChannels);

    return HttpResponse.json({
      message: assistantMessage,
      subscription_preview: updatedConfig,
      ready_to_create: isReady,
      conversation_history: [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: assistantMessage },
      ],
    });
  }),

  // POST /api/chat/subscription/create - Create subscription from chat config
  http.post("/api/chat/subscription/create", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const config = body.config as Record<string, unknown>;

    const newSub: SubscriptionResponse = {
      id: generateUUID(),
      user_id: "test-user-id",
      list_id: body.list_id as string,
      name: (config.name as string) || "Chat Abo",
      channel_ids: (config.channel_ids as string[]) || null,
      keywords: (config.keywords as string[]) || null,
      filters: (config.filters as Record<string, unknown>) || {},
      poll_interval: (config.poll_interval as string) || "daily",
      is_active: true,
      match_count: 0,
      last_polled_at: null,
      next_poll_at: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockSubscriptions.push(newSub);
    return HttpResponse.json(newSub, { status: 201 });
  }),
];
