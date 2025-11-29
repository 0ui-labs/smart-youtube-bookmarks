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
import type { SchemaEffectivenessStat } from "@/types/analytics";

export interface SchemaEffectivenessChartProps {
  data: SchemaEffectivenessStat[];
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
export function SchemaEffectivenessChart({
  data,
}: SchemaEffectivenessChartProps) {
  // Empty state
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schema Effectiveness</CardTitle>
          <CardDescription>No schemas with field values yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-gray-400">
            <p>Start filling in schema fields to see effectiveness metrics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * Get bar color based on completion percentage.
   * - Green (>75%): High completion, schema is effective
   * - Yellow (50-75%): Medium completion, could be improved
   * - Red (<50%): Low completion, users skip many fields
   */
  const getBarColor = (percentage: number): string => {
    if (percentage >= 75) return "#10b981"; // green-500
    if (percentage >= 50) return "#f59e0b"; // amber-500
    return "#ef4444"; // red-500
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schema Effectiveness</CardTitle>
        <CardDescription>
          Completion rate for {data.length} schema{data.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer height={400} width="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              domain={[0, 100]}
              label={{
                value: "Completion %",
                position: "insideBottom",
                offset: -5,
              }}
              type="number"
            />
            <YAxis
              dataKey="schema_name"
              tick={{ fontSize: 12 }}
              type="category"
              width={110}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!(active && payload && payload[0])) return null;

                const stat = payload[0].payload as SchemaEffectivenessStat;

                return (
                  <div
                    aria-live="polite"
                    className="rounded border bg-white p-3 shadow-lg"
                    role="status"
                  >
                    <p className="font-semibold">{stat.schema_name}</p>
                    <p className="text-gray-600 text-sm">
                      {stat.field_count} field
                      {stat.field_count === 1 ? "" : "s"} in schema
                    </p>
                    <p className="text-sm">
                      Average:{" "}
                      <span className="font-medium">
                        {stat.avg_fields_filled.toFixed(1)}
                      </span>{" "}
                      fields filled
                    </p>
                    <p className="font-medium text-blue-600 text-sm">
                      {stat.completion_percentage.toFixed(1)}% completion rate
                    </p>
                    <p className="mt-1 text-gray-500 text-xs">
                      {stat.video_count} video
                      {stat.video_count === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="completion_percentage" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  fill={getBarColor(entry.completion_percentage)}
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
