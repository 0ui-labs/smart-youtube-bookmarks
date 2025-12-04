import { useState } from 'react'
import { useLists } from '@/hooks/useLists'
import { KategorienTab } from '@/components/settings/KategorienTab'
import { AnalyticsView } from '@/components/analytics/AnalyticsView'
import {
  Tabs,
  TabsContent,
  TabsList as TabsListUI,
  TabsTrigger,
} from '@/components/ui/tabs'

/**
 * SettingsPage - Simplified settings management
 *
 * Provides tabbed interface for:
 * - Kategorien: Manage categories and their fields (replaces Schemas/Fields/Tags)
 * - Analytics: View usage statistics
 *
 * User-friendly design:
 * - "Kategorien" instead of technical "Schemas/Tags/Fields"
 * - "Informationen" instead of "Fields"
 * - Hides complexity from user
 *
 * Route: /settings
 */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'kategorien' | 'analytics'>('kategorien')

  // Fetch lists dynamically to get listId
  const { data: lists, isLoading: isListsLoading } = useLists()
  const listId = lists?.[0]?.id || ''

  // Show loading state
  if (isListsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Lade...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'kategorien' | 'analytics')}>
          <TabsListUI className="mb-6">
            <TabsTrigger value="kategorien">Kategorien</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsListUI>

          {/* Kategorien Tab */}
          <TabsContent value="kategorien">
            <KategorienTab listId={listId} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsView />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
