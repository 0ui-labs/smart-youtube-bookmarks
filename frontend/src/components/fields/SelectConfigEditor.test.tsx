import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SelectConfigEditor } from "./SelectConfigEditor";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Plus: () => <span data-testid="plus-icon" />,
  X: () => <span data-testid="x-icon" />,
  GripVertical: () => <span data-testid="grip-icon" />,
  Check: () => <span data-testid="check-icon" />,
}));

// Wrapper component to provide React Hook Form context
function TestWrapper({
  defaultOptions = ["Option 1"],
}: {
  defaultOptions?: string[];
}) {
  const form = useForm({
    defaultValues: {
      config: {
        options: defaultOptions.map((value) => ({ value })),
      },
    },
  });

  return (
    <FormProvider {...form}>
      <SelectConfigEditor control={form.control} />
    </FormProvider>
  );
}

describe("SelectConfigEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders existing options list", () => {
      render(<TestWrapper defaultOptions={["Good", "Bad"]} />);

      expect(screen.getByDisplayValue("Good")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Bad")).toBeInTheDocument();
    });

    it("renders empty state when no options exist", () => {
      render(<TestWrapper defaultOptions={[]} />);

      expect(screen.getByText(/noch keine optionen/i)).toBeInTheDocument();
    });

    it("renders add option input and button", () => {
      render(<TestWrapper />);

      expect(
        screen.getByPlaceholderText(/neue option hinzufügen/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /option hinzufügen/i })
      ).toBeInTheDocument();
    });
  });

  describe("Adding Options", () => {
    it("adds new option when clicking add button", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Option 1"]} />);

      const input = screen.getByPlaceholderText(/neue option hinzufügen/i);
      await user.type(input, "New Option");
      await user.click(
        screen.getByRole("button", { name: /option hinzufügen/i })
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue("New Option")).toBeInTheDocument();
      });
    });

    it("adds option on Enter key press", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Option 1"]} />);

      const input = screen.getByPlaceholderText(/neue option hinzufügen/i);
      await user.type(input, "Another Option{Enter}");

      await waitFor(() => {
        expect(screen.getByDisplayValue("Another Option")).toBeInTheDocument();
      });
    });

    it("clears input after adding option", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Option 1"]} />);

      const input = screen.getByPlaceholderText(
        /neue option hinzufügen/i
      ) as HTMLInputElement;
      await user.type(input, "Test{Enter}");

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    it("trims whitespace when adding option", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Option 1"]} />);

      const input = screen.getByPlaceholderText(/neue option hinzufügen/i);
      await user.type(input, "  Trimmed Option  {Enter}");

      await waitFor(() => {
        expect(screen.getByDisplayValue("Trimmed Option")).toBeInTheDocument();
      });
    });
  });

  describe("Validation", () => {
    it("shows error when adding empty option", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Option 1"]} />);

      await user.click(
        screen.getByRole("button", { name: /option hinzufügen/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/option darf nicht leer sein/i)
        ).toBeInTheDocument();
      });
    });

    it("shows error when adding duplicate option (case-insensitive)", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Good"]} />);

      const input = screen.getByPlaceholderText(/neue option hinzufügen/i);
      await user.type(input, "good");
      await user.click(
        screen.getByRole("button", { name: /option hinzufügen/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/diese option existiert bereits/i)
        ).toBeInTheDocument();
      });
    });

    it("clears error when typing after duplicate error", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Good"]} />);

      const input = screen.getByPlaceholderText(/neue option hinzufügen/i);
      await user.type(input, "Good");
      await user.click(
        screen.getByRole("button", { name: /option hinzufügen/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/diese option existiert bereits/i)
        ).toBeInTheDocument();
      });

      await user.clear(input);
      await user.type(input, "Better");

      await waitFor(() => {
        expect(
          screen.queryByText(/diese option existiert bereits/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Removing Options", () => {
    it("removes option when clicking X button", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Option 1", "Option 2"]} />);

      const removeButtons = screen.getAllByRole("button", {
        name: /entfernen/i,
      });
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByDisplayValue("Option 1")).not.toBeInTheDocument();
      });
    });

    it("disables remove button when only one option remains", () => {
      render(<TestWrapper defaultOptions={["Last Option"]} />);

      const removeButton = screen.getByRole("button", { name: /entfernen/i });
      expect(removeButton).toBeDisabled();
    });
  });

  describe("Editing Options", () => {
    it("renders existing options as editable inputs", () => {
      render(<TestWrapper defaultOptions={["Good", "Bad"]} />);

      const goodInput = screen.getByDisplayValue("Good");
      const badInput = screen.getByDisplayValue("Bad");

      expect(goodInput).toBeInTheDocument();
      expect(badInput).toBeInTheDocument();
      expect(goodInput).not.toHaveAttribute("readonly");
      expect(badInput).not.toHaveAttribute("readonly");
    });

    it("displays correct ARIA label for each option", () => {
      render(<TestWrapper defaultOptions={["Option 1", "Option 2"]} />);

      expect(screen.getByLabelText(/option 1/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/option 2/i)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels on option inputs", () => {
      render(<TestWrapper defaultOptions={["Option 1", "Option 2"]} />);

      expect(screen.getByLabelText(/option 1/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/option 2/i)).toBeInTheDocument();
    });

    it("marks new option input as invalid when error exists", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Option 1"]} />);

      await user.click(
        screen.getByRole("button", { name: /option hinzufügen/i })
      );

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/neue option hinzufügen/i);
        expect(input).toHaveAttribute("aria-invalid", "true");
      });
    });

    it("associates error with input via aria-describedby", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultOptions={["Option 1"]} />);

      await user.click(
        screen.getByRole("button", { name: /option hinzufügen/i })
      );

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/neue option hinzufügen/i);
        expect(input).toHaveAttribute("aria-describedby", "option-error");
      });
    });
  });
});
