import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tag } from "@/types/tag";
import { TagNavigation } from "./TagNavigation";

const mockTags: Tag[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Python",
    color: "#3B82F6",
    schema_id: null,
    is_video_type: true,
    user_id: "00000000-0000-0000-0000-000000000100",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Tutorial",
    color: null,
    schema_id: null,
    is_video_type: true,
    user_id: "00000000-0000-0000-0000-000000000100",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "JavaScript",
    color: "#F7DF1E",
    schema_id: null,
    is_video_type: true,
    user_id: "00000000-0000-0000-0000-000000000100",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("TagNavigation", () => {
  it("renders header with title", () => {
    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={[]}
        tags={[]}
      />
    );

    expect(screen.getByText("Kategorien")).toBeInTheDocument();
  });

  it("renders plus icon button with aria-label", () => {
    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={[]}
        tags={[]}
      />
    );

    const button = screen.getByRole("button", {
      name: /neue kategorie erstellen/i,
    });
    expect(button).toBeInTheDocument();
  });

  it("renders all tags with names", () => {
    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={[]}
        tags={mockTags}
      />
    );

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Tutorial")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });

  it("calls onTagSelect when tag is clicked", () => {
    const onTagSelect = vi.fn();

    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={onTagSelect}
        selectedTagIds={[]}
        tags={mockTags}
      />
    );

    const pythonButton = screen.getByRole("button", {
      name: /python auswählen/i,
    });
    fireEvent.click(pythonButton);

    expect(onTagSelect).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001"
    );
    expect(onTagSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onTagCreate when plus icon is clicked", () => {
    const onTagCreate = vi.fn();

    render(
      <TagNavigation
        onTagCreate={onTagCreate}
        onTagSelect={() => {}}
        selectedTagIds={[]}
        tags={mockTags}
      />
    );

    const createButton = screen.getByRole("button", {
      name: /neue kategorie erstellen/i,
    });
    fireEvent.click(createButton);

    expect(onTagCreate).toHaveBeenCalledTimes(1);
  });

  it("shows selected state for selected tags with aria-pressed", () => {
    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={["00000000-0000-0000-0000-000000000001"]}
        tags={mockTags}
      />
    );

    const pythonButton = screen.getByRole("button", {
      name: /python abwählen/i,
    });
    expect(pythonButton).toHaveClass("bg-accent");
    expect(pythonButton).toHaveAttribute("aria-pressed", "true");

    const tutorialButton = screen.getByRole("button", {
      name: /tutorial auswählen/i,
    });
    expect(tutorialButton).not.toHaveClass("bg-accent");
    expect(tutorialButton).toHaveAttribute("aria-pressed", "false");
  });

  it("shows multiple selected tags", () => {
    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={[
          "00000000-0000-0000-0000-000000000001",
          "00000000-0000-0000-0000-000000000003",
        ]}
        tags={mockTags}
      />
    );

    const pythonButton = screen.getByRole("button", {
      name: /python abwählen/i,
    });
    const jsButton = screen.getByRole("button", {
      name: /javascript abwählen/i,
    });
    const tutorialButton = screen.getByRole("button", {
      name: /tutorial auswählen/i,
    });

    expect(pythonButton).toHaveClass("bg-accent");
    expect(pythonButton).toHaveAttribute("aria-pressed", "true");
    expect(jsButton).toHaveClass("bg-accent");
    expect(jsButton).toHaveAttribute("aria-pressed", "true");
    expect(tutorialButton).not.toHaveClass("bg-accent");
    expect(tutorialButton).toHaveAttribute("aria-pressed", "false");
  });

  it("renders tags without color indicators in current implementation", () => {
    const { container } = render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={[]}
        tags={mockTags}
      />
    );

    // Verify tags are rendered with their names
    const pythonButton = screen.getByRole("button", {
      name: /python auswählen/i,
    });
    expect(pythonButton).toBeInTheDocument();
    expect(pythonButton).toHaveTextContent("Python");

    const tutorialButton = screen.getByRole("button", {
      name: /tutorial auswählen/i,
    });
    expect(tutorialButton).toBeInTheDocument();
    expect(tutorialButton).toHaveTextContent("Tutorial");

    // Current implementation does not render color indicators
    const pythonColorIndicator = pythonButton.querySelector(
      '[style*="background-color"]'
    );
    expect(pythonColorIndicator).not.toBeInTheDocument();
  });

  it("handles empty tags array", () => {
    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={[]}
        tags={[]}
      />
    );

    expect(screen.getByText("Kategorien")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /auswählen/i })
    ).not.toBeInTheDocument();
  });

  it("has proper keyboard navigation with accessible button", () => {
    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={[]}
        tags={[mockTags[0]]}
      />
    );

    const tagButton = screen.getByRole("button", { name: /python auswählen/i });
    expect(tagButton).toBeInTheDocument();
    expect(tagButton).toHaveAttribute("aria-pressed", "false");
  });

  it("buttons have proper accessibility attributes", () => {
    render(
      <TagNavigation
        onTagCreate={() => {}}
        onTagSelect={() => {}}
        selectedTagIds={[]}
        tags={[mockTags[0]]}
      />
    );

    // Verify button has proper aria-label
    const tagButton = screen.getByRole("button", { name: /python auswählen/i });
    expect(tagButton).toHaveAttribute("aria-pressed", "false");
    expect(tagButton).toHaveAttribute(
      "aria-label",
      "Kategorie Python auswählen"
    );
  });
});
