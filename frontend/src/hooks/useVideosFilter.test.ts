/**
 * Test file for useVideosFilter hook
 *
 * Validates the convertToBackendFilters function and demonstrates hook usage.
 */
import { describe, expect, it } from "vitest";
import type { ActiveFilter } from "@/stores/fieldFilterStore";
import { convertToBackendFilters } from "./useVideosFilter";

describe("convertToBackendFilters", () => {
  it("should convert rating filter with value", () => {
    const uiFilters: ActiveFilter[] = [
      {
        id: "filter-1",
        fieldId: "field-123",
        fieldName: "Overall Rating",
        fieldType: "rating",
        operator: "gte",
        value: 4,
      },
    ];

    const result = convertToBackendFilters(uiFilters);

    expect(result).toEqual([
      {
        field_id: "field-123",
        operator: "gte",
        value: 4,
      },
    ]);
  });

  it("should convert rating filter with BETWEEN operator", () => {
    const uiFilters: ActiveFilter[] = [
      {
        id: "filter-2",
        fieldId: "field-456",
        fieldName: "Rating",
        fieldType: "rating",
        operator: "between",
        valueMin: 3,
        valueMax: 5,
      },
    ];

    const result = convertToBackendFilters(uiFilters);

    expect(result).toEqual([
      {
        field_id: "field-456",
        operator: "between",
        value_min: 3,
        value_max: 5,
      },
    ]);
  });

  it("should convert select filter with exact operator", () => {
    const uiFilters: ActiveFilter[] = [
      {
        id: "filter-3",
        fieldId: "field-789",
        fieldName: "Quality",
        fieldType: "select",
        operator: "exact",
        value: "excellent",
      },
    ];

    const result = convertToBackendFilters(uiFilters);

    expect(result).toEqual([
      {
        field_id: "field-789",
        operator: "exact",
        value: "excellent",
      },
    ]);
  });

  it("should convert boolean filter", () => {
    const uiFilters: ActiveFilter[] = [
      {
        id: "filter-4",
        fieldId: "field-abc",
        fieldName: "Completed",
        fieldType: "boolean",
        operator: "is",
        value: true,
      },
    ];

    const result = convertToBackendFilters(uiFilters);

    expect(result).toEqual([
      {
        field_id: "field-abc",
        operator: "is",
        value: true,
      },
    ]);
  });

  it("should convert text filter with contains operator", () => {
    const uiFilters: ActiveFilter[] = [
      {
        id: "filter-5",
        fieldId: "field-def",
        fieldName: "Notes",
        fieldType: "text",
        operator: "contains",
        value: "important",
      },
    ];

    const result = convertToBackendFilters(uiFilters);

    expect(result).toEqual([
      {
        field_id: "field-def",
        operator: "contains",
        value: "important",
      },
    ]);
  });

  it("should convert multiple filters at once", () => {
    const uiFilters: ActiveFilter[] = [
      {
        id: "filter-1",
        fieldId: "field-123",
        fieldName: "Rating",
        fieldType: "rating",
        operator: "gte",
        value: 4,
      },
      {
        id: "filter-2",
        fieldId: "field-456",
        fieldName: "Quality",
        fieldType: "select",
        operator: "exact",
        value: "excellent",
      },
      {
        id: "filter-3",
        fieldId: "field-789",
        fieldName: "Completed",
        fieldType: "boolean",
        operator: "is",
        value: true,
      },
    ];

    const result = convertToBackendFilters(uiFilters);

    expect(result).toEqual([
      {
        field_id: "field-123",
        operator: "gte",
        value: 4,
      },
      {
        field_id: "field-456",
        operator: "exact",
        value: "excellent",
      },
      {
        field_id: "field-789",
        operator: "is",
        value: true,
      },
    ]);
  });

  it("should handle empty array", () => {
    const result = convertToBackendFilters([]);
    expect(result).toEqual([]);
  });

  it("should only include defined value fields", () => {
    const uiFilters: ActiveFilter[] = [
      {
        id: "filter-1",
        fieldId: "field-123",
        fieldName: "Rating",
        fieldType: "rating",
        operator: "gte",
        value: 4,
        // valueMin and valueMax are undefined
      },
    ];

    const result = convertToBackendFilters(uiFilters);

    expect(result).toEqual([
      {
        field_id: "field-123",
        operator: "gte",
        value: 4,
        // Should NOT include value_min or value_max
      },
    ]);

    // Verify undefined fields are not present
    expect(result[0]).not.toHaveProperty("value_min");
    expect(result[0]).not.toHaveProperty("value_max");
  });
});

/**
 * Hook usage examples (for manual testing and reference)
 *
 * Note: These are examples, not actual tests (would require React Query setup)
 */
describe("useVideosFilter usage examples", () => {
  it("documents hook usage patterns", () => {
    // Example 1: Filter by tags only
    const example1 = {
      queryKey: [
        "videos",
        "filter",
        "list-123",
        ["Python", "Tutorial"],
        undefined,
      ],
      requestBody: {
        tags: ["Python", "Tutorial"],
      },
    };
    expect(example1.requestBody.tags).toHaveLength(2);

    // Example 2: Filter by field filters only
    const fieldFilters: ActiveFilter[] = [
      {
        id: "f1",
        fieldId: "field-456",
        fieldName: "Rating",
        fieldType: "rating",
        operator: "gte",
        value: 4,
      },
    ];
    const example2 = {
      queryKey: ["videos", "filter", "list-123", undefined, fieldFilters],
      requestBody: {
        field_filters: convertToBackendFilters(fieldFilters),
      },
    };
    expect(example2.requestBody.field_filters).toHaveLength(1);
    expect(example2.requestBody.field_filters[0]).toEqual({
      field_id: "field-456",
      operator: "gte",
      value: 4,
    });

    // Example 3: Combine tags and field filters
    const example3 = {
      queryKey: ["videos", "filter", "list-123", ["Python"], fieldFilters],
      requestBody: {
        tags: ["Python"],
        field_filters: convertToBackendFilters(fieldFilters),
      },
    };
    expect(example3.requestBody).toHaveProperty("tags");
    expect(example3.requestBody).toHaveProperty("field_filters");
  });
});
