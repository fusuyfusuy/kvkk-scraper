import { Link } from '@tanstack/react-router';
import type { Post } from '@kvkk/shared';

interface PostCardProps {
  post: Post;
}

// CONTRACT:
// Renders a summary card for a single Post in the list view.
// Input: post (Post from packages/shared/src/types/post.ts)
// Output: JSX card with title, dates, read indicator, and link to detail view
// Logic:
//   1. Display post.title (bold, truncated)
//   2. Display post.publicationDate formatted in Turkish locale
//   3. Display post.incidentDate if present
//   4. Unread indicator: dot or bold border if post.read === false
//   5. Entire card is a Link to /posts/${post.id}

export function PostCard({ post }: PostCardProps) {
  throw new Error('not implemented');
}
