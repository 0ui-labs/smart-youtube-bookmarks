import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SchemaTemplate } from "@/constants/schemaTemplates";
import type { CustomField, FieldSchemaResponse } from "@/types/customFields";

interface UseTemplateInstantiationOptions {
  listId: string;
  onSuccess?: (schema: FieldSchemaResponse) => void;
  onError?: (error: Error) => void;
}

interface TemplateInstantiationState {
  currentStep:
    | "idle"
    | "creating-fields"
    | "creating-schema"
    | "complete"
    | "error";
  createdFields: CustomField[];
  error: Error | null;
}

/**
 * Hook to instantiate a schema template by creating fields and schema.
 *
 * Flow:
 * 1. Create all custom fields (parallel or sequential)
 * 2. Create schema with field associations
 * 3. Return created schema
 *
 * Error Handling:
 * - If field creation fails, stop and return error
 * - If schema creation fails, fields remain (can be reused or deleted)
 * - No automatic rollback (fields are reusable assets)
 */
export function useTemplateInstantiation({
  listId,
  onSuccess,
  onError,
}: UseTemplateInstantiationOptions) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TemplateInstantiationState>({
    currentStep: "idle",
    createdFields: [],
    error: null,
  });

  const instantiateMutation = useMutation({
    mutationFn: async (template: SchemaTemplate) => {
      setState({
        currentStep: "creating-fields",
        createdFields: [],
        error: null,
      });

      // Step 1: Create all custom fields
      const createdFields: CustomField[] = [];

      for (const fieldDef of template.fields) {
        const response = await fetch(`/api/lists/${listId}/custom-fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fieldDef.name,
            field_type: fieldDef.field_type,
            config: fieldDef.config,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            `Failed to create field "${fieldDef.name}": ${error.detail || response.statusText}`
          );
        }

        const field: CustomField = await response.json();
        createdFields.push(field);
      }

      setState((prev) => ({ ...prev, createdFields }));

      // Step 2: Create schema with field associations
      setState((prev) => ({ ...prev, currentStep: "creating-schema" }));

      const schemaResponse = await fetch(`/api/lists/${listId}/schemas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          fields: template.fields.map((fieldDef, index) => {
            const field = createdFields[index];
            if (!field) {
              throw new Error(
                `Field at index ${index} not found in createdFields`
              );
            }
            return {
              field_id: field.id,
              display_order: fieldDef.display_order,
              show_on_card: fieldDef.show_on_card,
            };
          }),
        }),
      });

      if (!schemaResponse.ok) {
        const error = await schemaResponse.json();
        throw new Error(
          `Failed to create schema "${template.name}": ${error.detail || schemaResponse.statusText}`
        );
      }

      const schema: FieldSchemaResponse = await schemaResponse.json();

      setState((prev) => ({ ...prev, currentStep: "complete" }));

      return schema;
    },
    onSuccess: (schema) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["custom-fields", listId] });
      queryClient.invalidateQueries({ queryKey: ["schemas", listId] });

      onSuccess?.(schema);
    },
    onError: (error: Error) => {
      setState((prev) => ({
        ...prev,
        currentStep: "error",
        error,
      }));
      onError?.(error);
    },
  });

  return {
    instantiate: instantiateMutation.mutate,
    isPending: instantiateMutation.isPending,
    isSuccess: instantiateMutation.isSuccess,
    isError: instantiateMutation.isError,
    error: instantiateMutation.error,
    state,
  };
}
