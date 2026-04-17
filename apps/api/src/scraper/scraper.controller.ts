import { Controller, Post, Get, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScraperService } from './scraper.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RefreshResponse, ScrapeRun } from '@kvkk/shared';

@ApiTags('scraper')
@Controller('scraper')
export class ScraperController {
  private readonly logger = new Logger('ScraperController');

  constructor(
    private readonly scraperService: ScraperService,
    private readonly prisma: PrismaService,
  ) {}

  // CONTRACT:
  // POST /scraper/refresh — trigger a manual scrape run
  // Input: none (body ignored)
  // Output: RefreshResponse (packages/shared/src/types/api.ts) — { status: 'accepted'|'already-running', runId }
  // Logic:
  //   1. Check singleton lock; if locked return 409 { status: 'already-running', runId: null }
  //   2. Create ScrapeRunRequest with mode=MANUAL
  //   3. Call scraperService.runScrape(request) asynchronously (fire and forget)
  //   4. Emit SSE 'scrape:started'
  //   5. Return 202 { status: 'accepted', runId }
  @Post('refresh')
  async triggerRefresh(): Promise<RefreshResponse> {
    try {
      const request = { mode: 'MANUAL' as const };
      // Fire and forget the scrape
      this.scraperService.runScrape(request).catch((err: Error) => {
        this.logger.error(`Manual scrape failed: ${err.message}`, err.stack);
      });
      return { status: 'accepted', runId: null };
    } catch (error) {
      // ConflictException from service is caught and re-thrown by Nest
      throw error;
    }
  }

  // CONTRACT:
  // GET /scraper/runs — list recent scrape runs
  // Input: none
  // Output: ScrapeRun[] (packages/shared/src/types/scrape.ts)
  // Logic:
  //   1. prisma.scrapeRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 })
  //   2. Return array of ScrapeRun
  @Get('runs')
  async listRuns(): Promise<ScrapeRun[]> {
    const runs = await this.prisma.scrapeRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return runs as ScrapeRun[];
  }
}
