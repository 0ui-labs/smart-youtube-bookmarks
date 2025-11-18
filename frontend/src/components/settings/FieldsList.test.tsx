import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldsList } from './FieldsList';
import type { CustomField } from '@/types/customField';

// Mock data - inline factory pattern (CLAUDE.md: SchemaSelector pattern)
const mockFields: CustomField[] = [
  {
    id: '1',
    list_id: 'list-1',
    name: 'Presentation Quality',
    field_type: 'select',
    config: { options: ['bad', 'good', 'great'] },
    created_at: '2025-11-01T10:00:00Z',
    updated_at: '2025-11-01T10:00:00Z',
  },
  {
    id: '2',
    list_id: 'list-1',
    name: 'Overall Rating',
    field_type: 'rating',
    config: { max_rating: 5 },
    created_at: '2025-11-02T10:00:00Z',
    updated_at: '2025-11-02T10:00:00Z',
  },
  {
    id: '3',
    list_id: 'list-1',
    name: 'Notes',
    field_type: 'text',
    config: { max_length: 500 },
    created_at: '2025-11-03T10:00:00Z',
    updated_at: '2025-11-03T10:00:00Z',
  },
  {
    id: '4',
    list_id: 'list-1',
    name: 'Watched',
    field_type: 'boolean',
    config: {},
    created_at: '2025-11-04T10:00:00Z',
    updated_at: '2025-11-04T10:00:00Z',
  },
];

describe('FieldsList', () => {
  // CLAUDE.md pattern: Cleanup after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Basic Rendering
  it('renders field list correctly', () => {
    render(<FieldsList fields={mockFields} />);

    // Check all field names are displayed
    expect(screen.getByText('Presentation Quality')).toBeInTheDocument();
    expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Watched')).toBeInTheDocument();
  });

  // Test 2: Field Type Badges
  it('displays field type badges with correct colors', () => {
    render(<FieldsList fields={mockFields} />);

    const selectBadge = screen.getByTestId('field-type-badge-select');
    const ratingBadge = screen.getByTestId('field-type-badge-rating');
    const textBadge = screen.getByTestId('field-type-badge-text');
    const booleanBadge = screen.getByTestId('field-type-badge-boolean');

    expect(selectBadge).toHaveClass('bg-blue-100', 'text-blue-800');
    expect(ratingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    expect(textBadge).toHaveClass('bg-gray-100', 'text-gray-800');
    expect(booleanBadge).toHaveClass('bg-green-100', 'text-green-800');
  });

  // Test 3: Config Preview
  it('displays config preview correctly for each field type', () => {
    render(<FieldsList fields={mockFields} />);

    expect(screen.getByText('Options: bad, good, great')).toBeInTheDocument();
    expect(screen.getByText('Max: 5 stars')).toBeInTheDocument();
    expect(screen.getByText('Max length: 500')).toBeInTheDocument();
    expect(screen.getByText('Yes/No')).toBeInTheDocument();
  });

  // Test 4: Sorting by Name (Ascending)
  it('sorts fields by name in ascending order', () => {
    render(<FieldsList fields={mockFields} />);

    const nameHeader = screen.getByText('Field Name');
    fireEvent.click(nameHeader);

    const rows = screen.getAllByRole('row').slice(1); // Skip header row
    const firstRowName = within(rows[0]).getByText(/Notes|Overall Rating|Presentation Quality|Watched/);

    expect(firstRowName.textContent).toBe('Notes');
  });

  // Test 5: Sorting by Name (Descending)
  it('sorts fields by name in descending order', () => {
    render(<FieldsList fields={mockFields} />);

    const nameHeader = screen.getByText('Field Name');
    fireEvent.click(nameHeader); // First click: ascending
    fireEvent.click(nameHeader); // Second click: descending

    const rows = screen.getAllByRole('row').slice(1);
    const firstRowName = within(rows[0]).getByText(/Notes|Overall Rating|Presentation Quality|Watched/);

    expect(firstRowName.textContent).toBe('Watched');
  });

  // Test 6: Sorting by Type
  it('sorts fields by type', () => {
    render(<FieldsList fields={mockFields} />);

    const typeHeader = screen.getByText('Type');
    fireEvent.click(typeHeader);

    // After sorting, boolean should be first (alphabetically)
    const rows = screen.getAllByRole('row').slice(1);
    const firstRowBadge = within(rows[0]).getByTestId(/field-type-badge-/);

    expect(firstRowBadge).toHaveAttribute('data-testid', 'field-type-badge-boolean');
  });

  // Test 7: Filtering by Field Type (Select)
  it('filters fields by type: select', () => {
    render(<FieldsList fields={mockFields} />);

    const typeFilter = screen.getByLabelText('Filter by Type:');
    fireEvent.change(typeFilter, { target: { value: 'select' } });

    // Only Presentation Quality should be visible
    expect(screen.getByText('Presentation Quality')).toBeInTheDocument();
    expect(screen.queryByText('Overall Rating')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Watched')).not.toBeInTheDocument();

    // Check result count
    expect(screen.getByText('1 of 4 fields')).toBeInTheDocument();
  });

  // Test 8: Filtering by Field Type (Rating)
  it('filters fields by type: rating', () => {
    render(<FieldsList fields={mockFields} />);

    const typeFilter = screen.getByLabelText('Filter by Type:');
    fireEvent.change(typeFilter, { target: { value: 'rating' } });

    expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    expect(screen.queryByText('Presentation Quality')).not.toBeInTheDocument();
  });

  // Test 9: Empty State
  it('displays empty state when no fields exist', () => {
    render(<FieldsList fields={[]} />);

    expect(screen.getByText('No custom fields yet. Create your first field!')).toBeInTheDocument();
  });

  // Test 10: Loading State
  it('displays loading state', () => {
    render(<FieldsList fields={[]} isLoading={true} />);

    expect(screen.getByText('Loading custom fields...')).toBeInTheDocument();
  });

  // Test 11: Edit Button Callback
  it('calls onEdit callback when edit button is clicked', async () => {
    // CLAUDE.md pattern: Use userEvent.setup with delay: null
    const user = userEvent.setup({ delay: null });
    const onEdit = vi.fn();
    render(<FieldsList fields={mockFields} onEdit={onEdit} />);

    // Open the dropdown menu first
    const menuTriggers = screen.getAllByLabelText(/Actions for/i);
    await user.click(menuTriggers[0]);

    // Now the Edit button should be visible
    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    expect(onEdit).toHaveBeenCalledWith(mockFields[0]);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  // Test 12: Delete Button Callback
  it('calls onDelete callback when delete button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    render(<FieldsList fields={mockFields} onDelete={onDelete} />);

    // Open the dropdown menu first (for the second field)
    const menuTriggers = screen.getAllByLabelText(/Actions for/i);
    await user.click(menuTriggers[1]);

    // Now the Delete button should be visible
    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith(mockFields[1].id);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  // Test 13: Usage Count Display
  it('displays usage count when showUsageCount is true', () => {
    const usageCounts = new Map<string, number>();
    usageCounts.set(mockFields[0].id, 1);
    usageCounts.set(mockFields[1].id, 2);

    render(<FieldsList fields={mockFields} showUsageCount={true} usageCounts={usageCounts} />);

    expect(screen.getByText('Used by 1 schema')).toBeInTheDocument(); // Singular
    expect(screen.getByText('Used by 2 schemas')).toBeInTheDocument(); // Plural
  });

  // Test 14: No Results After Filtering
  it('displays "no results" message when filter matches nothing', () => {
    // Create fields that only have 'text' type
    const textOnlyFields = mockFields.filter(f => f.field_type === 'text');
    render(<FieldsList fields={textOnlyFields} />);

    const typeFilter = screen.getByLabelText('Filter by Type:');
    fireEvent.change(typeFilter, { target: { value: 'rating' } });

    expect(screen.getByText('No fields match the current filter.')).toBeInTheDocument();
  });

  // Test 15: Responsive Layout (Table Renders)
  it('renders table with proper structure', () => {
    render(<FieldsList fields={mockFields} />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Check headers exist
    expect(screen.getByText('Field Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  // Test 16: Sort Indicator Display (REF MCP improvement)
  it('displays sort indicators (↑ ↓ ↕ symbols) correctly', () => {
    render(<FieldsList fields={mockFields} />);

    // Initially, sortable headers should show ↕ (unsorted)
    const nameHeader = screen.getByText('Field Name').closest('th');
    expect(nameHeader?.textContent).toContain('↕');

    // Click to sort ascending
    fireEvent.click(screen.getByText('Field Name'));

    // Should show ↑ for ascending
    expect(nameHeader?.textContent).toContain('↑');
    expect(nameHeader?.textContent).not.toContain('↓');

    // Click again to sort descending
    fireEvent.click(screen.getByText('Field Name'));

    // Should show ↓ for descending
    expect(nameHeader?.textContent).toContain('↓');
    expect(nameHeader?.textContent).not.toContain('↑');
  });

  // Test 17: aria-sort Attribute Correctness (REF MCP improvement)
  it('sets aria-sort attribute correctly for accessibility', () => {
    render(<FieldsList fields={mockFields} />);

    const nameHeader = screen.getByText('Field Name').closest('th');
    const configHeader = screen.getByText('Configuration').closest('th');

    // Initially, sortable columns should have aria-sort="none"
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');

    // Non-sortable columns should not have aria-sort
    expect(configHeader).not.toHaveAttribute('aria-sort');

    // Click to sort ascending
    fireEvent.click(screen.getByText('Field Name'));
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    // Click again to sort descending
    fireEvent.click(screen.getByText('Field Name'));
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  });
});
