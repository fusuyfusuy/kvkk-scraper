import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigSchema } from '@kvkk/shared';

// CONTRACT:
// Validates all env vars against AppConfigSchema (zod) on startup.
// Throws on missing/invalid config so the app fails fast.
// Exported globally so any module can inject ConfigService.

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const result = AppConfigSchema.safeParse({
          smtpHost: config['SMTP_HOST'],
          smtpPort: config['SMTP_PORT'],
          smtpUser: config['SMTP_USER'],
          smtpPass: config['SMTP_PASS'],
          smtpFrom: config['SMTP_FROM'],
          notificationRecipients: String(config['NOTIFICATION_RECIPIENTS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          cronExpression: config['CRON_EXPRESSION'],
          refreshMode: config['REFRESH_MODE'],
          refreshMaxPages: config['REFRESH_MAX_PAGES'],
          refreshMaxConsecutiveDuplicates: config['REFRESH_MAX_CONSECUTIVE_DUPLICATES'],
        });
        if (!result.success) {
          throw new Error(`Config validation failed: ${result.error.message}`);
        }
        return result.data;
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
