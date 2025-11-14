import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { SchemaActionsMenu } from './SchemaActionsMenu'
import { EditSchemaDialog } from './EditSchemaDialog'
import { ConfirmDeleteSchemaDialog } from './ConfirmDeleteSchemaDialog'
import { DuplicateSchemaDialog } from './DuplicateSchemaDialog'
import { SchemaUsageStatsModal } from './SchemaUsageStatsModal'
import { BulkApplySchemaDialog } from './BulkApplySchemaDialog'
import { BulkOperationResultDialog } from './BulkOperationResultDialog'
import {
  useUpdateSchema,
  useDeleteSchema,
  useDuplicateSchema,
  useSchemaUsageStats,
} from '@/hooks/useSchemas'
import { useTags, useBulkApplySchema } from '@/hooks/useTags'
import type { FieldSchemaResponse } from '@/types/schema'

export interface SchemaCardProps {
  schema: FieldSchemaResponse
  listId: string
  onClick?: (schema: FieldSchemaResponse) => void
}

/**
 * SchemaCard - Displays a schema summary with integrated action dialogs
 *
 * Shows:
 * - Schema name and description
 * - Field count
 * - Action menu (Edit, Delete, Duplicate, View Usage)
 * - Integrated dialogs for all actions
 *
 * Mutations:
 * - Edit: useUpdateSchema with optimistic updates
 * - Delete: useDeleteSchema with usage validation
 * - Duplicate: useDuplicateSchema (client-side GET + POST)
 *
 * Design follows REF MCP validated patterns with React Query v5 context API.
 *
 * @example
 * <SchemaCard
 *   schema={schema}
 *   listId={listId}
 *   onClick={(schema) => console.log('Clicked:', schema)}
 * />
 */
export function SchemaCard({ schema, listId, onClick }: SchemaCardProps) {
  const { data: tags = [] } = useTags()
  const usageStats = useSchemaUsageStats(schema.id, tags)

  // Mutations
  const updateSchema = useUpdateSchema(listId)
  const deleteSchema = useDeleteSchema(listId)
  const duplicateSchema = useDuplicateSchema(listId)
  const bulkApply = useBulkApplySchema()

  // Modal states
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [usageStatsOpen, setUsageStatsOpen] = useState(false)
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Action handlers
  const handleEdit = (data: { name: string; description: string | null }) => {
    updateSchema.mutate(
      { schemaId: schema.id, updates: data },
      {
        onSuccess: () => {
          setEditOpen(false)
        },
        // Keep modal open on error for retry
      }
    )
  }

  const handleDelete = () => {
    deleteSchema.mutate(
      { schemaId: schema.id },
      {
        onSuccess: () => {
          setDeleteOpen(false)
        },
        // Keep modal open on error (e.g., 409 Conflict)
      }
    )
  }

  const handleDuplicate = (newName: string) => {
    duplicateSchema.mutate(
      { schemaId: schema.id, newName },
      {
        onSuccess: () => {
          setDuplicateOpen(false)
        },
        // Keep modal open on error for retry
      }
    )
  }

  const handleBulkApply = (selectedTagIds: string[]) => {
    bulkApply.mutate(
      {
        tagIds: selectedTagIds,
        schemaId: schema.id,
      },
      {
        onSuccess: () => {
          setBulkApplyOpen(false)
          setShowResults(true)
        },
        // Errors handled by mutation's onError (rollback)
      }
    )
  }

  const handleRetry = (failedTagIds: string[]) => {
    bulkApply.mutate({
      tagIds: failedTagIds,
      schemaId: schema.id,
    })
  }

  return (
    <>
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => onClick?.(schema)}
      >
        <CardHeader className="flex flex-row items-start gap-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{schema.name}</h3>
            {schema.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {schema.description}
              </p>
            )}
          </div>

          {/* Actions Menu */}
          <SchemaActionsMenu
            schema={schema}
            usageCount={usageStats.count}
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
            onDuplicate={() => setDuplicateOpen(true)}
            onViewUsage={() => setUsageStatsOpen(true)}
            onBulkApply={() => setBulkApplyOpen(true)}
          />
        </CardHeader>

        <CardContent>
          {/* Field count */}
          <p className="text-sm text-muted-foreground">
            {schema.schema_fields.length} Feld
            {schema.schema_fields.length !== 1 ? 'er' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Modals */}
      <EditSchemaDialog
        open={editOpen}
        schema={schema}
        onConfirm={handleEdit}
        onCancel={() => setEditOpen(false)}
        isLoading={updateSchema.isPending}
      />

      <ConfirmDeleteSchemaDialog
        open={deleteOpen}
        schema={schema}
        usageStats={usageStats}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        isLoading={deleteSchema.isPending}
      />

      <DuplicateSchemaDialog
        open={duplicateOpen}
        schema={schema}
        onConfirm={handleDuplicate}
        onCancel={() => setDuplicateOpen(false)}
        isLoading={duplicateSchema.isPending}
      />

      <SchemaUsageStatsModal
        open={usageStatsOpen}
        schema={schema}
        tags={tags}
        onClose={() => setUsageStatsOpen(false)}
      />

      {/* Bulk Apply Dialog */}
      <BulkApplySchemaDialog
        open={bulkApplyOpen}
        schema={schema}
        tags={tags}
        onConfirm={handleBulkApply}
        onCancel={() => setBulkApplyOpen(false)}
      />

      {/* Results Dialog */}
      <BulkOperationResultDialog
        open={showResults}
        result={bulkApply.data || null}
        onClose={() => setShowResults(false)}
        onRetry={handleRetry}
      />
    </>
  )
}
