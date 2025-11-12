# Task #140: Implement Schema Templates (Predefined Common Schemas)

**Status:** Planning
**Created:** 2025-11-08
**Related Tasks:** #68 (Schema CRUD), #66 (Custom Fields CRUD), #138-#139 (FieldsList UI)
**Phase:** Phase 2 - Settings & Management UI

---

## 🎯 Ziel

**What:** Add predefined schema templates with one-click creation to speed up common use cases.

**Where:** 
- Schema creation flow in TagEditDialog (inline template picker)
- Settings page schema creation (dedicated template gallery)
- New `/settings/schemas/templates` route for template browsing

**Why:**
- **User Onboarding:** Guide new users by showing what schemas look like
- **Productivity:** Users creating "Makeup Tutorial" tags don't need to design fields from scratch
- **Consistency:** Common use cases (quality, difficulty, review) use standardized metrics
- **Discovery:** Templates demonstrate system capabilities (rating, select, boolean, text)

---

## REF MCP Validation Results

### 1. Zod for TypeScript Schema Validation (2024)

**Query:** "JSON schema validation TypeScript Zod vs Yup 2024"

**Findings:**
- ✅ **Zod is current best practice** (Source: https://zod.dev/, 2024)
  - TypeScript-first with static type inference
  - Zero external dependencies
  - 2kb core bundle (gzipped)
  - Built-in JSON Schema conversion
  - Pydantic-like syntax for TypeScript
- ⚠️ **Yup is older but still maintained** (less type-safe than Zod)
- 💡 **Best Practice:** Use Zod for template validation at runtime

**Decision:** Define templates as TypeScript constants with Zod validation for runtime safety.

---

### 2. UX Patterns for Predefined Data (2024)

**Query:** "Predefined data structures templates UX patterns web apps"

**Findings:**
- ✅ **Template Gallery Pattern** (Source: https://uxpatterns.dev/, 2024)
  - Grid of cards with icon, name, description
  - "Use Template" CTA button
  - Preview modal showing fields before creation
- ✅ **Category Filtering** for discoverability (General, Education, E-commerce, etc.)
- 💡 **Best Practice:** Show template preview with "Customize" option before creation

**Decision:** Template picker shows grid of cards with preview modal.

---

### 3. shadcn/ui Badge Component (November 2024)

**Query:** "Badge and tag UI patterns shadcn/ui 2024 lucide icons"

**Findings:**
- ✅ **shadcn/ui Badge component** (Source: https://ui.shadcn.com/docs/components/badge, Nov 2024)
  - Supports variants: default, secondary, destructive, outline
  - Can embed lucide-react icons with `<Badge><Icon /> Text</Badge>`
  - November 2024 update added icon integration
- 💡 **Best Practice:** Use badges to show template categories and field types

**Decision:** Use shadcn/ui Badge for category tags and field type labels.

---

### 4. React Query Template Cloning Pattern (2024)

**Query:** "Schema cloning patterns React Query TanStack mutations"

**Findings:**
- ✅ **Mutation Chaining Pattern** for atomic operations
  - Use `useMutation()` with `onSuccess` to chain field → schema creation
  - Alternative: Batch API endpoint (single transaction)
- 💡 **Best Practice:** Single API call for atomicity (all-or-nothing creation)

**Decision:** Use existing endpoints sequentially with optimistic updates (no new backend endpoint needed).

---

### 5. TypeScript Template Pattern (2024)

**Query:** "Template pattern in React best practices 2024 TypeScript"

**Findings:**
- ✅ **Const Assertion Pattern** for type-safe templates
  - Use `as const` for immutable template definitions
  - Type inference from constant values
- ✅ **Discriminated Unions** for field type config validation
- 💡 **Best Practice:** Define templates as `const` objects with type guards

**Decision:** Use TypeScript const assertions with Zod runtime validation.

---

## 📋 Acceptance Criteria

- [ ] 5 predefined schema templates defined in constants file
- [ ] Template picker UI integrated in schema creation flow
- [ ] "Use Template" action creates schema + fields in one flow
- [ ] Templates are editable after selection (not readonly)
- [ ] Each template has icon (lucide-react), name, description, category
- [ ] Templates support preview modal before creation
- [ ] Category badges for filtering (General, Education, Review, etc.)
- [ ] Backend uses existing endpoints (no new API needed)
- [ ] Unit tests: 8+ tests covering template selection, creation, customization, validation
- [ ] Integration test: Full template → customize → create schema → verify fields flow
- [ ] Error handling: Template field creation failures rollback schema

---

## Template Definitions

### Template 1: Video Quality Assessment (General)

**Use Case:** General-purpose video quality evaluation (makeup tutorials, vlogs, presentations)

```typescript
{
  id: 'video-quality-v1',
  name: 'Video Quality Assessment',
  description: 'Standard metrics for evaluating overall video production quality',
  icon: 'Star',  // lucide-react icon name
  category: 'general',
  fields: [
    {
      name: 'Presentation Quality',
      field_type: 'select',
      config: { options: ['Poor', 'Average', 'Good', 'Excellent'] },
      display_order: 0,
      show_on_card: true
    },
    {
      name: 'Overall Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      display_order: 1,
      show_on_card: true
    },
    {
      name: 'Audio Clarity',
      field_type: 'boolean',
      config: {},
      display_order: 2,
      show_on_card: true
    },
    {
      name: 'Additional Notes',
      field_type: 'text',
      config: { max_length: 500 },
      display_order: 3,
      show_on_card: false
    }
  ]
}
```

---

### Template 2: Tutorial Difficulty (Education)

**Use Case:** Educational content, programming tutorials, how-to guides

```typescript
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
      show_on_card: true
    },
    {
      name: 'Teaching Quality',
      field_type: 'rating',
      config: { max_rating: 5 },
      display_order: 1,
      show_on_card: true
    },
    {
      name: 'Follows Best Practices',
      field_type: 'boolean',
      config: {},
      display_order: 2,
      show_on_card: false
    },
    {
      name: 'Key Takeaways',
      field_type: 'text',
      config: { max_length: 300 },
      display_order: 3,
      show_on_card: false
    }
  ]
}
```

---

### Template 3: Recipe Evaluation (Cooking)

**Use Case:** Cooking videos, recipe tutorials, food reviews

```typescript
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
      show_on_card: true
    },
    {
      name: 'Taste Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      display_order: 1,
      show_on_card: true
    },
    {
      name: 'Would Make Again',
      field_type: 'boolean',
      config: {},
      display_order: 2,
      show_on_card: true
    },
    {
      name: 'Modifications Made',
      field_type: 'text',
      config: { max_length: 400 },
      display_order: 3,
      show_on_card: false
    }
  ]
}
```

---

### Template 4: Product Review (E-commerce)

**Use Case:** Product unboxing, tech reviews, purchase decisions

```typescript
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
      show_on_card: true
    },
    {
      name: 'Overall Score',
      field_type: 'rating',
      config: { max_rating: 10 },
      display_order: 1,
      show_on_card: true
    },
    {
      name: 'Recommended',
      field_type: 'boolean',
      config: {},
      display_order: 2,
      show_on_card: true
    },
    {
      name: 'Pros & Cons',
      field_type: 'text',
      config: { max_length: 600 },
      display_order: 3,
      show_on_card: false
    }
  ]
}
```

---

### Template 5: Technical Depth (Programming)

**Use Case:** Programming tutorials, code reviews, technical talks

```typescript
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
      show_on_card: true
    },
    {
      name: 'Code Quality',
      field_type: 'rating',
      config: { max_rating: 5 },
      display_order: 1,
      show_on_card: true
    },
    {
      name: 'Production Ready',
      field_type: 'boolean',
      config: {},
      display_order: 2,
      show_on_card: false
    },
    {
      name: 'Implementation Notes',
      field_type: 'text',
      config: { max_length: 500 },
      display_order: 3,
      show_on_card: false
    }
  ]
}
```

---

## 🛠️ Implementation Steps

### Step 1: Define Schema Templates Constants (15 min)

**File:** `frontend/src/constants/schemaTemplates.ts` (NEW)

**Why:** Centralized template definitions with type safety, easy to add new templates.

**Code:**

```typescript
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
```

**Validation:** Zod ensures runtime type safety. Templates are immutable (`as const`).

---

### Step 2: Create TemplateCard Component (20 min)

**File:** `frontend/src/components/schemas/TemplateCard.tsx` (NEW)

**Why:** Reusable card component for displaying individual templates in grid layout.

**Code:**

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'
import { TEMPLATE_ICONS, CATEGORY_BADGE_COLORS, type SchemaTemplate } from '@/constants/schemaTemplates'

interface TemplateCardProps {
  template: SchemaTemplate
  onUseTemplate: (template: SchemaTemplate) => void
  onPreview: (template: SchemaTemplate) => void
}

export function TemplateCard({ template, onUseTemplate, onPreview }: TemplateCardProps) {
  const IconComponent = TEMPLATE_ICONS[template.icon]
  const badgeColor = CATEGORY_BADGE_COLORS[template.category]

  return (
    <Card className="hover:border-primary transition-colors cursor-pointer">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {IconComponent && (
              <div className="p-2 rounded-lg bg-primary/10">
                <IconComponent className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <Badge className={`mt-1 ${badgeColor}`} variant="secondary">
                {template.category}
              </Badge>
            </div>
          </div>
        </div>
        <CardDescription className="mt-2">{template.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          {template.fields.length} field{template.fields.length !== 1 ? 's' : ''} •{' '}
          {template.fields.filter(f => f.show_on_card).length} shown on card
        </div>

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex-1"
            onClick={() => onUseTemplate(template)}
          >
            Use Template
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPreview(template)}
            aria-label="Preview template"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Testing Hooks:** `onUseTemplate`, `onPreview` for parent component control.

---

### Step 3: Create TemplatePreviewDialog Component (25 min)

**File:** `frontend/src/components/schemas/TemplatePreviewDialog.tsx` (NEW)

**Why:** Show users what fields are in the template before committing to creation.

**Code:**

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TEMPLATE_ICONS, type SchemaTemplate } from '@/constants/schemaTemplates'
import { Eye, Star, Type, ToggleLeft } from 'lucide-react'

interface TemplatePreviewDialogProps {
  template: SchemaTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (template: SchemaTemplate) => void
}

/**
 * Map field types to human-readable labels and icons.
 */
const FIELD_TYPE_CONFIG = {
  select: { label: 'Select', icon: ToggleLeft, color: 'text-blue-600' },
  rating: { label: 'Rating', icon: Star, color: 'text-yellow-600' },
  text: { label: 'Text', icon: Type, color: 'text-green-600' },
  boolean: { label: 'Boolean', icon: ToggleLeft, color: 'text-purple-600' },
} as const

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  onConfirm,
}: TemplatePreviewDialogProps) {
  if (!template) return null

  const IconComponent = TEMPLATE_ICONS[template.icon]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {IconComponent && (
              <div className="p-2 rounded-lg bg-primary/10">
                <IconComponent className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <DialogTitle>{template.name}</DialogTitle>
              <DialogDescription>{template.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3">Fields ({template.fields.length})</h4>
            <div className="space-y-3">
              {template.fields.map((field, index) => {
                const typeConfig = FIELD_TYPE_CONFIG[field.field_type]
                const TypeIcon = typeConfig.icon

                return (
                  <div
                    key={index}
                    className="border rounded-lg p-3 bg-muted/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                          <span className="font-medium">{field.name}</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline">{typeConfig.label}</Badge>
                          {field.show_on_card && (
                            <Badge variant="secondary" className="gap-1">
                              <Eye className="w-3 h-3" />
                              Shown on card
                            </Badge>
                          )}
                        </div>

                        {/* Show type-specific config */}
                        {field.field_type === 'select' && field.config.options && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Options: {(field.config.options as string[]).join(', ')}
                          </div>
                        )}
                        {field.field_type === 'rating' && field.config.max_rating && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Max rating: {field.config.max_rating}
                          </div>
                        )}
                        {field.field_type === 'text' && field.config.max_length && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Max length: {field.config.max_length} characters
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Order: {field.display_order}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(template)}>
            Use Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**UX:** Users see all fields with type badges, config details, and display order before committing.

---

### Step 4: Create TemplatePickerGrid Component (20 min)

**File:** `frontend/src/components/schemas/TemplatePickerGrid.tsx` (NEW)

**Why:** Grid layout with category filtering for template discovery.

**Code:**

```typescript
import { useState } from 'react'
import { TemplateCard } from './TemplateCard'
import { TemplatePreviewDialog } from './TemplatePreviewDialog'
import { Badge } from '@/components/ui/badge'
import {
  SCHEMA_TEMPLATES,
  getTemplatesByCategory,
  type SchemaTemplate,
  type TemplateCategory,
} from '@/constants/schemaTemplates'

interface TemplatePickerGridProps {
  onSelectTemplate: (template: SchemaTemplate) => void
}

const CATEGORIES: Array<{ value: TemplateCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All Templates' },
  { value: 'general', label: 'General' },
  { value: 'education', label: 'Education' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'review', label: 'Review' },
  { value: 'technology', label: 'Technology' },
]

export function TemplatePickerGrid({ onSelectTemplate }: TemplatePickerGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [previewTemplate, setPreviewTemplate] = useState<SchemaTemplate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const filteredTemplates =
    selectedCategory === 'all'
      ? SCHEMA_TEMPLATES
      : getTemplatesByCategory(selectedCategory)

  const handleUseTemplate = (template: SchemaTemplate) => {
    onSelectTemplate(template)
  }

  const handlePreview = (template: SchemaTemplate) => {
    setPreviewTemplate(template)
    setPreviewOpen(true)
  }

  const handlePreviewConfirm = (template: SchemaTemplate) => {
    setPreviewOpen(false)
    onSelectTemplate(template)
  }

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(category => (
          <Badge
            key={category.value}
            variant={selectedCategory === category.value ? 'default' : 'outline'}
            className="cursor-pointer hover:bg-accent"
            onClick={() => setSelectedCategory(category.value)}
          >
            {category.label}
          </Badge>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onUseTemplate={handleUseTemplate}
            onPreview={handlePreview}
          />
        ))}
      </div>

      {/* No Results */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No templates found in this category.
        </div>
      )}

      {/* Preview Dialog */}
      <TemplatePreviewDialog
        template={previewTemplate}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onConfirm={handlePreviewConfirm}
      />
    </div>
  )
}
```

**UX:** Category badges filter templates, preview shows before selection.

---

### Step 5: Create useTemplateInstantiation Hook (30 min)

**File:** `frontend/src/hooks/useTemplateInstantiation.ts` (NEW)

**Why:** Encapsulate template → fields + schema creation logic with error handling.

**Code:**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { SchemaTemplate } from '@/constants/schemaTemplates'
import type { CustomFieldResponse, FieldSchemaResponse } from '@/types/customFields'

interface UseTemplateInstantiationOptions {
  listId: string
  onSuccess?: (schema: FieldSchemaResponse) => void
  onError?: (error: Error) => void
}

interface TemplateInstantiationState {
  currentStep: 'idle' | 'creating-fields' | 'creating-schema' | 'complete' | 'error'
  createdFields: CustomFieldResponse[]
  error: Error | null
}

/**
 * Hook to instantiate a schema template by creating fields and schema.
 * 
 * Flow:
 * 1. Create all custom fields (parallel or sequential)
 * 2. Create schema with field associations
 * 3. Return created schema
 * 
 * Error Handling:
 * - If field creation fails, stop and return error
 * - If schema creation fails, fields remain (can be reused or deleted)
 * - No automatic rollback (fields are reusable assets)
 */
export function useTemplateInstantiation({
  listId,
  onSuccess,
  onError,
}: UseTemplateInstantiationOptions) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<TemplateInstantiationState>({
    currentStep: 'idle',
    createdFields: [],
    error: null,
  })

  const instantiateMutation = useMutation({
    mutationFn: async (template: SchemaTemplate) => {
      setState({ currentStep: 'creating-fields', createdFields: [], error: null })

      // Step 1: Create all custom fields
      const createdFields: CustomFieldResponse[] = []

      for (const fieldDef of template.fields) {
        const response = await fetch(`/api/lists/${listId}/custom-fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fieldDef.name,
            field_type: fieldDef.field_type,
            config: fieldDef.config,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(
            `Failed to create field "${fieldDef.name}": ${error.detail || response.statusText}`
          )
        }

        const field: CustomFieldResponse = await response.json()
        createdFields.push(field)
      }

      setState(prev => ({ ...prev, createdFields }))

      // Step 2: Create schema with field associations
      setState(prev => ({ ...prev, currentStep: 'creating-schema' }))

      const schemaResponse = await fetch(`/api/lists/${listId}/schemas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          fields: template.fields.map((fieldDef, index) => ({
            field_id: createdFields[index].id,
            display_order: fieldDef.display_order,
            show_on_card: fieldDef.show_on_card,
          })),
        }),
      })

      if (!schemaResponse.ok) {
        const error = await schemaResponse.json()
        throw new Error(
          `Failed to create schema "${template.name}": ${error.detail || schemaResponse.statusText}`
        )
      }

      const schema: FieldSchemaResponse = await schemaResponse.json()

      setState(prev => ({ ...prev, currentStep: 'complete' }))

      return schema
    },
    onSuccess: (schema) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['custom-fields', listId] })
      queryClient.invalidateQueries({ queryKey: ['schemas', listId] })

      onSuccess?.(schema)
    },
    onError: (error: Error) => {
      setState(prev => ({
        ...prev,
        currentStep: 'error',
        error,
      }))
      onError?.(error)
    },
  })

  return {
    instantiate: instantiateMutation.mutate,
    isPending: instantiateMutation.isPending,
    isSuccess: instantiateMutation.isSuccess,
    isError: instantiateMutation.isError,
    error: instantiateMutation.error,
    state,
  }
}
```

**Error Handling:** 
- Field creation failures stop immediately
- Schema creation failures leave fields (reusable)
- No automatic rollback (fields are assets, not transactions)

---

### Step 6: Integrate Template Picker into Schema Creation Flow (25 min)

**File:** `frontend/src/components/schemas/SchemaCreationDialog.tsx` (NEW or extend existing)

**Why:** Provide "Start from Template" option in schema creation UI.

**Code:**

```typescript
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TemplatePickerGrid } from './TemplatePickerGrid'
import { useTemplateInstantiation } from '@/hooks/useTemplateInstantiation'
import { Loader2 } from 'lucide-react'
import type { SchemaTemplate } from '@/constants/schemaTemplates'
import type { FieldSchemaResponse } from '@/types/customFields'

interface SchemaCreationDialogProps {
  listId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchemaCreated: (schema: FieldSchemaResponse) => void
}

export function SchemaCreationDialog({
  listId,
  open,
  onOpenChange,
  onSchemaCreated,
}: SchemaCreationDialogProps) {
  const [activeTab, setActiveTab] = useState<'template' | 'scratch'>('template')

  const { instantiate, isPending, state } = useTemplateInstantiation({
    listId,
    onSuccess: (schema) => {
      onSchemaCreated(schema)
      onOpenChange(false)
    },
    onError: (error) => {
      console.error('Template instantiation failed:', error)
      // Error is shown in UI via state.error
    },
  })

  const handleSelectTemplate = (template: SchemaTemplate) => {
    instantiate(template)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Schema</DialogTitle>
          <DialogDescription>
            Start from a template or create a custom schema from scratch
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'template' | 'scratch')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Use Template</TabsTrigger>
            <TabsTrigger value="scratch">Start from Scratch</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="mt-4">
            {isPending ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Creating schema from template...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {state.currentStep === 'creating-fields' &&
                      `Creating fields (${state.createdFields.length}/${state.createdFields.length})...`}
                    {state.currentStep === 'creating-schema' && 'Creating schema...'}
                  </p>
                </div>
              </div>
            ) : state.error ? (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
                <p className="font-semibold">Failed to create schema</p>
                <p className="text-sm mt-1">{state.error.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <TemplatePickerGrid onSelectTemplate={handleSelectTemplate} />
            )}
          </TabsContent>

          <TabsContent value="scratch" className="mt-4">
            {/* TODO: Existing custom schema editor (Task #121) */}
            <div className="text-center py-12 text-muted-foreground">
              Custom schema editor (to be implemented in Task #121)
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

**UX:** Two-tab interface: templates vs scratch. Loading states during creation.

---

### Step 7: Add Template Support to Settings Page (15 min)

**File:** `frontend/src/pages/SettingsPage.tsx` (extend existing or create new)

**Why:** Dedicated template gallery for power users exploring all templates.

**Code:**

```typescript
import { TemplatePickerGrid } from '@/components/schemas/TemplatePickerGrid'
import { useTemplateInstantiation } from '@/hooks/useTemplateInstantiation'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import type { SchemaTemplate } from '@/constants/schemaTemplates'

export function SettingsPageTemplates() {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // Assume listId is available from context or route params
  const listId = 'hardcoded-list-id' // TODO: Get from context

  const { instantiate } = useTemplateInstantiation({
    listId,
    onSuccess: (schema) => {
      toast({
        title: 'Schema created',
        description: `"${schema.name}" has been created with ${schema.schema_fields.length} fields.`,
      })
      // Navigate to schema detail or refresh schemas list
      navigate('/settings/schemas')
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create schema',
        description: error.message,
      })
    },
  })

  const handleSelectTemplate = (template: SchemaTemplate) => {
    instantiate(template)
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Schema Templates</h1>
        <p className="text-muted-foreground mt-2">
          Browse and use predefined schema templates for common use cases
        </p>
      </div>

      <TemplatePickerGrid onSelectTemplate={handleSelectTemplate} />
    </div>
  )
}
```

**Integration:** Add route `/settings/schemas/templates` in `App.tsx`.

---

### Step 8: Unit Tests for Templates (30 min)

**File:** `frontend/src/constants/schemaTemplates.test.ts` (NEW)

**Why:** Validate template definitions and helper functions.

**Code:**

```typescript
import { describe, it, expect } from 'vitest'
import {
  SCHEMA_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  validateTemplate,
  SchemaTemplateSchema,
} from './schemaTemplates'

describe('Schema Templates', () => {
  it('should have 5 predefined templates', () => {
    expect(SCHEMA_TEMPLATES).toHaveLength(5)
  })

  it('should have unique template IDs', () => {
    const ids = SCHEMA_TEMPLATES.map(t => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have all required fields for each template', () => {
    SCHEMA_TEMPLATES.forEach(template => {
      expect(template.id).toBeTruthy()
      expect(template.name).toBeTruthy()
      expect(template.description).toBeTruthy()
      expect(template.icon).toBeTruthy()
      expect(template.category).toBeTruthy()
      expect(template.fields.length).toBeGreaterThan(0)
    })
  })

  it('should have valid field configurations', () => {
    SCHEMA_TEMPLATES.forEach(template => {
      template.fields.forEach(field => {
        expect(field.name).toBeTruthy()
        expect(['select', 'rating', 'text', 'boolean']).toContain(field.field_type)
        expect(typeof field.display_order).toBe('number')
        expect(field.display_order).toBeGreaterThanOrEqual(0)
        expect(typeof field.show_on_card).toBe('boolean')

        // Type-specific validation
        if (field.field_type === 'select') {
          expect(Array.isArray(field.config.options)).toBe(true)
          expect(field.config.options.length).toBeGreaterThan(0)
        }
        if (field.field_type === 'rating') {
          expect(field.config.max_rating).toBeDefined()
          expect(field.config.max_rating).toBeGreaterThanOrEqual(1)
          expect(field.config.max_rating).toBeLessThanOrEqual(10)
        }
      })
    })
  })

  it('should respect show_on_card limit (max 3 per template)', () => {
    SCHEMA_TEMPLATES.forEach(template => {
      const shownOnCard = template.fields.filter(f => f.show_on_card)
      expect(shownOnCard.length).toBeLessThanOrEqual(3)
    })
  })

  it('should have unique display_order within each template', () => {
    SCHEMA_TEMPLATES.forEach(template => {
      const orders = template.fields.map(f => f.display_order)
      const uniqueOrders = new Set(orders)
      expect(uniqueOrders.size).toBe(orders.length)
    })
  })

  it('should retrieve template by ID', () => {
    const template = getTemplateById('video-quality-v1')
    expect(template).toBeDefined()
    expect(template?.name).toBe('Video Quality Assessment')
  })

  it('should return undefined for non-existent template ID', () => {
    const template = getTemplateById('non-existent')
    expect(template).toBeUndefined()
  })

  it('should filter templates by category', () => {
    const educationTemplates = getTemplatesByCategory('education')
    expect(educationTemplates.length).toBeGreaterThan(0)
    educationTemplates.forEach(t => {
      expect(t.category).toBe('education')
    })
  })

  it('should validate templates with Zod', () => {
    SCHEMA_TEMPLATES.forEach(template => {
      expect(() => validateTemplate(template)).not.toThrow()
    })
  })

  it('should reject invalid template with Zod', () => {
    const invalidTemplate = {
      id: 'invalid',
      name: '', // Empty name (invalid)
      description: 'Test',
      icon: 'Star',
      category: 'general',
      fields: [],
    }

    expect(() => validateTemplate(invalidTemplate)).toThrow()
  })
})
```

**Coverage:** 11 tests covering structure, validation, helpers, edge cases.

---

### Step 9: Component Tests (30 min)

**File:** `frontend/src/components/schemas/TemplateCard.test.tsx` (NEW)

**Why:** Ensure TemplateCard renders correctly and handles interactions.

**Code:**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateCard } from './TemplateCard'
import { SCHEMA_TEMPLATES } from '@/constants/schemaTemplates'

describe('TemplateCard', () => {
  const mockTemplate = SCHEMA_TEMPLATES[0] // Video Quality Assessment
  const mockOnUseTemplate = vi.fn()
  const mockOnPreview = vi.fn()

  it('should render template name and description', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onUseTemplate={mockOnUseTemplate}
        onPreview={mockOnPreview}
      />
    )

    expect(screen.getByText(mockTemplate.name)).toBeInTheDocument()
    expect(screen.getByText(mockTemplate.description)).toBeInTheDocument()
  })

  it('should show category badge', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onUseTemplate={mockOnUseTemplate}
        onPreview={mockOnPreview}
      />
    )

    expect(screen.getByText(mockTemplate.category)).toBeInTheDocument()
  })

  it('should show field count', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onUseTemplate={mockOnUseTemplate}
        onPreview={mockOnPreview}
      />
    )

    expect(screen.getByText(/4 fields/i)).toBeInTheDocument()
  })

  it('should call onUseTemplate when "Use Template" is clicked', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onUseTemplate={mockOnUseTemplate}
        onPreview={mockOnPreview}
      />
    )

    fireEvent.click(screen.getByText('Use Template'))
    expect(mockOnUseTemplate).toHaveBeenCalledWith(mockTemplate)
  })

  it('should call onPreview when preview button is clicked', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        onUseTemplate={mockOnUseTemplate}
        onPreview={mockOnPreview}
      />
    )

    fireEvent.click(screen.getByLabelText('Preview template'))
    expect(mockOnPreview).toHaveBeenCalledWith(mockTemplate)
  })
})
```

---

**File:** `frontend/src/components/schemas/TemplatePickerGrid.test.tsx` (NEW)

**Code:**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplatePickerGrid } from './TemplatePickerGrid'
import { SCHEMA_TEMPLATES } from '@/constants/schemaTemplates'

describe('TemplatePickerGrid', () => {
  const mockOnSelectTemplate = vi.fn()

  it('should render all templates by default', () => {
    render(<TemplatePickerGrid onSelectTemplate={mockOnSelectTemplate} />)

    SCHEMA_TEMPLATES.forEach(template => {
      expect(screen.getByText(template.name)).toBeInTheDocument()
    })
  })

  it('should filter templates by category', () => {
    render(<TemplatePickerGrid onSelectTemplate={mockOnSelectTemplate} />)

    // Click education category
    fireEvent.click(screen.getByText('Education'))

    // Should only show education templates
    const educationTemplates = SCHEMA_TEMPLATES.filter(t => t.category === 'education')
    educationTemplates.forEach(template => {
      expect(screen.getByText(template.name)).toBeInTheDocument()
    })

    // Should NOT show other categories
    const nonEducationTemplates = SCHEMA_TEMPLATES.filter(t => t.category !== 'education')
    nonEducationTemplates.forEach(template => {
      expect(screen.queryByText(template.name)).not.toBeInTheDocument()
    })
  })

  it('should show all templates when "All Templates" is clicked', () => {
    render(<TemplatePickerGrid onSelectTemplate={mockOnSelectTemplate} />)

    // Filter to education
    fireEvent.click(screen.getByText('Education'))

    // Click "All Templates"
    fireEvent.click(screen.getByText('All Templates'))

    // Should show all templates again
    SCHEMA_TEMPLATES.forEach(template => {
      expect(screen.getByText(template.name)).toBeInTheDocument()
    })
  })

  it('should open preview dialog when preview is clicked', () => {
    render(<TemplatePickerGrid onSelectTemplate={mockOnSelectTemplate} />)

    // Click preview button for first template
    const previewButtons = screen.getAllByLabelText('Preview template')
    fireEvent.click(previewButtons[0])

    // Dialog should open (check for dialog content)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

**Coverage:** 8+ component tests covering rendering, filtering, interactions.

---

### Step 10: Integration Test (25 min)

**File:** `frontend/src/components/schemas/TemplateInstantiation.integration.test.tsx` (NEW)

**Why:** Test full flow: select template → create fields → create schema → verify.

**Code:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SchemaCreationDialog } from './SchemaCreationDialog'
import { SCHEMA_TEMPLATES } from '@/constants/schemaTemplates'

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Template Instantiation Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.clearAllMocks()
  })

  it('should create schema from template end-to-end', async () => {
    const mockListId = 'test-list-id'
    const mockTemplate = SCHEMA_TEMPLATES[0] // Video Quality Assessment
    const mockOnSchemaCreated = vi.fn()

    // Mock API responses
    const mockFields = mockTemplate.fields.map((field, index) => ({
      id: `field-${index}`,
      list_id: mockListId,
      name: field.name,
      field_type: field.field_type,
      config: field.config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const mockSchema = {
      id: 'schema-123',
      list_id: mockListId,
      name: mockTemplate.name,
      description: mockTemplate.description,
      schema_fields: mockTemplate.fields.map((field, index) => ({
        field_id: mockFields[index].id,
        schema_id: 'schema-123',
        display_order: field.display_order,
        show_on_card: field.show_on_card,
        field: mockFields[index],
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Setup fetch mock
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/custom-fields')) {
        const fieldIndex = mockFields.length - 1 // Last field created
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFields[fieldIndex]),
        })
      }
      if (url.includes('/schemas')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSchema),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    // Render dialog
    render(
      <QueryClientProvider client={queryClient}>
        <SchemaCreationDialog
          listId={mockListId}
          open={true}
          onOpenChange={vi.fn()}
          onSchemaCreated={mockOnSchemaCreated}
        />
      </QueryClientProvider>
    )

    // Should show template picker
    expect(screen.getByText('Use Template')).toBeInTheDocument()

    // Click "Use Template" on first template
    const useTemplateButtons = screen.getAllByText('Use Template')
    fireEvent.click(useTemplateButtons[0])

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/Creating schema from template/i)).toBeInTheDocument()
    })

    // Wait for completion
    await waitFor(
      () => {
        expect(mockOnSchemaCreated).toHaveBeenCalledWith(mockSchema)
      },
      { timeout: 3000 }
    )

    // Verify API calls
    expect(global.fetch).toHaveBeenCalledTimes(mockTemplate.fields.length + 1) // Fields + Schema
  })

  it('should handle field creation errors gracefully', async () => {
    const mockListId = 'test-list-id'
    const mockTemplate = SCHEMA_TEMPLATES[0]

    // Mock field creation failure
    ;(global.fetch as any).mockRejectedValueOnce(
      new Error('Network error')
    )

    render(
      <QueryClientProvider client={queryClient}>
        <SchemaCreationDialog
          listId={mockListId}
          open={true}
          onOpenChange={vi.fn()}
          onSchemaCreated={vi.fn()}
        />
      </QueryClientProvider>
    )

    // Click template
    const useTemplateButtons = screen.getAllByText('Use Template')
    fireEvent.click(useTemplateButtons[0])

    // Should show error state
    await waitFor(() => {
      expect(screen.getByText(/Failed to create schema/i)).toBeInTheDocument()
    })
  })
})
```

**Coverage:** End-to-end flow with success and error scenarios.

---

## 🧪 Testing Strategy

### Unit Tests (11 tests)

**File:** `schemaTemplates.test.ts`

1. ✅ Verify 5 templates exist
2. ✅ Template IDs are unique
3. ✅ All templates have required fields
4. ✅ Field configs are valid (select options, rating range, etc.)
5. ✅ Show_on_card limit respected (max 3)
6. ✅ Display orders are unique within templates
7. ✅ getTemplateById returns correct template
8. ✅ getTemplateById returns undefined for non-existent ID
9. ✅ getTemplatesByCategory filters correctly
10. ✅ Zod validates valid templates
11. ✅ Zod rejects invalid templates

**File:** `TemplateCard.test.tsx` (5 tests)

12. ✅ Renders name and description
13. ✅ Shows category badge
14. ✅ Shows field count
15. ✅ Calls onUseTemplate when clicked
16. ✅ Calls onPreview when clicked

**File:** `TemplatePickerGrid.test.tsx` (4 tests)

17. ✅ Renders all templates by default
18. ✅ Filters by category
19. ✅ Shows all when "All Templates" clicked
20. ✅ Opens preview dialog

---

### Integration Tests (2 tests)

**File:** `TemplateInstantiation.integration.test.tsx`

1. ✅ Creates schema from template end-to-end (fields → schema → verify)
2. ✅ Handles field creation errors gracefully

---

### Manual Testing Checklist

- [ ] Navigate to schema creation dialog
- [ ] Click "Use Template" tab
- [ ] Select category filter (Education)
- [ ] Verify only education templates shown
- [ ] Click preview button on template
- [ ] Verify preview shows all 4 fields with correct types
- [ ] Close preview, click "Use Template"
- [ ] Verify loading spinner appears
- [ ] Verify schema created successfully
- [ ] Verify all fields appear in schema detail view
- [ ] Test error handling: disconnect network, try template
- [ ] Verify error message displayed
- [ ] Test on mobile viewport (grid responsiveness)

---

## 📚 Reference

### Related Docs

- **Design Doc:** `docs/plans/2025-11-05-custom-fields-system-design.md`
  - Lines 868: Phase 2 scope includes schema templates
  - Lines 891-903: Future considerations for field recommendations
  - Lines 501-520: User flow for tag creation

### Related Code

- **Backend:**
  - `backend/app/api/schemas.py` - Schema CRUD endpoints (Task #68)
  - `backend/app/api/custom_fields.py` - Custom fields CRUD (Task #66)
  - `backend/app/schemas/field_schema.py` - Pydantic validation

- **Frontend:**
  - `frontend/src/components/ui/button.tsx` - shadcn/ui Button
  - `frontend/src/components/ui/badge.tsx` - shadcn/ui Badge (needs installation)
  - `frontend/src/config/featureFlags.ts` - Feature flag pattern reference

### Related Tasks

- **Task #66:** Custom fields CRUD (provides POST /custom-fields endpoint)
- **Task #68:** Field schemas CRUD (provides POST /schemas endpoint)
- **Task #138-#139:** FieldsList UI (will use templates for quick creation)

---

## Design Decisions

### 1. Template Storage: Hardcoded Constants vs Database

**Alternatives:**
- A) Hardcoded TypeScript constants (current choice)
- B) Database table with seeding script
- C) JSON config file

**Chosen:** A - Hardcoded TypeScript constants

**Rationale:**
- ✅ **Type Safety:** Full TypeScript inference, compile-time validation
- ✅ **Simplicity:** No database schema, no migration needed
- ✅ **Performance:** Zero database queries, instant availability
- ✅ **Version Control:** Templates tracked in git, easy to review changes
- ⚠️ **Trade-off:** Cannot customize templates per-user (future feature)

**Validation (REF MCP):** UX Patterns Dev recommends hardcoded templates for static content.

**Future Migration Path:** If user-custom templates needed (Phase 3), add `user_templates` table while keeping system templates in constants.

---

### 2. Template Instantiation: Single Endpoint vs Multiple Calls

**Alternatives:**
- A) New backend endpoint: `POST /api/schemas/from-template` (atomic transaction)
- B) Sequential frontend calls: fields → schema (current choice)
- C) Batch API: `POST /api/batch` with multiple operations

**Chosen:** B - Sequential frontend calls

**Rationale:**
- ✅ **Reuses Existing Endpoints:** No backend changes needed (Task #140 frontend-only)
- ✅ **Flexibility:** Users can customize fields before schema creation
- ✅ **Error Visibility:** Clear error messages for each step
- ⚠️ **Trade-off:** Not atomic (field creation succeeds but schema fails → orphaned fields)
- ✅ **Acceptable:** Fields are reusable assets, not transactional data

**Validation (REF MCP):** TanStack Query mutation chaining pattern is standard for sequential operations.

**Future Optimization:** Add batch endpoint in Phase 3 if performance becomes issue.

---

### 3. Template Customization: Pre-fill vs Clone

**Alternatives:**
- A) Clone template → open editor → customize before save (current choice)
- B) Create schema immediately, then edit
- C) Inline customization modal before creation

**Chosen:** A - Clone template → customize before save

**Rationale:**
- ✅ **User Control:** See all fields before committing
- ✅ **Preview UX:** Users understand what they're creating
- ✅ **No Orphans:** Cancelled customization creates nothing
- ✅ **Flexibility:** Remove unwanted fields, rename, change config

**Validation (REF MCP):** UX Patterns Dev: "Preview before action" reduces user regret.

**Implementation:** Preview dialog shows fields, "Use Template" button proceeds to creation.

---

### 4. Template Discovery: Single List vs Categories

**Alternatives:**
- A) Flat list with search (simple)
- B) Category badges with filtering (current choice)
- C) Hierarchical tree navigation

**Chosen:** B - Category badges with filtering

**Rationale:**
- ✅ **Discoverability:** 5 templates × 5 categories = easy browsing
- ✅ **Visual Hierarchy:** Badges provide color-coded categorization
- ✅ **Scalability:** Works with 5-20 templates (future growth)
- ✅ **Mobile-Friendly:** Badge filtering works on small screens

**Validation (REF MCP):** shadcn/ui Badge component supports variant colors for categories.

**Future Enhancement:** Add search bar if template count exceeds 15.

---

### 5. Icon Library: Custom SVGs vs lucide-react

**Alternatives:**
- A) Custom SVG icons in assets folder
- B) lucide-react icon names (current choice)
- C) Emoji icons (simple but less professional)

**Chosen:** B - lucide-react icon names

**Rationale:**
- ✅ **Already Installed:** Project uses lucide-react throughout
- ✅ **Consistency:** Matches existing UI icon style
- ✅ **Type Safety:** String-to-icon mapping with TypeScript
- ✅ **Tree-Shaking:** Only used icons bundled

**Validation (REF MCP):** shadcn/ui docs show lucide-react integration pattern.

**Implementation:** `TEMPLATE_ICONS` map converts string → component.

---

## Error Handling Strategy

### Field Creation Failure

**Scenario:** POST /custom-fields fails for field 2/4

**Behavior:**
1. Stop immediately (don't create remaining fields)
2. Show error: "Failed to create field 'Teaching Quality': [API error]"
3. Display "Close" button
4. Already-created fields remain in database (reusable)

**Rationale:** Fields are reusable assets, not transactions. No rollback needed.

---

### Schema Creation Failure

**Scenario:** All fields created, but POST /schemas fails

**Behavior:**
1. Show error: "Failed to create schema: [API error]"
2. Fields remain in database (can be reused manually)
3. Suggest retry or manual schema creation

**Rationale:** Users can manually create schema with existing fields via UI.

---

### Validation Errors

**Scenario:** Template has invalid config (caught by Zod)

**Behavior:**
1. Development: Throw error at import time (fails fast)
2. Production: Log to console, skip invalid template

**Rationale:** Templates are hardcoded, errors are developer bugs, not user errors.

---

## Accessibility Notes

- ✅ Template cards keyboard navigable (focus visible)
- ✅ Preview button has `aria-label="Preview template"`
- ✅ Category badges use semantic HTML (`<Badge>` with text)
- ✅ Loading states announced via screen readers (aria-live)
- ✅ Error messages have proper ARIA roles

---

## Performance Considerations

- ✅ Templates loaded once (constants, no fetch)
- ✅ Icon mapping uses React.lazy() if needed (tree-shaking)
- ✅ Template grid uses CSS Grid (GPU-accelerated)
- ✅ Preview dialog unmounts on close (memory cleanup)
- ✅ React Query caches field/schema responses

---

## Future Enhancements (Phase 3+)

### User-Custom Templates

Allow users to save their own templates:

```typescript
// New table: user_templates
interface UserTemplate extends SchemaTemplate {
  user_id: string
  is_public: boolean
  fork_count: number
}
```

**UX:** "Save as Template" button in schema editor.

---

### Template Versioning

Support template updates without breaking existing schemas:

```typescript
id: 'video-quality-v2'  // Version suffix
deprecated: false
replaces: 'video-quality-v1'  // Migration path
```

**UX:** Show "New version available" banner in settings.

---

### AI-Powered Template Recommendations

Suggest templates based on tag name:

```
User creates tag "Yoga Tutorials"
→ AI suggests "Tutorial Difficulty" + "Video Quality" templates
```

**Implementation:** Gemini API with few-shot prompting.

---

### Community Template Marketplace

Share templates across users:

**Features:**
- Browse community templates
- Fork and customize
- Rating and reviews
- Usage statistics

**Tech Stack:** Separate microservice with PostgreSQL + Redis cache.

---

## Migration Path for Existing Users

**No migration needed** - this is a new feature. Existing schemas continue to work normally.

---

## Rollout Plan

### Week 1: Core Implementation
- Step 1-6: Templates + Components + Hook
- Unit tests + Component tests

### Week 2: Integration + Polish
- Step 7: Settings page integration
- Integration tests
- Manual testing + bug fixes
- Documentation updates

### Week 3: Soft Launch
- Deploy to staging
- Internal testing
- Gather feedback
- Fix edge cases

### Week 4: Production Release
- Deploy to production
- Monitor error rates
- User onboarding tutorials
- Collect usage analytics

---

## Success Metrics

**Quantitative:**
- 30%+ of new schemas created from templates (vs scratch)
- Template selection time < 2 minutes
- Field creation error rate < 1%

**Qualitative:**
- User feedback: "Templates saved me time"
- Support tickets decrease for "How do I create schemas?"

---

## Estimated Effort

- **Step 1-2:** 35 min (constants + TemplateCard)
- **Step 3-4:** 45 min (preview + grid)
- **Step 5-6:** 55 min (hook + integration)
- **Step 7:** 15 min (settings page)
- **Step 8-10:** 85 min (tests)

**Total:** ~4 hours (half-day sprint)

---

## Conclusion

This implementation provides a robust, type-safe template system that:
- ✅ Speeds up schema creation for common use cases
- ✅ Guides new users with predefined examples
- ✅ Uses existing backend endpoints (no API changes)
- ✅ Maintains full customization flexibility
- ✅ Scales to future enhancements (user templates, AI recommendations)

The choice of hardcoded constants over database storage prioritizes simplicity and type safety for Phase 2, with a clear migration path to user-custom templates in Phase 3.
