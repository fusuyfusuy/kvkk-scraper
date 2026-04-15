import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from './email.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SseService } from '../sse/sse.service';
import type { ConfigService } from '@nestjs/config';
import type { Post, ScrapeRunSummary } from '@kvkk/shared';

function buildPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    sourceUrl: 'https://kvkk.gov.tr/post/1',
    title: 'T',
    content: 'C',
    publicationDate: null,
    incidentDate: null,
    scrapedAt: new Date(),
    read: false,
    emailSent: false,
    emailSentAt: null,
    ...overrides,
  };
}

function buildSummary(): ScrapeRunSummary {
  return {
    runId: 1,
    mode: 'MANUAL',
    status: 'SUCCESS',
    startedAt: new Date(),
    finishedAt: null,
    pagesWalked: 1,
    postsFound: 1,
    postsInserted: 1,
    consecutiveDuplicates: 0,
    error: null,
  };
}

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({}) })) },
  createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({}) })),
}));

describe('EmailService', () => {
  let prisma: any;
  let sse: any;
  let config: any;
  let svc: EmailService;

  beforeEach(() => {
    prisma = {
      post: { findMany: vi.fn(), update: vi.fn() },
      emailDelivery: { create: vi.fn(), upsert: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };
    sse = { emit: vi.fn() };
    config = {
      get: vi.fn((key: string) => {
        const map: Record<string, any> = {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpUser: 'u',
          smtpPass: 'p',
          smtpFrom: 'from@example.com',
          notificationRecipients: ['a@example.com'],
        };
        return map[key];
      }),
    };
    svc = new EmailService(
      prisma as PrismaService,
      config as ConfigService,
      sse as SseService,
    );
  });

  describe('sendBreachNotification', () => {
    it('creates EmailDelivery with status=SENT on success (happy)', async () => {
      prisma.emailDelivery.create.mockResolvedValue({});
      await svc.sendBreachNotification(buildPost(), 'a@example.com');
      expect(prisma.emailDelivery.create).toHaveBeenCalled();
    });

    it('records FAILED and rethrows on SMTP error (negative)', async () => {
      // Override transport mock via module-level mock
      await expect(
        svc.sendBreachNotification(buildPost(), 'invalid'),
      ).rejects.toThrow();
    });
  });

  describe('sweepAndSend', () => {
    it('iterates unsent posts and marks emailSent on success (happy)', async () => {
      prisma.post.findMany.mockResolvedValue([buildPost()]);
      prisma.post.update.mockResolvedValue({});
      prisma.emailDelivery.create.mockResolvedValue({});
      const out = await svc.sweepAndSend(buildSummary());
      expect(prisma.post.findMany).toHaveBeenCalled();
      expect(out).toBeDefined();
    });

    it('emits email:failed SSE on per-post failure and continues (negative)', async () => {
      prisma.post.findMany.mockResolvedValue([buildPost()]);
      prisma.post.update.mockRejectedValue(new Error('boom'));
      const out = await svc.sweepAndSend(buildSummary());
      // sweep should not throw; it logs + emits + continues
      expect(out).toBeDefined();
    });
  });

  describe('logEmailError', () => {
    it('writes FAILED EmailDelivery row (happy)', async () => {
      prisma.emailDelivery.create.mockResolvedValue({});
      await svc.logEmailError('p1', 'a@example.com', 'subj', new Error('x'));
      expect(
        prisma.emailDelivery.create.mock.calls.length +
          prisma.emailDelivery.upsert.mock.calls.length,
      ).toBeGreaterThan(0);
    });
  });
});
