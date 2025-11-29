import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCustomFields } from "@/hooks/useCustomFields";
import { cn } from "@/lib/utils";

interface FieldSelectorProps {
  listId: string;
  selectedFieldIds: string[];
  onFieldsSelected: (fieldIds: string[]) => void;
}

export function FieldSelector({
  listId,
  selectedFieldIds,
  onFieldsSelected,
}: FieldSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: fields = [], isLoading, error } = useCustomFields(listId);

  const handleSelect = (fieldId: string) => {
    const isSelected = selectedFieldIds.includes(fieldId);

    if (isSelected) {
      // Remove from selection
      onFieldsSelected(selectedFieldIds.filter((id) => id !== fieldId));
    } else {
      // Add to selection
      onFieldsSelected([...selectedFieldIds, fieldId]);
    }
  };

  const selectedCount = selectedFieldIds.length;
  // Note: availableFields computed but not currently used in UI
  const _availableFields = fields.filter(
    (f) => !selectedFieldIds.includes(f.id)
  );
  void _availableFields; // Suppress unused warning

  // Helper function to get field type display text with proper typing
  const getFieldTypeDisplay = (field: (typeof fields)[0]) => {
    switch (field.field_type) {
      case "rating": {
        const maxRating =
          "max_rating" in field.config ? field.config.max_rating : 5;
        return `Bewertung (max ${maxRating})`;
      }
      case "select": {
        const optionCount =
          "options" in field.config ? field.config.options.length : 0;
        return `Auswahl (${optionCount} ${optionCount === 1 ? "Option" : "Optionen"})`;
      }
      case "text": {
        const maxLength =
          "max_length" in field.config ? field.config.max_length : undefined;
        return maxLength ? `Text (max ${maxLength} Zeichen)` : "Text";
      }
      case "boolean":
        return "Ja/Nein";
      default:
        return field.field_type;
    }
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-label="Vorhandene Felder auswählen"
          className="justify-between"
          role="combobox"
          size="sm"
          variant="outline"
        >
          {selectedCount > 0
            ? `${selectedCount} Feld${selectedCount > 1 ? "er" : ""} ausgewählt`
            : "Vorhandene Felder"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[400px] max-w-[calc(100vw-2rem)] p-0"
      >
        {/* REF MCP Improvement #3: Loading/Error states outside Command for better semantics */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="ml-2 text-muted-foreground text-sm">Lädt...</span>
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center text-red-600 text-sm">
            Fehler beim Laden der Felder
          </div>
        ) : fields.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              Noch keine Felder vorhanden.
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              Erstellen Sie zuerst ein Feld.
            </p>
          </div>
        ) : (
          <Command>
            <CommandInput className="h-9" placeholder="Felder suchen..." />
            <CommandList>
              {/* REF MCP Improvement #3: CommandEmpty only for search with no matches */}
              <CommandEmpty>Keine Felder gefunden.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {fields.map((field) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={field.id}
                    onKeyDown={(e) => {
                      // REF MCP Improvement #4: Prevent form submission on Enter
                      if (e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}
                    onSelect={() => handleSelect(field.id)}
                    value={field.name}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedFieldIds.includes(field.id)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{field.name}</div>
                      <div className="text-muted-foreground text-sm">
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
  );
}
