/**
 * Tests for ProgressOverlay component
 * TDD RED phase - Tests written BEFORE implementation
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressOverlay } from "./ProgressOverlay";

describe("ProgressOverlay", () => {
  it("renders progress percentage", () => {
    render(<ProgressOverlay progress={50} stage="captions" />);

    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders stage label", () => {
    render(<ProgressOverlay progress={25} stage="metadata" />);

    // Use getAllByText since label appears in visible span + sr-only span
    expect(
      screen.getAllByText(/Lade Metadaten/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("has correct ARIA attributes for progressbar", () => {
    render(<ProgressOverlay progress={60} stage="captions" />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "60");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps progress to 0-100 range", () => {
    const { rerender } = render(
      <ProgressOverlay progress={-10} stage="created" />
    );

    // Negative should be clamped to 0
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0"
    );

    // Above 100 should be clamped to 100
    rerender(<ProgressOverlay progress={150} stage="complete" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });

  it("renders iOS-style solid pie chart progress indicator", () => {
    const { container } = render(
      <ProgressOverlay progress={50} stage="captions" />
    );

    // Should have a pie chart element with conic-gradient
    const pieChart = container.querySelector('[data-testid="pie-chart"]');
    expect(pieChart).toBeInTheDocument();

    // Should have correct dimensions (iOS-style compact)
    expect(pieChart).toHaveStyle({ width: "48px", height: "48px" });
  });

  it("applies overlay styling classes", () => {
    const { container } = render(
      <ProgressOverlay progress={50} stage="captions" />
    );

    // Should have absolute positioning for overlay
    const overlay = container.firstChild;
    expect(overlay).toHaveClass("absolute");
    expect(overlay).toHaveClass("inset-0"); // covers entire parent
  });

  it("shows different labels for each stage", () => {
    const stages: Array<{ stage: string; expectedText: RegExp }> = [
      { stage: "created", expectedText: /Vorbereiten/i },
      { stage: "metadata", expectedText: /Lade Metadaten/i },
      { stage: "captions", expectedText: /Lade Untertitel/i },
      { stage: "chapters", expectedText: /Lade Kapitel/i },
    ];

    stages.forEach(({ stage, expectedText }) => {
      const { unmount } = render(
        <ProgressOverlay progress={50} stage={stage} />
      );
      // Use getAllByText since label appears in visible span + sr-only span
      expect(screen.getAllByText(expectedText).length).toBeGreaterThanOrEqual(
        1
      );
      unmount();
    });
  });

  it("displays percentage below the pie chart", () => {
    render(<ProgressOverlay progress={50} stage="captions" />);

    // Percentage should be displayed (iOS-style: below the pie)
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
