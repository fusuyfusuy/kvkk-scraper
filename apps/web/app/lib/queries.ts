import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import type { PostListQuery, AppConfigPatch } from '@kvkk/shared';

export function useListPosts(query: Partial<PostListQuery>) {
  return useQuery({
    queryKey: ['posts', 'list', query],
    queryFn: () => api.listPosts(query),
    staleTime: 30_000,
  });
}

export function usePost(id: number) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => api.getPost(id),
    enabled: !!id,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['posts', 'unread-count'],
    queryFn: api.getUnreadCount,
    refetchInterval: 60_000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useTriggerRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.triggerRefresh,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['scrape-runs'] });
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: AppConfigPatch) => api.updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: (recipient: string) => api.sendTestEmail(recipient),
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 30_000,
  });
}

export function useScrapeRuns() {
  return useQuery({
    queryKey: ['scrape-runs'],
    queryFn: api.listScrapeRuns,
  });
}

export function useEmailDeliveries() {
  return useQuery({
    queryKey: ['email-deliveries'],
    queryFn: () => api.listEmailDeliveries(50),
  });
}
