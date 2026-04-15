import { useEffect } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
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
  const { id } = Route.useParams();
  const { data: post, isLoading, isError } = usePost(id);
  const { mutate: markAsRead } = useMarkAsRead();

  useEffect(() => {
    if (post && !post.read) {
      markAsRead(id);
    }
  }, [id, post, markAsRead]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Post Not Found</h2>
        <Link to="/" className="text-blue-600 hover:text-blue-700 underline">
          Back to Posts
        </Link>
      </div>
    );
  }

  const displayDate = post.publicationDate
    ? new Date(post.publicationDate).toLocaleDateString('tr-TR')
    : new Date(post.scrapedAt).toLocaleDateString('tr-TR');

  const incidentDateStr = post.incidentDate
    ? new Date(post.incidentDate).toLocaleDateString('tr-TR')
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/" className="text-blue-600 hover:text-blue-700 underline mb-6 inline-block">
        ← Back to Posts
      </Link>

      <article className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>

        <div className="text-sm text-gray-500 space-y-2 mb-6">
          <p>Published: {displayDate}</p>
          {incidentDateStr && <p>Incident Date: {incidentDateStr}</p>}
        </div>

        {post.sourceUrl && (
          <div className="mb-6">
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              View Source
            </a>
          </div>
        )}

        <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
          {post.content.split('\n').map((paragraph, idx) => (
            paragraph.trim() && (
              <p key={idx} className="text-gray-700">
                {paragraph}
              </p>
            )
          ))}
        </div>
      </article>
    </div>
  );
}

export const Route = createFileRoute('/posts/$id' as never)({
  component: PostDetailPage,
});
