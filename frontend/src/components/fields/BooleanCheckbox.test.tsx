import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BooleanCheckbox } from "./BooleanCheckbox";

describe("BooleanCheckbox", () => {
  const defaultProps = {
    value: false,
    fieldName: "Test Field",
  };

  // Test 1: Renders checked when value is true
  it("renders checked when value is true", () => {
    render(<BooleanCheckbox {...defaultProps} value={true} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  // Test 2: Renders unchecked when value is false
  it("renders unchecked when value is false", () => {
    render(<BooleanCheckbox {...defaultProps} value={false} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  // Test 3: Renders unchecked when value is null
  it("renders unchecked when value is null", () => {
    render(<BooleanCheckbox {...defaultProps} value={null} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  // Test 4: Calls onChange on click
  it("calls onChange on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BooleanCheckbox {...defaultProps} onChange={onChange} value={false} />
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  // Test 5: Toggles true/false
  it("toggles between true and false", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <BooleanCheckbox {...defaultProps} onChange={onChange} value={false} />
    );

    const checkbox = screen.getByRole("checkbox");

    // Click to toggle from false to true
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);

    // Rerender with new value
    rerender(
      <BooleanCheckbox {...defaultProps} onChange={onChange} value={true} />
    );
    expect(checkbox).toBeChecked();

    // Click to toggle from true to false
    await user.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  // Test 6: Does not call onChange in readOnly mode
  it("does not call onChange in readOnly mode", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BooleanCheckbox
        {...defaultProps}
        onChange={onChange}
        readonly={true}
        value={false}
      />
    );

    const checkbox = screen.getByRole("checkbox");

    // Attempt to click
    await user.click(checkbox);

    // Should not call onChange because it's disabled
    expect(onChange).not.toHaveBeenCalled();
  });

  // Test 7: Keyboard (Space key) toggles the checkbox
  it("toggles checkbox with Space key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BooleanCheckbox {...defaultProps} onChange={onChange} value={false} />
    );

    const checkbox = screen.getByRole("checkbox");

    // Focus and press Space
    checkbox.focus();
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledWith(true);
  });

  // Test 8: Supports custom className
  it("supports custom className", () => {
    const { container } = render(
      <BooleanCheckbox {...defaultProps} className="custom-class" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("custom-class");
  });

  // Test 9: Renders label with field name
  it("renders label with field name", () => {
    render(<BooleanCheckbox {...defaultProps} fieldName="Recommended" />);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
  });

  // Test 10: Has accessible aria-label
  it("has accessible aria-label describing state", () => {
    const { rerender } = render(
      <BooleanCheckbox {...defaultProps} fieldName="Watched" value={false} />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-label", "Watched: unchecked");

    // Rerender with true value
    rerender(
      <BooleanCheckbox {...defaultProps} fieldName="Watched" value={true} />
    );
    expect(checkbox).toHaveAttribute("aria-label", "Watched: checked");
  });

  // Test 11: Disabled attribute set in readOnly mode
  it("sets disabled attribute in readOnly mode", () => {
    render(<BooleanCheckbox {...defaultProps} readonly={true} value={false} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
  });

  // Test 12: Prevents event propagation on click
  it("prevents event propagation on checkbox click", async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <BooleanCheckbox {...defaultProps} onChange={vi.fn()} value={false} />
      </div>
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    // Parent click should not be called
    expect(parentClick).not.toHaveBeenCalled();
  });

  // Test 13: Prevents event propagation on label click
  it("prevents event propagation on label click", async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <BooleanCheckbox {...defaultProps} onChange={vi.fn()} value={false} />
      </div>
    );

    const label = screen.getByText("Test Field");
    await user.click(label);

    // Parent click should not be called (label click is handled by native checkbox)
    // This is more about the wrapper preventing propagation
    expect(parentClick).not.toHaveBeenCalled();
  });

  // Test 14: Can be controlled component (value changes update checkbox)
  it("updates checkbox state when value prop changes", () => {
    const { rerender } = render(
      <BooleanCheckbox {...defaultProps} value={false} />
    );

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    rerender(<BooleanCheckbox {...defaultProps} value={true} />);
    expect(checkbox.checked).toBe(true);

    rerender(<BooleanCheckbox {...defaultProps} value={null} />);
    expect(checkbox.checked).toBe(false);
  });
});
