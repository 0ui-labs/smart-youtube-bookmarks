/**
 * Feature Flags für MVP UI Cleanup (Wave 2 - Task #24)
 *
 * Diese Flags steuern die Sichtbarkeit von Buttons, die in späteren Tasks
 * durch andere UI-Elemente ersetzt werden:
 * - SHOW_ADD_VIDEO_BUTTON → Plus Icon in Header (Task #30)
 * - SHOW_CSV_UPLOAD_BUTTON → Settings Dropdown (Task #26)
 * - SHOW_CSV_EXPORT_BUTTON → Settings Dropdown (Task #26)
 *
 * Environment Variable Support:
 * Standardwerte (MVP): alle false
 * Überschreibbar via .env.local für lokales Testing:
 *   VITE_FEATURE_SHOW_ADD_VIDEO_BUTTON=true
 *   VITE_FEATURE_SHOW_CSV_UPLOAD_BUTTON=true
 *   VITE_FEATURE_SHOW_CSV_EXPORT_BUTTON=true
 */

/**
 * Helper um Environment Variable zu Boolean zu konvertieren
 * @param envVar - Environment Variable Wert (undefined wenn nicht gesetzt)
 * @param defaultValue - Fallback-Wert wenn env var nicht gesetzt
 * @returns Boolean Wert
 */
const envToBool = (envVar: string | undefined, defaultValue: boolean): boolean => {
  if (envVar === undefined) return defaultValue
  return envVar.toLowerCase() === 'true'
}

export const FEATURE_FLAGS = {
  /**
   * Zeigt "Video hinzufügen" Button an
   * MVP: false (wird durch Plus Icon in Header ersetzt - Task #30)
   */
  SHOW_ADD_VIDEO_BUTTON: envToBool(
    import.meta.env.VITE_FEATURE_SHOW_ADD_VIDEO_BUTTON,
    false
  ),

  /**
   * Zeigt "CSV Upload" Button an
   * MVP: false (wird in Settings Dropdown verschoben - Task #26)
   */
  SHOW_CSV_UPLOAD_BUTTON: envToBool(
    import.meta.env.VITE_FEATURE_SHOW_CSV_UPLOAD_BUTTON,
    false
  ),

  /**
   * Zeigt "CSV Export" Button an
   * MVP: false (wird in Settings Dropdown verschoben - Task #26)
   */
  SHOW_CSV_EXPORT_BUTTON: envToBool(
    import.meta.env.VITE_FEATURE_SHOW_CSV_EXPORT_BUTTON,
    false
  ),
} as const

export type FeatureFlags = typeof FEATURE_FLAGS
