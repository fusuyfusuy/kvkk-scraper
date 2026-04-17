import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { PostCard } from '../components/PostCard';
import { Button } from '../components/form/Button';
import { useListPosts, useTriggerRefresh } from '../lib/queries';
import type { PostListQuery } from '@kvkk/shared';

function PostsPage() {
  const query = Route.useSearch();
  const [filters, setFilters] = useState<Partial<PostListQuery>>(query);
  const { data, isLoading } = useListPosts(filters);
  const { mutate: refresh, isPending: isRefreshing } = useTriggerRefresh();

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Posts</h2>
        <Button onClick={() => refresh()} loading={isRefreshing}>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="p-8 space-y-6">
        <FilterBar filters={filters} onChange={setFilters} />

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : data?.items && data.items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No posts found</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/posts' as never)({
  validateSearch: (search: Record<string, unknown>): Partial<PostListQuery> => search,
  component: PostsPage,
});
