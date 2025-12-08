// frontend/src/components/ViewModeToggle.test.tsx

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ViewModeToggle } from "./ViewModeToggle";

describe("ViewModeToggle", () => {
  it("shows LayoutGrid icon when in list view", () => {
    render(<ViewModeToggle onToggle={vi.fn()} viewMode="list" />);

    // Should show "Switch to Grid" tooltip
    const button = screen.getByRole("button", { name: /Grid-Ansicht/i });
    expect(button).toBeInTheDocument();
  });

  it("shows LayoutList icon when in grid view", () => {
    render(<ViewModeToggle onToggle={vi.fn()} viewMode="grid" />);

    // Should show "Switch to List" tooltip
    const button = screen.getByRole("button", { name: /Listen-Ansicht/i });
    expect(button).toBeInTheDocument();
  });

  it("calls onToggle with grid when clicking from list view", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ViewModeToggle onToggle={onToggle} viewMode="list" />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledWith("grid");
  });

  it("calls onToggle with list when clicking from grid view", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ViewModeToggle onToggle={onToggle} viewMode="grid" />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledWith("list");
  });

  it("has ghost variant and icon size consistent with Plus button", () => {
    const { container } = render(
      <ViewModeToggle onToggle={vi.fn()} viewMode="list" />
    );

    const button = container.querySelector("button");
    // Ghost variant applies these classes (from shadcn/ui button component)
    expect(button).toHaveClass("hover:bg-accent");
    expect(button).toHaveClass("hover:text-accent-foreground");
    // Icon size variant applies these classes
    expect(button).toHaveClass("h-9", "w-9");

    const icon = container.querySelector("svg");
    expect(icon).toHaveClass("h-4", "w-4"); // Icon size
  });
});
