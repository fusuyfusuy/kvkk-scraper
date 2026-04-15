import { z } from 'zod';

export const RefreshModeSchema = z.enum(['PAGES', 'DUPLICATES']);
export type RefreshMode = z.infer<typeof RefreshModeSchema>;

export const AppConfigSchema = z.object({
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  smtpFrom: z.string().email(),
  notificationRecipients: z.array(z.string().email()).min(1),
  cronExpression: z.string().min(1).default('0 * * * *'),
  refreshMode: RefreshModeSchema.default('DUPLICATES'),
  refreshMaxPages: z.coerce.number().int().min(1).max(100).default(50),
  refreshMaxConsecutiveDuplicates: z.coerce.number().int().min(1).default(5),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
