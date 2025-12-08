import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CustomFieldResponse } from "@/types/customField";
import { FieldEditDialog } from "./FieldEditDialog";

const mockRatingField: CustomFieldResponse = {
  id: "field-123",
  list_id: "list-456",
  name: "Test Field",
  field_type: "rating",
  config: { max_rating: 5 },
  created_at: "2025-11-08T10:00:00Z",
  updated_at: "2025-11-08T10:00:00Z",
};

const mockSelectField: CustomFieldResponse = {
  id: "field-456",
  list_id: "list-456",
  name: "Priority",
  field_type: "select",
  config: { options: ["Low", "Medium", "High"] },
  created_at: "2025-11-08T10:00:00Z",
  updated_at: "2025-11-08T10:00:00Z",
};

describe("FieldEditDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("pre-fills form with field data", () => {
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    expect(screen.getByDisplayValue("Test Field")).toBeInTheDocument();
    // Config is pretty-printed with 2 spaces
    expect(screen.getByDisplayValue(/"max_rating": 5/)).toBeInTheDocument();
  });

  it("pre-fills select field config correctly", () => {
    render(
      <FieldEditDialog
        field={mockSelectField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    expect(screen.getByDisplayValue("Priority")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/"options"/)).toBeInTheDocument();
  });

  it("validates empty name", async () => {
    const user = userEvent.setup({ delay: null });
    const onSave = vi.fn();
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={onSave}
        open={true}
      />
    );

    const nameInput = screen.getByLabelText(/Field Name/i);
    await user.clear(nameInput);

    // Wait for validation to trigger
    await waitFor(() => {
      const submitButton = screen.getByText("Save Changes");
      expect(submitButton).toBeDisabled();
    });

    // Try clicking submit button (should not call onSave due to validation error)
    const submitButton = screen.getByText("Save Changes");
    await user.click(submitButton);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("validates whitespace-only name", async () => {
    const user = userEvent.setup({ delay: null });
    const onSave = vi.fn();
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={onSave}
        open={true}
      />
    );

    const nameInput = screen.getByLabelText(/Field Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "   ");

    // Wait for validation to trigger
    await waitFor(() => {
      const submitButton = screen.getByText("Save Changes");
      expect(submitButton).toBeDisabled();
    });

    // Try clicking submit button (should not call onSave due to validation error)
    const submitButton = screen.getByText("Save Changes");
    await user.click(submitButton);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("validates invalid JSON config", async () => {
    const user = userEvent.setup({ delay: null });
    const onSave = vi.fn();
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={onSave}
        open={true}
      />
    );

    const configInput = screen.getByLabelText(
      /Configuration/i
    ) as HTMLTextAreaElement;
    await user.clear(configInput);
    // Use paste to avoid userEvent issues with curly braces
    await user.click(configInput);
    await user.paste("invalid json without braces");

    // Wait for validation to trigger
    await waitFor(() => {
      const submitButton = screen.getByText("Save Changes");
      expect(submitButton).toBeDisabled();
    });

    // Try clicking submit button (should not call onSave due to validation error)
    const submitButton = screen.getByText("Save Changes");
    await user.click(submitButton);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave with only changed name", async () => {
    const user = userEvent.setup({ delay: null });
    const onSave = vi.fn();
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={onSave}
        open={true}
      />
    );

    const nameInput = screen.getByLabelText(/Field Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");
    await user.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("field-123", {
        name: "Updated Name",
        // config NOT included (unchanged)
      });
    });
  });

  it("calls onSave with only changed config", async () => {
    const user = userEvent.setup({ delay: null });
    const onSave = vi.fn();
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={onSave}
        open={true}
      />
    );

    const configInput = screen.getByLabelText(
      /Configuration/i
    ) as HTMLTextAreaElement;
    await user.clear(configInput);
    // Use paste to avoid userEvent issues with curly braces
    await user.click(configInput);
    await user.paste('{"max_rating": 10}');

    await user.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("field-123", {
        config: { max_rating: 10 },
        // name NOT included (unchanged)
      });
    });
  });

  it("calls onSave with both name and config when both changed", async () => {
    const user = userEvent.setup({ delay: null });
    const onSave = vi.fn();
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={onSave}
        open={true}
      />
    );

    const nameInput = screen.getByLabelText(/Field Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    const configInput = screen.getByLabelText(
      /Configuration/i
    ) as HTMLTextAreaElement;
    await user.clear(configInput);
    // Use paste to avoid userEvent issues with curly braces
    await user.click(configInput);
    await user.paste('{"max_rating": 10}');

    await user.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("field-123", {
        name: "New Name",
        config: { max_rating: 10 },
      });
    });
  });

  it("shows character count for name field", () => {
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    // "Test Field" has 10 characters
    expect(screen.getByText("10/255 characters")).toBeInTheDocument();
  });

  it("disables form during loading", () => {
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    expect(screen.getByLabelText(/Field Name/i)).toBeDisabled();
    expect(screen.getByLabelText(/Configuration/i)).toBeDisabled();
    expect(screen.getByText("Saving...")).toBeDisabled();
  });

  it("shows loading state on save button", () => {
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    expect(screen.getByText("Saving...")).toBeInTheDocument();
    expect(screen.getByText("Saving...")).toBeDisabled();
  });

  it("calls onClose when Cancel clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={onClose}
        onSave={vi.fn()}
        open={true}
      />
    );

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets form when dialog closes", async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    // Modify the name
    const nameInput = screen.getByLabelText(/Field Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Modified Name");

    // Close dialog
    rerender(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={false}
      />
    );

    // Re-open dialog
    rerender(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    // Form should be reset to empty state (as per component behavior)
    const resetNameInput = screen.getByLabelText(
      /Field Name/i
    ) as HTMLInputElement;
    expect(resetNameInput.value).toBe("");
  });

  it("shows warning about config changes", () => {
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    expect(
      screen.getByText(
        /Changing field configuration may affect existing values/i
      )
    ).toBeInTheDocument();
  });

  it("enforces maxLength on name input", () => {
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    const nameInput = screen.getByLabelText(/Field Name/i) as HTMLInputElement;
    expect(nameInput).toHaveAttribute("maxLength", "255");
  });

  it("has name input available for focus", () => {
    render(
      <FieldEditDialog
        field={mockRatingField}
        isLoading={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open={true}
      />
    );

    const nameInput = screen.getByLabelText(/Field Name/i);
    // Note: autoFocus is consumed by React and doesn't persist in the DOM
    // We just verify the input exists and can receive focus
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.tagName).toBe("INPUT");
  });
});
