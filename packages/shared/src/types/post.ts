import { z } from 'zod';

export const PostSchema = z.object({
  id: z.number().int(),
  sourceUrl: z.string().url(),
  title: z.string().min(1),
  content: z.string(),
  publicationDate: z.coerce.date().nullable(),
  incidentDate: z.coerce.date().nullable(),
  scrapedAt: z.coerce.date(),
  read: z.boolean().default(false),
  emailSent: z.boolean().default(false),
  emailSentAt: z.coerce.date().nullable(),
});
export type Post = z.infer<typeof PostSchema>;

export const PostInputSchema = PostSchema.omit({
  id: true,
  scrapedAt: true,
  read: true,
  emailSent: true,
  emailSentAt: true,
});
export type PostInput = z.infer<typeof PostInputSchema>;

export const PostListQuerySchema = z.object({
  search: z.string().optional(),
  company: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().optional(),
});
export type PostListQuery = z.infer<typeof PostListQuerySchema>;

export const ParsedPostSchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string(),
  content: z.string(),
  publicationDate: z.coerce.date().nullable(),
  incidentDate: z.coerce.date().nullable(),
});
export type ParsedPost = z.infer<typeof ParsedPostSchema>;

export const DuplicateCheckResultSchema = z.object({
  sourceUrl: z.string().url(),
  isDuplicate: z.boolean(),
  existingPostId: z.number().int().nullable(),
});
export type DuplicateCheckResult = z.infer<typeof DuplicateCheckResultSchema>;
