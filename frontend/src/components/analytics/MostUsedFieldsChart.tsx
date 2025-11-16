import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MostUsedFieldStat } from '@/types/analytics'

export interface MostUsedFieldsChartProps {
  data: MostUsedFieldStat[]
}

/**
 * MostUsedFieldsChart - Horizontal bar chart showing top 10 fields by usage.
 *
 * Features:
 * - Responsive recharts bar chart
 * - Color-coded by usage percentage (green > 75%, yellow 50-75%, red < 50%)
 * - Interactive tooltips with exact counts
 * - Empty state when no data
 * - Accessible (keyboard navigation, ARIA labels)
 *
 * Design Patterns:
 * - Uses shadcn/ui Card for container
 * - Recharts ResponsiveContainer for responsiveness
 * - Custom tooltip for rich data display
 *
 * @example
 * <MostUsedFieldsChart data={analytics.most_used_fields} />
 */
export function MostUsedFieldsChart({ data }: MostUsedFieldsChartProps) {
  // Empty state
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Most-Used Fields</CardTitle>
          <CardDescription>No field values set yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>Start rating videos to see usage statistics</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  /**
   * Get bar color based on usage percentage.
   * - Green (>75%): High usage, field is valuable
   * - Yellow (50-75%): Medium usage, could be improved
   * - Red (<50%): Low usage, consider removing
   */
  const getBarColor = (percentage: number): string => {
    if (percentage >= 75) return '#10b981' // green-500
    if (percentage >= 50) return '#f59e0b' // amber-500
    return '#ef4444' // red-500
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most-Used Fields</CardTitle>
        <CardDescription>
          Top {Math.min(10, data.length)} fields by usage count
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            aria-label="Bar chart showing top 10 most-used custom fields by usage count"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              label={{ value: 'Usage Count', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              type="category"
              dataKey="field_name"
              width={90}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null

                const stat = payload[0].payload as MostUsedFieldStat

                return (
                  <div
                    className="bg-white p-3 border rounded shadow-lg"
                    role="status"
                    aria-live="assertive"
                  >
                    <p className="font-semibold">{stat.field_name}</p>
                    <p className="text-sm text-gray-600">Type: {stat.field_type}</p>
                    <p className="text-sm">
                      <span className="font-medium">{stat.usage_count}</span> / {stat.total_videos} videos
                    </p>
                    <p className="text-sm font-medium text-blue-600">
                      {stat.usage_percentage.toFixed(1)}% coverage
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="usage_count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.usage_percentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
