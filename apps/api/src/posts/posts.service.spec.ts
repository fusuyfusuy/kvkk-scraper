import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostsService } from './posts.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PostListQuery } from '@kvkk/shared';

describe('PostsService', () => {
  let prisma: any;
  let svc: PostsService;

  beforeEach(() => {
    prisma = {
      post: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
    };
    svc = new PostsService(prisma as PrismaService);
  });

  describe('list', () => {
    it('returns paginated response with unreadCount (happy)', async () => {
      prisma.post.findMany.mockResolvedValue([]);
      prisma.post.count.mockResolvedValue(0);
      const q: PostListQuery = { page: 1, pageSize: 20 } as PostListQuery;
      const r = await svc.list(q);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(20);
      expect(typeof r.unreadCount).toBe('number');
      expect(Array.isArray(r.items)).toBe(true);
    });

    it('propagates DB error (negative)', async () => {
      prisma.post.findMany.mockRejectedValue(new Error('db down'));
      prisma.post.count.mockResolvedValue(0);
      await expect(svc.list({ page: 1, pageSize: 20 } as PostListQuery)).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('returns post when found (happy)', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'x' });
      const p = await svc.getById('x');
      expect(p).not.toBeNull();
    });

    it('returns null when missing (negative)', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      const p = await svc.getById('missing');
      expect(p).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('flips read=true and returns changed=true (happy)', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'x', read: false });
      prisma.post.update.mockResolvedValue({ id: 'x', read: true });
      const r = await svc.markAsRead('x');
      expect(r?.changed).toBe(true);
    });

    it('returns changed=false when already read (idempotent)', async () => {
      prisma.post.findUnique.mockResolvedValue({ id: 'x', read: true });
      const r = await svc.markAsRead('x');
      expect(r?.changed).toBe(false);
      expect(prisma.post.update).not.toHaveBeenCalled();
    });

    it('returns null when post missing (negative)', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      const r = await svc.markAsRead('missing');
      expect(r).toBeNull();
    });
  });

  describe('getUnreadCount', () => {
    it('returns count from prisma (happy)', async () => {
      prisma.post.count.mockResolvedValue(7);
      const n = await svc.getUnreadCount();
      expect(n).toBe(7);
    });

    it('propagates DB error (negative)', async () => {
      prisma.post.count.mockRejectedValue(new Error('db down'));
      await expect(svc.getUnreadCount()).rejects.toThrow();
    });
  });
});
