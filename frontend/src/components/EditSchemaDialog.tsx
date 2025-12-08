import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FieldSchemaResponse } from "@/types/schema";

const editSchemaSchema = z.object({
  name: z
    .string()
    .min(1, "Name ist erforderlich")
    .max(255, "Name zu lang (max 255 Zeichen)"),
  description: z
    .string()
    .max(1000, "Beschreibung zu lang (max 1000 Zeichen)")
    .nullable()
    .optional(),
});

type EditSchemaFormData = z.infer<typeof editSchemaSchema>;

interface EditSchemaDialogProps {
  open: boolean;
  schema: FieldSchemaResponse | null;
  onConfirm: (data: { name: string; description: string | null }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const EditSchemaDialog = ({
  open,
  schema,
  onConfirm,
  onCancel,
  isLoading,
}: EditSchemaDialogProps) => {
  const form = useForm<EditSchemaFormData>({
    resolver: zodResolver(editSchemaSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Sync form with schema prop
  useEffect(() => {
    if (schema) {
      form.reset({
        name: schema.name,
        description: schema.description || "",
      });
    }
  }, [schema, form]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({ name: "", description: "" });
    }
  }, [open, form]);

  const handleSubmit = (data: EditSchemaFormData) => {
    onConfirm({
      name: data.name.trim(),
      description: data.description?.trim() || null,
    });
  };

  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Schema bearbeiten</DialogTitle>
            <DialogDescription>
              Ändern Sie den Namen oder die Beschreibung des Schemas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name Field */}
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-schema-name">
                    Name <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    autoFocus
                    disabled={isLoading}
                    id="edit-schema-name"
                    maxLength={255}
                    placeholder="z.B. Video Quality"
                  />
                  <FieldDescription>
                    {field.value?.length || 0}/255 Zeichen
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Description Field */}
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-schema-description">
                    Beschreibung (optional)
                  </FieldLabel>
                  <Textarea
                    {...field}
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading}
                    id="edit-schema-description"
                    maxLength={1000}
                    placeholder="z.B. Standard quality metrics for evaluating videos"
                    rows={3}
                    value={field.value || ""}
                  />
                  <FieldDescription>
                    {field.value?.length || 0}/1000 Zeichen
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              disabled={isLoading}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button disabled={isLoading} type="submit">
              {isLoading ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
