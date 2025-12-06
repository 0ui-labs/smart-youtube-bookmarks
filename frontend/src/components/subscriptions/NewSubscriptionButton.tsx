/**
 * NewSubscriptionButton
 *
 * Button to open the AI-powered subscription creation chat.
 * Uses the first list as default target if no listId is provided.
 */
import { Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLists } from "@/hooks/useLists";
import { useSubscriptionChatStore } from "@/stores/subscriptionChatStore";

interface NewSubscriptionButtonProps {
  /** Target list ID. Uses first list if not provided. */
  listId?: string;
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Show icon only */
  iconOnly?: boolean;
}

export function NewSubscriptionButton({
  listId,
  variant = "outline",
  size = "sm",
  iconOnly = false,
}: NewSubscriptionButtonProps) {
  const openChat = useSubscriptionChatStore((s) => s.openChat);
  const { data: lists } = useLists();

  // Use provided listId or fall back to first list
  const targetListId = listId ?? lists?.[0]?.id;

  const handleClick = () => {
    if (targetListId) {
      openChat(targetListId);
    }
  };

  if (iconOnly) {
    return (
      <Button
        disabled={!targetListId}
        onClick={handleClick}
        size="icon"
        title="Neues Abo erstellen"
        variant={variant}
      >
        <Sparkles className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      disabled={!targetListId}
      onClick={handleClick}
      size={size}
      variant={variant}
    >
      <Plus className="mr-2 h-4 w-4" />
      Neues Abo
    </Button>
  );
}
