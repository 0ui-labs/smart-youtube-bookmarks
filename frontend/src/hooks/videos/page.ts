import { z } from "zod";
import { VideoResponseSchema } from "@/types/video";

export const VideoPageSchema = z.object({
  items: z.array(VideoResponseSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
});
export type VideoPage = z.infer<typeof VideoPageSchema>;
