import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TemplatePickerGrid } from './TemplatePickerGrid'
import { useTemplateInstantiation } from '@/hooks/useTemplateInstantiation'
import { Loader2 } from 'lucide-react'
import type { SchemaTemplate } from '@/constants/schemaTemplates'
import type { FieldSchemaResponse } from '@/types/customFields'

interface SchemaCreationDialogProps {
  listId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchemaCreated: (schema: FieldSchemaResponse) => void
}

export function SchemaCreationDialog({
  listId,
  open,
  onOpenChange,
  onSchemaCreated,
}: SchemaCreationDialogProps) {
  const [activeTab, setActiveTab] = useState<'template' | 'scratch'>('template')

  const { instantiate, isPending, state } = useTemplateInstantiation({
    listId,
    onSuccess: (schema) => {
      onSchemaCreated(schema)
      onOpenChange(false)
    },
    onError: (error) => {
      console.error('Template instantiation failed:', error)
      // Error is shown in UI via state.error
    },
  })

  const handleSelectTemplate = (template: SchemaTemplate) => {
    instantiate(template)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Schema</DialogTitle>
          <DialogDescription>
            Start from a template or create a custom schema from scratch
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'template' | 'scratch')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Use Template</TabsTrigger>
            <TabsTrigger value="scratch">Start from Scratch</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="mt-4">
            {isPending ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Creating schema from template...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {state.currentStep === 'creating-fields' && 'Creating custom fields...'}
                    {state.currentStep === 'creating-schema' && 'Creating schema...'}
                  </p>
                </div>
              </div>
            ) : state.error ? (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
                <p className="font-semibold">Failed to create schema</p>
                <p className="text-sm mt-1">{state.error.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <TemplatePickerGrid onSelectTemplate={handleSelectTemplate} />
            )}
          </TabsContent>

          <TabsContent value="scratch" className="mt-4">
            {/* TODO: Existing custom schema editor (Task #121) */}
            <div className="text-center py-12 text-muted-foreground">
              Custom schema editor (to be implemented in Task #121)
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
