import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  Post,
  PostListQuery,
  PostListResponse,
  MarkAsReadResponse,
} from '@kvkk/shared';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  // CONTRACT:
  // List posts with filters, search, and pagination.
  // Input: PostListQuery (packages/shared/src/types/post.ts)
  // Output: PostListResponse (packages/shared/src/types/api.ts)
  // Logic:
  //   1. Build Prisma where clause: LIKE on title+content for search, LIKE on title for company, incidentDate range, read flag
  //   2. Run count and findMany in parallel (Promise.all)
  //   3. Order by publicationDate DESC NULLS LAST, then scrapedAt DESC
  //   4. Compute unreadCount globally (separate count where read=false)
  //   5. Return { items, total, page, pageSize, unreadCount }
  async list(query: PostListQuery): Promise<PostListResponse> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // Fetch single post by UUID.
  // Input: id (string UUID)
  // Output: Post | null (packages/shared/src/types/post.ts)
  // Logic:
  //   1. prisma.post.findUnique({ where: { id } })
  //   2. Return post or null
  async getById(id: string): Promise<Post | null> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // Idempotently mark post as read.
  // Input: id (string UUID)
  // Output: MarkAsReadResponse (packages/shared/src/types/api.ts)
  // Logic:
  //   1. Fetch post by id; return null if not found
  //   2. If post.read already true, return { post, changed: false }
  //   3. prisma.post.update({ where: { id }, data: { read: true } })
  //   4. Return { post: updatedPost, changed: true }
  async markAsRead(id: string): Promise<MarkAsReadResponse | null> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // Get global unread count.
  // Input: none
  // Output: number
  // Logic:
  //   1. prisma.post.count({ where: { read: false } })
  //   2. Return count
  async getUnreadCount(): Promise<number> {
    throw new Error('not implemented');
  }
}
