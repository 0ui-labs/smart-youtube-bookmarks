/**
 * Subscription Chat Store
 *
 * Manages state for the AI-powered subscription creation chat.
 * Handles chat messages, subscription configuration preview, and creation flow.
 *
 * Architecture:
 * - messages: Conversation history displayed in UI
 * - config: Subscription configuration built from chat responses
 * - isReady: True when enough info is present to create subscription
 * - isLoading: True while waiting for AI response
 */
import { create } from "zustand";

import {
  chatSubscriptionApiChatSubscriptionPost,
  createSubscriptionFromChatApiChatSubscriptionCreatePost,
} from "@/api/generated/chat/chat";
import type { ChatMessage, SubscriptionResponse } from "@/api/generated/model";

export interface SubscriptionConfig {
  name?: string;
  channel_names?: string[];
  keywords?: string[];
  filters?: {
    duration?: { min_seconds?: number; max_seconds?: number };
    views?: { min_views?: number };
    ai_filter?: { enabled: boolean };
  };
  poll_interval?: string;
  [key: string]: unknown; // Index signature for compatibility with API types
}

interface SubscriptionChatStore {
  // State
  isOpen: boolean;
  messages: ChatMessage[];
  config: SubscriptionConfig;
  isLoading: boolean;
  isReady: boolean;
  listId: string | null;
  error: string | null;

  // Actions
  openChat: (listId: string) => void;
  openChatWithContext: (listId: string, contextMessage: string) => void;
  closeChat: () => void;
  sendMessage: (message: string) => Promise<void>;
  reset: () => void;
  createSubscription: () => Promise<SubscriptionResponse | null>;
}

const initialState = {
  isOpen: false,
  messages: [] as ChatMessage[],
  config: {} as SubscriptionConfig,
  isLoading: false,
  isReady: false,
  listId: null as string | null,
  error: null as string | null,
};

export const useSubscriptionChatStore = create<SubscriptionChatStore>(
  (set, get) => ({
    ...initialState,

    openChat: (listId: string) => {
      set({
        isOpen: true,
        listId,
        messages: [],
        config: {},
        isReady: false,
        error: null,
      });
    },

    openChatWithContext: (listId: string, contextMessage: string) => {
      // First open the chat
      set({
        isOpen: true,
        listId,
        messages: [],
        config: {},
        isReady: false,
        error: null,
      });

      // Then immediately send the context message
      // Use setTimeout to ensure state is updated before sending
      setTimeout(() => {
        get().sendMessage(contextMessage);
      }, 0);
    },

    closeChat: () => {
      set({
        isOpen: false,
        messages: [],
        config: {},
        isReady: false,
        listId: null,
        error: null,
      });
    },

    sendMessage: async (message: string) => {
      const { messages, config, listId } = get();

      if (!listId) {
        set({ error: "Keine Liste ausgewählt" });
        return;
      }

      set({ isLoading: true, error: null });

      // Add user message immediately for responsive UI
      const userMessage: ChatMessage = { role: "user", content: message };
      set({
        messages: [...messages, userMessage],
      });

      try {
        const response = await chatSubscriptionApiChatSubscriptionPost({
          message,
          list_id: listId,
          current_config: config,
          conversation_history: messages,
        });

        // Extract data from AxiosResponse
        const data = response.data;

        set({
          messages: data.conversation_history,
          config: data.subscription_preview as SubscriptionConfig,
          isReady: data.ready_to_create,
          isLoading: false,
        });
      } catch (error) {
        console.error("Chat error:", error);
        set({
          isLoading: false,
          error: "Fehler beim Senden der Nachricht. Bitte versuche es erneut.",
        });
      }
    },

    reset: () => {
      set({
        messages: [],
        config: {},
        isReady: false,
        error: null,
      });
    },

    createSubscription: async () => {
      const { config, listId } = get();

      if (!listId) {
        set({ error: "Keine Liste ausgewählt" });
        return null;
      }

      set({ isLoading: true, error: null });

      try {
        const response =
          await createSubscriptionFromChatApiChatSubscriptionCreatePost({
            list_id: listId,
            config,
          });

        // Extract data from AxiosResponse
        const data = response.data;

        // Close chat on success
        get().closeChat();

        return data;
      } catch (error) {
        console.error("Subscription creation error:", error);
        set({
          isLoading: false,
          error: "Fehler beim Erstellen des Abos. Bitte versuche es erneut.",
        });
        return null;
      }
    },
  })
);
