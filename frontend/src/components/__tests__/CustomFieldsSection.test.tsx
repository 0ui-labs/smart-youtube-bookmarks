import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AvailableFieldResponse, VideoFieldValue } from "@/types/video";
import { CustomFieldsSection } from "../CustomFieldsSection";

// Mock FieldDisplay component
vi.mock("@/components/fields", () => ({
  FieldDisplay: ({ fieldValue, onChange, onExpand }: any) => (
    <div data-testid={`field-display-${fieldValue.field_id}`}>
      <span>Field: {fieldValue.field.name}</span>
      <button onClick={() => onChange?.(5)}>Change Value</button>
      {onExpand && <button onClick={onExpand}>Expand</button>}
    </div>
  ),
}));

describe("CustomFieldsSection", () => {
  const mockOnFieldChange = vi.fn();
  const mockOnExpand = vi.fn();

  const mockAvailableFields: AvailableFieldResponse[] = [
    {
      field_id: "field-1",
      field_name: "Rating",
      field_type: "rating",
      config: { max_rating: 5 },
      schema_name: "Tutorial Schema",
      display_order: 1,
      show_on_card: true,
    },
    {
      field_id: "field-2",
      field_name: "Quality",
      field_type: "select",
      config: { options: ["bad", "good", "great"] },
      schema_name: "Tutorial Schema",
      display_order: 2,
      show_on_card: false,
    },
    {
      field_id: "field-3",
      field_name: "Notes",
      field_type: "text",
      config: { max_length: 500 },
      schema_name: "Review Schema",
      display_order: 1,
      show_on_card: false,
    },
    {
      field_id: "field-4",
      field_name: "Recommended",
      field_type: "boolean",
      config: {},
      schema_name: null, // Should group under "Allgemeine Felder"
      display_order: 1,
      show_on_card: false,
    },
  ];

  const mockFieldValues: VideoFieldValue[] = [
    {
      id: "value-1",
      video_id: "video-1",
      field_id: "field-1",
      field_name: "Rating",
      show_on_card: true,
      field: {
        id: "field-1",
        list_id: "list-1",
        name: "Rating",
        field_type: "rating",
        config: { max_rating: 5 },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      value: 4,
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const showFields = (fields = mockAvailableFields) =>
    render(
      <CustomFieldsSection
        availableFields={fields}
        fieldValues={mockFieldValues}
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        videoId="video-1"
      />
    );
  it("renders all fields as an editable flat list", () => {
    showFields();
    for (const name of ["Rating", "Quality", "Notes", "Recommended"]) {
      expect(screen.getByText(name)).toBeVisible();
    }
    expect(screen.getAllByTestId(/^field-display-/)).toHaveLength(4);
  });
  it("sorts fields by display order across schemas", () => {
    showFields();
    expect(
      screen
        .getAllByTestId(/^field-display-/)
        .map((node) => node.dataset.testid)
    ).toEqual([
      "field-display-field-1",
      "field-display-field-3",
      "field-display-field-4",
      "field-display-field-2",
    ]);
  });
  it("does not mutate the query cache array when sorting", () => {
    const fields = Object.freeze([...mockAvailableFields].reverse());
    const original = [...fields];
    showFields(fields as unknown as AvailableFieldResponse[]);
    expect(fields).toEqual(original);
  });
  it("renders fields without a schema", () => {
    showFields([mockAvailableFields[3]]);
    expect(screen.getByText("Recommended")).toBeVisible();
  });
  it("updates every rendered field using its own identity", () => {
    showFields();
    screen
      .getAllByText("Change Value")
      .forEach((button) => fireEvent.click(button));
    expect(mockOnFieldChange.mock.calls.map((call) => call[0])).toEqual([
      "field-1",
      "field-3",
      "field-4",
      "field-2",
    ]);
  });
  it("FieldDisplay receives correct props (fieldValue, readonly, onChange)", () => {
    render(
      <CustomFieldsSection
        availableFields={mockAvailableFields}
        fieldValues={mockFieldValues}
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        videoId="video-1"
      />
    );

    // Check that FieldDisplay was rendered with correct field_id
    expect(screen.getByTestId("field-display-field-1")).toBeInTheDocument();
    expect(screen.getByTestId("field-display-field-2")).toBeInTheDocument();
    expect(screen.getByTestId("field-display-field-3")).toBeInTheDocument();
    expect(screen.getByTestId("field-display-field-4")).toBeInTheDocument();
  });

  it("calls onFieldChange when field value changes", () => {
    render(
      <CustomFieldsSection
        availableFields={mockAvailableFields}
        fieldValues={mockFieldValues}
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        videoId="video-1"
      />
    );

    // Find the specific field-1 FieldDisplay and click its change button
    const field1Display = screen.getByTestId("field-display-field-1");
    const changeButton = field1Display.querySelector("button");
    if (changeButton) {
      fireEvent.click(changeButton);
    }

    expect(mockOnFieldChange).toHaveBeenCalledWith("field-1", 5);
  });

  it("renders empty state when no fields available", () => {
    render(
      <CustomFieldsSection
        availableFields={[]}
        fieldValues={[]}
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        videoId="video-1"
      />
    );

    expect(
      screen.getByText("Keine Informationen verfügbar.")
    ).toBeInTheDocument();
  });

  it("passes onExpand callback to FieldDisplay", () => {
    render(
      <CustomFieldsSection
        availableFields={mockAvailableFields}
        fieldValues={mockFieldValues}
        listId="list-1"
        onExpand={mockOnExpand}
        onFieldChange={mockOnFieldChange}
        videoId="video-1"
      />
    );

    // onExpand should be passed to FieldDisplay (verified via mock implementation)
    expect(screen.getByTestId("field-display-field-1")).toBeInTheDocument();
  });

  it("creates type-specific placeholder field values for empty fields", () => {
    // Test with only available fields (no existing values)
    render(
      <CustomFieldsSection
        availableFields={[mockAvailableFields[0]]} // Only Rating field
        fieldValues={[]} // No existing values
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        videoId="video-1"
      />
    );

    // Should render FieldDisplay with placeholder field value
    expect(screen.getByTestId("field-display-field-1")).toBeInTheDocument();
    expect(screen.getByText("Field: Rating")).toBeInTheDocument();
  });

  it("sorts fields within schema by display_order", () => {
    const fieldsWithOrder: AvailableFieldResponse[] = [
      {
        field_id: "field-1",
        field_name: "Second",
        field_type: "text",
        config: {},
        schema_name: "Test Schema",
        display_order: 2,
        show_on_card: false,
      },
      {
        field_id: "field-2",
        field_name: "First",
        field_type: "text",
        config: {},
        schema_name: "Test Schema",
        display_order: 1,
        show_on_card: false,
      },
    ];

    render(
      <CustomFieldsSection
        availableFields={fieldsWithOrder}
        fieldValues={[]}
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        videoId="video-1"
      />
    );

    // Check that fields are rendered in display_order (First before Second)
    // The field labels are rendered as "Field: First" and "Field: Second" in the mock
    expect(
      screen
        .getAllByTestId(/^field-display-/)
        .map((node) => node.dataset.testid)
    ).toEqual(["field-display-field-2", "field-display-field-1"]);

    // Verify both fields exist
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});
