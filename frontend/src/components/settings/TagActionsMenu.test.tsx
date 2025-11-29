import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tag } from "@/types/tag";
import { TagActionsMenu } from "./TagActionsMenu";

const mockTag: Tag = {
  id: "tag-123",
  name: "Python",
  color: "#3B82F6",
  schema_id: null,
  is_video_type: true,
  user_id: "user-456",
  created_at: "2025-11-18T10:00:00Z",
  updated_at: "2025-11-18T10:00:00Z",
};

describe("TagActionsMenu", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders actions menu trigger", () => {
    render(
      <TagActionsMenu onDelete={vi.fn()} onEdit={vi.fn()} tag={mockTag} />
    );
    expect(screen.getByLabelText("Actions for Python")).toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TagActionsMenu onDelete={vi.fn()} onEdit={vi.fn()} tag={mockTag} />
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("calls onEdit when Edit clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onEdit = vi.fn();
    render(<TagActionsMenu onDelete={vi.fn()} onEdit={onEdit} tag={mockTag} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Edit"));

    expect(onEdit).toHaveBeenCalledWith(mockTag);
  });

  it("calls onDelete when Delete clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    render(
      <TagActionsMenu onDelete={onDelete} onEdit={vi.fn()} tag={mockTag} />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Delete"));

    expect(onDelete).toHaveBeenCalledWith(mockTag);
  });
});
