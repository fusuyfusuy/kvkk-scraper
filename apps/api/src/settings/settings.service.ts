import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeConfigService, CONFIG_CHANGED_EVENT } from './runtime-config.service';
import type { AppConfigPatch, SettingsResponse } from '@kvkk/shared';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: RuntimeConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getAll(): Promise<SettingsResponse> {
    const c = this.runtime.getCurrent();
    return {
      smtpHost: c.smtpHost,
      smtpPort: c.smtpPort,
      smtpUser: c.smtpUser,
      smtpPass: null,
      smtpPassSet: c.smtpPass.length > 0,
      smtpFrom: c.smtpFrom,
      notificationRecipients: c.notificationRecipients,
      cronExpression: c.cronExpression,
      refreshMode: c.refreshMode,
      refreshMaxPages: c.refreshMaxPages,
      refreshMaxConsecutiveDuplicates: c.refreshMaxConsecutiveDuplicates,
    };
  }

  async update(patch: AppConfigPatch): Promise<SettingsResponse> {
    const writes: { key: string; value: string }[] = [];

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (key === 'smtpPass' && typeof value === 'string' && value.length === 0) continue;

      const serialized = Array.isArray(value) ? value.join(',') : String(value);
      writes.push({ key, value: serialized });
    }

    if (writes.length > 0) {
      await this.prisma.$transaction(
        writes.map((w) =>
          this.prisma.appSetting.upsert({
            where: { key: w.key },
            create: { key: w.key, value: w.value },
            update: { value: w.value },
          }),
        ),
      );
      this.eventEmitter.emit(CONFIG_CHANGED_EVENT);
      await this.runtime.reload();
    }

    return this.getAll();
  }
}
