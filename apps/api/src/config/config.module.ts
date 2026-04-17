import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          smtpHost: process.env['SMTP_HOST'],
          smtpPort: process.env['SMTP_PORT'] ? Number(process.env['SMTP_PORT']) : undefined,
          smtpUser: process.env['SMTP_USER'],
          smtpPass: process.env['SMTP_PASS'],
          smtpFrom: process.env['SMTP_FROM'],
          notificationRecipients: String(process.env['NOTIFICATION_RECIPIENTS'] ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          cronExpression: process.env['CRON_EXPRESSION'] ?? '0 * * * *',
          refreshMode: process.env['REFRESH_MODE'] ?? 'DUPLICATES',
          refreshMaxPages: process.env['REFRESH_MAX_PAGES'] ? Number(process.env['REFRESH_MAX_PAGES']) : 50,
          refreshMaxConsecutiveDuplicates: process.env['REFRESH_MAX_CONSECUTIVE_DUPLICATES']
            ? Number(process.env['REFRESH_MAX_CONSECUTIVE_DUPLICATES'])
            : 5,
        }),
      ],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
