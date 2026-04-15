import { z } from 'zod';
import { PostSchema } from './post';

export const PostListResponseSchema = z.object({
  items: z.array(PostSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  unreadCount: z.number().int().min(0),
});
export type PostListResponse = z.infer<typeof PostListResponseSchema>;

export const PostDetailResponseSchema = PostSchema;
export type PostDetailResponse = z.infer<typeof PostDetailResponseSchema>;

export const RefreshResponseSchema = z.object({
  status: z.enum(['accepted', 'already-running']),
  runId: z.string().uuid().nullable(),
});
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const MarkAsReadResponseSchema = z.object({
  post: PostSchema,
  changed: z.boolean(),
});
export type MarkAsReadResponse = z.infer<typeof MarkAsReadResponseSchema>;

export const SseEventSchema = z.object({
  event: z.enum([
    'scrape:started',
    'scrape:completed',
    'scrape:failed',
    'post:created',
    'post:updated',
    'email:sent',
    'email:failed',
  ]),
  data: z.record(z.unknown()),
  timestamp: z.coerce.date(),
});
export type SseEvent = z.infer<typeof SseEventSchema>;

export const UnreadCountResponseSchema = z.object({
  unreadCount: z.number().int().min(0),
});
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;
