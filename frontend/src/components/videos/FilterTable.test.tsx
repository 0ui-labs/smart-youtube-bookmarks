import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFieldFilterStore } from "@/stores/fieldFilterStore";
import type { CategoryFilters } from "@/types/filterSettings";
import { FilterTable } from "./FilterTable";

// Mock the store
vi.mock("@/stores/fieldFilterStore", () => ({
  useFieldFilterStore: vi.fn(),
}));

describe("FilterTable", () => {
  const mockAddFilter = vi.fn();
  const mockRemoveFilter = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    vi.mocked(useFieldFilterStore).mockReturnValue({
      activeFilters: [],
      addFilter: mockAddFilter,
      removeFilter: mockRemoveFilter,
      updateFilter: vi.fn(),
      clearFilters: vi.fn(),
    });
  });

  it("renders empty state when no fields available", () => {
    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: null,
      fields: [],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    expect(
      screen.getByText("Keine Felder verfügbar für diese Kategorie.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Diese Kategorie hat kein Schema zugewiesen.")
    ).toBeInTheDocument();
  });

  it("renders table with fields when fields are available", () => {
    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-1",
          name: "Overall Rating",
          field_type: "rating",
          config: { max_rating: 5 },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        {
          id: "field-2",
          name: "Kategorie",
          field_type: "select",
          config: { options: ["Tutorial", "Review"] },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    expect(screen.getByText("Overall Rating")).toBeInTheDocument();
    expect(screen.getByText("Kategorie")).toBeInTheDocument();
    expect(screen.getAllByText("Inaktiv")).toHaveLength(2);
  });

  it("displays correct field type labels", () => {
    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-1",
          name: "Overall Rating",
          field_type: "rating",
          config: { max_rating: 5 },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        {
          id: "field-2",
          name: "Category",
          field_type: "select",
          config: { options: ["A", "B"] },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        {
          id: "field-3",
          name: "Notes",
          field_type: "text",
          config: {},
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        {
          id: "field-4",
          name: "Is Recommended",
          field_type: "boolean",
          config: {},
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    expect(screen.getByText("Bewertung")).toBeInTheDocument(); // rating type
    expect(screen.getByText("Auswahl")).toBeInTheDocument(); // select type
    expect(screen.getByText("Text")).toBeInTheDocument(); // text type
    expect(screen.getByText("Ja/Nein")).toBeInTheDocument(); // boolean type
  });

  it('adds rating filter when "Hinzufügen" button is clicked', async () => {
    const user = userEvent.setup();
    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-1",
          name: "Bewertung",
          field_type: "rating",
          config: { max_rating: 5 },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    const addButton = screen.getByRole("button", { name: /hinzufügen/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockAddFilter).toHaveBeenCalledWith({
        fieldId: "field-1",
        fieldName: "Bewertung",
        fieldType: "rating",
        operator: "gte",
        value: 1,
      });
    });
  });

  it("adds select filter with first option when button is clicked", async () => {
    const user = userEvent.setup();
    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-2",
          name: "Kategorie",
          field_type: "select",
          config: { options: ["Tutorial", "Review", "Podcast"] },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    const addButton = screen.getByRole("button", { name: /hinzufügen/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockAddFilter).toHaveBeenCalledWith({
        fieldId: "field-2",
        fieldName: "Kategorie",
        fieldType: "select",
        operator: "in",
        value: "Tutorial", // First option
      });
    });
  });

  it("adds text filter when button is clicked", async () => {
    const user = userEvent.setup();
    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-3",
          name: "Notizen",
          field_type: "text",
          config: {},
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    const addButton = screen.getByRole("button", { name: /hinzufügen/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockAddFilter).toHaveBeenCalledWith({
        fieldId: "field-3",
        fieldName: "Notizen",
        fieldType: "text",
        operator: "contains",
        value: "",
      });
    });
  });

  it("adds boolean filter when button is clicked", async () => {
    const user = userEvent.setup();
    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-4",
          name: "Empfohlen",
          field_type: "boolean",
          config: {},
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    const addButton = screen.getByRole("button", { name: /hinzufügen/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockAddFilter).toHaveBeenCalledWith({
        fieldId: "field-4",
        fieldName: "Empfohlen",
        fieldType: "boolean",
        operator: "is",
        value: true,
      });
    });
  });

  it('shows "Aktiv" badge when filter is active', () => {
    vi.mocked(useFieldFilterStore).mockReturnValue({
      activeFilters: [
        {
          id: "filter-123",
          fieldId: "field-1",
          fieldName: "Bewertung",
          fieldType: "rating",
          operator: "gte",
          value: 4,
        },
      ],
      addFilter: mockAddFilter,
      removeFilter: mockRemoveFilter,
      updateFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-1",
          name: "Bewertung",
          field_type: "rating",
          config: { max_rating: 5 },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    expect(screen.getByText("Aktiv")).toBeInTheDocument();
    expect(screen.queryByText("Inaktiv")).not.toBeInTheDocument();
  });

  it('shows "Entfernen" button when filter is active', () => {
    vi.mocked(useFieldFilterStore).mockReturnValue({
      activeFilters: [
        {
          id: "filter-123",
          fieldId: "field-1",
          fieldName: "Bewertung",
          fieldType: "rating",
          operator: "gte",
          value: 4,
        },
      ],
      addFilter: mockAddFilter,
      removeFilter: mockRemoveFilter,
      updateFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-1",
          name: "Bewertung",
          field_type: "rating",
          config: { max_rating: 5 },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    expect(
      screen.getByRole("button", { name: /entfernen/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /hinzufügen/i })
    ).not.toBeInTheDocument();
  });

  it('removes filter when "Entfernen" button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useFieldFilterStore).mockReturnValue({
      activeFilters: [
        {
          id: "filter-123",
          fieldId: "field-1",
          fieldName: "Bewertung",
          fieldType: "rating",
          operator: "gte",
          value: 4,
        },
      ],
      addFilter: mockAddFilter,
      removeFilter: mockRemoveFilter,
      updateFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    const categoryFilter: CategoryFilters = {
      categoryId: "cat-1",
      categoryName: "Tutorial",
      schemaId: "schema-1",
      fields: [
        {
          id: "field-1",
          name: "Bewertung",
          field_type: "rating",
          config: { max_rating: 5 },
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
    };

    render(<FilterTable categoryFilter={categoryFilter} />);

    const removeButton = screen.getByRole("button", { name: /entfernen/i });
    await user.click(removeButton);

    await waitFor(() => {
      expect(mockRemoveFilter).toHaveBeenCalledWith("filter-123");
    });
  });
});
