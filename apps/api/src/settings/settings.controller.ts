import { Body, Controller, Get, Post, Put, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { EmailService } from '../email/email.service';
import {
  AppConfigPatchSchema,
  TestMailRequestSchema,
  type SettingsResponse,
} from '@kvkk/shared';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  async get(): Promise<SettingsResponse> {
    return this.settingsService.getAll();
  }

  @Put()
  async update(@Body() body: unknown): Promise<SettingsResponse> {
    const parsed = AppConfigPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.settingsService.update(parsed.data);
  }

  @Post('test-mail')
  async testMail(@Body() body: unknown): Promise<{ ok: true }> {
    const parsed = TestMailRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.emailService.sendTestEmail(parsed.data.recipient);
    return { ok: true };
  }
}
