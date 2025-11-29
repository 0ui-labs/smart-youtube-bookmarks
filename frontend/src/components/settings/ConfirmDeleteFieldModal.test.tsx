import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDeleteFieldModal } from "./ConfirmDeleteFieldModal";

describe("ConfirmDeleteFieldModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders with field name", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={0}
      />
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // Use more specific query within alertdialog to avoid matching multiple elements
    const alertDialog = screen.getByRole("alertdialog");
    expect(alertDialog).toHaveTextContent(/"Test Field"/i);
  });

  it("shows usage count warning when field in use", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={3}
      />
    );

    expect(screen.getByText(/used by 3 schema\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Cannot delete/i)).toBeInTheDocument();
  });

  it("shows singular usage count correctly", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={1}
      />
    );

    expect(screen.getByText(/used by 1 schema\(s\)/i)).toBeInTheDocument();
  });

  it("disables delete button when field in use", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={2}
      />
    );

    const deleteButton = screen.getByText("Delete Field");
    expect(deleteButton).toBeDisabled();
  });

  it("enables delete button when field not in use", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={0}
      />
    );

    const deleteButton = screen.getByText("Delete Field");
    expect(deleteButton).not.toBeDisabled();
  });

  it("shows cascade warning when field not in use", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={0}
      />
    );

    expect(
      screen.getByText(/All video values for this field/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This action cannot be undone/i)
    ).toBeInTheDocument();
  });

  it("shows remove from schemas message when field in use", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={5}
      />
    );

    expect(
      screen.getByText(/Remove this field from all schemas before deleting/i)
    ).toBeInTheDocument();
  });

  it("calls onConfirm when delete clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        open={true}
        usageCount={0}
      />
    );

    await user.click(screen.getByText("Delete Field"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
        open={true}
        usageCount={0}
      />
    );

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows loading state during deletion", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={0}
      />
    );

    expect(screen.getByText("Deleting...")).toBeInTheDocument();
    expect(screen.getByText("Deleting...")).toBeDisabled();
  });

  it("disables cancel button during loading", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={0}
      />
    );

    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("uses destructive styling for delete button", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={0}
      />
    );

    const deleteButton = screen.getByText("Delete Field");
    expect(deleteButton).toHaveClass("bg-red-600");
  });

  it("does not call onConfirm when disabled and clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteFieldModal
        fieldName="Test Field"
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        open={true}
        usageCount={3}
      />
    );

    const deleteButton = screen.getByText("Delete Field");
    await user.click(deleteButton);

    // Button is disabled, so click should not trigger onConfirm
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("handles null fieldName gracefully", () => {
    render(
      <ConfirmDeleteFieldModal
        fieldName={null}
        isLoading={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        usageCount={0}
      />
    );

    expect(screen.getByText("Delete Field?")).toBeInTheDocument();
  });
});
