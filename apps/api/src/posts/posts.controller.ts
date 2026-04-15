import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { PostsService } from './posts.service';
import type {
  PostListQuery,
  PostListResponse,
  PostDetailResponse,
  MarkAsReadResponse,
  UnreadCountResponse,
} from '@kvkk/shared';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // CONTRACT:
  // GET /posts — list posts with optional filters/pagination
  // Transition: apiList flow
  // Input: PostListQuery (packages/shared/src/types/post.ts) — search, company, dateFrom, dateTo, page, pageSize, unreadOnly
  // Output: PostListResponse (packages/shared/src/types/api.ts) — items[], total, page, pageSize, unreadCount
  // Logic:
  //   1. Parse and validate query params via PostListQuerySchema
  //   2. Delegate to postsService.list(query)
  //   3. Return PostListResponse
  @Get()
  async listPosts(@Query() query: PostListQuery): Promise<PostListResponse> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // GET /posts/unread/count — return global unread count
  // Input: none
  // Output: UnreadCountResponse (packages/shared/src/types/api.ts)
  // Logic:
  //   1. Delegate to postsService.getUnreadCount()
  //   2. Return { unreadCount }
  @Get('unread/count')
  async getUnreadCount(): Promise<UnreadCountResponse> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // GET /posts/:id — fetch single post by UUID
  // Input: id (string UUID from path param)
  // Output: PostDetailResponse (packages/shared/src/types/api.ts)
  // Logic:
  //   1. Delegate to postsService.getById(id)
  //   2. If null, throw NotFoundException (404)
  //   3. Return post
  @Get(':id')
  async getPost(@Param('id') id: string): Promise<PostDetailResponse> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // POST /posts/:id/read — idempotently mark post as read
  // Input: id (string UUID from path param)
  // Output: MarkAsReadResponse (packages/shared/src/types/api.ts) — { post, changed }
  // Logic:
  //   1. Delegate to postsService.markAsRead(id)
  //   2. If post not found, throw NotFoundException (404)
  //   3. Emit SSE 'post:updated' if changed
  //   4. Return { post, changed }
  @Post(':id/read')
  async markAsRead(@Param('id') id: string): Promise<MarkAsReadResponse> {
    throw new Error('not implemented');
  }
}
