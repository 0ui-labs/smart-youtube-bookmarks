import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { FieldSchemaResponse } from "@/types/schema";

interface ConfirmDeleteSchemaDialogProps {
  open: boolean;
  schema: FieldSchemaResponse | null;
  usageStats: {
    count: number;
    tagNames: string[];
  };
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const ConfirmDeleteSchemaDialog = ({
  open,
  schema,
  usageStats,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDeleteSchemaDialogProps) => {
  const schemaName = schema?.name || "dieses Schema";
  const isUsed = usageStats.count > 0;

  return (
    <AlertDialog onOpenChange={(open) => !open && onCancel()} open={open}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Schema löschen?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isUsed ? (
                <>
                  {/* Usage Warning */}
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                      <div className="flex-1">
                        <p className="font-medium text-orange-900">
                          Dieses Schema wird von {usageStats.count} Tag
                          {usageStats.count !== 1 ? "s" : ""} verwendet:
                        </p>
                        <ul className="mt-2 space-y-1">
                          {usageStats.tagNames.slice(0, 5).map((tagName) => (
                            <li
                              className="text-orange-800 text-sm"
                              key={tagName}
                            >
                              • {tagName}
                            </li>
                          ))}
                          {usageStats.tagNames.length > 5 && (
                            <li className="font-medium text-orange-700 text-sm">
                              ... und {usageStats.tagNames.length - 5} weitere
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm">
                    Möchten Sie <strong>"{schemaName}"</strong> wirklich
                    löschen? Diese Tags verlieren ihre Schemaverbindung.
                  </p>
                </>
              ) : (
                <p>
                  Möchten Sie das Schema <strong>"{schemaName}"</strong>{" "}
                  wirklich löschen? Diese Aktion kann nicht rückgängig gemacht
                  werden.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
              disabled={isLoading}
              onClick={(e) => {
                e.preventDefault(); // Prevent auto-close during async
                onConfirm();
              }}
              variant="destructive"
            >
              {isLoading ? "Löschen..." : "Schema löschen"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
