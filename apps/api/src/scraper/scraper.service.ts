import { Injectable, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SseService } from '../sse/sse.service';
import { fetchUrl } from './http.client';
import {
  parseListingPage as parseListingPageFn,
  parsePostPage as parsePostPageFn,
} from './kvkk.parser';
import type {
  ScrapeRunRequest,
  ScrapeRunSummary,
  ScrapeRunContext,
  HtmlResponse,
  ListingPage,
  ParsedPost,
  Post,
  PostUrl,
  PageUrl,
  PageDecision,
  DuplicateCheckResult,
  AppConfig,
} from '@kvkk/shared';

@Injectable()
export class ScraperService {
  // In-memory singleton lock flag (module-scoped instance property; Nest provider is singleton by default)
  private lockHeld = false;
  // Current run context (used by stateful action methods)
  private context: ScrapeRunContext | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly sseService: SseService,
    private readonly configService: ConfigService,
  ) {}

  async runScrape(request: ScrapeRunRequest): Promise<ScrapeRunSummary> {
    if (this.lockHeld) {
      throw new ConflictException('scrape already running');
    }

    this.lockHeld = true;

    try {
      let context = await this.initRun(request);
      const baseUrl = this.configService.get<string>('baseUrl') || 'https://www.kvkk.gov.tr';

      let pageUrl: PageUrl = `${baseUrl}/veri-ihlali-bildirimi/?&page=${context.currentPage}` as PageUrl;

      while (true) {
        let html: HtmlResponse;
        try {
          html = await fetchUrl(pageUrl);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (err.message.includes('TIMEOUT') || err.message.includes('timeout')) {
            context = await this.handleListTimeout(context);
            pageUrl = await this.retryListFetch(context);
            continue;
          }
          throw err;
        }

        let listing: ListingPage;
        try {
          listing = await this.parseListingPage(html);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          throw new Error(`Failed to parse listing: ${err.message}`);
        }

        if (listing.postUrls.length === 0) {
          const decision = await this.advancePage(context);
          if (decision.action === 'STOP') {
            let summary = await this.finalizeRun(context);
            try {
              summary = await this.emailService.sweepAndSend(summary);
            } catch (error) {
              const err = error instanceof Error ? error : new Error(String(error));
              await this.logEmailError(summary);
            }
            return await this.closeRun(summary);
          }
          pageUrl = await this.nextPage(decision);
          continue;
        }

        context.pendingPostUrls = [...listing.postUrls];

        for (let postUrl of context.pendingPostUrls) {
          let postHtml: HtmlResponse = { url: postUrl, status: 0, headers: {}, body: '' };
          try {
            postHtml = await fetchUrl(postUrl as string);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (err.message.includes('TIMEOUT') || err.message.includes('timeout')) {
              context = await this.handlePostTimeout(context);
              postUrl = await this.retryPostFetch(context);
              continue;
            }
            context = await this.handleParseError(postHtml);
            continue;
          }

          let parsedPost: ParsedPost;
          try {
            parsedPost = await this.parsePostPage(postHtml);
          } catch (error) {
            context = await this.handleParseError(postHtml);
            continue;
          }

          const duplicateCheck = await this.checkDuplicate(parsedPost);

          if (duplicateCheck.isDuplicate) {
            context = await this.recordDuplicate(duplicateCheck);
            const decision = await this.advancePage(context);
            if (decision.action === 'STOP') {
              let summary = await this.finalizeRun(context);
              try {
                summary = await this.emailService.sweepAndSend(summary);
              } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                await this.logEmailError(summary);
              }
              return await this.closeRun(summary);
            }
          } else {
            let post: Post;
            try {
              post = await this.insertPost(parsedPost);
            } catch (error) {
              context = await this.handleDbError(context);
              const summary = await this.abortRun(context);
              return summary;
            }
            context = await this.continueList(post);
          }
        }

        const decision = await this.advancePage(context);
        if (decision.action === 'STOP') {
          let summary = await this.finalizeRun(context);
          try {
            summary = await this.emailService.sweepAndSend(summary);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            await this.logEmailError(summary);
          }
          return await this.closeRun(summary);
        }

        pageUrl = await this.nextPage(decision);
      }
    } finally {
      this.lockHeld = false;
    }
  }

  async initRun(request: ScrapeRunRequest): Promise<ScrapeRunContext> {
    const now = new Date();

    const refreshMode = this.configService.get<string>('refreshMode') || 'DUPLICATES';
    const maxPages = this.configService.get<number>('refreshMaxPages') || 50;
    const maxConsecutiveDuplicates =
      this.configService.get<number>('refreshMaxConsecutiveDuplicates') || 5;

    const run = await this.prisma.scrapeRun.create({
      data: {
        mode: request.mode,
        status: 'RUNNING',
        startedAt: now,
        pagesWalked: 0,
        postsFound: 0,
        postsInserted: 0,
        consecutiveDuplicates: 0,
      },
    });

    this.context = {
      runId: run.id,
      mode: request.mode,
      currentPage: request.startPage ?? 1,
      pagesWalked: 0,
      postsFound: 0,
      postsInserted: 0,
      consecutiveDuplicates: 0,
      maxPages: request.maxPages || maxPages,
      maxConsecutiveDuplicates: request.maxConsecutiveDuplicates || maxConsecutiveDuplicates,
      startedAt: now,
      pendingPostUrls: [],
    };
    return this.context;
  }

  async parseListingPage(html: HtmlResponse): Promise<ListingPage> {
    return parseListingPageFn(html);
  }

  async fetchPost(postUrl: PostUrl): Promise<HtmlResponse> {
    return fetchUrl(postUrl as string);
  }

  async parsePostPage(html: HtmlResponse): Promise<ParsedPost> {
    return parsePostPageFn(html);
  }

  async checkDuplicate(parsedPost: ParsedPost): Promise<DuplicateCheckResult> {
    const found = await this.prisma.post.findUnique({
      where: { sourceUrl: parsedPost.sourceUrl },
    });

    if (found) {
      return {
        sourceUrl: parsedPost.sourceUrl,
        isDuplicate: true,
        existingPostId: found.id as any,
      };
    }

    return {
      sourceUrl: parsedPost.sourceUrl,
      isDuplicate: false,
      existingPostId: null,
    };
  }

  async insertPost(parsedPost: ParsedPost): Promise<Post> {
    const now = new Date();

    const post = await this.prisma.post.create({
      data: {
        sourceUrl: parsedPost.sourceUrl,
        title: parsedPost.title,
        content: parsedPost.content,
        publicationDate: parsedPost.publicationDate,
        incidentDate: parsedPost.incidentDate,
        scrapedAt: now,
        read: false,
        emailSent: false,
        emailSentAt: null,
      },
    });

    this.sseService.emit({
      event: 'post:created',
      data: post,
      timestamp: now,
    });

    return post as any;
  }

  async continueList(post: Post): Promise<ScrapeRunContext> {
    const ctx = this.context ?? ({} as ScrapeRunContext);
    const updated: ScrapeRunContext = {
      ...ctx,
      postsInserted: (ctx.postsInserted ?? 0) + 1,
      postsFound: (ctx.postsFound ?? 0) + 1,
      consecutiveDuplicates: 0,
    };
    this.context = updated;
    return updated;
  }

  async advancePage(context: ScrapeRunContext): Promise<PageDecision> {
    context.pagesWalked += 1;

    const refreshMode = this.configService.get<string>('refreshMode') || 'DUPLICATES';

    if (
      refreshMode === 'DUPLICATES' &&
      context.consecutiveDuplicates >= context.maxConsecutiveDuplicates
    ) {
      return {
        action: 'STOP',
        nextPageUrl: null,
        reason: 'Consecutive duplicates threshold reached',
      };
    }

    if (refreshMode === 'PAGES' && context.pagesWalked >= context.maxPages) {
      return {
        action: 'STOP',
        nextPageUrl: null,
        reason: 'Max pages reached',
      };
    }

    const baseUrl = this.configService.get<string>('baseUrl') || 'https://www.kvkk.gov.tr';
    const nextPage = context.currentPage + 1;
    return {
      action: 'CONTINUE',
      nextPageUrl: `${baseUrl}/veri-ihlali-bildirimi/?&page=${nextPage}` as PageUrl,
      reason: 'Continue to next page',
    };
  }

  async recordDuplicate(result: DuplicateCheckResult): Promise<ScrapeRunContext> {
    const ctx = this.context ?? ({} as ScrapeRunContext);
    const updated: ScrapeRunContext = {
      ...ctx,
      consecutiveDuplicates: (ctx.consecutiveDuplicates ?? 0) + 1,
      postsFound: (ctx.postsFound ?? 0) + 1,
    };
    this.context = updated;
    return updated;
  }

  async nextPage(decision: PageDecision): Promise<PageUrl> {
    // Note: context is not passed in. In runScrape, we manage currentPage directly.
    return decision.nextPageUrl as PageUrl;
  }

  async finalizeRun(context: ScrapeRunContext): Promise<ScrapeRunSummary> {
    await this.prisma.scrapeRun.update({
      where: { id: context.runId },
      data: {
        pagesWalked: context.pagesWalked,
        postsFound: context.postsFound,
        postsInserted: context.postsInserted,
        consecutiveDuplicates: context.consecutiveDuplicates,
      },
    });

    return {
      runId: context.runId,
      mode: context.mode,
      status: 'SUCCESS',
      startedAt: context.startedAt,
      finishedAt: null,
      pagesWalked: context.pagesWalked,
      postsFound: context.postsFound,
      postsInserted: context.postsInserted,
      consecutiveDuplicates: context.consecutiveDuplicates,
      error: null,
    };
  }

  async closeRun(summary: ScrapeRunSummary): Promise<ScrapeRunSummary> {
    const now = new Date();

    await this.prisma.scrapeRun.update({
      where: { id: summary.runId },
      data: {
        status: 'SUCCESS',
        finishedAt: now,
      },
    });

    this.sseService.emit({
      event: 'scrape:completed',
      data: summary,
      timestamp: now,
    });

    return { ...summary, finishedAt: now };
  }

  async handleListTimeout(context: ScrapeRunContext): Promise<ScrapeRunContext> {
    console.error(`Timeout fetching list page ${context.currentPage}`);
    return context;
  }

  async handlePostTimeout(context: ScrapeRunContext): Promise<ScrapeRunContext> {
    const postUrl = context.pendingPostUrls[0] || 'unknown';
    console.error(`Timeout fetching post ${postUrl}`);
    return context;
  }

  async handleParseError(html: HtmlResponse): Promise<ScrapeRunContext> {
    const excerpt = html.body.substring(0, 200);
    console.error(`Parse error for ${html.url}: ${excerpt}`);
    return {} as ScrapeRunContext;
  }

  async handleDbError(context: ScrapeRunContext): Promise<ScrapeRunContext> {
    console.error('Database error during insert');
    return context;
  }

  async retryListFetch(context: ScrapeRunContext): Promise<PageUrl> {
    const baseUrl = this.configService.get<string>('baseUrl') || 'https://www.kvkk.gov.tr';
    return `${baseUrl}/veri-ihlali-bildirimi/?&page=${context.currentPage}` as PageUrl;
  }

  async retryPostFetch(context: ScrapeRunContext): Promise<PostUrl> {
    if (!context.pendingPostUrls || context.pendingPostUrls.length === 0) {
      throw new Error('NO_PENDING_POSTS');
    }
    return context.pendingPostUrls[0] as PostUrl;
  }

  async skipPost(context: ScrapeRunContext): Promise<PageDecision> {
    if (context.pendingPostUrls.length > 0) {
      context.pendingPostUrls.shift();
    }

    if (context.pendingPostUrls.length > 0) {
      return {
        action: 'CONTINUE',
        nextPageUrl: null,
        reason: 'More posts to process on same page',
      };
    }

    return this.advancePage(context);
  }

  async abortRun(context: ScrapeRunContext): Promise<ScrapeRunSummary> {
    const now = new Date();

    await this.prisma.scrapeRun.update({
      where: { id: context.runId },
      data: {
        status: 'FAILED',
        finishedAt: now,
        error: 'Database error during post insertion',
      },
    });

    this.sseService.emit({
      event: 'scrape:failed',
      data: { runId: context.runId, reason: 'Database error' },
      timestamp: now,
    });

    return {
      runId: context.runId,
      mode: context.mode,
      status: 'FAILED',
      startedAt: context.startedAt,
      finishedAt: now,
      pagesWalked: context.pagesWalked,
      postsFound: context.postsFound,
      postsInserted: context.postsInserted,
      consecutiveDuplicates: context.consecutiveDuplicates,
      error: 'Database error during post insertion',
    };
  }

  async logEmailError(summary: ScrapeRunSummary): Promise<ScrapeRunSummary> {
    console.error(`Email send failed during scrape run ${summary.runId}`);
    return summary;
  }
}
