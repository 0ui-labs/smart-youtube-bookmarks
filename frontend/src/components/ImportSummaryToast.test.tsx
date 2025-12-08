/**
 * Tests for ImportSummaryToast component
 * TDD RED phase - Tests written BEFORE implementation
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportSummaryToast } from "./ImportSummaryToast";

describe("ImportSummaryToast", () => {
  it("shows total videos imported", () => {
    render(
      <ImportSummaryToast
        result={{
          total: 47,
          successful: 47,
          withoutCaptions: 0,
          failed: 0,
        }}
      />
    );

    expect(screen.getByText(/47/)).toBeInTheDocument();
    expect(screen.getByText(/importiert/i)).toBeInTheDocument();
  });

  it("shows videos without captions count", () => {
    render(
      <ImportSummaryToast
        result={{
          total: 50,
          successful: 47,
          withoutCaptions: 3,
          failed: 0,
        }}
      />
    );

    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/ohne untertitel/i)).toBeInTheDocument();
  });

  it("shows failed videos count", () => {
    render(
      <ImportSummaryToast
        result={{
          total: 50,
          successful: 45,
          withoutCaptions: 0,
          failed: 5,
        }}
      />
    );

    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/fehlgeschlagen|fehler/i)).toBeInTheDocument();
  });

  it("shows success icon when all imports successful", () => {
    const { container } = render(
      <ImportSummaryToast
        result={{
          total: 10,
          successful: 10,
          withoutCaptions: 0,
          failed: 0,
        }}
      />
    );

    // Should have success styling (green)
    const successElement =
      container.querySelector(".text-green-500") ||
      container.querySelector(".bg-green-500");
    expect(successElement).toBeInTheDocument();
  });

  it("shows warning state when some videos have issues", () => {
    const { container } = render(
      <ImportSummaryToast
        result={{
          total: 10,
          successful: 7,
          withoutCaptions: 2,
          failed: 1,
        }}
      />
    );

    // Should have warning or error styling (yellow/red)
    const warningElement =
      container.querySelector(".text-amber-500") ||
      container.querySelector(".text-yellow-500") ||
      container.querySelector(".text-red-500");
    expect(warningElement).toBeInTheDocument();
  });

  it("has accessible role for toast notification", () => {
    render(
      <ImportSummaryToast
        result={{
          total: 10,
          successful: 10,
          withoutCaptions: 0,
          failed: 0,
        }}
      />
    );

    // Should be an alert or status role
    const alertElement =
      screen.queryByRole("alert") || screen.queryByRole("status");
    expect(alertElement).toBeInTheDocument();
  });

  it("handles singular/plural correctly", () => {
    render(
      <ImportSummaryToast
        result={{
          total: 1,
          successful: 1,
          withoutCaptions: 0,
          failed: 0,
        }}
      />
    );

    // Should say "Video" not "Videos" for singular
    expect(screen.getByText(/1 video importiert/i)).toBeInTheDocument();
  });
});
