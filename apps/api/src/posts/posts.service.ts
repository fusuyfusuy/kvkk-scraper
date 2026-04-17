import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  Post,
  PostListQuery,
  PostListResponse,
  MarkAsReadResponse,
  StatsResponse,
} from '@kvkk/shared';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PostListQuery): Promise<PostListResponse> {
    // Build where clause based on filters
    const where: any = {};

    // Search in title or content
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { content: { contains: query.search } },
      ];
    }

    // Filter by company (title contains)
    if (query.company) {
      where.title = { contains: query.company };
    }

    // Filter by date range
    if (query.dateFrom) {
      where.incidentDate = {
        ...where.incidentDate,
        gte: query.dateFrom,
      };
    }
    if (query.dateTo) {
      where.incidentDate = {
        ...where.incidentDate,
        lte: query.dateTo,
      };
    }

    // Filter by read status
    if (query.unreadOnly !== undefined) {
      where.read = !query.unreadOnly;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const [total, items, unreadCount] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: [{ publicationDate: 'desc' }, { scrapedAt: 'desc' }],
        take: pageSize,
        skip,
      }),
      this.prisma.post.count({ where: { read: false } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      unreadCount,
    };
  }

  async getById(id: string): Promise<Post | null> {
    return this.prisma.post.findUnique({
      where: { id: parseInt(id, 10) },
    });
  }

  async markAsRead(id: string): Promise<MarkAsReadResponse | null> {
    const post = await this.prisma.post.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!post) {
      return null;
    }

    if (post.read) {
      return { post, changed: false };
    }

    const updatedPost = await this.prisma.post.update({
      where: { id: parseInt(id, 10) },
      data: { read: true },
    });

    return { post: updatedPost, changed: true };
  }

  async getUnreadCount(): Promise<number> {
    return this.prisma.post.count({ where: { read: false } });
  }

  async getStats(): Promise<StatsResponse> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalPosts,
      postsThisWeek,
      unreadCount,
      lastRun,
      totalRuns30d,
      successRuns30d,
    ] = await Promise.all([
      this.prisma.post.count(),
      this.prisma.post.count({ where: { scrapedAt: { gte: weekAgo } } }),
      this.prisma.post.count({ where: { read: false } }),
      this.prisma.scrapeRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      this.prisma.scrapeRun.count({ where: { startedAt: { gte: thirtyDaysAgo } } }),
      this.prisma.scrapeRun.count({
        where: { startedAt: { gte: thirtyDaysAgo }, status: 'SUCCESS' },
      }),
    ]);

    const successRate30d = totalRuns30d === 0 ? 0 : successRuns30d / totalRuns30d;

    return {
      totalPosts,
      postsThisWeek,
      unreadCount,
      lastRunAt: lastRun?.startedAt ?? null,
      lastRunStatus: lastRun?.status ?? null,
      successRate30d,
    };
  }
}
