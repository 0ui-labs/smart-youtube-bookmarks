import { Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFiltersByCategory } from "@/hooks/useFiltersByCategory";
import { FilterTable } from "./FilterTable";

interface FilterSettingsModalProps {
  listId: string;
  selectedTagIds: string[];
}

/**
 * Filter Settings Modal - Configure filters by category
 *
 * Displays available custom fields grouped by selected categories.
 * When multiple categories selected, shows tabs for each category.
 * When no categories selected, shows all custom fields.
 *
 * @param listId - List ID to fetch fields for
 * @param selectedTagIds - Selected category IDs from sidebar
 */
export function FilterSettingsModal({
  listId,
  selectedTagIds,
}: FilterSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const categoryFilters = useFiltersByCategory(listId, selectedTagIds);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings className="mr-1 h-4 w-4" />
          Filter
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl" hideDescription>
        <DialogHeader>
          <DialogTitle>Filter konfigurieren</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Single category: Show FilterTable directly */}
          {categoryFilters.length === 1 && categoryFilters[0] && (
            <FilterTable categoryFilter={categoryFilters[0]} />
          )}

          {/* Multiple categories: Show Tabs */}
          {categoryFilters.length > 1 && categoryFilters[0] && (
            <Tabs defaultValue={categoryFilters[0].categoryId}>
              <TabsList
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${categoryFilters.length}, minmax(0, 1fr))`,
                }}
              >
                {categoryFilters.map((category) => (
                  <TabsTrigger
                    key={category.categoryId}
                    value={category.categoryId}
                  >
                    {category.categoryName}
                  </TabsTrigger>
                ))}
              </TabsList>
              {categoryFilters.map((category) => (
                <TabsContent
                  key={category.categoryId}
                  value={category.categoryId}
                >
                  <FilterTable categoryFilter={category} />
                </TabsContent>
              ))}
            </Tabs>
          )}

          {/* No categories: Shouldn't happen with fallback */}
          {categoryFilters.length === 0 && (
            <div className="text-muted-foreground text-sm">
              <p>Keine Kategorien verfügbar.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
