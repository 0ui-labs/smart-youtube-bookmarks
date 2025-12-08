import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useDeleteSchema,
  useDuplicateSchema,
  useSchemaUsageStats,
  useUpdateSchema,
} from "@/hooks/useSchemas";
import { useBulkApplySchema, useTags } from "@/hooks/useTags";
import type { FieldSchemaResponse } from "@/types/schema";
import { BulkApplySchemaDialog } from "./BulkApplySchemaDialog";
import { BulkOperationResultDialog } from "./BulkOperationResultDialog";
import { ConfirmDeleteSchemaDialog } from "./ConfirmDeleteSchemaDialog";
import { DuplicateSchemaDialog } from "./DuplicateSchemaDialog";
import { EditSchemaDialog } from "./EditSchemaDialog";
import { SchemaActionsMenu } from "./SchemaActionsMenu";
import { SchemaUsageStatsModal } from "./SchemaUsageStatsModal";

export interface SchemaCardProps {
  schema: FieldSchemaResponse;
  listId: string;
  onClick?: (schema: FieldSchemaResponse) => void;
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
  const { data: tags = [] } = useTags();
  const usageStats = useSchemaUsageStats(schema.id, tags);

  // Mutations
  const updateSchema = useUpdateSchema(listId);
  const deleteSchema = useDeleteSchema(listId);
  const duplicateSchema = useDuplicateSchema(listId);
  const bulkApply = useBulkApplySchema();

  // Modal states
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [usageStatsOpen, setUsageStatsOpen] = useState(false);
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Action handlers
  const handleEdit = (data: { name: string; description: string | null }) => {
    updateSchema.mutate(
      { schemaId: schema.id, updates: data },
      {
        onSuccess: () => {
          setEditOpen(false);
        },
        // Keep modal open on error for retry
      }
    );
  };

  const handleDelete = () => {
    deleteSchema.mutate(
      { schemaId: schema.id },
      {
        onSuccess: () => {
          setDeleteOpen(false);
        },
        // Keep modal open on error (e.g., 409 Conflict)
      }
    );
  };

  const handleDuplicate = (newName: string) => {
    duplicateSchema.mutate(
      { schemaId: schema.id, newName },
      {
        onSuccess: () => {
          setDuplicateOpen(false);
        },
        // Keep modal open on error for retry
      }
    );
  };

  const handleBulkApply = (selectedTagIds: string[]) => {
    bulkApply.mutate(
      {
        tagIds: selectedTagIds,
        schemaId: schema.id,
      },
      {
        onSuccess: () => {
          setBulkApplyOpen(false);
          setShowResults(true);
        },
        // Errors handled by mutation's onError (rollback)
      }
    );
  };

  const handleRetry = (failedTagIds: string[]) => {
    bulkApply.mutate(
      {
        tagIds: failedTagIds,
        schemaId: schema.id,
      },
      {
        onSuccess: () => {
          setShowResults(true);
        },
        // Errors handled by mutation's onError (rollback)
      }
    );
  };

  return (
    <>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => onClick?.(schema)}
      >
        <CardHeader className="flex flex-row items-start gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{schema.name}</h3>
            {schema.description && (
              <p className="mt-1 text-muted-foreground text-sm">
                {schema.description}
              </p>
            )}
          </div>

          {/* Actions Menu */}
          <SchemaActionsMenu
            onBulkApply={() => setBulkApplyOpen(true)}
            onDelete={() => setDeleteOpen(true)}
            onDuplicate={() => setDuplicateOpen(true)}
            onEdit={() => setEditOpen(true)}
            onViewUsage={() => setUsageStatsOpen(true)}
            schema={schema}
            usageCount={usageStats.count}
          />
        </CardHeader>

        <CardContent>
          {/* Field count */}
          <p className="text-muted-foreground text-sm">
            {schema.schema_fields.length} Feld
            {schema.schema_fields.length !== 1 ? "er" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Modals */}
      <EditSchemaDialog
        isLoading={updateSchema.isPending}
        onCancel={() => setEditOpen(false)}
        onConfirm={handleEdit}
        open={editOpen}
        schema={schema}
      />

      <ConfirmDeleteSchemaDialog
        isLoading={deleteSchema.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        open={deleteOpen}
        schema={schema}
        usageStats={usageStats}
      />

      <DuplicateSchemaDialog
        isLoading={duplicateSchema.isPending}
        onCancel={() => setDuplicateOpen(false)}
        onConfirm={handleDuplicate}
        open={duplicateOpen}
        schema={schema}
      />

      <SchemaUsageStatsModal
        onClose={() => setUsageStatsOpen(false)}
        open={usageStatsOpen}
        schema={schema}
        tags={tags}
      />

      {/* Bulk Apply Dialog */}
      <BulkApplySchemaDialog
        onCancel={() => setBulkApplyOpen(false)}
        onConfirm={handleBulkApply}
        open={bulkApplyOpen}
        schema={schema}
        tags={tags}
      />

      {/* Results Dialog */}
      <BulkOperationResultDialog
        onClose={() => setShowResults(false)}
        onRetry={handleRetry}
        open={showResults}
        result={bulkApply.data || null}
      />
    </>
  );
}
