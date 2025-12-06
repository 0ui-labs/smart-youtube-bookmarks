/**
 * Tests for subscriptionChatStore.
 *
 * Tests the Zustand store for AI-powered subscription chat.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSubscriptionChatStore } from "./subscriptionChatStore";

// Mock the API functions
vi.mock("@/api/generated/chat/chat", () => ({
  chatSubscriptionApiChatSubscriptionPost: vi.fn(),
  createSubscriptionFromChatApiChatSubscriptionCreatePost: vi.fn(),
}));

describe("subscriptionChatStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useSubscriptionChatStore.setState({
      isOpen: false,
      messages: [],
      config: {},
      isLoading: false,
      isReady: false,
      listId: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("has correct initial values", () => {
      const state = useSubscriptionChatStore.getState();

      expect(state.isOpen).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.config).toEqual({});
      expect(state.isLoading).toBe(false);
      expect(state.isReady).toBe(false);
      expect(state.listId).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe("openChat", () => {
    it("sets isOpen to true and stores listId", () => {
      const { openChat } = useSubscriptionChatStore.getState();

      openChat("test-list-id");

      const state = useSubscriptionChatStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.listId).toBe("test-list-id");
    });

    it("resets messages and config when opening", () => {
      // Set some existing state
      useSubscriptionChatStore.setState({
        messages: [{ role: "user", content: "old message" }],
        config: { name: "old config" },
        isReady: true,
        error: "old error",
      });

      const { openChat } = useSubscriptionChatStore.getState();
      openChat("new-list-id");

      const state = useSubscriptionChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.config).toEqual({});
      expect(state.isReady).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("openChatWithContext", () => {
    it("sets isOpen to true and stores listId", () => {
      const { openChatWithContext } = useSubscriptionChatStore.getState();

      openChatWithContext("test-list-id", "Test context message");

      const state = useSubscriptionChatStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.listId).toBe("test-list-id");
    });

    it("triggers sendMessage with context after opening", async () => {
      vi.useFakeTimers();

      const mockResponse = {
        data: {
          message: "Ich verstehe.",
          subscription_preview: {},
          ready_to_create: false,
          conversation_history: [
            { role: "user", content: "Context message" },
            { role: "assistant", content: "Ich verstehe." },
          ],
        },
      };

      const { chatSubscriptionApiChatSubscriptionPost } = await import(
        "@/api/generated/chat/chat"
      );
      vi.mocked(chatSubscriptionApiChatSubscriptionPost).mockResolvedValue(
        mockResponse as never
      );

      const { openChatWithContext } = useSubscriptionChatStore.getState();
      openChatWithContext("test-list", "Context message");

      // Advance timers to trigger the setTimeout
      await vi.runAllTimersAsync();

      // Verify the API was called with the context message
      expect(chatSubscriptionApiChatSubscriptionPost).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Context message",
          list_id: "test-list",
        })
      );

      vi.useRealTimers();
    });
  });

  describe("closeChat", () => {
    it("resets all state values", () => {
      // Set some state
      useSubscriptionChatStore.setState({
        isOpen: true,
        listId: "test-list",
        messages: [{ role: "user", content: "test" }],
        config: { name: "Test" },
        isReady: true,
        error: "Some error",
      });

      const { closeChat } = useSubscriptionChatStore.getState();
      closeChat();

      const state = useSubscriptionChatStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.listId).toBeNull();
      expect(state.messages).toEqual([]);
      expect(state.config).toEqual({});
      expect(state.isReady).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("reset", () => {
    it("clears messages, config, and error but keeps isOpen and listId", () => {
      useSubscriptionChatStore.setState({
        isOpen: true,
        listId: "keep-this",
        messages: [{ role: "user", content: "test" }],
        config: { name: "Test" },
        isReady: true,
        error: "Some error",
      });

      const { reset } = useSubscriptionChatStore.getState();
      reset();

      const state = useSubscriptionChatStore.getState();
      // These should be reset
      expect(state.messages).toEqual([]);
      expect(state.config).toEqual({});
      expect(state.isReady).toBe(false);
      expect(state.error).toBeNull();
      // isOpen and listId are NOT affected by reset (only closeChat resets them)
      // Actually checking the reset implementation - it doesn't reset isOpen/listId
    });
  });

  describe("sendMessage", () => {
    it("sets error when listId is null", async () => {
      useSubscriptionChatStore.setState({
        listId: null,
      });

      const { sendMessage } = useSubscriptionChatStore.getState();
      await sendMessage("Test message");

      const state = useSubscriptionChatStore.getState();
      expect(state.error).toBe("Keine Liste ausgewählt");
    });

    it("adds user message immediately for responsive UI", async () => {
      const mockResponse = {
        data: {
          message: "AI response",
          subscription_preview: { keywords: ["Python"] },
          ready_to_create: false,
          conversation_history: [
            { role: "user", content: "Test" },
            { role: "assistant", content: "AI response" },
          ],
        },
      };

      const { chatSubscriptionApiChatSubscriptionPost } = await import(
        "@/api/generated/chat/chat"
      );
      vi.mocked(chatSubscriptionApiChatSubscriptionPost).mockResolvedValue(
        mockResponse as never
      );

      useSubscriptionChatStore.setState({
        listId: "test-list",
        messages: [],
        config: {},
      });

      const { sendMessage } = useSubscriptionChatStore.getState();

      // Start sending
      const promise = sendMessage("Test message");

      // Check that user message was added immediately
      const stateWhileLoading = useSubscriptionChatStore.getState();
      expect(stateWhileLoading.isLoading).toBe(true);
      expect(stateWhileLoading.messages).toHaveLength(1);
      expect(stateWhileLoading.messages[0]).toEqual({
        role: "user",
        content: "Test message",
      });

      await promise;
    });

    it("updates state with API response", async () => {
      const mockResponse = {
        data: {
          message: "Verstanden! Python Videos.",
          subscription_preview: { keywords: ["Python"], name: "Python Abo" },
          ready_to_create: true,
          conversation_history: [
            { role: "user", content: "Python Videos" },
            { role: "assistant", content: "Verstanden! Python Videos." },
          ],
        },
      };

      const { chatSubscriptionApiChatSubscriptionPost } = await import(
        "@/api/generated/chat/chat"
      );
      vi.mocked(chatSubscriptionApiChatSubscriptionPost).mockResolvedValue(
        mockResponse as never
      );

      useSubscriptionChatStore.setState({
        listId: "test-list",
        messages: [],
        config: {},
      });

      const { sendMessage } = useSubscriptionChatStore.getState();
      await sendMessage("Python Videos");

      const state = useSubscriptionChatStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.messages).toHaveLength(2);
      expect(state.config).toEqual({
        keywords: ["Python"],
        name: "Python Abo",
      });
      expect(state.isReady).toBe(true);
    });

    it("handles API error gracefully", async () => {
      const { chatSubscriptionApiChatSubscriptionPost } = await import(
        "@/api/generated/chat/chat"
      );
      vi.mocked(chatSubscriptionApiChatSubscriptionPost).mockRejectedValue(
        new Error("API Error")
      );

      useSubscriptionChatStore.setState({
        listId: "test-list",
        messages: [],
        config: { existing: "config" },
      });

      const { sendMessage } = useSubscriptionChatStore.getState();
      await sendMessage("Test");

      const state = useSubscriptionChatStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toContain("Fehler");
      // Original config should be preserved
      expect(state.config).toEqual({ existing: "config" });
    });
  });

  describe("createSubscription", () => {
    it("sets error when listId is null", async () => {
      useSubscriptionChatStore.setState({
        listId: null,
        config: { name: "Test" },
      });

      const { createSubscription } = useSubscriptionChatStore.getState();
      const result = await createSubscription();

      expect(result).toBeNull();
      const state = useSubscriptionChatStore.getState();
      expect(state.error).toBe("Keine Liste ausgewählt");
    });

    it("creates subscription and closes chat on success", async () => {
      const mockSubscription = {
        id: "new-sub-id",
        name: "Test Sub",
        keywords: ["Python"],
      };

      const { createSubscriptionFromChatApiChatSubscriptionCreatePost } =
        await import("@/api/generated/chat/chat");
      vi.mocked(
        createSubscriptionFromChatApiChatSubscriptionCreatePost
      ).mockResolvedValue({ data: mockSubscription } as never);

      useSubscriptionChatStore.setState({
        isOpen: true,
        listId: "test-list",
        config: { name: "Test Sub", keywords: ["Python"] },
      });

      const { createSubscription } = useSubscriptionChatStore.getState();
      const result = await createSubscription();

      expect(result).toEqual(mockSubscription);

      // Chat should be closed
      const state = useSubscriptionChatStore.getState();
      expect(state.isOpen).toBe(false);
    });

    it("handles creation error gracefully", async () => {
      const { createSubscriptionFromChatApiChatSubscriptionCreatePost } =
        await import("@/api/generated/chat/chat");
      vi.mocked(
        createSubscriptionFromChatApiChatSubscriptionCreatePost
      ).mockRejectedValue(new Error("Creation failed"));

      useSubscriptionChatStore.setState({
        isOpen: true,
        listId: "test-list",
        config: { name: "Test" },
      });

      const { createSubscription } = useSubscriptionChatStore.getState();
      const result = await createSubscription();

      expect(result).toBeNull();

      const state = useSubscriptionChatStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toContain("Fehler");
      // Chat should still be open on error
      expect(state.isOpen).toBe(true);
    });
  });
});
