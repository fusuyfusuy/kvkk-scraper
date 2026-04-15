import { z } from 'zod';

export const EmailStatusSchema = z.enum(['PENDING', 'SENT', 'FAILED']);
export type EmailStatus = z.infer<typeof EmailStatusSchema>;

export const EmailDeliverySchema = z.object({
  id: z.number().int(),
  postId: z.number().int(),
  recipient: z.string().email(),
  subject: z.string().min(1),
  status: EmailStatusSchema,
  sentAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
});
export type EmailDelivery = z.infer<typeof EmailDeliverySchema>;

export const EmailTemplateDataSchema = z.object({
  title: z.string(),
  publicationDate: z.coerce.date().nullable(),
  incidentDate: z.coerce.date().nullable(),
  sourceUrl: z.string().url(),
  bodyExcerpt: z.string(),
});
export type EmailTemplateData = z.infer<typeof EmailTemplateDataSchema>;
