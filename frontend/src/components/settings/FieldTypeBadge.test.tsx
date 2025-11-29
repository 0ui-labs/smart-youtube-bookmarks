import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldTypeBadge } from "./FieldTypeBadge";

describe("FieldTypeBadge", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders select badge with blue colors", () => {
    render(<FieldTypeBadge fieldType="select" />);
    const badge = screen.getByTestId("field-type-badge-select");

    expect(badge).toHaveTextContent("Select");
    expect(badge).toHaveClass("bg-blue-100", "text-blue-800");
  });

  it("renders rating badge with yellow colors", () => {
    render(<FieldTypeBadge fieldType="rating" />);
    const badge = screen.getByTestId("field-type-badge-rating");

    expect(badge).toHaveTextContent("Rating");
    expect(badge).toHaveClass("bg-yellow-100", "text-yellow-800");
  });

  it("renders text badge with gray colors", () => {
    render(<FieldTypeBadge fieldType="text" />);
    const badge = screen.getByTestId("field-type-badge-text");

    expect(badge).toHaveTextContent("Text");
    expect(badge).toHaveClass("bg-gray-100", "text-gray-800");
  });

  it("renders boolean badge with green colors", () => {
    render(<FieldTypeBadge fieldType="boolean" />);
    const badge = screen.getByTestId("field-type-badge-boolean");

    expect(badge).toHaveTextContent("Boolean");
    expect(badge).toHaveClass("bg-green-100", "text-green-800");
  });

  it("accepts custom className prop", () => {
    render(<FieldTypeBadge className="custom-class" fieldType="select" />);
    const badge = screen.getByTestId("field-type-badge-select");

    expect(badge).toHaveClass("custom-class");
  });
});
