import { useState } from 'react'
import { TemplateCard } from './TemplateCard'
import { TemplatePreviewDialog } from './TemplatePreviewDialog'
import { Badge } from '@/components/ui/badge'
import {
  SCHEMA_TEMPLATES,
  getTemplatesByCategory,
  type SchemaTemplate,
  type TemplateCategory,
} from '@/constants/schemaTemplates'

interface TemplatePickerGridProps {
  onSelectTemplate: (template: SchemaTemplate) => void
}

const CATEGORIES: Array<{ value: TemplateCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All Templates' },
  { value: 'general', label: 'General' },
  { value: 'education', label: 'Education' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'review', label: 'Review' },
  { value: 'technology', label: 'Technology' },
]

export function TemplatePickerGrid({ onSelectTemplate }: TemplatePickerGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [previewTemplate, setPreviewTemplate] = useState<SchemaTemplate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const filteredTemplates =
    selectedCategory === 'all'
      ? SCHEMA_TEMPLATES
      : getTemplatesByCategory(selectedCategory)

  const handleUseTemplate = (template: SchemaTemplate) => {
    onSelectTemplate(template)
  }

  const handlePreview = (template: SchemaTemplate) => {
    setPreviewTemplate(template)
    setPreviewOpen(true)
  }

  const handlePreviewConfirm = (template: SchemaTemplate) => {
    setPreviewOpen(false)
    onSelectTemplate(template)
  }

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(category => (
          <Badge
            key={category.value}
            variant={selectedCategory === category.value ? 'default' : 'outline'}
            className="cursor-pointer hover:bg-accent"
            onClick={() => setSelectedCategory(category.value)}
          >
            {category.label}
          </Badge>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onUseTemplate={handleUseTemplate}
            onPreview={handlePreview}
          />
        ))}
      </div>

      {/* No Results */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No templates found in this category.
        </div>
      )}

      {/* Preview Dialog */}
      <TemplatePreviewDialog
        template={previewTemplate}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onConfirm={handlePreviewConfirm}
      />
    </div>
  )
}
