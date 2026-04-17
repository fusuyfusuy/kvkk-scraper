import type {
  PostListQuery,
  PostListResponse,
  PostDetailResponse,
  RefreshResponse,
  MarkAsReadResponse,
  UnreadCountResponse,
} from '@kvkk/shared';

const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000/api';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export function listPosts(query: Partial<PostListQuery>): Promise<PostListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.company) params.set('company', query.company);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom.toISOString());
  if (query.dateTo) params.set('dateTo', query.dateTo.toISOString());
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.unreadOnly) params.set('unreadOnly', 'true');
  const qs = params.toString();
  return fetchJson<PostListResponse>(`/posts${qs ? `?${qs}` : ''}`);
}

export function getPost(id: number): Promise<PostDetailResponse> {
  return fetchJson<PostDetailResponse>(`/posts/${id}`);
}

export function markAsRead(id: number): Promise<MarkAsReadResponse> {
  return fetchJson<MarkAsReadResponse>(`/posts/${id}/read`, { method: 'POST' });
}

export function triggerRefresh(): Promise<RefreshResponse> {
  return fetchJson<RefreshResponse>('/scraper/refresh', { method: 'POST' });
}

export function getUnreadCount(): Promise<UnreadCountResponse> {
  return fetchJson<UnreadCountResponse>('/posts/unread/count');
}
