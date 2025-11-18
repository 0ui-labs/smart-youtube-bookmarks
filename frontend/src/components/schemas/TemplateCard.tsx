import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'
import { TEMPLATE_ICONS, CATEGORY_BADGE_COLORS, type SchemaTemplate } from '@/constants/schemaTemplates'

interface TemplateCardProps {
  template: SchemaTemplate
  onUseTemplate: (template: SchemaTemplate) => void
  onPreview: (template: SchemaTemplate) => void
}

export function TemplateCard({ template, onUseTemplate, onPreview }: TemplateCardProps) {
  const IconComponent = TEMPLATE_ICONS[template.icon]
  const badgeColor = CATEGORY_BADGE_COLORS[template.category]

  return (
    <Card className="hover:border-primary transition-colors cursor-pointer">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {IconComponent && (
              <div className="p-2 rounded-lg bg-primary/10">
                <IconComponent className="w-6 h-6 text-primary" />
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
        <CardDescription className="mt-2">{template.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          {template.fields.length} field{template.fields.length !== 1 ? 's' : ''} •{' '}
          {template.fields.filter(f => f.show_on_card).length} shown on card
        </div>

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex-1"
            onClick={() => onUseTemplate(template)}
          >
            Use Template
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPreview(template)}
            aria-label="Preview template"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
