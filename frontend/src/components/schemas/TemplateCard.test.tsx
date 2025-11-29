import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_TEMPLATES } from "@/constants/schemaTemplates";
import { TemplateCard } from "./TemplateCard";

describe("TemplateCard", () => {
  const mockTemplate = SCHEMA_TEMPLATES[0]; // Video Quality Assessment
  const mockOnUseTemplate = vi.fn();
  const mockOnPreview = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render template name and description", () => {
    render(
      <TemplateCard
        onPreview={mockOnPreview}
        onUseTemplate={mockOnUseTemplate}
        template={mockTemplate}
      />
    );

    expect(screen.getByText(mockTemplate.name)).toBeInTheDocument();
    expect(screen.getByText(mockTemplate.description)).toBeInTheDocument();
  });

  it("should show category badge", () => {
    render(
      <TemplateCard
        onPreview={mockOnPreview}
        onUseTemplate={mockOnUseTemplate}
        template={mockTemplate}
      />
    );

    expect(screen.getByText(mockTemplate.category)).toBeInTheDocument();
  });

  it("should show field count", () => {
    render(
      <TemplateCard
        onPreview={mockOnPreview}
        onUseTemplate={mockOnUseTemplate}
        template={mockTemplate}
      />
    );

    expect(screen.getByText(/4 fields/i)).toBeInTheDocument();
  });

  it('should call onUseTemplate when "Use Template" is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TemplateCard
        onPreview={mockOnPreview}
        onUseTemplate={mockOnUseTemplate}
        template={mockTemplate}
      />
    );

    await user.click(screen.getByText("Use Template"));
    expect(mockOnUseTemplate).toHaveBeenCalledWith(mockTemplate);
  });

  it("should call onPreview when preview button is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TemplateCard
        onPreview={mockOnPreview}
        onUseTemplate={mockOnUseTemplate}
        template={mockTemplate}
      />
    );

    await user.click(screen.getByLabelText("Preview template"));
    expect(mockOnPreview).toHaveBeenCalledWith(mockTemplate);
  });
});
