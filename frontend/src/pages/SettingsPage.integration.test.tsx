import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/renderWithRouter";
import type { FieldSchemaResponse } from "@/types/schema";
import { SettingsPage } from "./SettingsPage";

// Mock the hooks
vi.mock("@/hooks/useSchemas", () => ({
  useSchemas: vi.fn(),
  useSchema: vi.fn(),
  usePrefetchSchema: vi.fn(() => vi.fn()),
  useCreateSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDuplicateSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useAddFieldToSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useRemoveFieldFromSchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateSchemaField: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useReorderSchemaFields: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateSchemaFieldsBatch: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useSchemaUsageStats: vi.fn(() => ({ count: 0, tagNames: [] })),
  schemasOptions: vi.fn(),
  schemaOptions: vi.fn(),
  schemasKeys: {
    all: () => ["schemas"],
    lists: () => ["schemas", "list"],
    list: (listId: string) => ["schemas", "list", listId],
    details: () => ["schemas", "detail"],
    detail: (schemaId: string) => ["schemas", "detail", schemaId],
  },
}));

vi.mock("@/hooks/useLists", () => ({
  useLists: vi.fn(),
}));

vi.mock("@/hooks/useTags", () => ({
  useTags: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateTag: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateTag: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteTag: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useBulkApplySchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    data: null,
  })),
  tagsOptions: vi.fn(() => ({
    queryKey: ["tags"],
    queryFn: vi.fn(),
  })),
}));

vi.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useUpdateCustomField: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteCustomField: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useFieldUsageCounts: vi.fn(() => new Map()),
}));

import { useLists } from "@/hooks/useLists";
import { useSchemas } from "@/hooks/useSchemas";
import { useTags } from "@/hooks/useTags";

const mockLists = [
  {
    id: "list-1",
    name: "My List",
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
  },
];

const mockSchemas: FieldSchemaResponse[] = [
  {
    id: "schema-1",
    list_id: "list-1",
    name: "Makeup Tutorial Criteria",
    description: "Fields for rating makeup tutorials",
    created_at: "2025-11-08T10:00:00Z",
    updated_at: "2025-11-08T10:00:00Z",
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
          name: "Presentation Quality",
          field_type: "rating",
          config: { max_rating: 5 },
          created_at: "2025-11-08T09:00:00Z",
          updated_at: "2025-11-08T09:00:00Z",
        },
      },
    ],
  },
];

describe("SettingsPage Integration", () => {
  // ✨ FIX #2: Added afterEach cleanup
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Default mock setup
    vi.mocked(useLists).mockReturnValue({
      data: mockLists,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useSchemas).mockReturnValue({
      data: mockSchemas,
      isLoading: false,
      isError: false,
    } as any);
  });

  it("renders complete settings page with schemas", async () => {
    renderWithRouter(<SettingsPage />);

    // Page header
    expect(screen.getByText("Settings")).toBeInTheDocument();

    // Tabs
    expect(screen.getByRole("tab", { name: /schemas/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /fields/i })).toBeInTheDocument();

    // Create button
    expect(
      screen.getByRole("button", { name: /create schema/i })
    ).toBeInTheDocument();

    // Wait for schemas to load
    await waitFor(() => {
      expect(screen.getByText("Makeup Tutorial Criteria")).toBeInTheDocument();
    });
  });

  it("switches between tabs", async () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null });
    renderWithRouter(<SettingsPage />);

    // Initially on Schemas tab
    await waitFor(() => {
      expect(screen.getByText(/no schemas yet/i)).toBeInTheDocument();
    });

    // Click Fields tab
    await user.click(screen.getByRole("tab", { name: /fields/i }));

    // Fields tab content shown (empty state since no fields)
    await waitFor(() => {
      expect(screen.getByText(/no custom fields yet/i)).toBeInTheDocument();
    });
  });

  it("handles create schema button click", async () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null });
    renderWithRouter(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create schema/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /create schema/i }));

    // SchemaCreationDialog should open (check for dialog heading)
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /create schema/i })
      ).toBeInTheDocument();
    });
  });

  it("handles schema action menu interactions", async () => {
    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null });
    renderWithRouter(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Makeup Tutorial Criteria")).toBeInTheDocument();
    });

    // Open action menu
    const actionButton = screen.getByRole("button", {
      name: /actions for makeup tutorial criteria/i,
    });
    await user.click(actionButton);

    // Menu should be visible with options
    await waitFor(() => {
      expect(screen.getByText("Schema bearbeiten")).toBeInTheDocument();
      expect(screen.getByText("Schema duplizieren")).toBeInTheDocument();
      expect(screen.getByText("Schema löschen")).toBeInTheDocument();
    });
  });

  // ✨ FIX #7 (Optional): Error handling test
  it("handles network error gracefully", async () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any);

    renderWithRouter(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/error loading schemas/i)).toBeInTheDocument();
    });
  });
});

describe("SettingsPage - Tags Tab", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(useLists).mockReturnValue({
      data: mockLists,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useSchemas).mockReturnValue({
      data: mockSchemas,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useTags).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);
  });

  it("renders Tags tab and displays TagsList", async () => {
    const user = userEvent.setup({ delay: null });
    renderWithRouter(<SettingsPage />);

    const tagsTab = screen.getByRole("tab", { name: /tags/i });
    expect(tagsTab).toBeInTheDocument();

    await user.click(tagsTab);

    await waitFor(() => {
      expect(screen.getByText(/manage your tags/i)).toBeInTheDocument();
    });
  });

  it("shows tags in the list when data is available", async () => {
    const mockTags = [
      {
        id: "tag-1",
        name: "Python",
        color: "#3B82F6",
        schema_id: null,
        user_id: "user-1",
        created_at: "2025-11-18T10:00:00Z",
        updated_at: "2025-11-18T10:00:00Z",
      },
      {
        id: "tag-2",
        name: "Tutorial",
        color: "#10B981",
        schema_id: "schema-1",
        user_id: "user-1",
        created_at: "2025-11-18T11:00:00Z",
        updated_at: "2025-11-18T11:00:00Z",
      },
    ];

    vi.mocked(useTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
      error: null,
    } as any);

    const user = userEvent.setup({ delay: null });
    renderWithRouter(<SettingsPage />);

    await user.click(screen.getByRole("tab", { name: /tags/i }));

    await waitFor(() => {
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("Tutorial")).toBeInTheDocument();
    });
  });

  it("shows empty state when no tags", async () => {
    vi.mocked(useTags).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    const user = userEvent.setup({ delay: null });
    renderWithRouter(<SettingsPage />);

    await user.click(screen.getByRole("tab", { name: /tags/i }));

    await waitFor(() => {
      expect(screen.getByText(/no tags yet/i)).toBeInTheDocument();
    });
  });
});
