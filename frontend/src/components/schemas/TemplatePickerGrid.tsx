import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  getTemplatesByCategory,
  SCHEMA_TEMPLATES,
  type SchemaTemplate,
  type TemplateCategory,
} from "@/constants/schemaTemplates";
import { TemplateCard } from "./TemplateCard";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";

interface TemplatePickerGridProps {
  onSelectTemplate: (template: SchemaTemplate) => void;
}

const CATEGORIES: Array<{ value: TemplateCategory | "all"; label: string }> = [
  { value: "all", label: "All Templates" },
  { value: "general", label: "General" },
  { value: "education", label: "Education" },
  { value: "cooking", label: "Cooking" },
  { value: "review", label: "Review" },
  { value: "technology", label: "Technology" },
];

export function TemplatePickerGrid({
  onSelectTemplate,
}: TemplatePickerGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategory | "all"
  >("all");
  const [previewTemplate, setPreviewTemplate] = useState<SchemaTemplate | null>(
    null
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredTemplates =
    selectedCategory === "all"
      ? SCHEMA_TEMPLATES
      : getTemplatesByCategory(selectedCategory);

  const handleUseTemplate = (template: SchemaTemplate) => {
    onSelectTemplate(template);
  };

  const handlePreview = (template: SchemaTemplate) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const handlePreviewConfirm = (template: SchemaTemplate) => {
    setPreviewOpen(false);
    onSelectTemplate(template);
  };

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <Badge
            className="cursor-pointer hover:bg-accent"
            key={category.value}
            onClick={() => setSelectedCategory(category.value)}
            variant={
              selectedCategory === category.value ? "default" : "outline"
            }
          >
            {category.label}
          </Badge>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            onPreview={handlePreview}
            onUseTemplate={handleUseTemplate}
            template={template}
          />
        ))}
      </div>

      {/* No Results */}
      {filteredTemplates.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No templates found in this category.
        </div>
      )}

      {/* Preview Dialog */}
      <TemplatePreviewDialog
        onConfirm={handlePreviewConfirm}
        onOpenChange={setPreviewOpen}
        open={previewOpen}
        template={previewTemplate}
      />
    </div>
  );
}
