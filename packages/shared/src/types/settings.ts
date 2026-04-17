import { z } from 'zod';
import { RefreshModeSchema } from './config';

export const AppConfigPatchSchema = z.object({
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email().optional(),
  notificationRecipients: z.array(z.string().email()).optional(),
  cronExpression: z.string().min(1).optional(),
  refreshMode: RefreshModeSchema.optional(),
  refreshMaxPages: z.coerce.number().int().min(1).max(100).optional(),
  refreshMaxConsecutiveDuplicates: z.coerce.number().int().min(1).optional(),
});
export type AppConfigPatch = z.infer<typeof AppConfigPatchSchema>;

export const SettingsResponseSchema = z.object({
  smtpHost: z.string(),
  smtpPort: z.number(),
  smtpUser: z.string(),
  smtpPass: z.null(),
  smtpPassSet: z.boolean(),
  smtpFrom: z.string(),
  notificationRecipients: z.array(z.string()),
  cronExpression: z.string(),
  refreshMode: RefreshModeSchema,
  refreshMaxPages: z.number(),
  refreshMaxConsecutiveDuplicates: z.number(),
});
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

export const TestMailRequestSchema = z.object({
  recipient: z.string().email(),
});
export type TestMailRequest = z.infer<typeof TestMailRequestSchema>;

export const StatsResponseSchema = z.object({
  totalPosts: z.number().int(),
  postsThisWeek: z.number().int(),
  unreadCount: z.number().int(),
  lastRunAt: z.coerce.date().nullable(),
  lastRunStatus: z.string().nullable(),
  successRate30d: z.number(),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;

export const EmailDeliveryRowSchema = z.object({
  id: z.number().int(),
  postId: z.number().int(),
  postTitle: z.string(),
  recipient: z.string(),
  subject: z.string(),
  status: z.string(),
  sentAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
});
export type EmailDeliveryRow = z.infer<typeof EmailDeliveryRowSchema>;

export const EmailDeliveryListResponseSchema = z.object({
  items: z.array(EmailDeliveryRowSchema),
});
export type EmailDeliveryListResponse = z.infer<typeof EmailDeliveryListResponseSchema>;
