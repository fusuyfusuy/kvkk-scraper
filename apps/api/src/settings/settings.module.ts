import { Module, Global, forwardRef } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { RuntimeConfigService } from './runtime-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [forwardRef(() => EmailModule)],
  controllers: [SettingsController],
  providers: [SettingsService, RuntimeConfigService, PrismaService],
  exports: [SettingsService, RuntimeConfigService],
})
export class SettingsModule {}
