import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SchemaTemplate } from "@/constants/schemaTemplates";
import { useCreateSchema } from "@/hooks/useSchemas";
import { useTemplateInstantiation } from "@/hooks/useTemplateInstantiation";
import type { FieldSchemaResponse } from "@/types/customFields";
import { SchemaEditor, type SchemaFormData } from "./SchemaEditor";
import { TemplatePickerGrid } from "./TemplatePickerGrid";

interface SchemaCreationDialogProps {
  listId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchemaCreated: (schema: FieldSchemaResponse) => void;
}

export function SchemaCreationDialog({
  listId,
  open,
  onOpenChange,
  onSchemaCreated,
}: SchemaCreationDialogProps) {
  const [activeTab, setActiveTab] = useState<"template" | "scratch">(
    "template"
  );

  const { instantiate, isPending, state } = useTemplateInstantiation({
    listId,
    onSuccess: (schema) => {
      onSchemaCreated(schema);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Template instantiation failed:", error);
      // Error is shown in UI via state.error
    },
  });

  const createSchema = useCreateSchema(listId);

  const handleSelectTemplate = (template: SchemaTemplate) => {
    instantiate(template);
  };

  // Bug #001 Fix: Handlers for "Start from Scratch" tab
  const handleSchemaCreated = async (schemaData: SchemaFormData) => {
    const newSchema = await createSchema.mutateAsync({
      name: schemaData.name,
      description: schemaData.description,
      fields: schemaData.fields,
    });

    // Notify parent and close dialog
    onSchemaCreated(newSchema);
    onOpenChange(false);
  };

  const handleSchemaCancelled = () => {
    // Just close the dialog
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Schema</DialogTitle>
          <DialogDescription>
            Start from a template or create a custom schema from scratch
          </DialogDescription>
        </DialogHeader>

        <Tabs
          onValueChange={(v) => setActiveTab(v as "template" | "scratch")}
          value={activeTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Use Template</TabsTrigger>
            <TabsTrigger value="scratch">Start from Scratch</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-4" value="template">
            {isPending ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">
                    Creating schema from template...
                  </p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {state.currentStep === "creating-fields" &&
                      "Creating custom fields..."}
                    {state.currentStep === "creating-schema" &&
                      "Creating schema..."}
                  </p>
                </div>
              </div>
            ) : state.error ? (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
                <p className="font-semibold">Failed to create schema</p>
                <p className="mt-1 text-sm">{state.error.message}</p>
                <Button
                  className="mt-3"
                  onClick={() => onOpenChange(false)}
                  size="sm"
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            ) : (
              <TemplatePickerGrid onSelectTemplate={handleSelectTemplate} />
            )}
          </TabsContent>

          <TabsContent className="mt-4" value="scratch">
            {/* Bug #001 Fix: Integrate SchemaEditor for custom schema creation */}
            <SchemaEditor
              listId={listId}
              onCancel={handleSchemaCancelled}
              onSave={handleSchemaCreated}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
