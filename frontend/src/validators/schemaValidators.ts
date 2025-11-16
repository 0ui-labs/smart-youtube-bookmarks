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
  type?: string;
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
  const orders = fields.map(f => f.display_order);

  // Find all duplicate orders
  const duplicateOrders = orders.filter((order, index) =>
    orders.indexOf(order) !== index
  );

  // Create an issue for each duplicate (pointing to the last occurrence)
  duplicateOrders.forEach((order) => {
    const index = orders.lastIndexOf(order);
    issues.push({
      code: 'custom',
      message: `Anzeigereihenfolge ${order} ist bereits vergeben`,
      path: [index, 'display_order'], // Point to specific field
    });
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
  const ids = fields.map(f => f.field_id);

  // Find all duplicate IDs
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

  // Create an issue for each duplicate (pointing to the last occurrence)
  duplicateIds.forEach((id) => {
    const index = ids.lastIndexOf(id);
    issues.push({
      code: 'custom',
      message: 'Dieses Feld wurde bereits hinzugefügt',
      path: [index, 'field_id'], // Point to specific field
    });
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
    ctx.addIssue(showOnCardIssue);
  }

  // Check 2: Unique display_order
  const displayOrderIssues = validateUniqueDisplayOrder(fields);
  displayOrderIssues.forEach(issue => ctx.addIssue(issue));

  // Check 3: Unique field_id
  const fieldIdIssues = validateUniqueFieldIds(fields);
  fieldIdIssues.forEach(issue => ctx.addIssue(issue));
}
