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
  throw new Error('not implemented');
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): Partial<PostListQuery> => search,
  component: ListPage,
});
