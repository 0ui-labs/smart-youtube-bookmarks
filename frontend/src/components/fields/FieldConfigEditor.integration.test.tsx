import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { FieldType } from "@/types/customField";
import { FieldConfigEditor } from "./FieldConfigEditor";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Plus: () => <span data-testid="plus-icon" />,
  X: () => <span data-testid="x-icon" />,
  GripVertical: () => <span data-testid="grip-icon" />,
  Check: () => <span data-testid="check-icon" />,
}));

// Test wrapper with React Hook Form
function TestWrapper({
  initialFieldType,
  initialConfig,
}: {
  initialFieldType: FieldType;
  initialConfig: any;
}) {
  const form = useForm({
    defaultValues: {
      fieldType: initialFieldType,
      config: initialConfig,
    },
  });

  const fieldType = form.watch("fieldType");
  const config = form.watch("config");

  return (
    <FormProvider {...form}>
      <div>
        {/* Field Type Switcher */}
        <select
          aria-label="Field Type"
          onChange={(e) => {
            const newType = e.target.value as FieldType;
            form.setValue("fieldType", newType);

            // Reset config based on new type
            if (newType === "select") {
              form.setValue("config", {
                options: [{ value: "Default Option" }],
              });
            } else if (newType === "rating") {
              form.setValue("config", { max_rating: 5 });
            } else if (newType === "text") {
              form.setValue("config", {});
            } else if (newType === "boolean") {
              form.setValue("config", {});
            }
          }}
          value={fieldType}
        >
          <option value="select">Select</option>
          <option value="rating">Rating</option>
          <option value="text">Text</option>
          <option value="boolean">Boolean</option>
        </select>

        {/* Field Config Editor */}
        <FieldConfigEditor
          config={config}
          control={form.control}
          fieldType={fieldType}
          onChange={(newConfig) => form.setValue("config", newConfig)}
        />
      </div>
    </FormProvider>
  );
}

describe("FieldConfigEditor - Integration Tests", () => {
  describe("Type Switching", () => {
    it("switches from select to rating config editor", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          initialConfig={{ options: [{ value: "Option 1" }] }}
          initialFieldType="select"
        />
      );

      // Initially shows select config
      expect(
        screen.getByPlaceholderText(/neue option hinzufügen/i)
      ).toBeInTheDocument();

      // Switch to rating
      await user.selectOptions(screen.getByLabelText("Field Type"), "rating");

      // Should now show rating config
      await waitFor(() => {
        expect(
          screen.getByLabelText(/maximale bewertung/i)
        ).toBeInTheDocument();
      });

      // Select config should be gone
      expect(
        screen.queryByPlaceholderText(/neue option hinzufügen/i)
      ).not.toBeInTheDocument();
    });

    it("switches from rating to text config editor", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          initialConfig={{ max_rating: 5 }}
          initialFieldType="rating"
        />
      );

      // Initially shows rating config
      expect(screen.getByLabelText(/maximale bewertung/i)).toBeInTheDocument();

      // Switch to text
      await user.selectOptions(screen.getByLabelText("Field Type"), "text");

      // Should now show text config
      await waitFor(() => {
        expect(
          screen.getByLabelText(/zeichenlimit festlegen/i)
        ).toBeInTheDocument();
      });

      // Rating config should be gone
      expect(
        screen.queryByLabelText(/maximale bewertung/i)
      ).not.toBeInTheDocument();
    });
  });
});
