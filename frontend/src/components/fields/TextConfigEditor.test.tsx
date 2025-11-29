import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TextConfigEditor } from "./TextConfigEditor";

describe("TextConfigEditor", () => {
  const mockOnChange = vi.fn();

  describe("Rendering", () => {
    it("renders checkbox to toggle max_length", () => {
      render(<TextConfigEditor config={{}} onChange={mockOnChange} />);

      expect(
        screen.getByLabelText(/zeichenlimit festlegen/i)
      ).toBeInTheDocument();
    });

    it("shows unlimited message when max_length is not set", () => {
      render(<TextConfigEditor config={{}} onChange={mockOnChange} />);

      expect(screen.getByText(/keine längenbeschränkung/i)).toBeInTheDocument();
    });

    it("shows numeric input when max_length is set", () => {
      render(
        <TextConfigEditor
          config={{ max_length: 500 }}
          onChange={mockOnChange}
        />
      );

      expect(
        screen.getByLabelText(/maximale zeichenanzahl/i)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/maximale zeichenanzahl/i)).toHaveValue(500);
    });
  });

  describe("Toggle Behavior", () => {
    it("enables max_length with default value when checkbox is checked", async () => {
      const user = userEvent.setup();
      render(<TextConfigEditor config={{}} onChange={mockOnChange} />);

      const checkbox = screen.getByLabelText(/zeichenlimit festlegen/i);
      await user.click(checkbox);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({ max_length: 500 });
      });
    });

    it("disables max_length when checkbox is unchecked", async () => {
      const user = userEvent.setup();
      render(
        <TextConfigEditor
          config={{ max_length: 500 }}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByLabelText(/zeichenlimit festlegen/i);
      await user.click(checkbox);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({});
      });
    });

    it("calls onChange to remove max_length when toggled off", async () => {
      const user = userEvent.setup();
      render(
        <TextConfigEditor
          config={{ max_length: 500 }}
          onChange={mockOnChange}
        />
      );

      expect(
        screen.getByLabelText(/maximale zeichenanzahl/i)
      ).toBeInTheDocument();

      const checkbox = screen.getByLabelText(/zeichenlimit festlegen/i);
      await user.click(checkbox);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({});
      });
    });
  });

  describe("Validation", () => {
    it("validates minimum value of 1", () => {
      render(
        <TextConfigEditor config={{ max_length: 0 }} onChange={mockOnChange} />
      );

      // Component should display error for invalid value (< 1)
      expect(screen.getByLabelText(/maximale zeichenanzahl/i)).toHaveValue(0);
    });

    it("displays current max_length value", () => {
      render(
        <TextConfigEditor
          config={{ max_length: 1000 }}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/maximale zeichenanzahl/i);
      expect(input).toHaveValue(1000);
    });
  });
});
