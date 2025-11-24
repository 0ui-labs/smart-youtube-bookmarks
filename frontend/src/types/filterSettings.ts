import type { CustomField } from './customFields'

/**
 * Grouped custom fields by category for filter modal
 *
 * Used by FilterSettingsModal to display filters organized by category tabs.
 * If no categories are selected, all fields are grouped under a single "Alle Felder" entry.
 */
export type CategoryFilters = {
  /** Category ID (tag.id or 'all' for fallback) */
  categoryId: string

  /** Display name for tab header */
  categoryName: string

  /** Schema ID this category uses (null if no schema) */
  schemaId: string | null

  /** Custom fields available for filtering in this category */
  fields: CustomField[]
}
