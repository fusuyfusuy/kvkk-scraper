import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import type { RefreshMode } from '@kvkk/shared';

export interface RuntimeConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  notificationRecipients: string[];
  cronExpression: string;
  refreshMode: RefreshMode;
  refreshMaxPages: number;
  refreshMaxConsecutiveDuplicates: number;
}

export const CONFIG_CHANGED_EVENT = 'config.changed';

const KEYS: (keyof RuntimeConfig)[] = [
  'smtpHost',
  'smtpPort',
  'smtpUser',
  'smtpPass',
  'smtpFrom',
  'notificationRecipients',
  'cronExpression',
  'refreshMode',
  'refreshMaxPages',
  'refreshMaxConsecutiveDuplicates',
];

@Injectable()
export class RuntimeConfigService implements OnModuleInit {
  private readonly logger = new Logger(RuntimeConfigService.name);
  private current!: RuntimeConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  @OnEvent(CONFIG_CHANGED_EVENT)
  async reload(): Promise<void> {
    const envDefaults = this.readEnv();
    const dbRows = await this.prisma.appSetting.findMany();
    const dbMap = new Map(dbRows.map((r) => [r.key, r.value]));

    const merged: RuntimeConfig = { ...envDefaults };
    for (const key of KEYS) {
      const dbVal = dbMap.get(key);
      if (dbVal === undefined) continue;
      (merged as any)[key] = this.deserialize(key, dbVal);
    }
    this.current = merged;
    this.logger.log('Runtime config reloaded');
  }

  getCurrent(): RuntimeConfig {
    return this.current;
  }

  private readEnv(): RuntimeConfig {
    return {
      smtpHost: this.configService.get<string>('smtpHost') ?? process.env['SMTP_HOST'] ?? 'localhost',
      smtpPort: this.configService.get<number>('smtpPort') ?? Number(process.env['SMTP_PORT'] ?? 1025),
      smtpUser: this.configService.get<string>('smtpUser') ?? process.env['SMTP_USER'] ?? '',
      smtpPass: this.configService.get<string>('smtpPass') ?? process.env['SMTP_PASS'] ?? '',
      smtpFrom: this.configService.get<string>('smtpFrom') ?? process.env['SMTP_FROM'] ?? 'kvkk@example.com',
      notificationRecipients:
        this.configService.get<string[]>('notificationRecipients') ??
        String(process.env['NOTIFICATION_RECIPIENTS'] ?? 'admin@example.com')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      cronExpression: this.configService.get<string>('cronExpression') ?? process.env['CRON_EXPRESSION'] ?? '0 * * * *',
      refreshMode: (this.configService.get<RefreshMode>('refreshMode') ?? (process.env['REFRESH_MODE'] as RefreshMode) ?? 'DUPLICATES'),
      refreshMaxPages: this.configService.get<number>('refreshMaxPages') ?? Number(process.env['REFRESH_MAX_PAGES'] ?? 50),
      refreshMaxConsecutiveDuplicates:
        this.configService.get<number>('refreshMaxConsecutiveDuplicates') ??
        Number(process.env['REFRESH_MAX_CONSECUTIVE_DUPLICATES'] ?? 5),
    };
  }

  private deserialize(key: keyof RuntimeConfig, value: string): unknown {
    switch (key) {
      case 'smtpPort':
      case 'refreshMaxPages':
      case 'refreshMaxConsecutiveDuplicates':
        return Number(value);
      case 'notificationRecipients':
        return value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      default:
        return value;
    }
  }
}
