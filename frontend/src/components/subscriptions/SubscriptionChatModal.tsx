/**
 * Subscription Chat Modal
 *
 * AI-powered chat interface for creating subscriptions through natural language.
 * Users describe what videos they want to subscribe to, and the AI builds
 * the subscription configuration incrementally.
 */
import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type SubscriptionConfig,
  useSubscriptionChatStore,
} from "@/stores/subscriptionChatStore";

export function SubscriptionChatModal() {
  const {
    isOpen,
    closeChat,
    messages,
    config,
    isLoading,
    isReady,
    error,
    sendMessage,
    createSubscription,
  } = useSubscriptionChatStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput("");
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreate = async () => {
    await createSubscription();
  };

  return (
    <Dialog onOpenChange={(open) => !open && closeChat()} open={isOpen}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Neues Abo erstellen
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Chat Area */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto pr-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="mb-2">
                      Beschreibe, welche Videos du abonnieren möchtest.
                    </p>
                    <p className="text-sm">
                      z.B. &quot;Alle FastAPI Videos von Fireship&quot; oder
                      &quot;Python Tutorials mit mindestens 10 Minuten&quot;
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                    key={`msg-${i}-${msg.role}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-muted px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <div className="rounded-lg bg-destructive/10 px-4 py-2 text-destructive text-sm">
                      {error}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="mt-4 flex gap-2 border-t pt-4">
              <Input
                className="flex-1"
                disabled={isLoading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Beschreibe dein Abo..."
                value={input}
              />
              <Button
                disabled={isLoading || !input.trim()}
                onClick={handleSend}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex w-80 flex-col border-l pl-4">
            <h3 className="mb-4 font-semibold">Vorschau</h3>

            <div className="flex-1 overflow-y-auto">
              <ConfigPreview config={config} />
            </div>

            {isReady && (
              <Button
                className="mt-4 w-full"
                disabled={isLoading}
                onClick={handleCreate}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  "Abo erstellen"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfigPreview({ config }: { config: SubscriptionConfig }) {
  const hasContent =
    config.name ||
    config.channel_names?.length ||
    config.keywords?.length ||
    config.filters?.duration ||
    config.filters?.views;

  if (!hasContent) {
    return (
      <p className="text-muted-foreground text-sm">
        Die Konfiguration wird hier angezeigt, während du das Abo beschreibst.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {config.name && (
        <div>
          <span className="text-muted-foreground">Name:</span>
          <div className="font-medium">{config.name}</div>
        </div>
      )}

      {config.channel_names && config.channel_names.length > 0 && (
        <div>
          <span className="text-muted-foreground">Kanäle:</span>
          <div className="font-medium">{config.channel_names.join(", ")}</div>
        </div>
      )}

      {config.keywords && config.keywords.length > 0 && (
        <div>
          <span className="text-muted-foreground">Keywords:</span>
          <div className="font-medium">{config.keywords.join(", ")}</div>
        </div>
      )}

      {config.filters?.duration && (
        <div>
          <span className="text-muted-foreground">Dauer:</span>
          <div className="font-medium">
            {formatDuration(config.filters.duration)}
          </div>
        </div>
      )}

      {config.filters?.views?.min_views && (
        <div>
          <span className="text-muted-foreground">Min. Views:</span>
          <div className="font-medium">
            {config.filters.views.min_views.toLocaleString("de-DE")}
          </div>
        </div>
      )}

      {config.poll_interval && (
        <div>
          <span className="text-muted-foreground">Prüfintervall:</span>
          <div className="font-medium">
            {formatPollInterval(config.poll_interval)}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(duration: {
  min_seconds?: number;
  max_seconds?: number;
}) {
  const min = duration.min_seconds
    ? Math.round(duration.min_seconds / 60)
    : null;
  const max = duration.max_seconds
    ? Math.round(duration.max_seconds / 60)
    : null;

  if (min && max) return `${min} - ${max} Minuten`;
  if (min) return `≥ ${min} Minuten`;
  if (max) return `≤ ${max} Minuten`;
  return "Beliebig";
}

function formatPollInterval(interval: string) {
  const labels: Record<string, string> = {
    hourly: "Stündlich",
    twice_daily: "2x täglich",
    daily: "Täglich",
  };
  return labels[interval] || interval;
}
