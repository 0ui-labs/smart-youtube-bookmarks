import { useAnalytics } from '@/hooks/useAnalytics'
import { useLists } from '@/hooks/useLists'
import { MostUsedFieldsChart } from './MostUsedFieldsChart'
import { UnusedSchemasTable } from './UnusedSchemasTable'
import { FieldCoverageStats } from './FieldCoverageStats'
import { SchemaEffectivenessChart } from './SchemaEffectivenessChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * AnalyticsView - Container component for analytics dashboard.
 *
 * Fetches analytics data and displays all 4 analytics components:
 * - MostUsedFieldsChart: Bar chart of top 10 fields by usage
 * - UnusedSchemasTable: Table of schemas with zero usage
 * - FieldCoverageStats: Coverage percentages for all fields
 * - SchemaEffectivenessChart: Completion rates for schemas
 *
 * Layout:
 * - 2-column responsive grid (1 column on mobile, 2 on tablet+)
 * - Full-width grid items
 * - Loading skeleton while fetching
 * - Error state if fetch fails
 *
 * Data Flow:
 * - Uses useLists() to get listId (follows SettingsPage pattern)
 * - Uses useAnalytics(listId) hook to fetch data
 * - Passes data slices to individual components
 *
 * @example
 * ```tsx
 * // In SettingsPage.tsx
 * <TabsContent value="analytics">
 *   <AnalyticsView />
 * </TabsContent>
 * ```
 */
export function AnalyticsView() {
  // Fetch lists dynamically (pattern: SettingsPage.tsx)
  const { data: lists, isLoading: isListsLoading, isError: isListsError } = useLists()
  const listId = lists?.[0]?.id || ''

  // Fetch analytics for current list (only if listId exists)
  const { data: analytics, isLoading: isAnalyticsLoading, isError: isAnalyticsError } = useAnalytics(listId)

  // Combine loading/error states
  const isLoading = isListsLoading || isAnalyticsLoading
  const isError = isListsError || isAnalyticsError

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="h-6 bg-gray-200 rounded animate-pulse w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Error state
  if (isError || !analytics) {
    return (
      <div className="text-center py-12">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <p className="text-red-600 text-lg mb-2">Error loading analytics</p>
            <p className="text-gray-600 text-sm">
              Unable to fetch analytics data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render analytics components in 2-column grid
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top row: Most-Used Fields + Unused Schemas */}
      <MostUsedFieldsChart data={analytics.most_used_fields} />
      <UnusedSchemasTable data={analytics.unused_schemas} />

      {/* Bottom row: Field Coverage + Schema Effectiveness */}
      <FieldCoverageStats data={analytics.field_coverage} />
      <SchemaEffectivenessChart data={analytics.schema_effectiveness} />
    </div>
  )
}
