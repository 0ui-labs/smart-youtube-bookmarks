import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FieldCoverageStat } from "@/types/analytics";

export interface FieldCoverageStatsProps {
  data: FieldCoverageStat[];
}

/**
 * FieldCoverageStats - Table showing field coverage statistics.
 *
 * Features:
 * - Displays coverage percentage for all fields
 * - Progress bar visualization
 * - Highlights fields with <10% coverage (warning state)
 * - Sorted by coverage ascending (problems first)
 * - Empty state when all fields have good coverage
 *
 * Design Patterns:
 * - Uses shadcn/ui Table components
 * - Progress bar with color coding
 * - Badge for low coverage warning
 *
 * @example
 * <FieldCoverageStats data={analytics.field_coverage} />
 */
export function FieldCoverageStats({ data }: FieldCoverageStatsProps) {
  // Empty state
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Field Coverage</CardTitle>
          <CardDescription>All fields have good coverage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-gray-400">
            <p>No coverage issues found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * Get progress bar color based on coverage percentage.
   * - Green (>75%): High coverage, field is well-used
   * - Yellow (50-75%): Medium coverage, could be improved
   * - Red (<50%): Low coverage, needs attention
   */
  const getProgressColor = (percentage: number): string => {
    if (percentage >= 75) return "bg-green-500";
    if (percentage >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  // Sort data by coverage percentage ascending (problems first)
  const sortedData = [...data].sort(
    (a, b) => a.coverage_percentage - b.coverage_percentage
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Field Coverage</CardTitle>
        <CardDescription>
          Coverage percentage for all custom fields
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left font-semibold">Field Name</th>
                <th className="p-3 text-left font-semibold">Type</th>
                <th className="p-3 text-left font-semibold">
                  Videos with Values
                </th>
                <th className="p-3 text-left font-semibold">Total Videos</th>
                <th className="p-3 text-left font-semibold">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((field) => (
                <tr className="border-b hover:bg-gray-50" key={field.field_id}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{field.field_name}</span>
                      {field.coverage_percentage < 10 && (
                        <Badge className="text-xs" variant="destructive">
                          Low Coverage
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-gray-600 text-sm capitalize">
                    {field.field_type}
                  </td>
                  <td className="p-3">{field.videos_with_values}</td>
                  <td className="p-3">{field.total_videos}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 max-w-[120px] flex-1 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(field.coverage_percentage)}`}
                          style={{
                            width: `${Math.min(100, field.coverage_percentage)}%`,
                          }}
                        />
                      </div>
                      <span className="min-w-[45px] text-right font-medium text-sm">
                        {field.coverage_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
