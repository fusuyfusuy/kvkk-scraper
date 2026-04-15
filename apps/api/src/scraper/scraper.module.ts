import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { ScraperScheduler } from './scraper.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { EmailModule } from '../email/email.module';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [ScheduleModule.forRoot(), EmailModule, SseModule],
  controllers: [ScraperController],
  providers: [ScraperService, ScraperScheduler, PrismaService],
  exports: [ScraperService],
})
export class ScraperModule {}
