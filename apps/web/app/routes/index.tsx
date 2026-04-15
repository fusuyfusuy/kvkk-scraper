import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { PostCard } from '../components/PostCard';
import { useListPosts, useTriggerRefresh } from '../lib/queries';
import type { PostListQuery } from '@kvkk/shared';

// CONTRACT:
// List view route — renders filter bar, post cards grid, and refresh button.
// URL search params map to PostListQuery fields.
// Logic:
//   1. Read search params from Route.useSearch()
//   2. useListPosts(query) fetches posts
//   3. useTriggerRefresh() provides refresh mutation
//   4. Render <FilterBar> with current filters and setFilter callback
//   5. Render list of <PostCard> for each item
//   6. Refresh button calls triggerRefresh() and shows loading state

function ListPage() {
  // CONTRACT:
  // Input: PostListQuery from URL search params
  // Output: JSX — FilterBar + list of PostCards + refresh button
  // Logic:
  //   1. const { data, isLoading } = useListPosts(query)
  //   2. const { mutate: refresh, isPending } = useTriggerRefresh()
  //   3. Render loading spinner while isLoading
  //   4. Render empty state if data.items.length === 0
  //   5. Map data.items to <PostCard key={post.id} post={post} />
  const query = Route.useSearch();
  const [filters, setFilters] = useState<Partial<PostListQuery>>(query);
  const { data, isLoading } = useListPosts(filters);
  const { mutate: refresh, isPending: isRefreshing } = useTriggerRefresh();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <FilterBar filters={filters} onChange={setFilters} />
        <button
          onClick={() => refresh()}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

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
  );
}

export const Route = createFileRoute('/' as never)({
  validateSearch: (search: Record<string, unknown>): Partial<PostListQuery> => search,
  component: ListPage,
});
