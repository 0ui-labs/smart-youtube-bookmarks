/**
 * DuplicateWarning Component Tests (Task #125 Phase 2)
 *
 * Tests all states and behaviors:
 * - Empty field name (silent)
 * - Loading state with spinner
 * - Duplicate exists with field details
 * - No duplicate (silent success)
 * - API error handling
 * - Network error handling
 * - Debouncing behavior
 * - Config preview formatting (select, rating, text, boolean)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as customFieldsApi from "@/api/customFields";
import type { CustomField } from "@/types/customFields";
import { DuplicateWarning } from "./DuplicateWarning";

// Mock API functions
vi.mock("@/api/customFields", () => ({
  checkFieldNameDuplicate: vi.fn(),
}));

// Helper to render with QueryClient
function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("DuplicateWarning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no duplicate exists
    vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
      exists: false,
      field: null,
    });
  });
  describe("Empty field name", () => {
    it("renders nothing when field name is empty", () => {
      const { container } = renderWithQuery(
        <DuplicateWarning fieldName="" listId="list-123" />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when field name is only whitespace", () => {
      const { container } = renderWithQuery(
        <DuplicateWarning fieldName="   " listId="list-123" />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Loading state", () => {
    it("shows loading spinner while checking for duplicates", async () => {
      // Mock slow API response
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ exists: false, field: null }), 100);
          })
      );

      renderWithQuery(
        <DuplicateWarning
          debounceMs={0}
          fieldName="Rating"
          listId="list-123" // No debounce for testing
        />
      );

      // Should show loading state
      expect(screen.getByText("Prüfe auf Duplikate...")).toBeInTheDocument();
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Duplicate exists", () => {
    it("shows warning when duplicate rating field exists", async () => {
      const existingField: CustomField = {
        id: "field-123",
        list_id: "list-123",
        name: "Overall Rating",
        field_type: "rating",
        config: { max_rating: 5 },
        created_at: "2025-11-12T10:00:00Z",
        updated_at: "2025-11-12T10:00:00Z",
      };

      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: existingField,
      });

      renderWithQuery(
        <DuplicateWarning
          debounceMs={0}
          fieldName="Overall Rating"
          listId="list-123"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText("Feld existiert bereits")).toBeInTheDocument();
      expect(screen.getByText(/"Overall Rating"/)).toBeInTheDocument();
      expect(screen.getByText(/Typ:/)).toBeInTheDocument();
      expect(screen.getByText(/Bewertung/)).toBeInTheDocument();
      expect(screen.getByText(/1-5 Sterne/)).toBeInTheDocument();
    });

    it("shows warning with select field config preview", async () => {
      const existingField: CustomField = {
        id: "field-456",
        list_id: "list-123",
        name: "Quality",
        field_type: "select",
        config: { options: ["bad", "good", "great"] },
        created_at: "2025-11-12T10:00:00Z",
        updated_at: "2025-11-12T10:00:00Z",
      };

      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: existingField,
      });

      renderWithQuery(
        <DuplicateWarning
          debounceMs={0}
          fieldName="Quality"
          listId="list-123"
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Optionen: bad, good, great/)
        ).toBeInTheDocument();
      });
    });

    it("truncates select options to 3 with +N more", async () => {
      const existingField: CustomField = {
        id: "field-789",
        list_id: "list-123",
        name: "Status",
        field_type: "select",
        config: {
          options: ["draft", "review", "approved", "published", "archived"],
        },
        created_at: "2025-11-12T10:00:00Z",
        updated_at: "2025-11-12T10:00:00Z",
      };

      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: existingField,
      });

      renderWithQuery(
        <DuplicateWarning debounceMs={0} fieldName="Status" listId="list-123" />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Optionen: draft, review, approved \+2 weitere/)
        ).toBeInTheDocument();
      });
    });

    it("shows text field with max_length", async () => {
      const existingField: CustomField = {
        id: "field-abc",
        list_id: "list-123",
        name: "Notes",
        field_type: "text",
        config: { max_length: 500 },
        created_at: "2025-11-12T10:00:00Z",
        updated_at: "2025-11-12T10:00:00Z",
      };

      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: existingField,
      });

      renderWithQuery(
        <DuplicateWarning debounceMs={0} fieldName="Notes" listId="list-123" />
      );

      await waitFor(() => {
        expect(screen.getByText(/Max\. 500 Zeichen/)).toBeInTheDocument();
      });
    });

    it("shows text field without max_length", async () => {
      const existingField: CustomField = {
        id: "field-def",
        list_id: "list-123",
        name: "Description",
        field_type: "text",
        config: {},
        created_at: "2025-11-12T10:00:00Z",
        updated_at: "2025-11-12T10:00:00Z",
      };

      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: existingField,
      });

      renderWithQuery(
        <DuplicateWarning
          debounceMs={0}
          fieldName="Description"
          listId="list-123"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Unbegrenzte Länge/)).toBeInTheDocument();
      });
    });

    it("shows boolean field preview", async () => {
      const existingField: CustomField = {
        id: "field-ghi",
        list_id: "list-123",
        name: "Recommended",
        field_type: "boolean",
        config: {},
        created_at: "2025-11-12T10:00:00Z",
        updated_at: "2025-11-12T10:00:00Z",
      };

      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: existingField,
      });

      renderWithQuery(
        <DuplicateWarning
          debounceMs={0}
          fieldName="Recommended"
          listId="list-123"
        />
      );

      await waitFor(() => {
        // Check for "Typ: Ja/Nein" to be more specific
        expect(screen.getByText(/Typ:/)).toBeInTheDocument();
        const allJaNein = screen.getAllByText(/Ja\/Nein/);
        expect(allJaNein.length).toBeGreaterThan(0);
      });
    });
  });

  describe("No duplicate", () => {
    it("renders nothing when field name is available", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: false,
        field: null,
      });

      const { container } = renderWithQuery(
        <DuplicateWarning
          debounceMs={0}
          fieldName="New Field"
          listId="list-123"
        />
      );

      // Wait for loading to finish
      await waitFor(() => {
        expect(
          screen.queryByText("Prüfe auf Duplikate...")
        ).not.toBeInTheDocument();
      });

      // Should render nothing (silent success)
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("shows error message when API call fails", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockRejectedValue(
        new Error("API error")
      );

      renderWithQuery(
        <DuplicateWarning debounceMs={0} fieldName="Rating" listId="list-123" />
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText("Fehler beim Prüfen")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Die Duplikatsprüfung konnte nicht durchgeführt werden/
        )
      ).toBeInTheDocument();
    });

    it("shows error message on network error", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockRejectedValue(
        new Error("Network error")
      );

      renderWithQuery(
        <DuplicateWarning debounceMs={0} fieldName="Rating" listId="list-123" />
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText("Fehler beim Prüfen")).toBeInTheDocument();
    });
  });

  describe("Debouncing", () => {
    it("debounces API calls with custom delay", async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: false,
        field: null,
      });

      // Create single QueryClient for consistent query state
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      // Start with empty field name (no API call)
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <DuplicateWarning debounceMs={500} fieldName="" listId="list-123" />
        </QueryClientProvider>
      );

      // Now start typing - fast updates should be debounced
      rerender(
        <QueryClientProvider client={queryClient}>
          <DuplicateWarning debounceMs={500} fieldName="R" listId="list-123" />
        </QueryClientProvider>
      );

      rerender(
        <QueryClientProvider client={queryClient}>
          <DuplicateWarning debounceMs={500} fieldName="Ra" listId="list-123" />
        </QueryClientProvider>
      );

      rerender(
        <QueryClientProvider client={queryClient}>
          <DuplicateWarning
            debounceMs={500}
            fieldName="Rat"
            listId="list-123"
          />
        </QueryClientProvider>
      );

      // Wait a short time - API should not be called yet due to debounce
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(customFieldsApi.checkFieldNameDuplicate).not.toHaveBeenCalled();

      // Wait for full debounce period
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Now API should be called once with the final value
      await waitFor(() => {
        expect(customFieldsApi.checkFieldNameDuplicate).toHaveBeenCalledTimes(
          1
        );
        expect(customFieldsApi.checkFieldNameDuplicate).toHaveBeenCalledWith(
          "list-123",
          "Rat"
        );
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA roles for loading state", () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ exists: false, field: null }), 100);
          })
      );

      renderWithQuery(
        <DuplicateWarning debounceMs={0} fieldName="Rating" listId="list-123" />
      );

      // Spinner should have aria-hidden
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toHaveAttribute("aria-hidden", "true");
    });

    it('has role="alert" for duplicate warning', async () => {
      const existingField: CustomField = {
        id: "field-123",
        list_id: "list-123",
        name: "Rating",
        field_type: "rating",
        config: { max_rating: 5 },
        created_at: "2025-11-12T10:00:00Z",
        updated_at: "2025-11-12T10:00:00Z",
      };

      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockResolvedValue({
        exists: true,
        field: existingField,
      });

      renderWithQuery(
        <DuplicateWarning debounceMs={0} fieldName="Rating" listId="list-123" />
      );

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
      });
    });

    it('has role="alert" for error state', async () => {
      vi.mocked(customFieldsApi.checkFieldNameDuplicate).mockRejectedValue(
        new Error("API error")
      );

      renderWithQuery(
        <DuplicateWarning debounceMs={0} fieldName="Rating" listId="list-123" />
      );

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
      });
    });
  });
});
