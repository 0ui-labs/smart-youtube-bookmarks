import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useCategories } from '@/hooks/useTags'
import { extractYouTubeId } from '@/utils/urlParser'

export interface ImportPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  urls: string[]
  existingVideoIds?: string[]
  preselectedCategoryId?: string
  onImport: (urls: string[], categoryId?: string) => void
}

interface UrlValidation {
  url: string
  videoId: string | null
  isValid: boolean
  isDuplicate: boolean
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  open,
  onOpenChange,
  urls,
  existingVideoIds = [],
  preselectedCategoryId,
  onImport,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    preselectedCategoryId
  )
  const { data: categories = [] } = useCategories()

  // Sync selectedCategoryId when preselectedCategoryId changes
  useEffect(() => {
    if (preselectedCategoryId) {
      setSelectedCategoryId(preselectedCategoryId)
    }
  }, [preselectedCategoryId])

  // Validate all URLs
  const validatedUrls = useMemo<UrlValidation[]>(() => {
    return urls.map((url) => {
      const videoId = extractYouTubeId(url)
      return {
        url,
        videoId,
        isValid: videoId !== null,
        isDuplicate: videoId !== null && existingVideoIds.includes(videoId),
      }
    })
  }, [urls, existingVideoIds])

  const validUrls = validatedUrls.filter((v) => v.isValid)
  const duplicateCount = validatedUrls.filter((v) => v.isDuplicate).length

  const handleImport = () => {
    const urlsToImport = validUrls.map((v) => v.url)
    onImport(urlsToImport, selectedCategoryId)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                key={index}
                data-testid={`url-item-${index}`}
                className={cn(
                  'flex items-center gap-2 text-sm py-1',
                  !item.isValid && 'text-destructive'
                )}
              >
                {item.isValid ? (
                  item.isDuplicate ? (
                    <AlertTriangle
                      data-testid="duplicate-url-icon"
                      className="h-4 w-4 text-yellow-500 flex-shrink-0"
                    />
                  ) : (
                    <CheckCircle
                      data-testid="valid-url-icon"
                      className="h-4 w-4 text-green-500 flex-shrink-0"
                    />
                  )
                ) : (
                  <XCircle
                    data-testid="invalid-url-icon"
                    className="h-4 w-4 text-destructive flex-shrink-0"
                  />
                )}
                <span className="truncate">{item.url}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {duplicateCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {duplicateCount} Duplikat{duplicateCount !== 1 ? 'e' : ''} gefunden
            </p>
          )}

          <Select
            value={selectedCategoryId ?? '__none__'}
            onValueChange={(value) =>
              setSelectedCategoryId(value === '__none__' ? undefined : value)
            }
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
          <Button variant="outline" onClick={handleCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleImport} disabled={validUrls.length === 0}>
            Importieren ({validUrls.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
