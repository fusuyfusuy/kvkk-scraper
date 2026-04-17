import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { PostsModule } from './posts/posts.module';
import { ScraperModule } from './scraper/scraper.module';
import { EmailModule } from './email/email.module';
import { SseModule } from './sse/sse.module';
import { SettingsModule } from './settings/settings.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ConfigModule,
    PostsModule,
    ScraperModule,
    EmailModule,
    SseModule,
    SettingsModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
