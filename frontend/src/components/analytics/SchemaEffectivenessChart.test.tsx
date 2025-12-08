import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SchemaEffectivenessStat } from "@/types/analytics";
import { SchemaEffectivenessChart } from "./SchemaEffectivenessChart";

const mockData: SchemaEffectivenessStat[] = [
  {
    schema_id: "schema-1",
    schema_name: "High Effectiveness",
    field_count: 3,
    avg_fields_filled: 2.8,
    completion_percentage: 93.3,
    video_count: 50,
  },
  {
    schema_id: "schema-2",
    schema_name: "Medium Effectiveness",
    field_count: 5,
    avg_fields_filled: 3.0,
    completion_percentage: 60.0,
    video_count: 30,
  },
  {
    schema_id: "schema-3",
    schema_name: "Low Effectiveness",
    field_count: 4,
    avg_fields_filled: 1.2,
    completion_percentage: 30.0,
    video_count: 20,
  },
];

describe("SchemaEffectivenessChart", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders chart with data", () => {
    render(<SchemaEffectivenessChart data={mockData} />);

    expect(screen.getByText("Schema Effectiveness")).toBeInTheDocument();
    expect(
      screen.getByText(/Completion rate for \d+ schemas/)
    ).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<SchemaEffectivenessChart data={[]} />);

    expect(
      screen.getByText("No schemas with field values yet")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Start filling in schema fields to see effectiveness metrics"
      )
    ).toBeInTheDocument();
  });

  it("displays correct number of schemas in description", () => {
    render(<SchemaEffectivenessChart data={mockData} />);

    expect(
      screen.getByText("Completion rate for 3 schemas")
    ).toBeInTheDocument();
  });

  it("uses singular form for single schema", () => {
    const singleSchema: SchemaEffectivenessStat[] = [mockData[0]];

    render(<SchemaEffectivenessChart data={singleSchema} />);

    expect(
      screen.getByText("Completion rate for 1 schema")
    ).toBeInTheDocument();
  });
});
