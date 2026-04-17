import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SseService } from '../sse/sse.service';
import { RuntimeConfigService, CONFIG_CHANGED_EVENT } from '../settings/runtime-config.service';
import type { Post, ScrapeRunSummary } from '@kvkk/shared';
import * as nodemailer from 'nodemailer';
import { renderBreachEmail } from './email.templates';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: RuntimeConfigService,
    private readonly sseService: SseService,
  ) {}

  private initTransporter(): void {
    const c = this.runtime.getCurrent();
    if (!c) return;
    this.transporter = nodemailer.createTransport({
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpPort === 465,
      auth: c.smtpUser
        ? { user: c.smtpUser, pass: c.smtpPass }
        : undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    this.initTransporter();
  }

  @OnEvent(CONFIG_CHANGED_EVENT)
  handleConfigChanged(): void {
    this.initTransporter();
  }

  async sendTestEmail(recipient: string): Promise<void> {
    if (!this.transporter) this.initTransporter();
    const c = this.runtime.getCurrent();
    await this.transporter!.sendMail({
      from: c.smtpFrom,
      to: recipient,
      subject: 'KVKK Takip — test email',
      text: 'This is a test email from the KVKK Takip admin panel.',
      html: '<p>This is a test email from the <strong>KVKK Takip</strong> admin panel.</p>',
    });
  }

  async sendBreachNotification(post: Post, recipient: string): Promise<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      throw new Error(`Invalid recipient email address: ${recipient}`);
    }

    const smtpFrom = this.runtime.getCurrent().smtpFrom;

    const emailData = {
      title: post.title,
      publicationDate: post.publicationDate,
      incidentDate: post.incidentDate,
      sourceUrl: post.sourceUrl,
      bodyExcerpt: post.content,
    };

    const { subject, html, text } = renderBreachEmail(emailData);

    try {
      await this.transporter!.sendMail({
        from: smtpFrom,
        to: recipient,
        subject,
        html,
        text,
      });

      await this.prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
        await tx.emailDelivery.create({
          data: {
            postId: post.id,
            recipient,
            subject,
            status: 'SENT',
            sentAt: new Date(),
          },
        });

        await tx.post.update({
          where: { id: post.id },
          data: {
            emailSent: true,
            emailSentAt: new Date(),
          },
        });
      });

      this.sseService.emit({
        event: 'email:sent',
        data: { postId: post.id, recipient },
        timestamp: new Date(),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      await this.prisma.emailDelivery.create({
        data: {
          postId: post.id,
          recipient,
          subject,
          status: 'FAILED',
          error: err.message,
        },
      });

      throw err;
    }
  }

  async sweepAndSend(summary: ScrapeRunSummary): Promise<ScrapeRunSummary> {
    const posts = await this.prisma.post.findMany({
      where: { emailSent: false },
      orderBy: { scrapedAt: 'asc' },
    });

    const recipients = this.runtime.getCurrent().notificationRecipients;

    for (const post of posts) {
      for (const recipient of recipients) {
        try {
          await this.sendBreachNotification(post as Post, recipient);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));

          await this.logEmailError(post.id, recipient, '', err);

          this.sseService.emit({
            event: 'email:failed',
            data: {
              postId: String(post.id),
              recipient,
              error: err.message,
            },
            timestamp: new Date(),
          });
        }
      }
    }

    return summary;
  }

  async logEmailError(
    postId: number | string,
    recipient: string,
    subject: string,
    error: Error,
  ): Promise<void> {
    console.error(
      `Email send failed - postId: ${postId}, recipient: ${recipient}, error: ${error.message}`,
    );

    try {
      await this.prisma.emailDelivery.create({
        data: {
          postId: typeof postId === 'string' ? parseInt(postId, 10) : postId,
          recipient,
          subject: subject || 'Unknown Subject',
          status: 'FAILED',
          error: error.message,
        },
      });
    } catch (dbError) {
      console.error(`Failed to log email error to database: ${dbError}`);
    }
  }
}
