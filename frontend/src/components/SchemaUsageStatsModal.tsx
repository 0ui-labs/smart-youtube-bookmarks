import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FieldSchemaResponse } from "@/types/schema";
import type { Tag } from "@/types/tag";

interface SchemaUsageStatsModalProps {
  open: boolean;
  schema: FieldSchemaResponse | null;
  tags: Tag[];
  onClose: () => void;
}

export const SchemaUsageStatsModal = ({
  open,
  schema,
  tags,
  onClose,
}: SchemaUsageStatsModalProps) => {
  // Compute which tags use this schema
  const usedByTags = tags.filter((tag) => tag.schema_id === schema?.id);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Verwendungsstatistik</DialogTitle>
          <DialogDescription>
            Schema: <strong>{schema?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {usedByTags.length > 0 ? (
            <div className="space-y-3">
              <p className="font-medium text-sm">
                Verwendet von {usedByTags.length} Tag
                {usedByTags.length !== 1 ? "s" : ""}:
              </p>

              <ul className="max-h-[300px] space-y-2 overflow-y-auto">
                {usedByTags.map((tag) => (
                  <li
                    className="flex items-center gap-2 rounded-md p-2 hover:bg-gray-50"
                    key={tag.id}
                  >
                    {/* Tag Color Badge */}
                    {tag.color && (
                      <div
                        className="h-4 w-4 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    {/* Tag Name */}
                    <span className="text-sm">{tag.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
              <Info className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <p className="text-gray-600 text-sm">
                Dieses Schema wird aktuell nicht von Tags verwendet.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
