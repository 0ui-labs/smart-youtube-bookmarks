import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/hooks/useTags";
import { cn } from "@/lib/utils";
import { extractYouTubeId } from "@/utils/urlParser";

export interface ImportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  urls: string[];
  existingVideoIds?: string[];
  preselectedCategoryId?: string;
  onImport: (urls: string[], categoryId?: string) => void;
}

interface UrlValidation {
  url: string;
  videoId: string | null;
  isValid: boolean;
  isDuplicate: boolean;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  open,
  onOpenChange,
  urls,
  existingVideoIds = [],
  preselectedCategoryId,
  onImport,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >(preselectedCategoryId);
  const { data: categories = [] } = useCategories();

  // Sync selectedCategoryId when preselectedCategoryId changes
  useEffect(() => {
    if (preselectedCategoryId) {
      setSelectedCategoryId(preselectedCategoryId);
    }
  }, [preselectedCategoryId]);

  // Validate all URLs
  const validatedUrls = useMemo<UrlValidation[]>(
    () =>
      urls.map((url) => {
        const videoId = extractYouTubeId(url);
        return {
          url,
          videoId,
          isValid: videoId !== null,
          isDuplicate: videoId !== null && existingVideoIds.includes(videoId),
        };
      }),
    [urls, existingVideoIds]
  );

  const validUrls = validatedUrls.filter((v) => v.isValid);
  const duplicateCount = validatedUrls.filter((v) => v.isDuplicate).length;

  const handleImport = () => {
    const urlsToImport = validUrls.map((v) => v.url);
    onImport(urlsToImport, selectedCategoryId);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{urls.length} Videos erkannt</DialogTitle>
          <DialogDescription>
            Überprüfe die URLs und wähle optional eine Kategorie.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[300px] overflow-y-auto pr-4">
          <div className="space-y-2">
            {validatedUrls.map((item, index) => (
              <div
                className={cn(
                  "flex items-center gap-2 py-1 text-sm",
                  !item.isValid && "text-destructive"
                )}
                data-testid={`url-item-${index}`}
                key={index}
              >
                {item.isValid ? (
                  item.isDuplicate ? (
                    <AlertTriangle
                      className="h-4 w-4 flex-shrink-0 text-yellow-500"
                      data-testid="duplicate-url-icon"
                    />
                  ) : (
                    <CheckCircle
                      className="h-4 w-4 flex-shrink-0 text-green-500"
                      data-testid="valid-url-icon"
                    />
                  )
                ) : (
                  <XCircle
                    className="h-4 w-4 flex-shrink-0 text-destructive"
                    data-testid="invalid-url-icon"
                  />
                )}
                <span className="truncate">{item.url}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {duplicateCount > 0 && (
            <p className="text-muted-foreground text-sm">
              {duplicateCount} Duplikat{duplicateCount !== 1 ? "e" : ""}{" "}
              gefunden
            </p>
          )}

          <Select
            onValueChange={(value) =>
              setSelectedCategoryId(value === "__none__" ? undefined : value)
            }
            value={selectedCategoryId ?? "__none__"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Keine Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Keine Kategorie</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button onClick={handleCancel} variant="outline">
            Abbrechen
          </Button>
          <Button disabled={validUrls.length === 0} onClick={handleImport}>
            Importieren ({validUrls.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
