import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SseService } from '../sse/sse.service';
import type { Post, ScrapeRunSummary } from '@kvkk/shared';
import * as nodemailer from 'nodemailer';
import { renderBreachEmail } from './email.templates';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sseService: SseService,
  ) {
    this.initTransporter();
  }

  private initTransporter(): void {
    const smtpHost = this.configService.get<string>('smtpHost');
    const smtpPort = this.configService.get<number>('smtpPort');
    const smtpUser = this.configService.get<string>('smtpUser');
    const smtpPass = this.configService.get<string>('smtpPass');

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    this.initTransporter();
  }

  async sendBreachNotification(post: Post, recipient: string): Promise<void> {
    // Validate recipient email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      throw new Error(`Invalid recipient email address: ${recipient}`);
    }

    const smtpFrom = this.configService.get<string>('smtpFrom');

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

    const recipients = this.configService.get<string[]>('notificationRecipients') || [];

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
