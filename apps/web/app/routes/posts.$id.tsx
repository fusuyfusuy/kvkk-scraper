import { createFileRoute } from '@tanstack/react-router';
import { usePost, useMarkAsRead } from '../lib/queries';

// CONTRACT:
// Post detail view route — renders full post content and marks as read on mount.
// Logic:
//   1. Get id from Route.useParams()
//   2. usePost(id) fetches post detail
//   3. useMarkAsRead(id) fires mutation on mount (idempotent)
//   4. Render: title, publicationDate, incidentDate, content, link to sourceUrl
//   5. If loading, show skeleton; if error, show 404 message

function PostDetailPage() {
  // CONTRACT:
  // Input: id (string UUID from route params)
  // Output: JSX — post detail view
  // Logic:
  //   1. const { id } = Route.useParams()
  //   2. const { data: post, isLoading, isError } = usePost(id)
  //   3. useEffect(() => { markAsRead(id) }, [id])
  //   4. Render post fields or loading/error states
  throw new Error('not implemented');
}

export const Route = createFileRoute('/posts/$id')({
  component: PostDetailPage,
});
