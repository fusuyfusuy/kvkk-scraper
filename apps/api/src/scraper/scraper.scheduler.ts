import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { CronJob } from 'cron';
import { ScraperService } from './scraper.service';
import { RuntimeConfigService, CONFIG_CHANGED_EVENT } from '../settings/runtime-config.service';

const JOB_NAME = 'scraper:scheduled';

@Injectable()
export class ScraperScheduler implements OnModuleInit {
  private readonly logger = new Logger(ScraperScheduler.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly runtime: RuntimeConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.register();
  }

  @OnEvent(CONFIG_CHANGED_EVENT)
  handleConfigChanged(): void {
    this.register();
  }

  private register(): void {
    const expression = this.runtime.getCurrent().cronExpression;

    if (this.schedulerRegistry.doesExist('cron', JOB_NAME)) {
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
    }

    const job = new CronJob(expression, () => {
      this.scraperService
        .runScrape({ mode: 'SCHEDULED' })
        .catch((err) => this.logger.error(`Scheduled scrape failed: ${err instanceof Error ? err.message : String(err)}`));
    });

    this.schedulerRegistry.addCronJob(JOB_NAME, job as any);
    job.start();
    this.logger.log(`Scheduler registered with expression: ${expression}`);
  }
}
