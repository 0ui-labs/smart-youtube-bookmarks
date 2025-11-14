import React from 'react';
import type { FieldType } from '@/types/customField';

/**
 * Props for FieldTypeBadge component
 */
interface FieldTypeBadgeProps {
  fieldType: FieldType;
  className?: string;
}

/**
 * Color mapping for field types
 * Uses Tailwind utility classes for consistency
 */
const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  select: 'bg-blue-100 text-blue-800',
  rating: 'bg-yellow-100 text-yellow-800',
  text: 'bg-gray-100 text-gray-800',
  boolean: 'bg-green-100 text-green-800',
};

/**
 * Human-readable labels for field types
 */
const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  select: 'Select',
  rating: 'Rating',
  text: 'Text',
  boolean: 'Boolean',
};

/**
 * FieldTypeBadge Component
 *
 * Displays field type as a colored badge with consistent styling.
 * Uses discriminated union pattern for type safety.
 *
 * @example
 * ```tsx
 * <FieldTypeBadge fieldType="rating" />
 * // Renders: <span class="bg-yellow-100 text-yellow-800 ...">Rating</span>
 * ```
 */
export const FieldTypeBadge: React.FC<FieldTypeBadgeProps> = ({
  fieldType,
  className = ''
}) => {
  const colorClasses = FIELD_TYPE_COLORS[fieldType];
  const label = FIELD_TYPE_LABELS[fieldType];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses} ${className}`}
      data-testid={`field-type-badge-${fieldType}`}
    >
      {label}
    </span>
  );
};
