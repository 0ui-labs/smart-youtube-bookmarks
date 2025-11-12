import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useCustomFields } from '@/hooks/useCustomFields'
import { cn } from '@/lib/utils'

interface FieldSelectorProps {
  listId: string
  selectedFieldIds: string[]
  onFieldsSelected: (fieldIds: string[]) => void
}

export function FieldSelector({ listId, selectedFieldIds, onFieldsSelected }: FieldSelectorProps) {
  const [open, setOpen] = useState(false)
  const { data: fields = [], isLoading, error } = useCustomFields(listId)

  const handleSelect = (fieldId: string) => {
    const isSelected = selectedFieldIds.includes(fieldId)

    if (isSelected) {
      // Remove from selection
      onFieldsSelected(selectedFieldIds.filter(id => id !== fieldId))
    } else {
      // Add to selection
      onFieldsSelected([...selectedFieldIds, fieldId])
    }
  }

  const selectedCount = selectedFieldIds.length
  const availableFields = fields.filter(f => !selectedFieldIds.includes(f.id))

  // Helper function to get field type display text with proper typing
  const getFieldTypeDisplay = (field: typeof fields[0]) => {
    switch (field.field_type) {
      case 'rating': {
        const maxRating = 'max_rating' in field.config ? field.config.max_rating : 5
        return `Bewertung (max ${maxRating})`
      }
      case 'select': {
        const optionCount = 'options' in field.config ? field.config.options.length : 0
        return `Auswahl (${optionCount} ${optionCount === 1 ? 'Option' : 'Optionen'})`
      }
      case 'text': {
        const maxLength = 'max_length' in field.config ? field.config.max_length : undefined
        return maxLength ? `Text (max ${maxLength} Zeichen)` : 'Text'
      }
      case 'boolean':
        return 'Ja/Nein'
      default:
        return field.field_type
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Vorhandene Felder auswählen"
          className="justify-between"
        >
          {selectedCount > 0
            ? `${selectedCount} Feld${selectedCount > 1 ? 'er' : ''} ausgewählt`
            : 'Vorhandene Felder'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] max-w-[calc(100vw-2rem)] p-0" align="start">
        {/* REF MCP Improvement #3: Loading/Error states outside Command for better semantics */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
            <span className="ml-2 text-sm text-muted-foreground">Lädt...</span>
          </div>
        ) : error ? (
          <div className="py-6 px-4 text-center text-sm text-red-600">
            Fehler beim Laden der Felder
          </div>
        ) : fields.length === 0 ? (
          <div className="py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground">Noch keine Felder vorhanden.</p>
            <p className="text-sm text-muted-foreground mt-1">Erstellen Sie zuerst ein Feld.</p>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Felder suchen..." className="h-9" />
            <CommandList>
              {/* REF MCP Improvement #3: CommandEmpty only for search with no matches */}
              <CommandEmpty>Keine Felder gefunden.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {availableFields.map((field) => (
                  <CommandItem
                    key={field.id}
                    value={field.name}
                    onSelect={() => handleSelect(field.id)}
                    onKeyDown={(e) => {
                      // REF MCP Improvement #4: Prevent form submission on Enter
                      if (e.key === 'Enter') {
                        e.preventDefault()
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedFieldIds.includes(field.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{field.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getFieldTypeDisplay(field)}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}
