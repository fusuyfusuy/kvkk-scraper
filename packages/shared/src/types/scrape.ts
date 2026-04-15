import { z } from 'zod';

export const ScrapeModeSchema = z.enum(['SCHEDULED', 'MANUAL', 'FULL']);
export type ScrapeMode = z.infer<typeof ScrapeModeSchema>;

export const ScrapeStatusSchema = z.enum(['RUNNING', 'SUCCESS', 'FAILED']);
export type ScrapeStatus = z.infer<typeof ScrapeStatusSchema>;

export const PageUrlSchema = z.string().url().brand<'PageUrl'>();
export type PageUrl = z.infer<typeof PageUrlSchema>;

export const PostUrlSchema = z.string().url().brand<'PostUrl'>();
export type PostUrl = z.infer<typeof PostUrlSchema>;

export const HtmlResponseSchema = z.object({
  url: z.string().url(),
  status: z.number().int(),
  headers: z.record(z.string()),
  body: z.string(),
});
export type HtmlResponse = z.infer<typeof HtmlResponseSchema>;

export const ListingPageSchema = z.object({
  pageUrl: z.string().url(),
  pageNumber: z.number().int().min(1),
  postUrls: z.array(PostUrlSchema),
  hasNext: z.boolean(),
});
export type ListingPage = z.infer<typeof ListingPageSchema>;

export const ScrapeRunRequestSchema = z.object({
  mode: ScrapeModeSchema,
  startPage: z.number().int().min(1).default(1),
  maxPages: z.number().int().min(1).max(100).optional(),
  maxConsecutiveDuplicates: z.number().int().min(1).optional(),
});
export type ScrapeRunRequest = z.infer<typeof ScrapeRunRequestSchema>;

export const ScrapeRunContextSchema = z.object({
  runId: z.string().uuid(),
  mode: ScrapeModeSchema,
  currentPage: z.number().int().min(1),
  pagesWalked: z.number().int().min(0),
  postsFound: z.number().int().min(0),
  postsInserted: z.number().int().min(0),
  consecutiveDuplicates: z.number().int().min(0),
  maxPages: z.number().int().min(1),
  maxConsecutiveDuplicates: z.number().int().min(1),
  startedAt: z.coerce.date(),
  pendingPostUrls: z.array(PostUrlSchema),
});
export type ScrapeRunContext = z.infer<typeof ScrapeRunContextSchema>;

export const PageDecisionSchema = z.object({
  action: z.enum(['CONTINUE', 'STOP']),
  nextPageUrl: PageUrlSchema.nullable(),
  reason: z.string(),
});
export type PageDecision = z.infer<typeof PageDecisionSchema>;

export const ScrapeRunSummarySchema = z.object({
  runId: z.string().uuid(),
  mode: ScrapeModeSchema,
  status: ScrapeStatusSchema,
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
  pagesWalked: z.number().int().min(0),
  postsFound: z.number().int().min(0),
  postsInserted: z.number().int().min(0),
  consecutiveDuplicates: z.number().int().min(0),
  error: z.string().nullable(),
});
export type ScrapeRunSummary = z.infer<typeof ScrapeRunSummarySchema>;

export const ScrapeRunSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
  mode: ScrapeModeSchema,
  pagesWalked: z.number().int().min(0),
  postsFound: z.number().int().min(0),
  postsInserted: z.number().int().min(0),
  consecutiveDuplicates: z.number().int().min(0),
  status: ScrapeStatusSchema,
  error: z.string().nullable(),
});
export type ScrapeRun = z.infer<typeof ScrapeRunSchema>;
