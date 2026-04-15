import { Link } from '@tanstack/react-router';
import type { Post } from '@kvkk/shared';

interface PostCardProps {
  post: Post;
  onClick?: () => void;
}

export function PostCard({ post, onClick }: PostCardProps) {
  const displayDate = post.publicationDate
    ? new Date(post.publicationDate).toLocaleDateString('tr-TR')
    : new Date(post.scrapedAt).toLocaleDateString('tr-TR');

  const incidentDateStr = post.incidentDate
    ? new Date(post.incidentDate).toLocaleDateString('tr-TR')
    : null;

  const content =
    post.content.length > 160
      ? post.content.substring(0, 160) + '...'
      : post.content;

  const cardContent = (
    <div className="flex gap-3">
      {!post.read && (
        <div className="flex-shrink-0 pt-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-gray-900 break-words">{post.title}</h3>
        <div className="text-sm text-gray-500 mt-1 space-y-1">
          <p>Yayın: {displayDate}</p>
          {incidentDateStr && <p>Olay: {incidentDateStr}</p>}
        </div>
        <p className="text-sm text-gray-700 mt-2 line-clamp-2">{content}</p>
      </div>
    </div>
  );

  try {
    return (
      <Link to={'/posts/$id'} params={{ id: post.id }}>
        <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer">
          {cardContent}
        </div>
      </Link>
    );
  } catch {
    return (
      <button
        onClick={onClick}
        className="w-full text-left p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
      >
        {cardContent}
      </button>
    );
  }
}
