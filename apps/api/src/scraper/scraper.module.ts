import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { ScraperScheduler } from './scraper.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigModule } from '../config/config.module';
import { EmailModule } from '../email/email.module';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [ConfigModule, EmailModule, SseModule],
  controllers: [ScraperController],
  providers: [ScraperService, ScraperScheduler, PrismaService],
  exports: [ScraperService],
})
export class ScraperModule {}
