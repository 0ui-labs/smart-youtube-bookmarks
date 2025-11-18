import { z } from 'zod'
import type { LucideIcon } from 'lucide-react'
import {
  Star,
  GraduationCap,
  ChefHat,
  ShoppingCart,
  Code2,
} from 'lucide-react'

/**
 * Schema template field definition.
 * Matches CustomFieldCreate + SchemaFieldInput structure.
 */
export const TemplateFieldSchema = z.object({
  name: z.string().min(1).max(255),
  field_type: z.enum(['select', 'rating', 'text', 'boolean']),
  config: z.record(z.any()), // Type-specific config validated by backend
  display_order: z.number().int().min(0),
  show_on_card: z.boolean(),
})

export type TemplateField = z.infer<typeof TemplateFieldSchema>

/**
 * Schema template category.
 * Used for filtering and badge display.
 */
export type TemplateCategory =
  | 'general'
  | 'education'
  | 'cooking'
  | 'review'
  | 'technology'

/**
 * Complete schema template definition.
 */
export const SchemaTemplateSchema = z.object({
  id: z.string(), // Unique template identifier (version suffix for updates)
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(1000),
  icon: z.string(), // lucide-react icon name
  category: z.enum(['general', 'education', 'cooking', 'review', 'technology']),
  fields: z.array(TemplateFieldSchema).min(1).max(10),
})

export type SchemaTemplate = z.infer<typeof SchemaTemplateSchema>

/**
 * Icon mapping for template categories.
 * Allows dynamic icon rendering based on template.icon string.
 */
export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Star,
  GraduationCap,
  ChefHat,
  ShoppingCart,
  Code2,
} as const

/**
 * Category badge colors for UI display.
 */
export const CATEGORY_BADGE_COLORS: Record<TemplateCategory, string> = {
  general: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  education: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  cooking: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  review: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  technology: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
} as const

/**
 * Predefined schema templates (5 templates covering common use cases).
 */
export const SCHEMA_TEMPLATES: readonly SchemaTemplate[] = [
  // Template 1: Video Quality Assessment
  {
    id: 'video-quality-v1',
    name: 'Video Quality Assessment',
    description: 'Standard metrics for evaluating overall video production quality',
    icon: 'Star',
    category: 'general',
    fields: [
      {
        name: 'Presentation Quality',
        field_type: 'select',
        config: { options: ['Poor', 'Average', 'Good', 'Excellent'] },
        display_order: 0,
        show_on_card: true,
      },
      {
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        display_order: 1,
        show_on_card: true,
      },
      {
        name: 'Audio Clarity',
        field_type: 'boolean',
        config: {},
        display_order: 2,
        show_on_card: true,
      },
      {
        name: 'Additional Notes',
        field_type: 'text',
        config: { max_length: 500 },
        display_order: 3,
        show_on_card: false,
      },
    ],
  },

  // Template 2: Tutorial Difficulty
  {
    id: 'tutorial-difficulty-v1',
    name: 'Tutorial Difficulty',
    description: 'Evaluate complexity and learning curve of educational content',
    icon: 'GraduationCap',
    category: 'education',
    fields: [
      {
        name: 'Difficulty Level',
        field_type: 'select',
        config: { options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
        display_order: 0,
        show_on_card: true,
      },
      {
        name: 'Teaching Quality',
        field_type: 'rating',
        config: { max_rating: 5 },
        display_order: 1,
        show_on_card: true,
      },
      {
        name: 'Follows Best Practices',
        field_type: 'boolean',
        config: {},
        display_order: 2,
        show_on_card: false,
      },
      {
        name: 'Key Takeaways',
        field_type: 'text',
        config: { max_length: 300 },
        display_order: 3,
        show_on_card: false,
      },
    ],
  },

  // Template 3: Recipe Evaluation
  {
    id: 'recipe-evaluation-v1',
    name: 'Recipe Evaluation',
    description: 'Assess cooking videos and recipe complexity',
    icon: 'ChefHat',
    category: 'cooking',
    fields: [
      {
        name: 'Recipe Complexity',
        field_type: 'select',
        config: { options: ['Easy', 'Moderate', 'Difficult', 'Professional'] },
        display_order: 0,
        show_on_card: true,
      },
      {
        name: 'Taste Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        display_order: 1,
        show_on_card: true,
      },
      {
        name: 'Would Make Again',
        field_type: 'boolean',
        config: {},
        display_order: 2,
        show_on_card: true,
      },
      {
        name: 'Modifications Made',
        field_type: 'text',
        config: { max_length: 400 },
        display_order: 3,
        show_on_card: false,
      },
    ],
  },

  // Template 4: Product Review
  {
    id: 'product-review-v1',
    name: 'Product Review',
    description: 'Evaluate product quality and purchasing decisions',
    icon: 'ShoppingCart',
    category: 'review',
    fields: [
      {
        name: 'Value for Money',
        field_type: 'select',
        config: { options: ['Poor', 'Fair', 'Good', 'Excellent'] },
        display_order: 0,
        show_on_card: true,
      },
      {
        name: 'Overall Score',
        field_type: 'rating',
        config: { max_rating: 10 },
        display_order: 1,
        show_on_card: true,
      },
      {
        name: 'Recommended',
        field_type: 'boolean',
        config: {},
        display_order: 2,
        show_on_card: true,
      },
      {
        name: 'Pros & Cons',
        field_type: 'text',
        config: { max_length: 600 },
        display_order: 3,
        show_on_card: false,
      },
    ],
  },

  // Template 5: Technical Depth
  {
    id: 'technical-depth-v1',
    name: 'Technical Depth',
    description: 'Assess technical accuracy and depth of programming content',
    icon: 'Code2',
    category: 'technology',
    fields: [
      {
        name: 'Technical Accuracy',
        field_type: 'select',
        config: { options: ['Inaccurate', 'Partially Correct', 'Accurate', 'Authoritative'] },
        display_order: 0,
        show_on_card: true,
      },
      {
        name: 'Code Quality',
        field_type: 'rating',
        config: { max_rating: 5 },
        display_order: 1,
        show_on_card: true,
      },
      {
        name: 'Production Ready',
        field_type: 'boolean',
        config: {},
        display_order: 2,
        show_on_card: false,
      },
      {
        name: 'Implementation Notes',
        field_type: 'text',
        config: { max_length: 500 },
        display_order: 3,
        show_on_card: false,
      },
    ],
  },
] as const

/**
 * Get template by ID (type-safe).
 */
export function getTemplateById(templateId: string): SchemaTemplate | undefined {
  return SCHEMA_TEMPLATES.find(t => t.id === templateId)
}

/**
 * Get templates by category (for filtering).
 */
export function getTemplatesByCategory(category: TemplateCategory): readonly SchemaTemplate[] {
  return SCHEMA_TEMPLATES.filter(t => t.category === category)
}

/**
 * Validate template at runtime (Zod validation).
 * Useful for testing and ensuring template integrity.
 */
export function validateTemplate(template: unknown): SchemaTemplate {
  return SchemaTemplateSchema.parse(template)
}
