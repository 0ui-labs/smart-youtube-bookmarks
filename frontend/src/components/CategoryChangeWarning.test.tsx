/**
 * Unit Tests for CategoryChangeWarning Component
 * Phase 5 Step 5.4-5.6 (TDD)
 *
 * Tests the warning dialog that shows when changing a video's category.
 * Features:
 * - Shows fields that will be backed up
 * - Shows fields that will persist (workspace fields)
 * - Offers restore checkbox when previous backup exists
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tag } from "@/types/tag";
import { CategoryChangeWarning } from "./CategoryChangeWarning";

// Mock categories
const mockOldCategory: Tag = {
  id: "cat-old",
  name: "Keto Rezepte",
  color: "#FF5722",
  schema_id: "schema-1",
  is_video_type: true,
  user_id: "user-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockNewCategory: Tag = {
  id: "cat-new",
  name: "Vegan",
  color: "#4CAF50",
  schema_id: "schema-2",
  is_video_type: true,
  user_id: "user-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Mock field values that will be backed up (category-specific)
const mockFieldValuesToBackup = [
  {
    id: "fv-1",
    field_id: "field-1",
    value: 500,
    field: { id: "field-1", name: "Kalorien", field_type: "number" as const },
  },
  {
    id: "fv-2",
    field_id: "field-2",
    value: "Lecker",
    field: { id: "field-2", name: "Bewertung", field_type: "text" as const },
  },
];

// Mock field values that will persist (workspace fields)
const mockFieldValuesThatPersist = [
  {
    id: "fv-3",
    field_id: "field-3",
    value: "Notiz zum Video",
    field: { id: "field-3", name: "Notizen", field_type: "text" as const },
  },
];

describe("CategoryChangeWarning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Step 5.4: Dialog Shell tests
  describe("Dialog Shell (Step 5.4)", () => {
    it("renders dialog when open is true", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      // Use heading role to target the title specifically
      expect(
        screen.getByRole("heading", { name: /kategorie ändern/i })
      ).toBeInTheDocument();
    });

    it("does not render dialog when open is false", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={false}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows warning icon in dialog title", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      // AlertTriangle icon should be present
      expect(screen.getByTestId("warning-icon")).toBeInTheDocument();
    });

    it("shows category change description", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(screen.getByText(/Keto Rezepte/)).toBeInTheDocument();
      expect(screen.getByText(/Vegan/)).toBeInTheDocument();
    });

    it("calls onCancel when cancel button clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={onCancel}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      await user.click(screen.getByRole("button", { name: /abbrechen/i }));
      expect(onCancel).toHaveBeenCalled();
    });

    it("calls onConfirm with false when confirm button clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      await user.click(
        screen.getByRole("button", { name: /kategorie ändern/i })
      );
      expect(onConfirm).toHaveBeenCalledWith(false);
    });
  });

  // Step 5.5: Fields To Backup Section
  describe("Fields To Backup Section (Step 5.5)", () => {
    it("shows fields that will be backed up", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={mockFieldValuesToBackup}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(
        screen.getByText(/folgende werte werden gesichert/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Kalorien")).toBeInTheDocument();
      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("Bewertung")).toBeInTheDocument();
      expect(screen.getByText("Lecker")).toBeInTheDocument();
    });

    it("shows fields that will persist (workspace fields)", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={mockFieldValuesThatPersist}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(screen.getByText(/folgenden felder bleiben/i)).toBeInTheDocument();
      expect(screen.getByText("Notizen")).toBeInTheDocument();
      expect(screen.getByText("Notiz zum Video")).toBeInTheDocument();
    });

    it("does not show backup section when no fields to backup", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(
        screen.queryByText(/folgende werte werden gesichert/i)
      ).not.toBeInTheDocument();
    });

    it("does not show persist section when no fields persist", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={mockFieldValuesToBackup}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(
        screen.queryByText(/folgenden felder bleiben/i)
      ).not.toBeInTheDocument();
    });
  });

  // Step 5.6: Restore Checkbox
  describe("Restore Checkbox (Step 5.6)", () => {
    it("shows restore option when backup exists", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={true}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(
        screen.getByText(/gesicherte werte gefunden/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", {
          name: /gesicherte werte wiederherstellen/i,
        })
      ).toBeInTheDocument();
    });

    it("does not show restore option when no backup exists", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(
        screen.queryByText(/gesicherte werte gefunden/i)
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("calls onConfirm with true when checkbox is checked and confirm clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={true}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      // Check the restore checkbox
      const checkbox = screen.getByRole("checkbox", {
        name: /gesicherte werte wiederherstellen/i,
      });
      await user.click(checkbox);

      // Click confirm
      await user.click(
        screen.getByRole("button", { name: /kategorie ändern/i })
      );

      expect(onConfirm).toHaveBeenCalledWith(true);
    });

    it("shows category name in restore message", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={true}
          newCategory={mockNewCategory}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      // Message should mention the new category name (appears multiple times, use getAllByText)
      const veganElements = screen.getAllByText(/Vegan/);
      expect(veganElements.length).toBeGreaterThan(0);
    });
  });

  // Edge cases
  describe("Edge Cases", () => {
    it("handles null oldCategory (assigning first category)", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={[]}
          hasBackup={false}
          newCategory={mockNewCategory}
          oldCategory={null}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("handles null newCategory (removing category)", () => {
      render(
        <CategoryChangeWarning
          fieldValuesThatPersist={[]}
          fieldValuesToBackup={mockFieldValuesToBackup}
          hasBackup={false}
          newCategory={null}
          oldCategory={mockOldCategory}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      // Use heading role to target the title specifically
      expect(
        screen.getByRole("heading", { name: /kategorie entfernen/i })
      ).toBeInTheDocument();
    });
  });
});
