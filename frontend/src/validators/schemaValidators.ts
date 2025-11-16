import { z } from 'zod';

/**
 * Schema field for validation (matches the structure in SchemaEditor)
 */
interface SchemaField {
  field_id: string;
  display_order: number;
  show_on_card: boolean;
}

/**
 * Validation issue type (compatible with Zod's addIssue)
 */
interface ValidationIssue {
  code: z.ZodIssueCode | 'custom';
  message: string;
  path: (string | number)[];
  maximum?: number;
  type?: 'string' | 'number' | 'bigint' | 'date' | 'array' | 'set';
  inclusive?: boolean;
}

/**
 * Validate show_on_card limit (max 3 fields)
 *
 * Business rule: Only 3 fields can be shown on video cards to avoid cluttering the UI
 *
 * @param fields - Array of schema fields
 * @returns Validation issue if limit exceeded, null otherwise
 *
 * @example
 * ```ts
 * const fields = [
 *   { field_id: 'f1', display_order: 0, show_on_card: true },
 *   { field_id: 'f2', display_order: 1, show_on_card: true },
 *   { field_id: 'f3', display_order: 2, show_on_card: true },
 *   { field_id: 'f4', display_order: 3, show_on_card: true },
 * ];
 * const issue = validateShowOnCardLimit(fields);
 * // Returns: { code: "too_big", message: "Maximal 3 Felder können auf der Karte angezeigt werden", ... }
 * ```
 */
export function validateShowOnCardLimit(fields: SchemaField[]): ValidationIssue | null {
  const showOnCardCount = fields.filter(f => f.show_on_card).length;

  if (showOnCardCount > 3) {
    return {
      code: 'too_big',
      maximum: 3,
      type: 'array',
      inclusive: true,
      message: 'Maximal 3 Felder können auf der Karte angezeigt werden',
      path: [], // Root level error for entire fields array
    };
  }

  return null;
}

/**
 * Validate unique display_order values
 *
 * Business rule: Each field must have a unique display order to avoid ambiguous sorting
 *
 * @param fields - Array of schema fields
 * @returns Array of validation issues for duplicate display orders
 *
 * @example
 * ```ts
 * const fields = [
 *   { field_id: 'f1', display_order: 0, show_on_card: true },
 *   { field_id: 'f2', display_order: 1, show_on_card: false },
 *   { field_id: 'f3', display_order: 1, show_on_card: false }, // Duplicate!
 * ];
 * const issues = validateUniqueDisplayOrder(fields);
 * // Returns: [{ code: "custom", message: "Anzeigereihenfolge 1 ist bereits vergeben", path: [2, 'display_order'] }]
 * ```
 */
export function validateUniqueDisplayOrder(fields: SchemaField[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Use Map for O(n) complexity instead of O(n²)
  const orderMap = new Map<number, number[]>();

  // Build map of display_order -> array of indices
  fields.forEach((field, index) => {
    const indices = orderMap.get(field.display_order) || [];
    indices.push(index);
    orderMap.set(field.display_order, indices);
  });

  // Emit issues for all duplicates except the first occurrence
  orderMap.forEach((indices, order) => {
    if (indices.length > 1) {
      // Skip first occurrence, report rest as duplicates
      indices.slice(1).forEach(index => {
        issues.push({
          code: 'custom',
          message: `Anzeigereihenfolge ${order} ist bereits vergeben`,
          path: [index, 'display_order'],
        });
      });
    }
  });

  return issues;
}

/**
 * Validate unique field_id values
 *
 * Business rule: Each field can only be added once to a schema to avoid duplicate data
 *
 * @param fields - Array of schema fields
 * @returns Array of validation issues for duplicate field IDs
 *
 * @example
 * ```ts
 * const fields = [
 *   { field_id: 'field-123', display_order: 0, show_on_card: true },
 *   { field_id: 'field-456', display_order: 1, show_on_card: false },
 *   { field_id: 'field-123', display_order: 2, show_on_card: false }, // Duplicate!
 * ];
 * const issues = validateUniqueFieldIds(fields);
 * // Returns: [{ code: "custom", message: "Dieses Feld wurde bereits hinzugefügt", path: [2, 'field_id'] }]
 * ```
 */
export function validateUniqueFieldIds(fields: SchemaField[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Use Map for O(n) complexity instead of O(n²)
  const idMap = new Map<string, number[]>();

  // Build map of field_id -> array of indices
  fields.forEach((field, index) => {
    const indices = idMap.get(field.field_id) || [];
    indices.push(index);
    idMap.set(field.field_id, indices);
  });

  // Emit issues for all duplicates except the first occurrence
  idMap.forEach((indices) => {
    if (indices.length > 1) {
      // Skip first occurrence, report rest as duplicates
      indices.slice(1).forEach(index => {
        issues.push({
          code: 'custom',
          message: 'Dieses Feld wurde bereits hinzugefügt',
          path: [index, 'field_id'],
        });
      });
    }
  });

  return issues;
}

/**
 * Run all schema field validations
 *
 * Convenience function that runs all validators and collects issues
 *
 * @param fields - Array of schema fields
 * @param ctx - Zod refinement context
 *
 * @example
 * ```ts
 * // In Zod schema:
 * .superRefine((fields, ctx) => {
 *   validateAllSchemaFields(fields, ctx);
 * })
 * ```
 */
export function validateAllSchemaFields(
  fields: SchemaField[],
  ctx: z.RefinementCtx
): void {
  // Check 1: Max 3 show_on_card
  const showOnCardIssue = validateShowOnCardLimit(fields);
  if (showOnCardIssue) {
    ctx.addIssue(showOnCardIssue as any);
  }

  // Check 2: Unique display_order
  const displayOrderIssues = validateUniqueDisplayOrder(fields);
  displayOrderIssues.forEach(issue => ctx.addIssue(issue as any));

  // Check 3: Unique field_id
  const fieldIdIssues = validateUniqueFieldIds(fields);
  fieldIdIssues.forEach(issue => ctx.addIssue(issue as any));
}
