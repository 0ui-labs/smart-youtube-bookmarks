import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCategories } from "@/hooks/useTags";
import { CategoryChangeWarning } from "./CategoryChangeWarning";

export interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCategoryId: string | null;
  onCategoryChange: (
    categoryId: string | null,
    restoreBackup?: boolean
  ) => void;
  isMutating?: boolean;
}

export function CategoryModal({
  open,
  onOpenChange,
  currentCategoryId,
  onCategoryChange,
  isMutating = false,
}: CategoryModalProps) {
  const { data: categories, isLoading } = useCategories();

  // Warning dialog state
  const [showWarning, setShowWarning] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(
    null
  );

  // Find selected category
  const selectedCategory = categories?.find((c) => c.id === currentCategoryId);

  // Find pending category for warning dialog
  const pendingCategory = pendingCategoryId
    ? (categories?.find((c) => c.id === pendingCategoryId) ?? null)
    : null;

  // Handle category click
  const handleCategoryClick = (categoryId: string | null) => {
    // If same category, close modal
    if (categoryId === currentCategoryId) {
      onOpenChange(false);
      return;
    }

    // If no current category, assign directly (no warning needed)
    if (currentCategoryId === null) {
      onCategoryChange(categoryId);
      onOpenChange(false);
      return;
    }

    // Otherwise show warning dialog
    setPendingCategoryId(categoryId);
    setShowWarning(true);
  };

  // Handle warning dialog confirm
  const handleConfirm = (restoreBackup: boolean) => {
    onCategoryChange(pendingCategoryId, restoreBackup);
    setShowWarning(false);
    setPendingCategoryId(null);
    onOpenChange(false);
  };

  // Handle warning dialog cancel
  const handleCancel = () => {
    setShowWarning(false);
    setPendingCategoryId(null);
  };

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="max-w-md" hideDescription>
          <DialogHeader>
            <DialogTitle>Kategorie auswählen</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : isMutating ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Ändere Kategorie...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {/* No category option */}
              <button
                className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-colors ${
                  currentCategoryId === null
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => handleCategoryClick(null)}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500 text-sm">
                  —
                </span>
                <span className="flex-1 text-left font-medium">
                  Keine Kategorie
                </span>
                {currentCategoryId === null && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </button>

              {/* Category options */}
              {categories?.map((category) => (
                <button
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-colors ${
                    currentCategoryId === category.id
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm text-white"
                    style={{ backgroundColor: category.color || "#6b7280" }}
                  >
                    {category.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 text-left font-medium">
                    {category.name}
                  </span>
                  {currentCategoryId === category.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}

              {categories?.length === 0 && (
                <p className="py-4 text-center text-gray-500">
                  Keine Kategorien verfügbar
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Abbrechen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warning dialog */}
      <CategoryChangeWarning
        fieldValuesThatPersist={[]}
        fieldValuesToBackup={[]}
        hasBackup={false}
        newCategory={pendingCategory}
        oldCategory={selectedCategory ?? null}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        onOpenChange={setShowWarning}
        open={showWarning}
      />
    </>
  );
}
