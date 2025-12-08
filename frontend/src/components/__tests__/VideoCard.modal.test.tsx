/**
 * Regression Tests: VideoCard Modal Behavior
 * Bug: Modal reopens immediately after closing (event propagation issue)
 *
 * After fix: VideoCard uses callback pattern instead of managing modal internally.
 * This prevents event propagation issues.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { VideoResponse } from "@/types/video";
import { VideoCard } from "../VideoCard";

// Mock video data
const mockVideo: VideoResponse = {
  id: "video-1",
  youtube_id: "abc123",
  title: "Test Video",
  thumbnail_url: "https://example.com/thumb.jpg",
  duration: 600,
  channel: "Test Channel",
  list_id: "list-1",
  tags: [],
  available_fields: [],
  field_values: [],
};

// Test setup helper
const renderVideoCard = (onCardClick?: () => void) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VideoCard onCardClick={onCardClick} video={mockVideo} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("VideoCard - Callback Pattern (Bug Fix)", () => {
  test("Callback is called when card is clicked", async () => {
    const onCardClickMock = vi.fn();
    renderVideoCard(onCardClickMock);
    const user = userEvent.setup();

    // Click card
    const card = screen.getByRole("button", { name: /Video: Test Video/ });
    await user.click(card);

    // Callback should be called exactly once
    expect(onCardClickMock).toHaveBeenCalledTimes(1);
  });

  test("Callback is NOT called when clicking channel name", async () => {
    const onCardClickMock = vi.fn();
    renderVideoCard(onCardClickMock);
    const user = userEvent.setup();

    // Click channel name (should stop propagation)
    const channelButton = screen.getByRole("button", {
      name: /Filter by channel/,
    });
    await user.click(channelButton);

    // Callback should NOT be called (stopPropagation works)
    expect(onCardClickMock).not.toHaveBeenCalled();
  });

  test("Callback is NOT called when clicking dropdown menu", async () => {
    const onCardClickMock = vi.fn();
    renderVideoCard(onCardClickMock);
    const user = userEvent.setup();

    // Click dropdown menu trigger (should stop propagation)
    const menuTrigger = screen.getByRole("button", { name: /Aktionen/i });
    await user.click(menuTrigger);

    // Callback should NOT be called (stopPropagation works)
    expect(onCardClickMock).not.toHaveBeenCalled();
  });

  test("Multiple clicks call callback multiple times", async () => {
    const onCardClickMock = vi.fn();
    renderVideoCard(onCardClickMock);
    const user = userEvent.setup();

    const card = screen.getByRole("button", { name: /Video: Test Video/ });

    // Click 3 times
    await user.click(card);
    await user.click(card);
    await user.click(card);

    // Callback should be called 3 times (no modal interference)
    expect(onCardClickMock).toHaveBeenCalledTimes(3);
  });

  test("Keyboard navigation triggers callback", async () => {
    const onCardClickMock = vi.fn();
    renderVideoCard(onCardClickMock);
    const user = userEvent.setup();

    const card = screen.getByRole("button", { name: /Video: Test Video/ });

    // Focus and press Enter
    card.focus();
    await user.keyboard("{Enter}");

    // Callback should be called
    expect(onCardClickMock).toHaveBeenCalledTimes(1);
  });
});
