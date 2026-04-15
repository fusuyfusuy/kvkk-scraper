import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PostsModule } from './posts/posts.module';
import { ScraperModule } from './scraper/scraper.module';
import { EmailModule } from './email/email.module';
import { SseModule } from './sse/sse.module';

@Module({
  imports: [
    ConfigModule,
    PostsModule,
    ScraperModule,
    EmailModule,
    SseModule,
  ],
})
export class AppModule {}
