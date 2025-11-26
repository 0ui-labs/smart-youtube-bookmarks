/**
 * Centralized UI strings for i18n-readiness.
 *
 * All user-facing strings should be defined here to enable
 * future migration to a proper i18n library (e.g., react-i18next).
 *
 * Usage:
 *   import { UI_STRINGS } from '@/constants/ui'
 *   <span>{UI_STRINGS.channel.chooseCategory}</span>
 */

export const UI_STRINGS = {
  channel: {
    chooseCategory: 'Kategorie wählen',
  },
} as const
