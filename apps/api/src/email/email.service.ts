import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { Post, ScrapeRunSummary } from '@kvkk/shared';

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // CONTRACT:
  // Send breach notification email for a single post to a single recipient.
  // Input: post (Post from packages/shared/src/types/post.ts), recipient (string email)
  // Output: void
  // Logic:
  //   1. Render breach notification template via Handlebars with EmailTemplateData
  //   2. nodemailer.sendMail({ from, to: recipient, subject, html })
  //   3. On success: prisma.emailDelivery.create({ postId, recipient, subject, status: 'SENT', sentAt })
  //   4. On failure: prisma.emailDelivery.create({ postId, recipient, subject, status: 'FAILED', error })
  //   5. Throw on failure so caller can handle
  async sendBreachNotification(post: Post, recipient: string): Promise<void> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // Email sweep: send emails for all posts with emailSent=false.
  // Input: summary (ScrapeRunSummary from packages/shared/src/types/scrape.ts)
  // Output: ScrapeRunSummary (updated with email results)
  // Logic:
  //   1. prisma.post.findMany({ where: { emailSent: false }, orderBy: { scrapedAt: 'asc' } })
  //   2. For each post:
  //       a. In a DB transaction: sendBreachNotification for each recipient
  //       b. On success: prisma.post.update({ emailSent: true, emailSentAt: now })
  //       c. On failure: log error, emit SSE 'email:failed', continue
  //   3. Return updated summary
  async closeRun(summary: ScrapeRunSummary): Promise<ScrapeRunSummary> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // Log an email send failure to EmailDelivery table.
  // Input: postId (string), recipient (string), subject (string), error (Error)
  // Output: void
  // Logic:
  //   1. prisma.emailDelivery.upsert or create with status='FAILED', error=error.message
  //   2. Log error to console
  async logEmailError(postId: string, recipient: string, subject: string, error: Error): Promise<void> {
    throw new Error('not implemented');
  }
}
