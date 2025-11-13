import { useState } from 'react'
import { useSchemas } from '@/hooks/useSchemas'
import { useLists } from '@/hooks/useLists' // ✨ FIX #4: Import useLists
import { SchemasList } from '@/components/SchemasList'
import { Button } from '@/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Plus } from 'lucide-react'

/**
 * SettingsPage - Centralized settings management
 *
 * Provides tabbed interface for:
 * - Schemas: Manage field schema templates (Task #135)
 * - Fields: Manage custom field definitions (Future)
 *
 * Architecture:
 * - Uses shadcn/ui Tabs for navigation
 * - Fetches data via TanStack Query hooks
 * - Follows Dashboard.tsx pattern for page layout
 * - Uses useLists() to get listId dynamically (not hardcoded)
 *
 * Route: /settings/schemas
 *
 * @example
 * // In App.tsx
 * <Route path="/settings/schemas" element={<SettingsPage />} />
 */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'schemas' | 'fields'>('schemas')

  // ✨ FIX #4: Fetch lists dynamically instead of hardcoded listId
  const { data: lists, isLoading: isListsLoading, isError: isListsError } = useLists()
  const listId = lists?.[0]?.id || ''

  // Fetch schemas for current list
  const { data: schemas, isLoading: isSchemasLoading, isError: isSchemasError } = useSchemas(listId)

  // Combine loading states
  const isLoading = isListsLoading || isSchemasLoading
  const isError = isListsError || isSchemasError

  // Placeholder handlers (to be implemented in future tasks)
  const handleCreateSchema = () => {
    console.log('Create schema clicked - to be implemented')
    // TODO: Open SchemaEditor dialog (Task #121)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Loading schemas...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            {activeTab === 'schemas' && (
              <Button onClick={handleCreateSchema}>
                <Plus className="h-4 w-4 mr-2" />
                Create Schema
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'schemas' | 'fields')}>
          <TabsList className="mb-6">
            <TabsTrigger value="schemas">Schemas</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
          </TabsList>

          {/* Schemas Tab */}
          <TabsContent value="schemas">
            {isError ? (
              <div className="text-center py-12">
                <p className="text-red-600 text-lg">Error loading schemas.</p>
              </div>
            ) : schemas && schemas.length > 0 ? (
              <SchemasList
                schemas={schemas}
                onEdit={(schemaId) => console.log('Edit schema:', schemaId)}
                onDelete={(schemaId) => console.log('Delete schema:', schemaId)}
                onDuplicate={(schemaId) => console.log('Duplicate schema:', schemaId)}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">
                  No schemas yet. Create your first schema to organize custom fields!
                </p>
                <Button onClick={handleCreateSchema}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Schema
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Fields Tab - Placeholder */}
          <TabsContent value="fields">
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                Fields management coming soon...
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
