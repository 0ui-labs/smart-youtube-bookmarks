import React, { useMemo } from 'react';
import {
  useReactTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import type { CustomField } from '@/types/customField';
import { FieldTypeBadge } from './FieldTypeBadge';
import { formatConfigPreview } from '@/utils/fieldConfigPreview';

/**
 * Props for FieldsList component
 */
interface FieldsListProps {
  fields: CustomField[];
  onEdit?: (field: CustomField) => void;
  onDelete?: (field: CustomField) => void;
  showUsageCount?: boolean;
  isLoading?: boolean;
}

/**
 * Extended CustomField type with usage count
 * Backend will eventually provide this, for now we calculate client-side
 */
interface CustomFieldRow extends CustomField {
  usage_count?: number;
}

/**
 * FieldsList Component
 *
 * Displays all custom fields in a sortable, filterable table.
 * Supports actions (edit/delete) via callback props.
 *
 * Features:
 * - Sorting by name, type, usage count
 * - Filtering by field type (dropdown)
 * - Empty state when no fields
 * - Responsive layout
 *
 * IMPROVEMENTS APPLIED (REF MCP validation):
 * 1. Uses initialState instead of controlled state
 * 2. Uses direct Column Filter API instead of duplicate state
 * 3. Uses modern Column Definition syntax (direct ColumnDef<CustomFieldRow>[])
 * 4. Adds aria-sort attribute for accessibility
 * 5. No maxLength in formatConfigPreview call
 *
 * @example
 * ```tsx
 * const { data: fields = [] } = useCustomFields(listId);
 *
 * <FieldsList
 *   fields={fields}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   showUsageCount={true}
 * />
 * ```
 */
export const FieldsList: React.FC<FieldsListProps> = ({
  fields,
  onEdit,
  onDelete,
  showUsageCount = true,
  isLoading = false,
}) => {
  /**
   * Column definitions (IMPROVEMENT #3: Direct ColumnDef syntax)
   * REF MCP: Use useMemo to prevent unnecessary re-creation on re-renders
   * Source: https://github.com/TanStack/table/blob/main/docs/guide/features.md
   */
  const columns = useMemo<ColumnDef<CustomFieldRow>[]>(
    () => [
      // Field Name Column (sortable)
      {
        accessorKey: 'name',
        header: 'Field Name',
        cell: (info) => (
          <span className="font-semibold text-gray-900">
            {info.getValue() as string}
          </span>
        ),
        enableSorting: true,
      },

      // Field Type Column (sortable, filterable)
      {
        accessorKey: 'field_type',
        header: 'Type',
        cell: (info) => (
          <FieldTypeBadge fieldType={info.getValue() as CustomField['field_type']} />
        ),
        enableSorting: true,
        // Custom filter function for field type
        filterFn: (row, _columnId, filterValue) => {
          if (filterValue === 'all') return true;
          return row.original.field_type === filterValue;
        },
      },

      // Config Preview Column (not sortable)
      {
        accessorKey: 'config',
        header: 'Configuration',
        cell: (info) => {
          const field = info.row.original;
          // IMPROVEMENT #5: No maxLength parameter
          const preview = formatConfigPreview(field.field_type, info.getValue() as Record<string, any>);
          return (
            <span className="text-sm text-gray-600 max-w-xs truncate block">
              {preview}
            </span>
          );
        },
        enableSorting: false, // Config is complex, don't sort
      },

      // Usage Count Column (sortable, conditional)
      ...(showUsageCount
        ? [
            {
              accessorKey: 'usage_count',
              header: 'Used In',
              cell: (info: any) => {
                const count = info.getValue() ?? 0;
                return (
                  <span className="text-sm text-gray-500">
                    {count} schema{count !== 1 ? 's' : ''}
                  </span>
                );
              },
              enableSorting: true,
            } as ColumnDef<CustomFieldRow>,
          ]
        : []),

      // Actions Column
      {
        accessorKey: 'id',
        header: 'Actions',
        cell: (info) => (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(info.row.original)}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                aria-label={`Edit ${info.row.original.name}`}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(info.row.original)}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                aria-label={`Delete ${info.row.original.name}`}
              >
                Delete
              </button>
            )}
          </div>
        ),
        enableSorting: false,
      },
    ],
    [onEdit, onDelete, showUsageCount]
  );

  /**
   * TanStack Table instance (IMPROVEMENT #1: Uses initialState)
   * REF MCP: getCoreRowModel is required, sorting/filtering are optional features
   */
  const table = useReactTable({
    data: fields,
    columns,
    // IMPROVEMENT #1: Let TanStack Table manage state internally
    initialState: {
      sorting: [],
      columnFilters: [],
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(), // Enable sorting
    getFilteredRowModel: getFilteredRowModel(), // Enable filtering
  });

  /**
   * Handle field type filter change (IMPROVEMENT #2: Direct Column Filter API)
   * Updates column filter directly using TanStack Table API
   */
  const handleTypeFilterChange = (value: string) => {
    const column = table.getColumn('field_type');
    if (!column) return;

    if (value === 'all') {
      column.setFilterValue(undefined);
    } else {
      column.setFilterValue(value);
    }
  };

  /**
   * Get current filter value (IMPROVEMENT #2: Direct Column Filter API)
   */
  const currentTypeFilter = (table.getColumn('field_type')?.getFilterValue() as string) ?? 'all';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading custom fields...</div>
      </div>
    );
  }

  // Empty state
  if (fields.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
        <p className="text-gray-500 text-lg">
          No custom fields yet. Create your first field!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex items-center gap-4 bg-white p-4 border border-gray-200 rounded-lg">
        <label htmlFor="type-filter" className="text-sm font-medium text-gray-700">
          Filter by Type:
        </label>
        <select
          id="type-filter"
          value={currentTypeFilter}
          onChange={(e) => handleTypeFilterChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="all">All Types</option>
          <option value="select">Select</option>
          <option value="rating">Rating</option>
          <option value="text">Text</option>
          <option value="boolean">Boolean</option>
        </select>

        {/* Result count */}
        <span className="text-sm text-gray-500 ml-auto">
          {table.getFilteredRowModel().rows.length} of {fields.length} fields
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Table Header */}
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();

                  // IMPROVEMENT #4: Add aria-sort attribute
                  const ariaSort = sortDirection === 'asc'
                    ? 'ascending'
                    : sortDirection === 'desc'
                    ? 'descending'
                    : canSort
                    ? 'none'
                    : undefined;

                  return (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      style={{ cursor: canSort ? 'pointer' : 'default' }}
                      aria-sort={ariaSort}
                    >
                      <div className="flex items-center gap-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}

                        {/* Sort indicator */}
                        {canSort && (
                          <span className="text-gray-400">
                            {sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '↕'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Table Body */}
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-6 py-4 whitespace-nowrap"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No results after filtering */}
      {table.getFilteredRowModel().rows.length === 0 && fields.length > 0 && (
        <div className="text-center py-8 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-500">
            No fields match the current filter.
          </p>
        </div>
      )}
    </div>
  );
};
