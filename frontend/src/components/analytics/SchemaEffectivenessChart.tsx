import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SchemaEffectivenessStat } from '@/types/analytics'

export interface SchemaEffectivenessChartProps {
  data: SchemaEffectivenessStat[]
}

/**
 * SchemaEffectivenessChart - Horizontal bar chart showing schema effectiveness.
 *
 * Features:
 * - Responsive recharts bar chart
 * - Color-coded by completion percentage (green > 75%, yellow 50-75%, red < 50%)
 * - Interactive tooltips with exact counts
 * - Empty state when no data
 * - Accessible (keyboard navigation, ARIA labels, title attribute)
 * - Shows schema name, completion %, avg fields filled
 * - Sorted by completion % descending (most effective first)
 *
 * Design Patterns:
 * - Uses shadcn/ui Card for container
 * - Recharts ResponsiveContainer for responsiveness
 * - Custom tooltip for rich data display
 * - REF MCP accessibility fixes (title, role, aria-live)
 *
 * @example
 * <SchemaEffectivenessChart data={analytics.schema_effectiveness} />
 */
export function SchemaEffectivenessChart({ data }: SchemaEffectivenessChartProps) {
  // Empty state
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schema Effectiveness</CardTitle>
          <CardDescription>No schemas with field values yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>Start filling in schema fields to see effectiveness metrics</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  /**
   * Get bar color based on completion percentage.
   * - Green (>75%): High completion, schema is effective
   * - Yellow (50-75%): Medium completion, could be improved
   * - Red (<50%): Low completion, users skip many fields
   */
  const getBarColor = (percentage: number): string => {
    if (percentage >= 75) return '#10b981' // green-500
    if (percentage >= 50) return '#f59e0b' // amber-500
    return '#ef4444' // red-500
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schema Effectiveness</CardTitle>
        <CardDescription>
          Completion rate for {data.length} schema{data.length === 1 ? '' : 's'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            title="Bar chart showing schema effectiveness by completion percentage"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              label={{ value: 'Completion %', position: 'insideBottom', offset: -5 }}
              domain={[0, 100]}
            />
            <YAxis
              type="category"
              dataKey="schema_name"
              width={110}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null

                const stat = payload[0].payload as SchemaEffectivenessStat

                return (
                  <div
                    className="bg-white p-3 border rounded shadow-lg"
                    role="status"
                    aria-live="assertive"
                  >
                    <p className="font-semibold">{stat.schema_name}</p>
                    <p className="text-sm text-gray-600">
                      {stat.field_count} field{stat.field_count === 1 ? '' : 's'} in schema
                    </p>
                    <p className="text-sm">
                      Average: <span className="font-medium">{stat.avg_fields_filled.toFixed(1)}</span> fields filled
                    </p>
                    <p className="text-sm font-medium text-blue-600">
                      {stat.completion_percentage.toFixed(1)}% completion rate
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.video_count} video{stat.video_count === 1 ? '' : 's'}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="completion_percentage" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.completion_percentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
