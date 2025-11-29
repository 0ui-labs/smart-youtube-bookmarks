import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
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
import type { FieldSchemaResponse } from "@/types/schema";

const duplicateSchemaSchema = z.object({
  newName: z
    .string()
    .min(1, "Name ist erforderlich")
    .max(255, "Name zu lang (max 255 Zeichen)"),
});

type DuplicateSchemaFormData = z.infer<typeof duplicateSchemaSchema>;

interface DuplicateSchemaDialogProps {
  open: boolean;
  schema: FieldSchemaResponse | null;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const DuplicateSchemaDialog = ({
  open,
  schema,
  onConfirm,
  onCancel,
  isLoading,
}: DuplicateSchemaDialogProps) => {
  const form = useForm<DuplicateSchemaFormData>({
    resolver: zodResolver(duplicateSchemaSchema),
    defaultValues: {
      newName: "",
    },
  });

  // Generate default name when dialog opens
  useEffect(() => {
    if (schema && open) {
      form.reset({
        newName: `${schema.name} (Kopie)`,
      });
    }
  }, [schema, open, form]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({ newName: "" });
    }
  }, [open, form]);

  const handleSubmit = (data: DuplicateSchemaFormData) => {
    onConfirm(data.newName.trim());
  };

  const fieldCount = schema?.schema_fields?.length || 0;

  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Schema duplizieren</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine Kopie von "{schema?.name}" mit einem neuen
              Namen.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name Field */}
            <Controller
              control={form.control}
              name="newName"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="duplicate-schema-name">
                    Neuer Name <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    aria-invalid={fieldState.invalid}
                    autoFocus
                    disabled={isLoading}
                    id="duplicate-schema-name"
                    maxLength={255}
                    placeholder="z.B. Video Quality (Kopie)"
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

            {/* Info Badge */}
            {fieldCount > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
                  <p className="text-blue-900 text-sm">
                    Alle {fieldCount} Feld{fieldCount !== 1 ? "er" : ""} werden
                    kopiert (inkl. Reihenfolge und Kartenanzeige-Einstellungen).
                  </p>
                </div>
              </div>
            )}
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
            <Button
              disabled={!form.formState.isValid || isLoading}
              type="submit"
            >
              {isLoading ? "Duplizieren..." : "Duplizieren"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
