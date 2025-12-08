import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CATEGORY_BADGE_COLORS,
  type SchemaTemplate,
  TEMPLATE_ICONS,
} from "@/constants/schemaTemplates";

interface TemplateCardProps {
  template: SchemaTemplate;
  onUseTemplate: (template: SchemaTemplate) => void;
  onPreview: (template: SchemaTemplate) => void;
}

export function TemplateCard({
  template,
  onUseTemplate,
  onPreview,
}: TemplateCardProps) {
  const IconComponent = TEMPLATE_ICONS[template.icon];
  const badgeColor = CATEGORY_BADGE_COLORS[template.category];

  return (
    <Card className="cursor-pointer transition-colors hover:border-primary">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {IconComponent && (
              <div className="rounded-lg bg-primary/10 p-2">
                <IconComponent className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <Badge className={`mt-1 ${badgeColor}`} variant="secondary">
                {template.category}
              </Badge>
            </div>
          </div>
        </div>
        <CardDescription className="mt-2">
          {template.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="mb-4 text-muted-foreground text-sm">
          {template.fields.length} field
          {template.fields.length !== 1 ? "s" : ""} •{" "}
          {template.fields.filter((f) => f.show_on_card).length} shown on card
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => onUseTemplate(template)}
            variant="default"
          >
            Use Template
          </Button>
          <Button
            aria-label="Preview template"
            onClick={() => onPreview(template)}
            size="icon"
            variant="outline"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
