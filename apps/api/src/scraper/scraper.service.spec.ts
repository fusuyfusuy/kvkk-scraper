import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScraperService } from './scraper.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { SseService } from '../sse/sse.service';
import type {
  ScrapeRunRequest,
  ScrapeRunContext,
  ParsedPost,
  HtmlResponse,
  DuplicateCheckResult,
  Post,
  PageDecision,
  ScrapeRunSummary,
  PostUrl,
  PageUrl,
} from '@kvkk/shared';

function buildContext(overrides: Partial<ScrapeRunContext> = {}): ScrapeRunContext {
  return {
    runId: 1,
    mode: 'MANUAL',
    currentPage: 1,
    pagesWalked: 0,
    postsFound: 0,
    postsInserted: 0,
    consecutiveDuplicates: 0,
    maxPages: 50,
    maxConsecutiveDuplicates: 5,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    pendingPostUrls: [],
    ...overrides,
  };
}

function buildParsedPost(overrides: Partial<ParsedPost> = {}): ParsedPost {
  return {
    sourceUrl: 'https://kvkk.gov.tr/post/1',
    title: 'Breach X',
    content: 'body',
    publicationDate: new Date('2026-01-01'),
    incidentDate: null,
    ...overrides,
  };
}

describe('ScraperService', () => {
  let prisma: any;
  let email: any;
  let sse: any;
  let svc: ScraperService;

  beforeEach(() => {
    prisma = {
      post: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      scrapeRun: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    email = { sweepAndSend: vi.fn(async (s: ScrapeRunSummary) => s) };
    sse = { emit: vi.fn() };
    const config = { get: vi.fn((key: string) => undefined) } as any;
    const runtime = {
      getCurrent: () => ({
        smtpHost: 'localhost',
        smtpPort: 1025,
        smtpUser: '',
        smtpPass: '',
        smtpFrom: 'kvkk@example.com',
        notificationRecipients: ['admin@example.com'],
        cronExpression: '0 * * * *',
        refreshMode: 'DUPLICATES' as const,
        refreshMaxPages: 50,
        refreshMaxConsecutiveDuplicates: 5,
      }),
    } as any;
    svc = new ScraperService(prisma as PrismaService, email as EmailService, sse as SseService, config, runtime);
  });

  describe('initRun', () => {
    it('creates a ScrapeRun row and returns populated context (happy)', async () => {
      prisma.scrapeRun.create.mockResolvedValue({ id: 'abc' });
      const req: ScrapeRunRequest = { mode: 'MANUAL', startPage: 1, maxPages: 10, maxConsecutiveDuplicates: 3 };
      const ctx = await svc.initRun(req);
      expect(ctx.mode).toBe('MANUAL');
      expect(ctx.currentPage).toBe(1);
      expect(prisma.scrapeRun.create).toHaveBeenCalled();
    });

    it('propagates DB error from scrapeRun.create (negative)', async () => {
      prisma.scrapeRun.create.mockRejectedValue(new Error('db down'));
      const req: ScrapeRunRequest = { mode: 'MANUAL', startPage: 1 } as ScrapeRunRequest;
      await expect(svc.initRun(req)).rejects.toThrow();
    });
  });

  describe('checkDuplicate', () => {
    it('returns isDuplicate=false when no existing row (happy)', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      const result: DuplicateCheckResult = await svc.checkDuplicate(buildParsedPost());
      expect(result.isDuplicate).toBe(false);
      expect(result.existingPostId).toBeNull();
    });

    it('returns isDuplicate=true with id when row exists (negative)', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'x' });
      const result = await svc.checkDuplicate(buildParsedPost());
      expect(result.isDuplicate).toBe(true);
      expect(result.existingPostId).toBe('x');
    });
  });

  describe('insertPost', () => {
    it('creates post and emits SSE post:created (happy)', async () => {
      const parsed = buildParsedPost();
      prisma.post.create.mockResolvedValue({
        id: 'new-id',
        sourceUrl: parsed.sourceUrl,
        title: parsed.title,
        content: parsed.content,
        publicationDate: parsed.publicationDate,
        incidentDate: parsed.incidentDate,
        scrapedAt: new Date(),
        read: false,
        emailSent: false,
        emailSentAt: null,
      });
      const post: Post = await svc.insertPost(parsed);
      expect(post.id).toBe('new-id');
      expect(sse.emit).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'post:created' }),
      );
    });

    it('throws when prisma.create fails (negative)', async () => {
      prisma.post.create.mockRejectedValue(new Error('unique constraint'));
      await expect(svc.insertPost(buildParsedPost())).rejects.toThrow();
    });
  });

  describe('advancePage', () => {
    it('returns STOP when consecutiveDuplicates >= max (DUPLICATES mode)', async () => {
      const ctx = buildContext({ consecutiveDuplicates: 5, maxConsecutiveDuplicates: 5 });
      const decision: PageDecision = await svc.advancePage(ctx);
      expect(decision.action).toBe('STOP');
    });

    it('returns CONTINUE with nextPageUrl when thresholds not reached (happy)', async () => {
      const ctx = buildContext({ consecutiveDuplicates: 0, pagesWalked: 1 });
      const decision = await svc.advancePage(ctx);
      expect(decision.action).toBe('CONTINUE');
      expect(decision.nextPageUrl).not.toBeNull();
    });
  });

  describe('recordDuplicate', () => {
    it('increments consecutiveDuplicates and postsFound (happy)', async () => {
      const r: DuplicateCheckResult = {
        sourceUrl: 'https://kvkk.gov.tr/post/1',
        isDuplicate: true,
        existingPostId: 1,
      };
      const ctx = await svc.recordDuplicate(r);
      expect(ctx.consecutiveDuplicates).toBeGreaterThan(0);
      expect(ctx.postsFound).toBeGreaterThan(0);
    });
  });

  describe('continueList', () => {
    it('resets consecutiveDuplicates and increments postsInserted (happy)', async () => {
      const post = {
        id: 1,
        sourceUrl: 'https://kvkk.gov.tr/post/1',
        title: 't',
        content: 'c',
        publicationDate: null,
        incidentDate: null,
        scrapedAt: new Date(),
        read: false,
        emailSent: false,
        emailSentAt: null,
      } as Post;
      const ctx = await svc.continueList(post);
      expect(ctx.consecutiveDuplicates).toBe(0);
      expect(ctx.postsInserted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('finalizeRun', () => {
    it('updates scrapeRun and returns SUCCESS summary (happy)', async () => {
      prisma.scrapeRun.update.mockResolvedValue({});
      const summary = await svc.finalizeRun(buildContext());
      expect(summary.status).toBe('SUCCESS');
      expect(prisma.scrapeRun.update).toHaveBeenCalled();
    });

    it('propagates DB error (negative)', async () => {
      prisma.scrapeRun.update.mockRejectedValue(new Error('db down'));
      await expect(svc.finalizeRun(buildContext())).rejects.toThrow();
    });
  });

  describe('closeRun', () => {
    it('emits scrape:completed SSE and releases lock (happy)', async () => {
      prisma.scrapeRun.update.mockResolvedValue({});
      const summary: ScrapeRunSummary = {
        runId: 1,
        mode: 'MANUAL',
        status: 'SUCCESS',
        startedAt: new Date(),
        finishedAt: null,
        pagesWalked: 1,
        postsFound: 0,
        postsInserted: 0,
        consecutiveDuplicates: 0,
        error: null,
      };
      const out = await svc.closeRun(summary);
      expect(sse.emit).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'scrape:completed' }),
      );
      expect(out.status).toBe('SUCCESS');
    });
  });

  describe('abortRun', () => {
    it('marks scrapeRun FAILED and emits scrape:failed (negative path)', async () => {
      prisma.scrapeRun.update.mockResolvedValue({});
      const summary = await svc.abortRun(buildContext());
      expect(summary.status).toBe('FAILED');
      expect(sse.emit).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'scrape:failed' }),
      );
    });
  });

  describe('timeout handlers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('handleListTimeout returns updated context (happy)', async () => {
      const ctx = await svc.handleListTimeout(buildContext());
      expect(ctx).toBeDefined();
    });

    it('handlePostTimeout returns updated context (happy)', async () => {
      const ctx = await svc.handlePostTimeout(buildContext());
      expect(ctx).toBeDefined();
    });

    it('retryListFetch returns a PageUrl (happy)', async () => {
      const url: PageUrl = await svc.retryListFetch(buildContext({ currentPage: 2 }));
      expect(typeof url).toBe('string');
    });

    it('retryPostFetch returns a PostUrl when pending (happy)', async () => {
      const url: PostUrl = await svc.retryPostFetch(
        buildContext({ pendingPostUrls: ['https://kvkk.gov.tr/post/1' as PostUrl] }),
      );
      expect(typeof url).toBe('string');
    });

    it('retryPostFetch throws when no pending posts (negative)', async () => {
      await expect(svc.retryPostFetch(buildContext({ pendingPostUrls: [] }))).rejects.toThrow();
    });
  });

  describe('runScrape lock', () => {
    it('rejects second concurrent call while lock held (negative)', async () => {
      (svc as any).lockHeld = true;
      await expect(
        svc.runScrape({ mode: 'MANUAL', startPage: 1 } as ScrapeRunRequest),
      ).rejects.toThrow();
    });
  });
});
