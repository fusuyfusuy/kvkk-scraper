import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigModule } from '../config/config.module';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [ConfigModule, SseModule],
  controllers: [EmailController],
  providers: [EmailService, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}
