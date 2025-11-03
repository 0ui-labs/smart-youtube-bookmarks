/**
 * Centralized exports for all Zustand stores
 *
 * This index file provides a single import point for all store hooks and types,
 * making it easier to import multiple stores and refactor store structure.
 *
 * @example
 * ```tsx
 * // Single import for multiple stores
 * import { useTableSettingsStore, useTagStore, type ThumbnailSize } from '@/stores';
 * ```
 */

// Table Settings Store
export { useTableSettingsStore } from './tableSettingsStore';
export type { ThumbnailSize, VisibleColumns } from './tableSettingsStore';

// Tag Store
export { useTagStore } from './tagStore';
