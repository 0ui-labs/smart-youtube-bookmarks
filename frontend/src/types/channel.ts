import { z } from 'zod'

/**
 * Zod schema for Channel validation
 * Matches backend API response (UUID and datetime as strings after JSON serialization)
 */
export const ChannelSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  youtube_channel_id: z.string(),
  name: z.string(),
  thumbnail_url: z.string().nullable(),
  description: z.string().nullable(),
  is_hidden: z.boolean(),
  video_count: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
})

/**
 * Channel type inferred from Zod schema
 */
export type Channel = z.infer<typeof ChannelSchema>

/**
 * Schema for updating a channel (only is_hidden can be changed)
 */
export const ChannelUpdateSchema = z.object({
  is_hidden: z.boolean().optional(),
})

export type ChannelUpdate = z.infer<typeof ChannelUpdateSchema>

/**
 * Array schema for validating multiple channels
 */
export const ChannelsSchema = z.array(ChannelSchema)
