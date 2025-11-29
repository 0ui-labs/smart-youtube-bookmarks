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

export type { ActiveFilter, FilterOperator } from "./fieldFilterStore";
// Field Filter Store
export { useFieldFilterStore } from "./fieldFilterStore";
export type { ImportProgress } from "./importProgressStore";
// Import Progress Store
export { useImportProgressStore } from "./importProgressStore";
// Player Settings Store
export { usePlayerSettingsStore } from "./playerSettingsStore";
export type {
  GridColumnCount,
  ThumbnailSize,
  ViewMode,
  VisibleColumns,
} from "./tableSettingsStore";
// Table Settings Store
export { useTableSettingsStore } from "./tableSettingsStore";
// Tag Store
export { useTagStore } from "./tagStore";
