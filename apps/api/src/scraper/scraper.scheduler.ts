import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ScraperService } from './scraper.service';

// CONTRACT:
// NestJS @Cron scheduler that triggers scrape runs on the configured expression.
// Reads cronExpression from AppConfig at module init.
// Uses dynamic cron registration via SchedulerRegistry if cronExpression is not static.

@Injectable()
export class ScraperScheduler {
  private readonly logger = new Logger(ScraperScheduler.name);

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
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledScrape(): Promise<void> {
    try {
      await this.scraperService.runScrape({ mode: 'SCHEDULED' });
    } catch (error) {
      this.logger.error(`Scheduled scrape failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
