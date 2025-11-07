# Task #78: Create FieldType TypeScript Types and Interfaces

**Plan Task:** #78
**Wave/Phase:** Phase 1 - Frontend Data Layer (Custom Fields System)
**Dependencies:** Task #64 (CustomField Pydantic Schemas) ✅ Completed, Task #65 (FieldSchema Pydantic Schemas) ✅ Completed

---

## 🎯 Ziel

Create comprehensive TypeScript type definitions and interfaces for the Custom Fields System that match backend Pydantic schemas. Implement discriminated unions for field types, type-safe config objects, and runtime type guards to prevent type errors throughout the frontend application.

**Expected Outcome:** Complete type-safe TypeScript API matching backend responses with zero `any` types, comprehensive JSDoc comments, and runtime type guards for safe field type detection.

---

## 📋 Acceptance Criteria

| Criterion | Evidence |
|-----------|----------|
| All backend response structures have TypeScript equivalents | CustomField, FieldSchema, SchemaField, VideoFieldValue interfaces defined |
| FieldType discriminated union implemented | Union type with 'select' \| 'rating' \| 'text' \| 'boolean' |
| Type-specific FieldConfig union implemented | SelectConfig, RatingConfig, TextConfig, BooleanConfig types |
| Type guards prevent runtime type errors | isRatingField, isSelectField, isTextField, isBooleanField functions |
| TypeScript strict mode passing | No errors with `strict: true` in tsconfig |
| Zero `any` types used | All types explicitly defined with proper constraints |
| Comprehensive JSDoc comments | All types and functions have JSDoc with examples |
| Optional Zod schemas for runtime validation | Zod schemas mirror TypeScript types for API validation |
| Unit tests for type guards | 12+ tests covering all type guard branches |
| Type inference tests compile successfully | TypeScript compilation tests verify correct type narrowing |

---

## 🛠️ Implementation Steps

### 1. Create Core Type Definitions

**File:** `frontend/src/types/customFields.ts` (new file)

**Action:** Define base field type literal and type-specific config interfaces matching backend schemas.

```typescript
/**
 * Custom Fields Type Definitions
 * 
 * TypeScript types for the Custom Fields System, matching backend Pydantic schemas.
 * Uses discriminated unions for type-safe field configuration and runtime type guards
 * for safe field type detection.
 * 
 * @see backend/app/schemas/custom_field.py - Backend schema definitions
 * @see backend/app/schemas/field_schema.py - Schema association schemas
 */

/**
 * Field type discriminator for discriminated unions.
 * 
 * Supported field types:
 * - 'select': Dropdown with predefined options
 * - 'rating': Numeric scale (1-10 stars)
 * - 'text': Free-form text input with optional max length
 * - 'boolean': Yes/no checkbox
 * 
 * @example
 * const fieldType: FieldType = 'rating'
 */
export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

/**
 * Configuration for 'select' field type.
 * 
 * Select fields provide a dropdown with predefined options.
 * Options must be non-empty strings.
 * 
 * @example
 * const config: SelectConfig = {
 *   options: ['bad', 'good', 'great']
 * }
 */
export interface SelectConfig {
  /** List of selectable options (minimum 1 required) */
  options: string[]
}

/**
 * Configuration for 'rating' field type.
 * 
 * Rating fields provide numeric scales (e.g., 1-5 stars).
 * Maximum rating must be between 1 and 10.
 * 
 * @example
 * const config: RatingConfig = {
 *   max_rating: 5
 * }
 */
export interface RatingConfig {
  /** Maximum rating value (1-10) */
  max_rating: number
}

/**
 * Configuration for 'text' field type.
 * 
 * Text fields allow free-form text input with optional length limits.
 * max_length must be >= 1 if specified.
 * 
 * @example
 * const config: TextConfig = {
 *   max_length: 500
 * }
 * 
 * @example
 * const config: TextConfig = {} // No length limit
 */
export interface TextConfig {
  /** Optional maximum text length (must be ≥1 if specified) */
  max_length?: number
}

/**
 * Configuration for 'boolean' field type.
 * 
 * Boolean fields provide yes/no checkboxes. No configuration needed.
 * 
 * @example
 * const config: BooleanConfig = {}
 */
export interface BooleanConfig {
  // No configuration needed for boolean fields
}

/**
 * Union type for all possible field configurations.
 * 
 * Used with discriminated unions to ensure type-specific config validation.
 * TypeScript will narrow the config type based on field_type.
 * 
 * @see CustomField - Uses this union type for the config property
 */
export type FieldConfig = SelectConfig | RatingConfig | TextConfig | BooleanConfig
```

---

### 2. Define Custom Field Interfaces

**File:** `frontend/src/types/customFields.ts` (continue)

**Action:** Define CustomField interface with discriminated union patterns and create/update types.

```typescript
/**
 * Base Custom Field structure from API responses.
 * 
 * Custom fields allow users to define reusable evaluation criteria for videos
 * (e.g., "Presentation Quality", "Overall Rating"). Fields are list-scoped.
 * 
 * @example
 * const field: CustomField = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Presentation Quality',
 *   field_type: 'select',
 *   config: {
 *     options: ['bad', 'good', 'great']
 *   },
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 */
export interface CustomField {
  /** Unique field identifier (UUID) */
  id: string
  /** Parent list identifier (UUID) */
  list_id: string
  /** Field name (1-255 characters) */
  name: string
  /** Field type discriminator */
  field_type: FieldType
  /** Type-specific configuration (shape depends on field_type) */
  config: FieldConfig
  /** Creation timestamp (ISO 8601) */
  created_at: string
  /** Last update timestamp (ISO 8601) */
  updated_at: string
}

/**
 * Schema for creating a new custom field.
 * 
 * Omits auto-generated fields (id, timestamps).
 * 
 * @example
 * const createData: CustomFieldCreate = {
 *   name: 'Overall Rating',
 *   field_type: 'rating',
 *   config: { max_rating: 5 }
 * }
 * 
 * @see POST /api/lists/{list_id}/custom-fields
 */
export interface CustomFieldCreate {
  /** Field name (1-255 characters) */
  name: string
  /** Field type discriminator */
  field_type: FieldType
  /** Type-specific configuration (shape depends on field_type) */
  config: FieldConfig
}

/**
 * Schema for updating an existing custom field.
 * 
 * All fields are optional to support partial updates.
 * 
 * @example
 * const updateData: CustomFieldUpdate = {
 *   name: 'Updated Field Name'
 * }
 * 
 * @example
 * const updateData: CustomFieldUpdate = {
 *   field_type: 'rating',
 *   config: { max_rating: 10 }
 * }
 * 
 * @see PUT /api/custom-fields/{field_id}
 */
export interface CustomFieldUpdate {
  /** Field name (1-255 characters) */
  name?: string
  /** Field type discriminator */
  field_type?: FieldType
  /** Type-specific configuration (shape depends on field_type) */
  config?: FieldConfig
}
```

---

### 3. Define Field Schema Interfaces

**File:** `frontend/src/types/customFields.ts` (continue)

**Action:** Define FieldSchema, SchemaField, and VideoFieldValue interfaces.

```typescript
/**
 * Field association within a schema.
 * 
 * Links a custom field to a schema with display metadata.
 * Nested within FieldSchema responses.
 * 
 * @example
 * const schemaField: SchemaField = {
 *   field_id: '123e4567-e89b-12d3-a456-426614174000',
 *   field: { ...customFieldData },
 *   display_order: 1,
 *   show_on_card: true
 * }
 */
export interface SchemaField {
  /** Associated custom field ID (UUID) */
  field_id: string
  /** Full custom field data (nested for N+1 query elimination) */
  field: CustomField
  /** Display order within schema (unique per schema) */
  display_order: number
  /** Whether to show on video card (max 3 per schema) */
  show_on_card: boolean
}

/**
 * Schema for creating field associations.
 * 
 * Used when creating a new schema with field associations.
 * Omits nested field data (only references field_id).
 * 
 * @example
 * const fieldItem: SchemaFieldItem = {
 *   field_id: '123e4567-e89b-12d3-a456-426614174000',
 *   display_order: 1,
 *   show_on_card: true
 * }
 * 
 * @see POST /api/lists/{list_id}/field-schemas
 */
export interface SchemaFieldItem {
  /** Associated custom field ID (UUID) */
  field_id: string
  /** Display order within schema (unique per schema) */
  display_order: number
  /** Whether to show on video card (max 3 per schema) */
  show_on_card: boolean
}

/**
 * Field schema from API responses.
 * 
 * Groups custom fields for tag-based organization.
 * Includes nested schema_fields with full field data.
 * 
 * @example
 * const schema: FieldSchema = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   list_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   name: 'Tutorial Evaluation',
 *   description: 'Fields for evaluating tutorial videos',
 *   schema_fields: [
 *     {
 *       field_id: 'abc123...',
 *       field: { ...fieldData },
 *       display_order: 1,
 *       show_on_card: true
 *     }
 *   ],
 *   created_at: '2025-11-06T10:30:00Z',
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 * 
 * @see GET /api/lists/{list_id}/field-schemas
 */
export interface FieldSchema {
  /** Unique schema identifier (UUID) */
  id: string
  /** Parent list identifier (UUID) */
  list_id: string
  /** Schema name (1-255 characters) */
  name: string
  /** Optional description */
  description?: string
  /** Associated fields with display metadata */
  schema_fields: SchemaField[]
  /** Creation timestamp (ISO 8601) */
  created_at: string
  /** Last update timestamp (ISO 8601) */
  updated_at: string
}

/**
 * Schema for creating a new field schema.
 * 
 * @example
 * const createData: FieldSchemaCreate = {
 *   name: 'Tutorial Evaluation',
 *   description: 'Fields for evaluating tutorial videos',
 *   fields: [
 *     {
 *       field_id: '123e4567-e89b-12d3-a456-426614174000',
 *       display_order: 1,
 *       show_on_card: true
 *     }
 *   ]
 * }
 * 
 * @see POST /api/lists/{list_id}/field-schemas
 */
export interface FieldSchemaCreate {
  /** Schema name (1-255 characters) */
  name: string
  /** Optional description */
  description?: string
  /** Field associations (max 3 with show_on_card=true) */
  fields: SchemaFieldItem[]
}

/**
 * Schema for updating an existing field schema.
 * 
 * Only name and description can be updated (not field associations).
 * 
 * @example
 * const updateData: FieldSchemaUpdate = {
 *   name: 'Updated Schema Name'
 * }
 * 
 * @see PUT /api/field-schemas/{schema_id}
 */
export interface FieldSchemaUpdate {
  /** Schema name (1-255 characters) */
  name?: string
  /** Optional description */
  description?: string
}

/**
 * Video field value from API responses.
 * 
 * Stores actual field values for videos with typed columns.
 * Includes nested field data and display metadata.
 * 
 * @example
 * const value: VideoFieldValue = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   video_id: '987fcdeb-51a2-43d1-9012-345678901234',
 *   field_id: 'abc123...',
 *   field: { ...fieldData },
 *   value: 5,
 *   schema_name: 'Tutorial Evaluation',
 *   show_on_card: true,
 *   updated_at: '2025-11-06T10:30:00Z'
 * }
 * 
 * @see GET /api/videos/{video_id}/field-values
 */
export interface VideoFieldValue {
  /** Unique value identifier (UUID) */
  id: string
  /** Parent video identifier (UUID) */
  video_id: string
  /** Associated field identifier (UUID) */
  field_id: string
  /** Full custom field data (nested) */
  field: CustomField
  /** Typed value (string for select/text, number for rating, boolean for boolean) */
  value: string | number | boolean
  /** Schema name for display (multi-tag videos) */
  schema_name?: string
  /** Whether to show on video card */
  show_on_card: boolean
  /** Last update timestamp (ISO 8601) */
  updated_at: string
}
```

---

### 4. Implement Type Guards

**File:** `frontend/src/types/customFields.ts` (continue)

**Action:** Create runtime type guard functions for safe field type detection.

```typescript
/**
 * Type guard to check if a field is a rating field.
 * 
 * Narrows CustomField type to ensure config is RatingConfig.
 * Use this before accessing rating-specific config properties.
 * 
 * @param field - Custom field to check
 * @returns True if field is a rating field
 * 
 * @example
 * if (isRatingField(field)) {
 *   // TypeScript knows config is RatingConfig
 *   console.log(field.config.max_rating)
 * }
 */
export function isRatingField(field: CustomField): field is CustomField & { field_type: 'rating'; config: RatingConfig } {
  return field.field_type === 'rating'
}

/**
 * Type guard to check if a field is a select field.
 * 
 * Narrows CustomField type to ensure config is SelectConfig.
 * Use this before accessing select-specific config properties.
 * 
 * @param field - Custom field to check
 * @returns True if field is a select field
 * 
 * @example
 * if (isSelectField(field)) {
 *   // TypeScript knows config is SelectConfig
 *   console.log(field.config.options)
 * }
 */
export function isSelectField(field: CustomField): field is CustomField & { field_type: 'select'; config: SelectConfig } {
  return field.field_type === 'select'
}

/**
 * Type guard to check if a field is a text field.
 * 
 * Narrows CustomField type to ensure config is TextConfig.
 * Use this before accessing text-specific config properties.
 * 
 * @param field - Custom field to check
 * @returns True if field is a text field
 * 
 * @example
 * if (isTextField(field)) {
 *   // TypeScript knows config is TextConfig
 *   console.log(field.config.max_length)
 * }
 */
export function isTextField(field: CustomField): field is CustomField & { field_type: 'text'; config: TextConfig } {
  return field.field_type === 'text'
}

/**
 * Type guard to check if a field is a boolean field.
 * 
 * Narrows CustomField type to ensure config is BooleanConfig.
 * Use this before accessing boolean-specific config properties.
 * 
 * @param field - Custom field to check
 * @returns True if field is a boolean field
 * 
 * @example
 * if (isBooleanField(field)) {
 *   // TypeScript knows config is BooleanConfig
 *   console.log('Boolean field with no config')
 * }
 */
export function isBooleanField(field: CustomField): field is CustomField & { field_type: 'boolean'; config: BooleanConfig } {
  return field.field_type === 'boolean'
}
```

---

### 5. Add Zod Schemas (Optional Runtime Validation)

**File:** `frontend/src/types/customFields.ts` (continue)

**Action:** Add Zod schemas for runtime validation of API responses (following existing pattern from tag.ts).

```typescript
import { z } from 'zod'

/**
 * Zod schema for SelectConfig validation.
 */
export const SelectConfigSchema = z.object({
  options: z.array(z.string().min(1)).min(1)
})

/**
 * Zod schema for RatingConfig validation.
 */
export const RatingConfigSchema = z.object({
  max_rating: z.number().int().min(1).max(10)
})

/**
 * Zod schema for TextConfig validation.
 */
export const TextConfigSchema = z.object({
  max_length: z.number().int().min(1).optional()
})

/**
 * Zod schema for BooleanConfig validation.
 */
export const BooleanConfigSchema = z.object({})

/**
 * Zod schema for FieldConfig union validation.
 * 
 * Note: This is a permissive union. For strict validation,
 * use discriminated union with field_type.
 */
export const FieldConfigSchema = z.union([
  SelectConfigSchema,
  RatingConfigSchema,
  TextConfigSchema,
  BooleanConfigSchema
])

/**
 * Zod schema for CustomField validation.
 * 
 * Matches backend API response structure.
 */
export const CustomFieldSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  field_type: z.enum(['select', 'rating', 'text', 'boolean']),
  config: FieldConfigSchema,
  created_at: z.string(),
  updated_at: z.string()
})

/**
 * Zod schema for CustomFieldCreate validation.
 */
export const CustomFieldCreateSchema = z.object({
  name: z.string().min(1).max(255),
  field_type: z.enum(['select', 'rating', 'text', 'boolean']),
  config: FieldConfigSchema
})

/**
 * Zod schema for CustomFieldUpdate validation.
 */
export const CustomFieldUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  field_type: z.enum(['select', 'rating', 'text', 'boolean']).optional(),
  config: FieldConfigSchema.optional()
})

/**
 * Zod schema for SchemaField validation.
 */
export const SchemaFieldSchema = z.object({
  field_id: z.string().uuid(),
  field: CustomFieldSchema,
  display_order: z.number().int().min(0),
  show_on_card: z.boolean()
})

/**
 * Zod schema for SchemaFieldItem validation.
 */
export const SchemaFieldItemSchema = z.object({
  field_id: z.string().uuid(),
  display_order: z.number().int().min(0),
  show_on_card: z.boolean()
})

/**
 * Zod schema for FieldSchema validation.
 */
export const FieldSchemaSchema = z.object({
  id: z.string().uuid(),
  list_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  schema_fields: z.array(SchemaFieldSchema),
  created_at: z.string(),
  updated_at: z.string()
})

/**
 * Zod schema for FieldSchemaCreate validation.
 */
export const FieldSchemaCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  fields: z.array(SchemaFieldItemSchema)
})

/**
 * Zod schema for FieldSchemaUpdate validation.
 */
export const FieldSchemaUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional()
})

/**
 * Zod schema for VideoFieldValue validation.
 */
export const VideoFieldValueSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  field_id: z.string().uuid(),
  field: CustomFieldSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
  schema_name: z.string().optional(),
  show_on_card: z.boolean(),
  updated_at: z.string()
})
```

---

### 6. Write Type Guard Unit Tests

**File:** `frontend/src/types/__tests__/customFields.test.ts` (new file)

**Action:** Create comprehensive unit tests for type guard functions.

```typescript
import { describe, it, expect } from 'vitest'
import {
  isRatingField,
  isSelectField,
  isTextField,
  isBooleanField,
  type CustomField,
  type RatingConfig,
  type SelectConfig,
  type TextConfig,
  type BooleanConfig
} from '../customFields'

describe('Type Guards', () => {
  describe('isRatingField', () => {
    it('should return true for rating field', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isRatingField(field)).toBe(true)

      // Type narrowing test (compile-time check)
      if (isRatingField(field)) {
        // Should not have TypeScript error
        const maxRating: number = field.config.max_rating
        expect(maxRating).toBe(5)
      }
    })

    it('should return false for non-rating field', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Quality',
        field_type: 'select',
        config: { options: ['bad', 'good', 'great'] },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isRatingField(field)).toBe(false)
    })
  })

  describe('isSelectField', () => {
    it('should return true for select field', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Quality',
        field_type: 'select',
        config: { options: ['bad', 'good', 'great'] },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isSelectField(field)).toBe(true)

      // Type narrowing test
      if (isSelectField(field)) {
        const options: string[] = field.config.options
        expect(options).toEqual(['bad', 'good', 'great'])
      }
    })

    it('should return false for non-select field', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isSelectField(field)).toBe(false)
    })
  })

  describe('isTextField', () => {
    it('should return true for text field with max_length', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Notes',
        field_type: 'text',
        config: { max_length: 500 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isTextField(field)).toBe(true)

      // Type narrowing test
      if (isTextField(field)) {
        const maxLength: number | undefined = field.config.max_length
        expect(maxLength).toBe(500)
      }
    })

    it('should return true for text field without max_length', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Comments',
        field_type: 'text',
        config: {},
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isTextField(field)).toBe(true)

      // Type narrowing test
      if (isTextField(field)) {
        const maxLength: number | undefined = field.config.max_length
        expect(maxLength).toBeUndefined()
      }
    })

    it('should return false for non-text field', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Completed',
        field_type: 'boolean',
        config: {},
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isTextField(field)).toBe(false)
    })
  })

  describe('isBooleanField', () => {
    it('should return true for boolean field', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Completed',
        field_type: 'boolean',
        config: {},
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isBooleanField(field)).toBe(true)

      // Type narrowing test
      if (isBooleanField(field)) {
        // Config should be empty object
        expect(field.config).toEqual({})
      }
    })

    it('should return false for non-boolean field', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Notes',
        field_type: 'text',
        config: { max_length: 500 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z'
      }

      expect(isBooleanField(field)).toBe(false)
    })
  })

  describe('Type Guard Exhaustiveness', () => {
    it('should cover all field types exactly once', () => {
      const fields: CustomField[] = [
        {
          id: '1',
          list_id: '1',
          name: 'Rating',
          field_type: 'rating',
          config: { max_rating: 5 },
          created_at: '2025-11-06T10:30:00Z',
          updated_at: '2025-11-06T10:30:00Z'
        },
        {
          id: '2',
          list_id: '1',
          name: 'Select',
          field_type: 'select',
          config: { options: ['a', 'b'] },
          created_at: '2025-11-06T10:30:00Z',
          updated_at: '2025-11-06T10:30:00Z'
        },
        {
          id: '3',
          list_id: '1',
          name: 'Text',
          field_type: 'text',
          config: {},
          created_at: '2025-11-06T10:30:00Z',
          updated_at: '2025-11-06T10:30:00Z'
        },
        {
          id: '4',
          list_id: '1',
          name: 'Boolean',
          field_type: 'boolean',
          config: {},
          created_at: '2025-11-06T10:30:00Z',
          updated_at: '2025-11-06T10:30:00Z'
        }
      ]

      // Each field should match exactly one type guard
      expect(isRatingField(fields[0])).toBe(true)
      expect(isSelectField(fields[0])).toBe(false)
      expect(isTextField(fields[0])).toBe(false)
      expect(isBooleanField(fields[0])).toBe(false)

      expect(isRatingField(fields[1])).toBe(false)
      expect(isSelectField(fields[1])).toBe(true)
      expect(isTextField(fields[1])).toBe(false)
      expect(isBooleanField(fields[1])).toBe(false)

      expect(isRatingField(fields[2])).toBe(false)
      expect(isSelectField(fields[2])).toBe(false)
      expect(isTextField(fields[2])).toBe(true)
      expect(isBooleanField(fields[2])).toBe(false)

      expect(isRatingField(fields[3])).toBe(false)
      expect(isSelectField(fields[3])).toBe(false)
      expect(isTextField(fields[3])).toBe(false)
      expect(isBooleanField(fields[3])).toBe(true)
    })
  })
})
```

---

### 7. Write TypeScript Compilation Tests

**File:** `frontend/src/types/__tests__/customFields.compilation.test.ts` (new file)

**Action:** Create type-level tests to verify correct type inference and narrowing.

```typescript
/**
 * Type-level compilation tests for CustomField types.
 * 
 * These tests verify that TypeScript correctly infers types and narrows
 * discriminated unions. They don't run at runtime - they only verify
 * that the code compiles without TypeScript errors.
 * 
 * To verify: Run `npx tsc --noEmit` and check for errors.
 */

import type {
  CustomField,
  FieldType,
  RatingConfig,
  SelectConfig,
  TextConfig,
  BooleanConfig,
  FieldConfig
} from '../customFields'

import {
  isRatingField,
  isSelectField,
  isTextField,
  isBooleanField
} from '../customFields'

// Test 1: FieldType literal union
const fieldType1: FieldType = 'rating'
const fieldType2: FieldType = 'select'
const fieldType3: FieldType = 'text'
const fieldType4: FieldType = 'boolean'

// @ts-expect-error - Invalid field type should error
const fieldTypeInvalid: FieldType = 'invalid'

// Test 2: Config type discrimination
const ratingConfig: RatingConfig = { max_rating: 5 }
const selectConfig: SelectConfig = { options: ['a', 'b'] }
const textConfig: TextConfig = { max_length: 500 }
const booleanConfig: BooleanConfig = {}

// @ts-expect-error - Wrong config shape for rating
const ratingConfigInvalid: RatingConfig = { options: [] }

// Test 3: Type narrowing with type guards
function testTypeNarrowing(field: CustomField) {
  if (isRatingField(field)) {
    // Should compile - max_rating exists on RatingConfig
    const maxRating: number = field.config.max_rating

    // @ts-expect-error - options doesn't exist on RatingConfig
    const options = field.config.options
  }

  if (isSelectField(field)) {
    // Should compile - options exists on SelectConfig
    const options: string[] = field.config.options

    // @ts-expect-error - max_rating doesn't exist on SelectConfig
    const maxRating = field.config.max_rating
  }

  if (isTextField(field)) {
    // Should compile - max_length exists on TextConfig
    const maxLength: number | undefined = field.config.max_length

    // @ts-expect-error - options doesn't exist on TextConfig
    const options = field.config.options
  }

  if (isBooleanField(field)) {
    // Should compile - config is empty object
    const config: BooleanConfig = field.config

    // @ts-expect-error - max_rating doesn't exist on BooleanConfig
    const maxRating = field.config.max_rating
  }
}

// Test 4: Exhaustive switch with discriminated unions
function testExhaustiveSwitch(field: CustomField): string {
  switch (field.field_type) {
    case 'rating':
      return `Max rating: ${field.config.max_rating}`
    case 'select':
      return `Options: ${field.config.options.join(', ')}`
    case 'text':
      return `Max length: ${field.config.max_length ?? 'unlimited'}`
    case 'boolean':
      return 'Boolean field'
    default:
      // @ts-expect-error - Should never reach here if all cases handled
      const exhaustiveCheck: never = field.field_type
      return exhaustiveCheck
  }
}

// Test 5: FieldConfig union type
const config1: FieldConfig = { max_rating: 5 }
const config2: FieldConfig = { options: ['a'] }
const config3: FieldConfig = { max_length: 500 }
const config4: FieldConfig = {}

// @ts-expect-error - Invalid config shape
const configInvalid: FieldConfig = { invalid: true }

// Export empty object to make this a module
export {}
```

---

## 🧪 Testing Strategy

### Unit Tests (frontend/src/types/__tests__/customFields.test.ts)

**Type Guard Tests (12 tests):**
- `isRatingField` returns true for rating fields, false otherwise (2 tests)
- `isSelectField` returns true for select fields, false otherwise (2 tests)
- `isTextField` returns true for text fields (with/without max_length), false otherwise (3 tests)
- `isBooleanField` returns true for boolean fields, false otherwise (2 tests)
- Type guard exhaustiveness test: each field matches exactly one guard (1 test)
- Type narrowing works correctly in if blocks (2 tests)

**Expected Results:**
- All type guards return correct boolean values
- Type narrowing allows access to type-specific properties
- No TypeScript compilation errors in type guard usage

### Compilation Tests (frontend/src/types/__tests__/customFields.compilation.test.ts)

**Type Inference Tests (5 categories):**
- FieldType literal union accepts only valid values
- Config interfaces enforce correct shapes
- Type guards narrow CustomField to specific config types
- Exhaustive switch statements with discriminated unions
- FieldConfig union accepts all valid config shapes

**Expected Results:**
- Valid code compiles without errors
- Invalid code (marked with `@ts-expect-error`) produces expected errors
- Type narrowing provides IntelliSense for type-specific properties

### Manual Testing

**TypeScript Strict Mode Verification:**
1. Run `npx tsc --noEmit` in frontend directory
2. Expected: No TypeScript errors
3. Verify all types are explicitly defined (no implicit `any`)

**Zod Schema Validation (Optional):**
1. Import Zod schemas in test file
2. Parse valid CustomField object: `CustomFieldSchema.parse(validData)`
3. Expected: Parsing succeeds, returns typed object
4. Parse invalid object with wrong field_type: `CustomFieldSchema.parse({ field_type: 'invalid' })`
5. Expected: Zod throws validation error

**Type Guard Usage in Components:**
1. Create test component using type guards
2. Verify IntelliSense shows correct properties after type narrowing
3. Verify attempting to access wrong properties shows TypeScript error

---

## 📚 Reference

### REF MCP Research Findings

**1. TypeScript Discriminated Unions Best Practices**
- **Source:** Microsoft TypeScript repository test baselines
- **Finding:** Discriminated unions with literal types (`'select' | 'rating'`) provide excellent type narrowing
- **Application:** Using `field_type` as discriminator for `FieldConfig` union enables TypeScript to narrow config shape based on field type
- **Pattern:** Prefer literal unions over enums for better type inference and smaller bundle size

**2. TypeScript Type Guards with Type Testing**
- **Source:** Microsoft TypeScript copilot instructions (type testing patterns)
- **Finding:** Type guards should use predicate return types (`field is Type`) for proper narrowing
- **Application:** Type guards return `field is CustomField & { field_type: 'rating'; config: RatingConfig }`
- **Testing Pattern:** Use both runtime tests (Vitest) and compilation tests (`@ts-expect-error`) to verify type narrowing works correctly

**3. React Query TypeScript Patterns**
- **Source:** TanStack Query TypeScript documentation
- **Finding:** Generic type inference works best when response types are explicitly defined
- **Application:** Define all API response types (`CustomField`, `FieldSchema`, `VideoFieldValue`) to match backend schemas exactly
- **Pattern:** Use type narrowing (type guards) instead of type assertions for safer type handling

**4. Zod Schema Validation vs TypeScript Types**
- **Source:** Zod documentation (zod.dev)
- **Finding:** Zod provides runtime validation that TypeScript can't (API responses, user input)
- **Application:** Define Zod schemas alongside TypeScript types for runtime safety at API boundaries
- **Pattern:** Use `z.infer<typeof Schema>` to derive TypeScript types from Zod schemas for single source of truth
- **Trade-off:** We're defining TypeScript types first (simpler), with optional Zod schemas for runtime validation

**5. Discriminated Union Exhaustiveness Checking**
- **Source:** TypeScript patterns and best practices
- **Finding:** Using `never` type in switch default case catches unhandled discriminated union members at compile time
- **Application:** Exhaustive switch statements in components can safely handle all field types
- **Pattern:** `default: const exhaustiveCheck: never = field.field_type` triggers TypeScript error if case is missing

### Related Documentation

**Backend Schemas:**
- `backend/app/schemas/custom_field.py` - Pydantic validation logic and config validation
- `backend/app/schemas/field_schema.py` - Schema association validation rules
- Lines 19-87 define Literal types, config classes, and validation helpers

**Frontend Type Patterns:**
- `frontend/src/types/tag.ts` - Zod-first approach with `z.infer<>` for type derivation
- `frontend/src/types/video.ts` - Interface-first approach for complex nested types
- `frontend/src/types/list.ts` - Simple interface definitions

**Design Document:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 946-996) - TypeScript types reference
- Section "Frontend Types & Interfaces" outlines expected type structure

### Design Decisions

**1. TypeScript Interfaces vs Zod Schemas (Type-First Approach)**

**Decision:** Define TypeScript interfaces first, with optional Zod schemas for runtime validation.

**Rationale:**
- TypeScript interfaces are simpler to read and maintain for complex nested types
- Zod schemas add ~2KB to bundle size per schema (acceptable for API validation)
- Backend Pydantic schemas are source of truth - TypeScript types mirror them
- Zod useful at API boundaries, but not needed for internal component props

**Alternative Considered:** Zod-first approach (like `tag.ts`)
- Pros: Single source of truth, runtime validation built-in
- Cons: More verbose syntax, harder to add JSDoc comments, larger bundle size
- Why Rejected: CustomField types are more complex than Tag, readability is priority

**Implementation:** Define interfaces for all types, add Zod schemas in step 5 for API validation layer.

---

**2. Discriminated Unions vs Enum for FieldType**

**Decision:** Use string literal union (`'select' | 'rating' | 'text' | 'boolean'`)

**Rationale:**
- Literal unions work better with discriminated union type narrowing
- Enums generate JavaScript code (larger bundle), literals compile away
- JSON serialization matches backend strings directly (no enum conversion)
- Better IntelliSense and error messages with literal types

**Alternative Considered:** TypeScript enum
```typescript
enum FieldType {
  Select = 'select',
  Rating = 'rating',
  Text = 'text',
  Boolean = 'boolean'
}
```
- Pros: Centralized constant values, namespace prevents naming conflicts
- Cons: Generates runtime code, less ergonomic for type narrowing, adds bundle size
- Why Rejected: String literals are TypeScript best practice for discriminated unions

**Implementation:** Define `type FieldType = 'select' | 'rating' | 'text' | 'boolean'` in step 1.

---

**3. Type Guards vs Type Casting**

**Decision:** Use type guard functions (`isRatingField`, etc.) with predicate return types.

**Rationale:**
- Type guards provide runtime safety and compile-time type narrowing
- Type casting (`field as RatingField`) bypasses runtime checks - unsafe
- Type guards centralize type checking logic (DRY principle)
- Better error messages when type guard fails at runtime

**Alternative Considered:** Type assertions everywhere
```typescript
const maxRating = (field as CustomField & { field_type: 'rating' }).config.max_rating
```
- Pros: Less code, no separate functions
- Cons: No runtime safety, verbose syntax, duplicated type assertions
- Why Rejected: Type assertions are considered harmful - use type guards instead

**Implementation:** Define type guard functions in step 4 with comprehensive tests.

---

**4. Config Union Type Structure**

**Decision:** Use type-specific interfaces (`RatingConfig`, `SelectConfig`, etc.) combined in union type.

**Rationale:**
- Separate interfaces provide clear documentation for each config shape
- Union type `FieldConfig = RatingConfig | SelectConfig | ...` enables type narrowing
- Matches backend Pydantic structure (SelectConfig, RatingConfig, etc. classes)
- Allows exhaustive switch statements with proper type narrowing

**Alternative Considered:** Single interface with all optional properties
```typescript
interface FieldConfig {
  options?: string[]
  max_rating?: number
  max_length?: number
}
```
- Pros: Simpler structure, single type
- Cons: No type safety (can't enforce rating has max_rating), allows invalid combinations
- Why Rejected: Loses discriminated union benefits, no compile-time validation

**Implementation:** Define separate config interfaces in step 1, combine in union type.

---

**5. JSDoc Comments Strategy**

**Decision:** Comprehensive JSDoc comments with examples for all public types and functions.

**Rationale:**
- JSDoc provides IntelliSense in VS Code (hover tooltips, autocomplete)
- Examples in JSDoc serve as inline documentation for developers
- `@see` tags link to related backend schemas and API endpoints
- Reduces need to context-switch to backend code or docs

**Alternative Considered:** Minimal comments, rely on type names
- Pros: Less code to maintain, cleaner file
- Cons: No inline documentation, harder for new developers
- Why Rejected: Custom Fields System is complex - documentation is critical

**Implementation:** Add JSDoc to all types, interfaces, and functions in steps 1-4.

---

### Related Code Examples

**Similar Type Guard Pattern:** `frontend/src/types/video.ts`
```typescript
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'
```
- Uses string literal union for status type
- No type guards needed (status doesn't affect other properties)

**Zod Schema Pattern:** `frontend/src/types/tag.ts`
```typescript
export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Tag = z.infer<typeof TagSchema>
```
- Zod-first approach with type inference
- Simpler structure than CustomField (no discriminated unions)

---

## ⏱️ Time Estimate

**Total:** 1.5-2 hours

**Breakdown:**
- Step 1 (Core Types): 20 minutes
- Step 2 (CustomField Interfaces): 15 minutes
- Step 3 (Schema Interfaces): 15 minutes
- Step 4 (Type Guards): 15 minutes
- Step 5 (Zod Schemas): 20 minutes
- Step 6 (Unit Tests): 20 minutes
- Step 7 (Compilation Tests): 15 minutes

**Note:** Type definitions are fast to write. Most time goes to comprehensive JSDoc comments and test coverage.
