import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MostUsedFieldStat } from "@/types/analytics";

export interface MostUsedFieldsChartProps {
  data: MostUsedFieldStat[];
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
          <div className="flex h-64 items-center justify-center text-gray-400">
            <p>Start rating videos to see usage statistics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * Get bar color based on usage percentage.
   * - Green (>75%): High usage, field is valuable
   * - Yellow (50-75%): Medium usage, could be improved
   * - Red (<50%): Low usage, consider removing
   */
  const getBarColor = (percentage: number): string => {
    if (percentage >= 75) return "#10b981"; // green-500
    if (percentage >= 50) return "#f59e0b"; // amber-500
    return "#ef4444"; // red-500
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most-Used Fields</CardTitle>
        <CardDescription>
          Top {Math.min(10, data.length)} fields by usage count
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer height={400} width="100%">
          <BarChart
            aria-label="Bar chart showing top 10 most-used custom fields by usage count"
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              label={{
                value: "Usage Count",
                position: "insideBottom",
                offset: -5,
              }}
              type="number"
            />
            <YAxis
              dataKey="field_name"
              tick={{ fontSize: 12 }}
              type="category"
              width={90}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!(active && payload && payload[0])) return null;

                const stat = payload[0].payload as MostUsedFieldStat;

                return (
                  <div
                    aria-live="assertive"
                    className="rounded border bg-white p-3 shadow-lg"
                    role="status"
                  >
                    <p className="font-semibold">{stat.field_name}</p>
                    <p className="text-gray-600 text-sm">
                      Type: {stat.field_type}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">{stat.usage_count}</span> /{" "}
                      {stat.total_videos} videos
                    </p>
                    <p className="font-medium text-blue-600 text-sm">
                      {stat.usage_percentage.toFixed(1)}% coverage
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="usage_count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  fill={getBarColor(entry.usage_percentage)}
                  key={`cell-${index}`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
