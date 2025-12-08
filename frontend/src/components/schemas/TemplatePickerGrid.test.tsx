import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_TEMPLATES } from "@/constants/schemaTemplates";
import { TemplatePickerGrid } from "./TemplatePickerGrid";

describe("TemplatePickerGrid", () => {
  const mockOnSelectTemplate = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render all templates by default", () => {
    render(<TemplatePickerGrid onSelectTemplate={mockOnSelectTemplate} />);

    SCHEMA_TEMPLATES.forEach((template) => {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    });
  });

  it("should filter templates by category", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TemplatePickerGrid onSelectTemplate={mockOnSelectTemplate} />);

    // Click education category
    await user.click(screen.getByText("Education"));

    // Should only show education templates
    const educationTemplates = SCHEMA_TEMPLATES.filter(
      (t) => t.category === "education"
    );
    educationTemplates.forEach((template) => {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    });

    // Should NOT show other categories
    const nonEducationTemplates = SCHEMA_TEMPLATES.filter(
      (t) => t.category !== "education"
    );
    nonEducationTemplates.forEach((template) => {
      expect(screen.queryByText(template.name)).not.toBeInTheDocument();
    });
  });

  it('should show all templates when "All Templates" is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TemplatePickerGrid onSelectTemplate={mockOnSelectTemplate} />);

    // Filter to education
    await user.click(screen.getByText("Education"));

    // Click "All Templates"
    await user.click(screen.getByText("All Templates"));

    // Should show all templates again
    SCHEMA_TEMPLATES.forEach((template) => {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    });
  });

  it("should open preview dialog when preview is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TemplatePickerGrid onSelectTemplate={mockOnSelectTemplate} />);

    // Click preview button for first template
    const previewButtons = screen.getAllByLabelText("Preview template");
    await user.click(previewButtons[0]);

    // Dialog should open (check for dialog content)
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
