import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { PostsModule } from './posts/posts.module';
import { ScraperModule } from './scraper/scraper.module';
import { EmailModule } from './email/email.module';
import { SseModule } from './sse/sse.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    PostsModule,
    ScraperModule,
    EmailModule,
    SseModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
