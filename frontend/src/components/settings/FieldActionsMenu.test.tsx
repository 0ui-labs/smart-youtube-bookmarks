import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CustomFieldResponse } from "@/types/customField";
import { FieldActionsMenu } from "./FieldActionsMenu";

const mockField: CustomFieldResponse = {
  id: "field-123",
  list_id: "list-456",
  name: "Test Field",
  field_type: "text",
  config: {},
  created_at: "2025-11-08T10:00:00Z",
  updated_at: "2025-11-08T10:00:00Z",
};

describe("FieldActionsMenu", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders three-dot menu trigger with accessible label", () => {
    render(
      <FieldActionsMenu field={mockField} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(screen.getByLabelText("Actions for Test Field")).toBeInTheDocument();
  });

  it("renders trigger button", () => {
    render(
      <FieldActionsMenu field={mockField} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    const trigger = screen.getByLabelText("Actions for Test Field");
    expect(trigger).toBeInTheDocument();
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("opens menu on trigger click", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FieldActionsMenu field={mockField} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("calls onEdit when Edit clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onEdit = vi.fn();
    render(
      <FieldActionsMenu field={mockField} onDelete={vi.fn()} onEdit={onEdit} />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when Delete clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    render(
      <FieldActionsMenu
        field={mockField}
        onDelete={onDelete}
        onEdit={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("shows delete action with destructive styling", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FieldActionsMenu field={mockField} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    await user.click(screen.getByRole("button"));
    const deleteItem = screen.getByText("Delete");
    expect(deleteItem).toHaveClass("text-red-600");
  });

  it("shows both Edit and Delete actions", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FieldActionsMenu field={mockField} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    await user.click(screen.getByRole("button"));

    // Check that both menu items exist
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("stops event propagation on trigger click", async () => {
    const user = userEvent.setup({ delay: null });
    const onRowClick = vi.fn();

    const { container } = render(
      <div data-testid="row" onClick={onRowClick}>
        <FieldActionsMenu
          field={mockField}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
        />
      </div>
    );

    await user.click(screen.getByRole("button"));

    // Row click should not fire due to stopPropagation
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
