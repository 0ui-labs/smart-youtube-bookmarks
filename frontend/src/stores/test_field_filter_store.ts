/**
 * Manual test file for fieldFilterStore
 *
 * Run this file to verify store functionality:
 * - Add filter
 * - Update filter
 * - Remove filter
 * - Clear all filters
 */
import { useFieldFilterStore } from './fieldFilterStore';

console.log('=== Field Filter Store Test ===\n');

// Clear any existing state
useFieldFilterStore.getState().clearFilters();
console.log('Initial state:', useFieldFilterStore.getState().activeFilters);

// Test 1: Add filter
console.log('\n--- Test 1: Add filter ---');
useFieldFilterStore.getState().addFilter({
  fieldId: 'field-123',
  fieldName: 'Overall Rating',
  fieldType: 'rating',
  operator: 'gte',
  value: 4
});
console.log('✓ Added filter:', useFieldFilterStore.getState().activeFilters);

// Test 2: Add another filter
console.log('\n--- Test 2: Add another filter ---');
useFieldFilterStore.getState().addFilter({
  fieldId: 'field-456',
  fieldName: 'Category',
  fieldType: 'select',
  operator: 'in',
  value: 'Tutorial'
});
console.log('✓ Added second filter:', useFieldFilterStore.getState().activeFilters);

// Test 3: Update filter
console.log('\n--- Test 3: Update filter ---');
const firstFilter = useFieldFilterStore.getState().activeFilters[0];
const firstFilterId = firstFilter?.id ?? '';
useFieldFilterStore.getState().updateFilter(firstFilterId, { value: 5 });
console.log('✓ Updated filter value to 5:', useFieldFilterStore.getState().activeFilters);

// Test 4: Update filter operator
console.log('\n--- Test 4: Update filter operator ---');
useFieldFilterStore.getState().updateFilter(firstFilterId, { operator: 'eq' });
console.log('✓ Updated filter operator to "eq":', useFieldFilterStore.getState().activeFilters);

// Test 5: Add BETWEEN filter
console.log('\n--- Test 5: Add BETWEEN filter ---');
useFieldFilterStore.getState().addFilter({
  fieldId: 'field-789',
  fieldName: 'Duration',
  fieldType: 'rating',
  operator: 'between',
  valueMin: 5,
  valueMax: 10
});
console.log('✓ Added BETWEEN filter:', useFieldFilterStore.getState().activeFilters);

// Test 6: Remove filter
console.log('\n--- Test 6: Remove filter ---');
const secondFilter = useFieldFilterStore.getState().activeFilters[1];
const secondFilterId = secondFilter?.id ?? '';
useFieldFilterStore.getState().removeFilter(secondFilterId);
console.log('✓ Removed second filter:', useFieldFilterStore.getState().activeFilters);

// Test 7: Clear all filters
console.log('\n--- Test 7: Clear all filters ---');
useFieldFilterStore.getState().clearFilters();
console.log('✓ Cleared all filters:', useFieldFilterStore.getState().activeFilters);

// Test 8: Verify UUID generation
console.log('\n--- Test 8: Verify UUID generation ---');
useFieldFilterStore.getState().addFilter({
  fieldId: 'field-abc',
  fieldName: 'Test',
  fieldType: 'text',
  operator: 'contains',
  value: 'test'
});
useFieldFilterStore.getState().addFilter({
  fieldId: 'field-def',
  fieldName: 'Test 2',
  fieldType: 'text',
  operator: 'contains',
  value: 'test2'
});
const filters = useFieldFilterStore.getState().activeFilters;
const allUniqueIds = filters.every((f, i, arr) =>
  arr.findIndex(other => other.id === f.id) === i
);
console.log('✓ All filter IDs are unique:', allUniqueIds);
console.log('Filter IDs:', filters.map(f => f.id));

// Test 9: Test boolean filter
console.log('\n--- Test 9: Test boolean filter ---');
useFieldFilterStore.getState().clearFilters();
useFieldFilterStore.getState().addFilter({
  fieldId: 'field-bool',
  fieldName: 'Is Favorite',
  fieldType: 'boolean',
  operator: 'is',
  value: true
});
console.log('✓ Added boolean filter:', useFieldFilterStore.getState().activeFilters);

// Final cleanup
useFieldFilterStore.getState().clearFilters();
console.log('\n=== All tests passed! ===');
