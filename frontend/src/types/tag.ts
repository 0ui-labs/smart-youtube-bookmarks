import { z } from 'zod'

/**
 * Zod schema for Tag validation
 * Matches backend API response (UUID and datetime as strings after JSON serialization)
 */
export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
})

/**
 * Tag type inferred from Zod schema
 */
export type Tag = z.infer<typeof TagSchema>

/**
 * Schema for creating a new tag
 */
export const TagCreateSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export type TagCreate = z.infer<typeof TagCreateSchema>

/**
 * Schema for updating a tag
 */
export const TagUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
})

export type TagUpdate = z.infer<typeof TagUpdateSchema>

/**
 * Array schema for validating multiple tags
 */
export const TagsSchema = z.array(TagSchema)
