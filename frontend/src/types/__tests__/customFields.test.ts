import { describe, it, expect } from 'vitest'
import {
  FieldTypeSchema,
  SelectConfigSchema,
  RatingConfigSchema,
  TextConfigSchema,
  BooleanConfigSchema,
  CustomFieldSchema,
  CustomFieldCreateSchema,
  CustomFieldUpdateSchema,
  SchemaFieldInputSchema,
  FieldSchemaCreateSchema,
  FieldSchemaUpdateSchema,
  FieldSchemaResponseSchema,
  VideoFieldValueSchema,
  isRatingField,
  isSelectField,
  isTextField,
  isBooleanField,
  type CustomField,
  type FieldType,
  type SelectConfig,
  type RatingConfig,
  type TextConfig,
  type BooleanConfig,
} from '../customFields'

describe('FieldType', () => {
  it('should validate correct field types', () => {
    expect(FieldTypeSchema.parse('select')).toBe('select')
    expect(FieldTypeSchema.parse('rating')).toBe('rating')
    expect(FieldTypeSchema.parse('text')).toBe('text')
    expect(FieldTypeSchema.parse('boolean')).toBe('boolean')
  })

  it('should reject invalid field types', () => {
    expect(() => FieldTypeSchema.parse('invalid')).toThrow()
    expect(() => FieldTypeSchema.parse('')).toThrow()
    expect(() => FieldTypeSchema.parse(123)).toThrow()
  })
})

describe('SelectConfig', () => {
  it('should validate correct select config', () => {
    const config = { options: ['bad', 'good', 'great'] }
    expect(SelectConfigSchema.parse(config)).toEqual(config)
  })

  it('should validate single option', () => {
    const config = { options: ['only-option'] }
    expect(SelectConfigSchema.parse(config)).toEqual(config)
  })

  it('should reject empty options array', () => {
    expect(() => SelectConfigSchema.parse({ options: [] })).toThrow()
  })

  it('should reject missing options', () => {
    expect(() => SelectConfigSchema.parse({})).toThrow()
  })

  it('should reject empty string options', () => {
    expect(() => SelectConfigSchema.parse({ options: ['', 'valid'] })).toThrow()
  })
})

describe('RatingConfig', () => {
  it('should validate correct rating config', () => {
    const config = { max_rating: 5 }
    expect(RatingConfigSchema.parse(config)).toEqual(config)
  })

  it('should validate min boundary (1)', () => {
    const config = { max_rating: 1 }
    expect(RatingConfigSchema.parse(config)).toEqual(config)
  })

  it('should validate max boundary (10)', () => {
    const config = { max_rating: 10 }
    expect(RatingConfigSchema.parse(config)).toEqual(config)
  })

  it('should reject max_rating below 1', () => {
    expect(() => RatingConfigSchema.parse({ max_rating: 0 })).toThrow()
    expect(() => RatingConfigSchema.parse({ max_rating: -1 })).toThrow()
  })

  it('should reject max_rating above 10', () => {
    expect(() => RatingConfigSchema.parse({ max_rating: 11 })).toThrow()
    expect(() => RatingConfigSchema.parse({ max_rating: 20 })).toThrow()
  })

  it('should reject missing max_rating', () => {
    expect(() => RatingConfigSchema.parse({})).toThrow()
  })

  it('should reject non-integer max_rating', () => {
    expect(() => RatingConfigSchema.parse({ max_rating: 5.5 })).toThrow()
  })
})

describe('TextConfig', () => {
  it('should validate text config with max_length', () => {
    const config = { max_length: 500 }
    expect(TextConfigSchema.parse(config)).toEqual(config)
  })

  it('should validate text config without max_length', () => {
    const config = {}
    expect(TextConfigSchema.parse(config)).toEqual(config)
  })

  it('should validate min max_length (1)', () => {
    const config = { max_length: 1 }
    expect(TextConfigSchema.parse(config)).toEqual(config)
  })

  it('should reject max_length below 1', () => {
    expect(() => TextConfigSchema.parse({ max_length: 0 })).toThrow()
    expect(() => TextConfigSchema.parse({ max_length: -1 })).toThrow()
  })

  it('should reject non-integer max_length', () => {
    expect(() => TextConfigSchema.parse({ max_length: 5.5 })).toThrow()
  })
})

describe('BooleanConfig', () => {
  it('should validate empty boolean config', () => {
    const config = {}
    expect(BooleanConfigSchema.parse(config)).toEqual(config)
  })

  it('should reject non-empty config', () => {
    expect(() => BooleanConfigSchema.parse({ foo: 'bar' })).toThrow()
  })
})

describe('CustomFieldSchema', () => {
  it('should validate rating field with matching config', () => {
    const field = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      list_id: '987fcdeb-51a2-43d1-9012-345678901234',
      name: 'Overall Rating',
      field_type: 'rating' as const,
      config: { max_rating: 5 },
      created_at: '2025-11-06T10:30:00Z',
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(CustomFieldSchema.parse(field)).toEqual(field)
  })

  it('should validate select field with matching config', () => {
    const field = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      list_id: '987fcdeb-51a2-43d1-9012-345678901234',
      name: 'Presentation Quality',
      field_type: 'select' as const,
      config: { options: ['bad', 'good', 'great'] },
      created_at: '2025-11-06T10:30:00Z',
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(CustomFieldSchema.parse(field)).toEqual(field)
  })

  it('should validate text field with matching config', () => {
    const field = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      list_id: '987fcdeb-51a2-43d1-9012-345678901234',
      name: 'Notes',
      field_type: 'text' as const,
      config: { max_length: 500 },
      created_at: '2025-11-06T10:30:00Z',
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(CustomFieldSchema.parse(field)).toEqual(field)
  })

  it('should validate boolean field with empty config', () => {
    const field = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      list_id: '987fcdeb-51a2-43d1-9012-345678901234',
      name: 'Recommended',
      field_type: 'boolean' as const,
      config: {},
      created_at: '2025-11-06T10:30:00Z',
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(CustomFieldSchema.parse(field)).toEqual(field)
  })

  it('should reject rating field with select config (REF MCP Improvement #2)', () => {
    const field = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      list_id: '987fcdeb-51a2-43d1-9012-345678901234',
      name: 'Overall Rating',
      field_type: 'rating' as const,
      config: { options: ['bad', 'good'] }, // Wrong config type
      created_at: '2025-11-06T10:30:00Z',
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(() => CustomFieldSchema.parse(field)).toThrow('Config shape must match field_type')
  })

  it('should reject select field with rating config (REF MCP Improvement #2)', () => {
    const field = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      list_id: '987fcdeb-51a2-43d1-9012-345678901234',
      name: 'Presentation Quality',
      field_type: 'select' as const,
      config: { max_rating: 5 }, // Wrong config type
      created_at: '2025-11-06T10:30:00Z',
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(() => CustomFieldSchema.parse(field)).toThrow('Config shape must match field_type')
  })

  it('should reject invalid UUID for id', () => {
    const field = {
      id: 'not-a-uuid',
      list_id: '987fcdeb-51a2-43d1-9012-345678901234',
      name: 'Overall Rating',
      field_type: 'rating' as const,
      config: { max_rating: 5 },
      created_at: '2025-11-06T10:30:00Z',
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(() => CustomFieldSchema.parse(field)).toThrow()
  })

  it('should reject name longer than 255 characters', () => {
    const field = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      list_id: '987fcdeb-51a2-43d1-9012-345678901234',
      name: 'a'.repeat(256),
      field_type: 'rating' as const,
      config: { max_rating: 5 },
      created_at: '2025-11-06T10:30:00Z',
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(() => CustomFieldSchema.parse(field)).toThrow()
  })
})

describe('CustomFieldCreateSchema', () => {
  it('should validate rating field creation', () => {
    const request = {
      name: 'Overall Rating',
      field_type: 'rating' as const,
      config: { max_rating: 5 },
    }
    expect(CustomFieldCreateSchema.parse(request)).toEqual(request)
  })

  it('should validate select field creation', () => {
    const request = {
      name: 'Presentation Quality',
      field_type: 'select' as const,
      config: { options: ['bad', 'good', 'great'] },
    }
    expect(CustomFieldCreateSchema.parse(request)).toEqual(request)
  })

  it('should reject mismatched field_type and config', () => {
    const request = {
      name: 'Overall Rating',
      field_type: 'rating' as const,
      config: { options: ['bad', 'good'] }, // Wrong config type
    }
    expect(() => CustomFieldCreateSchema.parse(request)).toThrow('Config shape must match field_type')
  })

  it('should reject empty name', () => {
    const request = {
      name: '',
      field_type: 'rating' as const,
      config: { max_rating: 5 },
    }
    expect(() => CustomFieldCreateSchema.parse(request)).toThrow()
  })
})

describe('CustomFieldUpdateSchema', () => {
  it('should validate name-only update', () => {
    const request = { name: 'Updated Field Name' }
    expect(CustomFieldUpdateSchema.parse(request)).toEqual(request)
  })

  it('should validate full update with matching field_type and config', () => {
    const request = {
      name: 'Overall Rating',
      field_type: 'rating' as const,
      config: { max_rating: 10 },
    }
    expect(CustomFieldUpdateSchema.parse(request)).toEqual(request)
  })

  it('should validate partial update (config only)', () => {
    const request = {
      config: { max_rating: 10 },
    }
    expect(CustomFieldUpdateSchema.parse(request)).toEqual(request)
  })

  it('should validate partial update (field_type only)', () => {
    const request = {
      field_type: 'rating' as const,
    }
    expect(CustomFieldUpdateSchema.parse(request)).toEqual(request)
  })

  it('should reject mismatched field_type and config when both present', () => {
    const request = {
      field_type: 'rating' as const,
      config: { options: ['bad', 'good'] }, // Wrong config type
    }
    expect(() => CustomFieldUpdateSchema.parse(request)).toThrow('Config shape must match field_type')
  })

  it('should validate empty update (all fields optional)', () => {
    const request = {}
    expect(CustomFieldUpdateSchema.parse(request)).toEqual(request)
  })
})

describe('SchemaFieldInputSchema', () => {
  it('should validate correct schema field input', () => {
    const input = {
      field_id: '123e4567-e89b-12d3-a456-426614174000',
      display_order: 0,
      show_on_card: true,
    }
    expect(SchemaFieldInputSchema.parse(input)).toEqual(input)
  })

  it('should reject negative display_order', () => {
    const input = {
      field_id: '123e4567-e89b-12d3-a456-426614174000',
      display_order: -1,
      show_on_card: true,
    }
    expect(() => SchemaFieldInputSchema.parse(input)).toThrow()
  })

  it('should reject invalid UUID for field_id', () => {
    const input = {
      field_id: 'not-a-uuid',
      display_order: 0,
      show_on_card: true,
    }
    expect(() => SchemaFieldInputSchema.parse(input)).toThrow()
  })
})

describe('FieldSchemaCreateSchema', () => {
  it('should validate schema creation with fields', () => {
    const request = {
      name: 'Video Quality',
      description: 'Standard quality metrics',
      fields: [
        {
          field_id: '123e4567-e89b-12d3-a456-426614174000',
          display_order: 0,
          show_on_card: true,
        },
        {
          field_id: '223e4567-e89b-12d3-a456-426614174001',
          display_order: 1,
          show_on_card: true,
        },
      ],
    }
    expect(FieldSchemaCreateSchema.parse(request)).toEqual(request)
  })

  it('should validate schema creation without fields', () => {
    const request = {
      name: 'Video Quality',
      description: 'Standard quality metrics',
    }
    expect(FieldSchemaCreateSchema.parse(request)).toEqual(request)
  })

  it('should reject more than 3 fields with show_on_card=true', () => {
    const request = {
      name: 'Video Quality',
      fields: [
        { field_id: '111e4567-e89b-12d3-a456-426614174000', display_order: 0, show_on_card: true },
        { field_id: '222e4567-e89b-12d3-a456-426614174001', display_order: 1, show_on_card: true },
        { field_id: '333e4567-e89b-12d3-a456-426614174002', display_order: 2, show_on_card: true },
        { field_id: '444e4567-e89b-12d3-a456-426614174003', display_order: 3, show_on_card: true }, // 4th field
      ],
    }
    expect(() => FieldSchemaCreateSchema.parse(request)).toThrow('At most 3 fields can have show_on_card=true')
  })

  it('should validate exactly 3 fields with show_on_card=true', () => {
    const request = {
      name: 'Video Quality',
      fields: [
        { field_id: '111e4567-e89b-12d3-a456-426614174000', display_order: 0, show_on_card: true },
        { field_id: '222e4567-e89b-12d3-a456-426614174001', display_order: 1, show_on_card: true },
        { field_id: '333e4567-e89b-12d3-a456-426614174002', display_order: 2, show_on_card: true },
      ],
    }
    expect(FieldSchemaCreateSchema.parse(request)).toEqual(request)
  })

  it('should reject duplicate display_order values', () => {
    const request = {
      name: 'Video Quality',
      fields: [
        { field_id: '123e4567-e89b-12d3-a456-426614174000', display_order: 0, show_on_card: true },
        { field_id: '223e4567-e89b-12d3-a456-426614174001', display_order: 0, show_on_card: true }, // Duplicate
      ],
    }
    expect(() => FieldSchemaCreateSchema.parse(request)).toThrow('Duplicate display_order values found')
  })

  it('should reject duplicate field_id values', () => {
    const request = {
      name: 'Video Quality',
      fields: [
        { field_id: '123e4567-e89b-12d3-a456-426614174000', display_order: 0, show_on_card: true },
        { field_id: '123e4567-e89b-12d3-a456-426614174000', display_order: 1, show_on_card: true }, // Duplicate
      ],
    }
    expect(() => FieldSchemaCreateSchema.parse(request)).toThrow('Duplicate field_id values found')
  })

  it('should reject name longer than 255 characters', () => {
    const request = {
      name: 'a'.repeat(256),
    }
    expect(() => FieldSchemaCreateSchema.parse(request)).toThrow()
  })

  it('should reject description longer than 1000 characters', () => {
    const request = {
      name: 'Video Quality',
      description: 'a'.repeat(1001),
    }
    expect(() => FieldSchemaCreateSchema.parse(request)).toThrow()
  })
})

describe('FieldSchemaUpdateSchema', () => {
  it('should validate name-only update', () => {
    const request = { name: 'Updated Video Quality' }
    expect(FieldSchemaUpdateSchema.parse(request)).toEqual(request)
  })

  it('should validate description-only update', () => {
    const request = { description: 'Updated description' }
    expect(FieldSchemaUpdateSchema.parse(request)).toEqual(request)
  })

  it('should validate both name and description update', () => {
    const request = {
      name: 'Tutorial Evaluation',
      description: 'Comprehensive tutorial assessment criteria',
    }
    expect(FieldSchemaUpdateSchema.parse(request)).toEqual(request)
  })

  it('should validate empty update (all fields optional)', () => {
    const request = {}
    expect(FieldSchemaUpdateSchema.parse(request)).toEqual(request)
  })

  it('should reject empty name', () => {
    const request = { name: '' }
    expect(() => FieldSchemaUpdateSchema.parse(request)).toThrow()
  })
})

describe('VideoFieldValueSchema', () => {
  it('should validate rating field value (value_numeric)', () => {
    const value = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      video_id: '987fcdeb-51a2-43d1-9012-345678901234',
      field_id: '111e4567-e89b-12d3-a456-426614174000',
      value_text: null,
      value_numeric: 4.5,
      value_boolean: null,
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(VideoFieldValueSchema.parse(value)).toEqual(value)
  })

  it('should validate select field value (value_text)', () => {
    const value = {
      id: '223e4567-e89b-12d3-a456-426614174001',
      video_id: '987fcdeb-51a2-43d1-9012-345678901234',
      field_id: '222e4567-e89b-12d3-a456-426614174001',
      value_text: 'great',
      value_numeric: null,
      value_boolean: null,
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(VideoFieldValueSchema.parse(value)).toEqual(value)
  })

  it('should validate boolean field value (value_boolean)', () => {
    const value = {
      id: '323e4567-e89b-12d3-a456-426614174002',
      video_id: '987fcdeb-51a2-43d1-9012-345678901234',
      field_id: '333e4567-e89b-12d3-a456-426614174002',
      value_text: null,
      value_numeric: null,
      value_boolean: true,
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(VideoFieldValueSchema.parse(value)).toEqual(value)
  })

  it('should reject invalid UUID for id', () => {
    const value = {
      id: 'not-a-uuid',
      video_id: '987fcdeb-51a2-43d1-9012-345678901234',
      field_id: '111e4567-e89b-12d3-a456-426614174000',
      value_text: null,
      value_numeric: 4.5,
      value_boolean: null,
      updated_at: '2025-11-06T10:30:00Z',
    }
    expect(() => VideoFieldValueSchema.parse(value)).toThrow()
  })
})

describe('Type Guards', () => {
  describe('isRatingField', () => {
    it('should return true for rating fields', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z',
      }
      expect(isRatingField(field)).toBe(true)

      // Type narrowing test (compile-time check)
      if (isRatingField(field)) {
        // Should be able to access max_rating without type error
        expect(field.config.max_rating).toBe(5)
      }
    })

    it('should return false for non-rating fields', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Presentation Quality',
        field_type: 'select',
        config: { options: ['bad', 'good', 'great'] },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z',
      }
      expect(isRatingField(field)).toBe(false)
    })
  })

  describe('isSelectField', () => {
    it('should return true for select fields', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Presentation Quality',
        field_type: 'select',
        config: { options: ['bad', 'good', 'great'] },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z',
      }
      expect(isSelectField(field)).toBe(true)

      // Type narrowing test (compile-time check)
      if (isSelectField(field)) {
        // Should be able to access options without type error
        expect(field.config.options).toEqual(['bad', 'good', 'great'])
      }
    })

    it('should return false for non-select fields', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z',
      }
      expect(isSelectField(field)).toBe(false)
    })
  })

  describe('isTextField', () => {
    it('should return true for text fields', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Notes',
        field_type: 'text',
        config: { max_length: 500 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z',
      }
      expect(isTextField(field)).toBe(true)

      // Type narrowing test (compile-time check)
      if (isTextField(field)) {
        // Should be able to access max_length without type error
        expect(field.config.max_length).toBe(500)
      }
    })

    it('should return false for non-text fields', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z',
      }
      expect(isTextField(field)).toBe(false)
    })
  })

  describe('isBooleanField', () => {
    it('should return true for boolean fields', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Recommended',
        field_type: 'boolean',
        config: {},
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z',
      }
      expect(isBooleanField(field)).toBe(true)
    })

    it('should return false for non-boolean fields', () => {
      const field: CustomField = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        list_id: '987fcdeb-51a2-43d1-9012-345678901234',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-11-06T10:30:00Z',
        updated_at: '2025-11-06T10:30:00Z',
      }
      expect(isBooleanField(field)).toBe(false)
    })
  })
})
