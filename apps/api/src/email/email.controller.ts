import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailDeliveryListResponse } from '@kvkk/shared';

@ApiTags('email-deliveries')
@Controller('email-deliveries')
export class EmailController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('limit') limit?: string): Promise<EmailDeliveryListResponse> {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const rows = await this.prisma.emailDelivery.findMany({
      take,
      orderBy: { id: 'desc' },
      include: { post: { select: { title: true } } },
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        postId: r.postId,
        postTitle: r.post?.title ?? '(unknown)',
        recipient: r.recipient,
        subject: r.subject,
        status: r.status,
        sentAt: r.sentAt,
        error: r.error,
      })),
    };
  }
}
