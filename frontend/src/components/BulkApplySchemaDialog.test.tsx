// frontend/src/components/BulkApplySchemaDialog.test.tsx

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FieldSchemaResponse } from "@/types/schema";
import type { Tag } from "@/types/tag";
import { BulkApplySchemaDialog } from "./BulkApplySchemaDialog";

const mockTags: Tag[] = [
  {
    id: "tag-1",
    name: "Keto Recipes",
    color: "#FF0000",
    schema_id: null,
    is_video_type: true,
    list_id: "list-1",
    created_at: "2025-11-08T10:00:00Z",
    updated_at: "2025-11-08T10:00:00Z",
  },
  {
    id: "tag-2",
    name: "Makeup Tutorials",
    color: "#00FF00",
    schema_id: "schema-1",
    is_video_type: true,
    list_id: "list-1",
    created_at: "2025-11-08T10:00:00Z",
    updated_at: "2025-11-08T10:00:00Z",
  },
  {
    id: "tag-3",
    name: "React Videos",
    color: "#0000FF",
    schema_id: null,
    is_video_type: true,
    list_id: "list-1",
    created_at: "2025-11-08T10:00:00Z",
    updated_at: "2025-11-08T10:00:00Z",
  },
];

const mockSchema: FieldSchemaResponse = {
  id: "schema-1",
  list_id: "list-1",
  name: "Video Quality",
  description: "Standard quality metrics",
  schema_fields: [
    {
      id: "sf-1",
      schema_id: "schema-1",
      field_id: "field-1",
      display_order: 1,
      show_on_card: true,
      field: {
        id: "field-1",
        list_id: "list-1",
        name: "Presentation",
        field_type: "rating",
        config: { max_rating: 5 },
        created_at: "2025-11-08T09:00:00Z",
        updated_at: "2025-11-08T09:00:00Z",
      },
    },
  ],
  created_at: "2025-11-08T10:00:00Z",
  updated_at: "2025-11-08T10:00:00Z",
};

describe("BulkApplySchemaDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders dialog when open", () => {
      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      expect(screen.getByText("Schema auf Tags anwenden")).toBeInTheDocument();
      expect(screen.getByText("Video Quality")).toBeInTheDocument();
    });

    it("does not render when closed", () => {
      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={false}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      expect(
        screen.queryByText("Schema auf Tags anwenden")
      ).not.toBeInTheDocument();
    });

    it("renders all available tags with checkboxes", () => {
      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      expect(screen.getByText("Keto Recipes")).toBeInTheDocument();
      expect(screen.getByText("Makeup Tutorials")).toBeInTheDocument();
      expect(screen.getByText("React Videos")).toBeInTheDocument();

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(4); // 3 tags + "Select All"
    });

    it("shows current schema indicator for tags with schemas", () => {
      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      // Tag 2 already has schema-1
      expect(screen.getByText(/hat Schema/i)).toBeInTheDocument();
    });
  });

  describe("Tag Selection", () => {
    it("allows selecting individual tags", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      const checkbox = screen.getByLabelText("Keto Recipes");
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
      expect(screen.getByText("1 Tag ausgewählt")).toBeInTheDocument();
    });

    it("allows selecting multiple tags", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      await user.click(screen.getByLabelText("Keto Recipes"));
      await user.click(screen.getByLabelText("React Videos"));

      expect(screen.getByText("2 Tags ausgewählt")).toBeInTheDocument();
    });

    it('implements "Select All" functionality', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      const selectAllCheckbox = screen.getByLabelText(/alle auswählen/i);
      await user.click(selectAllCheckbox);

      expect(screen.getByText("3 Tags ausgewählt")).toBeInTheDocument();

      // All individual checkboxes should be checked
      const tagCheckboxes = screen.getAllByRole("checkbox").slice(1); // Skip "Select All"
      tagCheckboxes.forEach((cb) => expect(cb).toBeChecked());
    });

    it('implements "Clear Selection" via unchecking Select All', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      // Select all
      const selectAllCheckbox = screen.getByLabelText(/alle auswählen/i);
      await user.click(selectAllCheckbox);
      expect(screen.getByText("3 Tags ausgewählt")).toBeInTheDocument();

      // Clear all
      await user.click(selectAllCheckbox);
      expect(screen.getByText("0 Tags ausgewählt")).toBeInTheDocument();
    });

    it("disables confirm button when no tags selected", () => {
      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      const confirmButton = screen.getByRole("button", { name: /anwenden/i });
      expect(confirmButton).toBeDisabled();
    });

    it("enables confirm button when tags selected", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      await user.click(screen.getByLabelText("Keto Recipes"));

      const confirmButton = screen.getByRole("button", { name: /anwenden/i });
      expect(confirmButton).toBeEnabled();
    });
  });

  describe("Confirmation", () => {
    it("calls onConfirm with selected tag IDs", async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup({ delay: null });

      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      await user.click(screen.getByLabelText("Keto Recipes"));
      await user.click(screen.getByLabelText("React Videos"));
      await user.click(screen.getByRole("button", { name: /anwenden/i }));

      expect(onConfirm).toHaveBeenCalledWith(["tag-1", "tag-3"]);
    });

    it("shows warning when overwriting existing schemas", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      // Select tag-2 which already has a schema
      await user.click(screen.getByLabelText("Makeup Tutorials"));

      expect(screen.getByText(/wird überschrieben/i)).toBeInTheDocument();
    });
  });

  describe("Cancel & Close", () => {
    it("calls onCancel when cancel button clicked", async () => {
      const onCancel = vi.fn();
      const user = userEvent.setup({ delay: null });

      render(
        <BulkApplySchemaDialog
          onCancel={onCancel}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      await user.click(screen.getByRole("button", { name: /abbrechen/i }));

      expect(onCancel).toHaveBeenCalled();
    });

    it("resets selection when dialog closes and reopens", async () => {
      const user = userEvent.setup({ delay: null });
      const { rerender } = render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      // Select tag
      await user.click(screen.getByLabelText("Keto Recipes"));
      expect(screen.getByText("1 Tag ausgewählt")).toBeInTheDocument();

      // Close dialog
      rerender(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={false}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      // Reopen dialog
      rerender(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={mockTags}
        />
      );

      // Selection should be reset
      expect(screen.getByText("0 Tags ausgewählt")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty tags array gracefully", () => {
      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={[]}
        />
      );

      expect(screen.getByText(/keine tags verfügbar/i)).toBeInTheDocument();
    });

    it("filters out tags that already have this exact schema", () => {
      const tagsWithSchema = [
        { ...mockTags[0], schema_id: "schema-1" }, // Same as dialog schema
        mockTags[1],
      ];

      render(
        <BulkApplySchemaDialog
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open={true}
          schema={mockSchema}
          tags={tagsWithSchema}
        />
      );

      // Should show info that some tags are filtered out
      expect(screen.getByText(/bereits zugewiesen/i)).toBeInTheDocument();
    });
  });
});
