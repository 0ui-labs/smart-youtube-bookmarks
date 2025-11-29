import { Eye, Star, ToggleLeft, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type SchemaTemplate,
  TEMPLATE_ICONS,
} from "@/constants/schemaTemplates";

interface TemplatePreviewDialogProps {
  template: SchemaTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (template: SchemaTemplate) => void;
}

/**
 * Map field types to human-readable labels and icons.
 */
const FIELD_TYPE_CONFIG = {
  select: { label: "Select", icon: ToggleLeft, color: "text-blue-600" },
  rating: { label: "Rating", icon: Star, color: "text-yellow-600" },
  text: { label: "Text", icon: Type, color: "text-green-600" },
  boolean: { label: "Boolean", icon: ToggleLeft, color: "text-purple-600" },
} as const;

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  onConfirm,
}: TemplatePreviewDialogProps) {
  if (!template) return null;

  const IconComponent = TEMPLATE_ICONS[template.icon];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {IconComponent && (
              <div className="rounded-lg bg-primary/10 p-2">
                <IconComponent className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <DialogTitle>{template.name}</DialogTitle>
              <DialogDescription>{template.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="mb-3 font-semibold">
              Fields ({template.fields.length})
            </h4>
            <div className="space-y-3">
              {template.fields.map((field, index) => {
                const typeConfig = FIELD_TYPE_CONFIG[field.field_type];
                const TypeIcon = typeConfig.icon;

                return (
                  <div
                    className="rounded-lg border bg-muted/30 p-3"
                    key={index}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                          <span className="font-medium">{field.name}</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline">{typeConfig.label}</Badge>
                          {field.show_on_card && (
                            <Badge className="gap-1" variant="secondary">
                              <Eye className="h-3 w-3" />
                              Shown on card
                            </Badge>
                          )}
                        </div>

                        {/* Show type-specific config */}
                        {field.field_type === "select" &&
                          field.config.options && (
                            <div className="mt-2 text-muted-foreground text-sm">
                              Options:{" "}
                              {(field.config.options as string[]).join(", ")}
                            </div>
                          )}
                        {field.field_type === "rating" &&
                          field.config.max_rating && (
                            <div className="mt-2 text-muted-foreground text-sm">
                              Max rating: {field.config.max_rating}
                            </div>
                          )}
                        {field.field_type === "text" &&
                          field.config.max_length && (
                            <div className="mt-2 text-muted-foreground text-sm">
                              Max length: {field.config.max_length} characters
                            </div>
                          )}
                      </div>

                      <div className="text-muted-foreground text-xs">
                        Order: {field.display_order}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button onClick={() => onConfirm(template)}>Use Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
