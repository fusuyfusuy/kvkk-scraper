import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigModule } from '../config/config.module';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [ConfigModule, SseModule],
  providers: [EmailService, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}
