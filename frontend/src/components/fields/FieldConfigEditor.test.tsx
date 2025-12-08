import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { FieldType } from "@/types/customField";
import { FieldConfigEditor } from "./FieldConfigEditor";

// Mock child components
vi.mock("./SelectConfigEditor", () => ({
  SelectConfigEditor: ({ control, error }: any) => (
    <div data-testid="select-config-editor">
      SelectConfigEditor (control: {control ? "present" : "missing"}, error:{" "}
      {error || "none"})
    </div>
  ),
}));

vi.mock("./RatingConfigEditor", () => ({
  RatingConfigEditor: ({ config, error }: any) => (
    <div data-testid="rating-config-editor">
      RatingConfigEditor (max_rating: {config.max_rating}, error:{" "}
      {error || "none"})
    </div>
  ),
}));

vi.mock("./TextConfigEditor", () => ({
  TextConfigEditor: ({ config, error }: any) => (
    <div data-testid="text-config-editor">
      TextConfigEditor (max_length: {config.max_length || "unlimited"}, error:{" "}
      {error || "none"})
    </div>
  ),
}));

// Wrapper component to provide React Hook Form context
function TestWrapper({
  fieldType,
  config,
  error,
}: {
  fieldType: FieldType;
  config: any;
  error?: string;
}) {
  const { control } = useForm({
    defaultValues: {
      config,
    },
  });

  return (
    <FieldConfigEditor
      config={config}
      control={control}
      error={error}
      fieldType={fieldType}
      onChange={vi.fn()}
    />
  );
}

describe("FieldConfigEditor", () => {
  describe("Rendering Based on Field Type", () => {
    it("renders SelectConfigEditor for select type", () => {
      render(
        <TestWrapper config={{ options: ["Option 1"] }} fieldType="select" />
      );

      expect(screen.getByTestId("select-config-editor")).toBeInTheDocument();
      expect(
        screen.queryByTestId("rating-config-editor")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("text-config-editor")
      ).not.toBeInTheDocument();
    });

    it("renders RatingConfigEditor for rating type", () => {
      render(<TestWrapper config={{ max_rating: 5 }} fieldType="rating" />);

      expect(screen.getByTestId("rating-config-editor")).toBeInTheDocument();
      expect(
        screen.queryByTestId("select-config-editor")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("text-config-editor")
      ).not.toBeInTheDocument();
    });

    it("renders TextConfigEditor for text type", () => {
      render(<TestWrapper config={{}} fieldType="text" />);

      expect(screen.getByTestId("text-config-editor")).toBeInTheDocument();
      expect(
        screen.queryByTestId("select-config-editor")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("rating-config-editor")
      ).not.toBeInTheDocument();
    });

    it("renders nothing for boolean type", () => {
      render(<TestWrapper config={{}} fieldType="boolean" />);

      expect(
        screen.queryByTestId("select-config-editor")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("rating-config-editor")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("text-config-editor")
      ).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("passes error to SelectConfigEditor", () => {
      const error = "At least one option is required";
      render(
        <TestWrapper
          config={{ options: [] }}
          error={error}
          fieldType="select"
        />
      );

      expect(
        screen.getByText(/at least one option is required/i)
      ).toBeInTheDocument();
    });
  });
});
