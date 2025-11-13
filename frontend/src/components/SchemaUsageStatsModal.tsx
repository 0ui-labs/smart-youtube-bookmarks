import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { FieldSchemaResponse } from '@/types/schema'
import type { Tag } from '@/types/tag'

interface SchemaUsageStatsModalProps {
  open: boolean
  schema: FieldSchemaResponse | null
  tags: Tag[]
  onClose: () => void
}

export const SchemaUsageStatsModal = ({
  open,
  schema,
  tags,
  onClose,
}: SchemaUsageStatsModalProps) => {
  // Compute which tags use this schema
  const usedByTags = tags.filter((tag) => tag.schema_id === schema?.id)

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
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
              <p className="text-sm font-medium">
                Verwendet von {usedByTags.length} Tag{usedByTags.length !== 1 ? 's' : ''}:
              </p>

              <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                {usedByTags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50"
                  >
                    {/* Tag Color Badge */}
                    {tag.color && (
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
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
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                Dieses Schema wird aktuell nicht von Tags verwendet.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
