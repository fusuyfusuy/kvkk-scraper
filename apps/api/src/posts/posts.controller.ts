import { Controller, Get, Post, Param, Query, NotFoundException } from '@nestjs/common';
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

  @Get()
  async listPosts(@Query() query: PostListQuery): Promise<PostListResponse> {
    return this.postsService.list(query);
  }

  @Get('unread/count')
  async getUnreadCount(): Promise<UnreadCountResponse> {
    const unreadCount = await this.postsService.getUnreadCount();
    return { unreadCount };
  }

  @Get(':id')
  async getPost(@Param('id') id: string): Promise<PostDetailResponse> {
    const post = await this.postsService.getById(id);
    if (!post) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }
    return post;
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string): Promise<MarkAsReadResponse> {
    const result = await this.postsService.markAsRead(id);
    if (!result) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }
    return result;
  }
}
