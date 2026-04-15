import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ScraperService } from './scraper.service';

// CONTRACT:
// NestJS @Cron scheduler that triggers scrape runs on the configured expression.
// Reads cronExpression from AppConfig at module init.
// Uses dynamic cron registration via SchedulerRegistry if cronExpression is not static.

@Injectable()
export class ScraperScheduler {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly configService: ConfigService,
  ) {}

  // CONTRACT:
  // Scheduled job — fires on cronExpression from AppConfig.
  // Logic:
  //   1. Build ScrapeRunRequest with mode='SCHEDULED'
  //   2. Call scraperService.runScrape(request) — handles lock internally
  //   3. Errors are caught and logged; never propagate to crash scheduler
  @Cron('0 * * * *') // default; fill agent replaces with dynamic from config
  async scheduledScrape(): Promise<void> {
    throw new Error('not implemented');
  }
}
