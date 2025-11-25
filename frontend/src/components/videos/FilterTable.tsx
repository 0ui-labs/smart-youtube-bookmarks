import type { CustomField } from '@/types/customFields'
import type { CategoryFilters } from '@/types/filterSettings'
import { useFieldFilterStore } from '@/stores/fieldFilterStore'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'

interface FilterTableProps {
  categoryFilter: CategoryFilters
}

/**
 * Filter Table Component - Displays fields and allows filter management
 *
 * Shows custom fields for a category with ability to add/edit/remove filters.
 * Integrates with fieldFilterStore for state management.
 *
 * @param categoryFilter - Category with fields to display
 */
export function FilterTable({ categoryFilter }: FilterTableProps) {
  const { activeFilters, addFilter, removeFilter } = useFieldFilterStore()

  // Get active filter for a specific field
  const getActiveFilter = (fieldId: string) => {
    return activeFilters.find((f) => f.fieldId === fieldId)
  }

  // Check if field has active filter
  const hasActiveFilter = (fieldId: string) => {
    return activeFilters.some((f) => f.fieldId === fieldId)
  }

  // Handle adding a filter (default operator and value)
  const handleAddFilter = (field: CustomField) => {
    // Default operator and value based on field type
    if (field.field_type === 'rating') {
      addFilter({
        fieldId: field.id,
        fieldName: field.name,
        fieldType: 'rating',
        operator: 'gte',
        value: 1,
      })
    } else if (field.field_type === 'select') {
      const config = field.config as { options: string[] }
      addFilter({
        fieldId: field.id,
        fieldName: field.name,
        fieldType: 'select',
        operator: 'in',
        value: config.options[0],
      })
    } else if (field.field_type === 'text') {
      addFilter({
        fieldId: field.id,
        fieldName: field.name,
        fieldType: 'text',
        operator: 'contains',
        value: '',
      })
    } else if (field.field_type === 'boolean') {
      addFilter({
        fieldId: field.id,
        fieldName: field.name,
        fieldType: 'boolean',
        operator: 'is',
        value: true,
      })
    }
  }

  // Handle removing a filter
  const handleRemoveFilter = (fieldId: string) => {
    const filter = getActiveFilter(fieldId)
    if (filter) {
      removeFilter(filter.id)
    }
  }

  // Get field type display label
  const getFieldTypeLabel = (fieldType: CustomField['field_type']): string => {
    const labels: Record<CustomField['field_type'], string> = {
      rating: 'Bewertung',
      select: 'Auswahl',
      text: 'Text',
      boolean: 'Ja/Nein',
    }
    return labels[fieldType]
  }

  // No fields available
  if (categoryFilter.fields.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <p>Keine Felder verfügbar für diese Kategorie.</p>
        {categoryFilter.schemaId === null && (
          <p className="mt-2">
            Diese Kategorie hat kein Schema zugewiesen.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feld</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aktion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categoryFilter.fields.map((field) => {
            const isActive = hasActiveFilter(field.id)

            return (
              <TableRow key={field.id}>
                <TableCell className="font-medium">{field.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {getFieldTypeLabel(field.field_type)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isActive ? (
                    <Badge variant="default">Aktiv</Badge>
                  ) : (
                    <Badge variant="secondary">Inaktiv</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFilter(field.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Entfernen
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddFilter(field)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Hinzufügen
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
