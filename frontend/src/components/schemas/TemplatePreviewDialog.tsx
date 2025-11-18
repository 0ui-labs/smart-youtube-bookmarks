import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TEMPLATE_ICONS, type SchemaTemplate } from '@/constants/schemaTemplates'
import { Eye, Star, Type, ToggleLeft } from 'lucide-react'

interface TemplatePreviewDialogProps {
  template: SchemaTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (template: SchemaTemplate) => void
}

/**
 * Map field types to human-readable labels and icons.
 */
const FIELD_TYPE_CONFIG = {
  select: { label: 'Select', icon: ToggleLeft, color: 'text-blue-600' },
  rating: { label: 'Rating', icon: Star, color: 'text-yellow-600' },
  text: { label: 'Text', icon: Type, color: 'text-green-600' },
  boolean: { label: 'Boolean', icon: ToggleLeft, color: 'text-purple-600' },
} as const

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  onConfirm,
}: TemplatePreviewDialogProps) {
  if (!template) return null

  const IconComponent = TEMPLATE_ICONS[template.icon]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {IconComponent && (
              <div className="p-2 rounded-lg bg-primary/10">
                <IconComponent className="w-6 h-6 text-primary" />
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
            <h4 className="font-semibold mb-3">Fields ({template.fields.length})</h4>
            <div className="space-y-3">
              {template.fields.map((field, index) => {
                const typeConfig = FIELD_TYPE_CONFIG[field.field_type]
                const TypeIcon = typeConfig.icon

                return (
                  <div
                    key={index}
                    className="border rounded-lg p-3 bg-muted/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                          <span className="font-medium">{field.name}</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline">{typeConfig.label}</Badge>
                          {field.show_on_card && (
                            <Badge variant="secondary" className="gap-1">
                              <Eye className="w-3 h-3" />
                              Shown on card
                            </Badge>
                          )}
                        </div>

                        {/* Show type-specific config */}
                        {field.field_type === 'select' && field.config.options && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Options: {(field.config.options as string[]).join(', ')}
                          </div>
                        )}
                        {field.field_type === 'rating' && field.config.max_rating && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Max rating: {field.config.max_rating}
                          </div>
                        )}
                        {field.field_type === 'text' && field.config.max_length && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Max length: {field.config.max_length} characters
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Order: {field.display_order}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(template)}>
            Use Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
