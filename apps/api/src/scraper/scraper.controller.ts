import { Controller, Post, Get } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import type { RefreshResponse, ScrapeRun } from '@kvkk/shared';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

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
    throw new Error('not implemented');
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
    throw new Error('not implemented');
  }
}
