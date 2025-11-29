/**
 * NewFieldForm Component
 *
 * Inline form for creating custom fields with type-specific configuration.
 * Used within SchemaEditor component (Task #121).
 *
 * Features:
 * - Field name input with real-time duplicate validation
 * - Type selector (select, rating, text, boolean)
 * - Dynamic config editor based on selected type
 * - Integration with FieldConfigEditor sub-components (Task #124)
 * - Integration with DuplicateWarning component (Task #125)
 * - WCAG 2.1 Level AA accessible
 *
 * REF MCP Improvements:
 * #1 - React Hook Form + Zod for validation (best practice 2024)
 * #2 - Debounced duplicate check (500ms) to avoid API spam
 * #3 - Dynamic schema validation based on field_type
 * #4 - Proper ARIA labels and error messages
 * #5 - Keyboard navigation support (Enter to submit, Esc to cancel)
 * #6 - Field component pattern (2025 shadcn/ui, NOT deprecated Form)
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useDebouncedCallback } from "use-debounce";
import { z } from "zod";
import { checkFieldNameDuplicate } from "@/api/customFields";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CustomFieldCreate,
  CustomFieldCreateSchema,
  type FieldType,
} from "@/types/customField";

// TODO: Import from Task #124 when available
// import { FieldConfigEditor } from './FieldConfigEditor'
// TODO: Import from Task #125 when available
// import { DuplicateWarning } from './DuplicateWarning'

/**
 * Form schema with runtime validation
 *
 * REF MCP #3: Dynamic config validation based on field_type
 */
const newFieldFormSchema = CustomFieldCreateSchema.superRefine((data, ctx) => {
  const { field_type, config } = data;

  // Type-specific config validation
  switch (field_type) {
    case "select":
      if (!(config.options && Array.isArray(config.options))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select fields require at least one option",
          path: ["config", "options"],
        });
      } else if (config.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one option is required",
          path: ["config", "options"],
        });
      } else if (
        !config.options.every(
          (opt: any) => typeof opt === "string" && opt.trim()
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "All options must be non-empty strings",
          path: ["config", "options"],
        });
      }
      break;

    case "rating":
      if (typeof config.max_rating !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Max rating is required",
          path: ["config", "max_rating"],
        });
      } else if (config.max_rating < 1 || config.max_rating > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Max rating must be between 1 and 10",
          path: ["config", "max_rating"],
        });
      }
      break;

    case "text":
      // max_length is optional, but if present must be >=1
      if (
        config.max_length !== undefined &&
        (typeof config.max_length !== "number" || config.max_length < 1)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Max length must be at least 1",
          path: ["config", "max_length"],
        });
      }
      break;

    case "boolean":
      // No config validation needed
      break;
  }
});

type NewFieldFormValues = z.infer<typeof newFieldFormSchema>;

interface NewFieldFormProps {
  listId: string;
  onSubmit: (fieldData: CustomFieldCreate) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const NewFieldForm = ({
  listId,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: NewFieldFormProps) => {
  const [duplicateCheck, setDuplicateCheck] = useState<{
    checking: boolean;
    exists: boolean;
    existingField: any | null;
  }>({
    checking: false,
    exists: false,
    existingField: null,
  });

  // REF MCP #1: React Hook Form with Zod resolver
  const form = useForm<NewFieldFormValues>({
    resolver: zodResolver(newFieldFormSchema),
    defaultValues: {
      name: "",
      field_type: "text", // Default to simplest type
      config: {},
    },
  });

  const selectedType = form.watch("field_type");

  // REF MCP #2: Debounced duplicate check (500ms delay)
  const checkDuplicate = useDebouncedCallback(async (name: string) => {
    if (!name.trim()) {
      setDuplicateCheck({
        checking: false,
        exists: false,
        existingField: null,
      });
      return;
    }

    setDuplicateCheck((prev) => ({ ...prev, checking: true }));

    try {
      const result = await checkFieldNameDuplicate(listId, name);
      setDuplicateCheck({
        checking: false,
        exists: result.exists,
        existingField: result.field,
      });
    } catch (error) {
      console.error("Duplicate check failed:", error);
      setDuplicateCheck({
        checking: false,
        exists: false,
        existingField: null,
      });
    }
  }, 500);

  // Watch name field and trigger duplicate check
  const nameValue = form.watch("name");
  useEffect(() => {
    checkDuplicate(nameValue);
  }, [nameValue, checkDuplicate]);

  // Reset config when field type changes
  useEffect(() => {
    const defaultConfigs: Record<FieldType, any> = {
      select: { options: ["Option 1", "Option 2"] },
      rating: { max_rating: 5 },
      text: {},
      boolean: {},
    };

    form.setValue("config", defaultConfigs[selectedType]);
  }, [selectedType, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    // Prevent submission if duplicate exists
    if (duplicateCheck.exists) {
      form.setError("name", {
        type: "manual",
        message: "A field with this name already exists",
      });
      return;
    }

    await onSubmit(data);
  });

  // REF MCP #5: Keyboard navigation (Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <form
      className="space-y-4 rounded-lg border bg-muted/50 p-4"
      onSubmit={handleSubmit}
    >
      {/* Field Name Input */}
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="field-name">Field Name *</FieldLabel>
            <Input
              {...field}
              aria-describedby={
                duplicateCheck.exists ? "duplicate-warning" : undefined
              }
              aria-invalid={fieldState.invalid}
              autoFocus
              id="field-name"
              placeholder="e.g., Presentation Quality"
            />
            <FieldDescription>
              The name must be unique within this list (case-insensitive)
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}

            {/* TODO: Replace with DuplicateWarning component (Task #125) */}
            {duplicateCheck.checking && (
              <p className="text-muted-foreground text-sm">
                Checking for duplicates...
              </p>
            )}
            {duplicateCheck.exists && (
              <div
                className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 p-3"
                id="duplicate-warning"
                role="alert"
              >
                <p className="text-sm text-yellow-800">
                  ⚠️ A field named "{duplicateCheck.existingField?.name}" already
                  exists.
                  {duplicateCheck.existingField?.field_type && (
                    <> Type: {duplicateCheck.existingField.field_type}</>
                  )}
                </p>
              </div>
            )}
          </Field>
        )}
      />

      {/* Field Type Selector */}
      <Controller
        control={form.control}
        name="field_type"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="field-type">Field Type *</FieldLabel>
            <Select defaultValue={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Select field type" id="field-type">
                <SelectValue placeholder="Select a field type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">
                  Text (Free-form text input)
                </SelectItem>
                <SelectItem value="boolean">
                  Boolean (Yes/No checkbox)
                </SelectItem>
                <SelectItem value="select">
                  Select (Dropdown with options)
                </SelectItem>
                <SelectItem value="rating">
                  Rating (1-10 numeric scale)
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              Choose the type of value this field will store
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* Dynamic Config Editor */}
      <div className="space-y-2">
        <Label>Configuration</Label>

        {/* TODO: Replace with FieldConfigEditor component (Task #124) */}
        {/* Placeholder config editors */}
        {selectedType === "select" && (
          <div className="space-y-2 rounded-md border bg-background p-3">
            <Controller
              control={form.control}
              name="config.options"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="select-options">
                    Options (comma-separated)
                  </FieldLabel>
                  <Input
                    aria-invalid={fieldState.invalid}
                    id="select-options"
                    onChange={(e) => {
                      const options = e.target.value
                        .split(",")
                        .map((opt) => opt.trim())
                        .filter((opt) => opt);
                      field.onChange(options);
                    }}
                    placeholder="Option 1, Option 2, Option 3"
                    value={
                      Array.isArray(field.value) ? field.value.join(", ") : ""
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        )}

        {selectedType === "rating" && (
          <div className="space-y-2 rounded-md border bg-background p-3">
            <Controller
              control={form.control}
              name="config.max_rating"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="max-rating">
                    Max Rating (1-10)
                  </FieldLabel>
                  <Input
                    id="max-rating"
                    max={10}
                    min={1}
                    type="number"
                    {...field}
                    aria-invalid={fieldState.invalid}
                    onChange={(e) =>
                      field.onChange(Number.parseInt(e.target.value, 10))
                    }
                    value={field.value ?? ""}
                  />
                  <FieldDescription>
                    Maximum value for the rating scale
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        )}

        {selectedType === "text" && (
          <div className="space-y-2 rounded-md border bg-background p-3">
            <Controller
              control={form.control}
              name="config.max_length"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="max-length">
                    Max Length (optional)
                  </FieldLabel>
                  <Input
                    id="max-length"
                    min={1}
                    placeholder="No limit"
                    type="number"
                    {...field}
                    aria-invalid={fieldState.invalid}
                    onChange={(e) => {
                      const val = e.target.value
                        ? Number.parseInt(e.target.value, 10)
                        : undefined;
                      field.onChange(val);
                    }}
                    value={field.value ?? ""}
                  />
                  <FieldDescription>
                    Optional character limit for text input
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        )}

        {selectedType === "boolean" && (
          <div className="rounded-md border bg-background p-3">
            <p className="text-muted-foreground text-sm">
              Boolean fields don't require configuration
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          className="flex-1"
          disabled={isSubmitting || duplicateCheck.exists}
          type="submit"
        >
          {isSubmitting ? "Creating..." : "Add Field"}
        </Button>
        <Button
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};
