/**
 * ChannelSubscribeButton
 *
 * Quick-subscribe button for a specific channel.
 * Opens the subscription chat pre-filled with the channel name.
 */
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLists } from "@/hooks/useLists";
import { useSubscriptionChatStore } from "@/stores/subscriptionChatStore";

interface ChannelSubscribeButtonProps {
  /** YouTube channel ID (for potential future use with direct subscription) */
  channelId: string;
  /** Channel display name */
  channelName: string;
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
}

export function ChannelSubscribeButton({
  channelId: _channelId,
  channelName,
  variant = "ghost",
  size = "icon",
}: ChannelSubscribeButtonProps) {
  const openChat = useSubscriptionChatStore((s) => s.openChat);
  const sendMessage = useSubscriptionChatStore((s) => s.sendMessage);
  const { data: lists } = useLists();

  const targetListId = lists?.[0]?.id;

  const handleClick = async () => {
    if (!targetListId) return;

    // Open chat and pre-fill with channel subscription
    openChat(targetListId);
    // Send initial message for this channel
    await sendMessage(`Alle Videos von ${channelName}`);
  };

  return (
    <Button
      disabled={!targetListId}
      onClick={handleClick}
      size={size}
      title={`${channelName} abonnieren`}
      variant={variant}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
}
