import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as useCustomFields from "./useCustomFields";
import { useFiltersByCategory } from "./useFiltersByCategory";
import * as useSchemas from "./useSchemas";
import * as useTags from "./useTags";

// Test wrapper with React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("useFiltersByCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback with all custom fields when no tags selected", async () => {
    // Mock useCustomFields to return some fields
    vi.spyOn(useCustomFields, "useCustomFields").mockReturnValue({
      data: [
        {
          id: "field-1",
          name: "Test Field",
          field_type: "text",
          config: {},
          list_id: "list-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => useFiltersByCategory("list-1", []), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toEqual([
        {
          categoryId: "all",
          categoryName: "Alle Felder",
          schemaId: null,
          fields: [
            {
              id: "field-1",
              name: "Test Field",
              field_type: "text",
              config: {},
              list_id: "list-1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          ],
        },
      ]);
    });
  });

  it("filters only is_video_type=true tags (categories)", async () => {
    // Mock useTags to return mix of categories and labels
    vi.spyOn(useTags, "useTags").mockReturnValue({
      data: [
        {
          id: "tag-1",
          name: "Tutorial",
          is_video_type: true,
          schema_id: "schema-1",
          color: "#ff0000",
          user_id: "user-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        {
          id: "tag-2",
          name: "Label",
          is_video_type: false, // This should be ignored
          schema_id: null,
          color: "#00ff00",
          user_id: "user-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    // Mock useSchema to return fields for the category
    vi.spyOn(useSchemas, "useSchema").mockReturnValue({
      data: {
        id: "schema-1",
        name: "Tutorial Schema",
        list_id: "list-1",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        schema_fields: [
          {
            field_id: "field-1",
            schema_id: "schema-1",
            display_order: 0,
            show_on_card: false,
            field: {
              id: "field-1",
              name: "Bewertung",
              field_type: "rating",
              config: { max_rating: 5 },
              list_id: "list-1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(
      () => useFiltersByCategory("list-1", ["tag-1", "tag-2"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      // Should only include tag-1 (is_video_type=true), ignore tag-2
      expect(result.current).toEqual([
        {
          categoryId: "tag-1",
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
        },
      ]);
    });
  });

  it("handles multiple categories with schemas", async () => {
    vi.spyOn(useTags, "useTags").mockReturnValue({
      data: [
        {
          id: "tag-1",
          name: "Tutorial",
          is_video_type: true,
          schema_id: "schema-1",
          color: "#ff0000",
          user_id: "user-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        {
          id: "tag-2",
          name: "Podcast",
          is_video_type: true,
          schema_id: "schema-2",
          color: "#00ff00",
          user_id: "user-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    // Mock useSchema to return different results based on schemaId
    vi.spyOn(useSchemas, "useSchema").mockImplementation(
      (_listId, schemaId) => {
        if (schemaId === "schema-1") {
          return {
            data: {
              id: "schema-1",
              name: "Tutorial Schema",
              list_id: "list-1",
              description: null,
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
              schema_fields: [
                {
                  field_id: "field-1",
                  schema_id: "schema-1",
                  display_order: 0,
                  show_on_card: false,
                  field: {
                    id: "field-1",
                    name: "Bewertung",
                    field_type: "rating",
                    config: { max_rating: 5 },
                    list_id: "list-1",
                    created_at: "2024-01-01",
                    updated_at: "2024-01-01",
                  },
                },
              ],
            },
            isLoading: false,
            error: null,
          } as any;
        }
        if (schemaId === "schema-2") {
          return {
            data: {
              id: "schema-2",
              name: "Podcast Schema",
              list_id: "list-1",
              description: null,
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
              schema_fields: [
                {
                  field_id: "field-2",
                  schema_id: "schema-2",
                  display_order: 0,
                  show_on_card: false,
                  field: {
                    id: "field-2",
                    name: "Notizen",
                    field_type: "text",
                    config: {},
                    list_id: "list-1",
                    created_at: "2024-01-01",
                    updated_at: "2024-01-01",
                  },
                },
              ],
            },
            isLoading: false,
            error: null,
          } as any;
        }
        return { data: undefined, isLoading: false, error: null } as any;
      }
    );

    const { result } = renderHook(
      () => useFiltersByCategory("list-1", ["tag-1", "tag-2"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(2);
      expect(result.current[0].categoryName).toBe("Tutorial");
      expect(result.current[0].fields).toHaveLength(1);
      expect(result.current[1].categoryName).toBe("Podcast");
      expect(result.current[1].fields).toHaveLength(1);
    });
  });

  it("handles category without schema (returns empty fields)", async () => {
    vi.spyOn(useTags, "useTags").mockReturnValue({
      data: [
        {
          id: "tag-1",
          name: "Tutorial",
          is_video_type: true,
          schema_id: null, // No schema
          color: "#ff0000",
          user_id: "user-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useSchemas, "useSchema").mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(
      () => useFiltersByCategory("list-1", ["tag-1"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current).toEqual([
        {
          categoryId: "tag-1",
          categoryName: "Tutorial",
          schemaId: null,
          fields: [],
        },
      ]);
    });
  });

  it("handles schema with no fields", async () => {
    vi.spyOn(useTags, "useTags").mockReturnValue({
      data: [
        {
          id: "tag-1",
          name: "Tutorial",
          is_video_type: true,
          schema_id: "schema-1",
          color: "#ff0000",
          user_id: "user-1",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useSchemas, "useSchema").mockReturnValue({
      data: {
        id: "schema-1",
        name: "Empty Schema",
        list_id: "list-1",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        schema_fields: [], // Empty fields
      },
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(
      () => useFiltersByCategory("list-1", ["tag-1"]),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current).toEqual([
        {
          categoryId: "tag-1",
          categoryName: "Tutorial",
          schemaId: "schema-1",
          fields: [],
        },
      ]);
    });
  });
});
