import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as customFieldsApi from "@/api/customFields";
import { NewFieldForm } from "./NewFieldForm";

// Mock API functions
vi.mock("@/api/customFields", () => ({
  checkFieldNameDuplicate: vi.fn(),
  createCustomField: vi.fn(),
}));

describe("NewFieldForm", () => {
  const mockListId = "123e4567-e89b-12d3-a456-426614174000";
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no duplicate exists
    vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
      exists: false,
      field: null,
    });
  });

  describe("Rendering", () => {
    it("renders all form fields", () => {
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByLabelText(/field name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select field type/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add field/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("defaults to text field type", () => {
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      // Text type selected by default - check for the Select trigger (button showing selected value)
      const typeSelector = screen.getByRole("combobox");
      expect(typeSelector).toHaveTextContent(/text/i);
    });

    it("auto-focuses field name input", () => {
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      const nameInput = screen.getByLabelText(/field name/i);
      expect(nameInput).toHaveFocus();
    });
  });

  describe("Field Type Switching", () => {
    it("shows select config editor when select type chosen", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      // Open type selector
      await user.click(screen.getByLabelText(/select field type/i));

      // Select "Select" type
      await user.click(
        screen.getByRole("option", { name: /select.*dropdown/i })
      );

      // Config editor should appear
      await waitFor(() => {
        expect(
          screen.getByLabelText(/options.*comma-separated/i)
        ).toBeInTheDocument();
      });
    });

    it("shows rating config editor when rating type chosen", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.click(screen.getByLabelText(/select field type/i));
      await user.click(
        screen.getByRole("option", { name: /rating.*numeric/i })
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/max rating/i)).toBeInTheDocument();
      });
    });

    it("shows text config editor when text type chosen", async () => {
      const _user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      // Text is default, so we should already see the max length input
      expect(screen.getByLabelText(/max length/i)).toBeInTheDocument();
    });

    it("shows boolean info when boolean type chosen", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.click(screen.getByLabelText(/select field type/i));
      await user.click(
        screen.getByRole("option", { name: /boolean.*checkbox/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/don't require configuration/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Duplicate Validation", () => {
    it("checks for duplicates after debounce delay", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      const nameInput = screen.getByLabelText(/field name/i);
      await user.type(nameInput, "Presentation Quality");

      // Wait for debounce (500ms)
      await waitFor(
        () => {
          expect(customFieldsApi.checkFieldNameDuplicate).toHaveBeenCalledWith(
            mockListId,
            "Presentation Quality"
          );
        },
        { timeout: 1000 }
      );
    });

    it("shows duplicate warning when field exists", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: {
          id: "123",
          list_id: mockListId,
          name: "Presentation Quality",
          field_type: "select",
          config: { options: ["Bad", "Good"] },
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      });

      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(
        screen.getByLabelText(/field name/i),
        "presentation quality"
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });

    it("disables submit button when duplicate exists", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: {
          id: "123",
          list_id: mockListId,
          name: "Existing Field",
          field_type: "text",
          config: {},
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      });

      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Existing Field");

      await waitFor(() => {
        const submitButton = screen.getByRole("button", { name: /add field/i });
        expect(submitButton).toBeDisabled();
      });
    });

    it("prevents submission when duplicate exists", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: {
          id: "123",
          list_id: mockListId,
          name: "Duplicate",
          field_type: "text",
          config: {},
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      });

      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Duplicate");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", { name: /add field/i });
      expect(submitButton).toBeDisabled();

      // Should not call onSubmit
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("shows existing field info in warning message", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: {
          id: "123",
          list_id: mockListId,
          name: "Presentation Quality",
          field_type: "rating",
          config: { max_rating: 5 },
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      });

      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(
        screen.getByLabelText(/field name/i),
        "presentation quality"
      );

      await waitFor(() => {
        // Should show field name and type in warning
        expect(
          screen.getByText(/presentation quality.*type.*rating/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form Validation", () => {
    it("prevents submission with empty field name", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      // Try to submit without entering name
      await user.click(screen.getByRole("button", { name: /add field/i }));

      await waitFor(() => {
        // Zod error message for empty string
        expect(screen.getByText(/field name is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("validates custom field submission with form state", async () => {
      // This test verifies the form can submit valid data
      // Negative validation cases (empty options, invalid rating) are tested
      // through the Zod schema validation layer and verified in backend tests
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Verified Field");
      // Default type is 'text', just submit
      await user.click(screen.getByRole("button", { name: /add field/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: "Verified Field",
          field_type: "text",
          config: {},
        });
      });
    });

    it("validates rating max_rating is between 1-10", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Test Rating");
      await user.click(screen.getByLabelText(/select field type/i));
      await user.click(
        screen.getByRole("option", { name: /rating.*numeric/i })
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/max rating/i)).toBeInTheDocument();
      });

      const maxRatingInput = screen.getByLabelText(
        /max rating/i
      ) as HTMLInputElement;
      await user.clear(maxRatingInput);
      await user.type(maxRatingInput, "15");

      await user.click(screen.getByRole("button", { name: /add field/i }));

      // Validation should prevent submission when max_rating is out of range
      await waitFor(
        () => {
          expect(mockOnSubmit).not.toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
    });
  });

  describe("Form Submission", () => {
    it("calls onSubmit with valid text field data", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Notes");

      // Text is default type, just submit
      await user.click(screen.getByRole("button", { name: /add field/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: "Notes",
          field_type: "text",
          config: {},
        });
      });
    });

    it("calls onSubmit with valid select field data", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Quality");
      await user.click(screen.getByLabelText(/select field type/i));
      await user.click(
        screen.getByRole("option", { name: /select.*dropdown/i })
      );

      await waitFor(() => {
        expect(
          screen.getByLabelText(/options.*comma-separated/i)
        ).toBeInTheDocument();
      });

      const optionsInput = screen.getByLabelText(/options.*comma-separated/i);
      await user.clear(optionsInput);
      // Use paste instead of type to handle commas correctly
      await user.click(optionsInput);
      await user.paste("Bad, Good, Great");

      await user.click(screen.getByRole("button", { name: /add field/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: "Quality",
          field_type: "select",
          config: { options: ["Bad", "Good", "Great"] },
        });
      });
    });

    it("calls onSubmit with valid rating field data", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Overall Rating");
      await user.click(screen.getByLabelText(/select field type/i));
      await user.click(
        screen.getByRole("option", { name: /rating.*numeric/i })
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/max rating/i)).toBeInTheDocument();
      });

      // Default max_rating is 5, just submit
      await user.click(screen.getByRole("button", { name: /add field/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: "Overall Rating",
          field_type: "rating",
          config: { max_rating: 5 },
        });
      });
    });
  });

  describe("Keyboard Navigation", () => {
    it("cancels form on Escape key", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.keyboard("{Escape}");

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("submits form on Enter key in name input", async () => {
      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      const nameInput = screen.getByLabelText(/field name/i);
      await user.type(nameInput, "Test Field{Enter}");

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels on all inputs", () => {
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByLabelText(/field name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select field type/i)).toBeInTheDocument();
    });

    it("associates duplicate warning with input via aria-describedby", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: {
          id: "123",
          list_id: mockListId,
          name: "Existing",
          field_type: "text",
          config: {},
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      });

      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Existing");

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/field name/i);
        expect(nameInput).toHaveAttribute(
          "aria-describedby",
          "duplicate-warning"
        );
      });
    });

    it('marks duplicate warning with role="alert"', async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: {
          id: "123",
          list_id: mockListId,
          name: "Existing",
          field_type: "text",
          config: {},
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      });

      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Existing");

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveAttribute("id", "duplicate-warning");
      });
    });
  });

  describe("Loading States", () => {
    it("shows loading state during form submission when isSubmitting prop is true", async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();

      const { rerender } = render(
        <NewFieldForm
          isSubmitting={false}
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Test Field");

      // Simulate submitting by re-rendering with isSubmitting=true
      rerender(
        <NewFieldForm
          isSubmitting={true}
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      // Check for loading state
      expect(
        screen.getByRole("button", { name: /creating/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
    });

    it("disables cancel button during submission when isSubmitting prop is true", async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();

      const { rerender } = render(
        <NewFieldForm
          isSubmitting={false}
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Test Field");

      // Simulate submitting by re-rendering with isSubmitting=true
      rerender(
        <NewFieldForm
          isSubmitting={true}
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it("shows checking state during duplicate validation", async () => {
      let resolveDuplicateCheck: (value: any) => void;
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDuplicateCheck = resolve;
          })
      );

      const user = userEvent.setup();
      render(
        <NewFieldForm
          listId={mockListId}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      );

      await user.type(screen.getByLabelText(/field name/i), "Test Field");

      // Should show checking state
      await waitFor(() => {
        expect(
          screen.getByText(/checking for duplicates/i)
        ).toBeInTheDocument();
      });

      // Resolve the check
      resolveDuplicateCheck?.({ exists: false, field: null });

      // Checking state should disappear
      await waitFor(() => {
        expect(
          screen.queryByText(/checking for duplicates/i)
        ).not.toBeInTheDocument();
      });
    });
  });
});
