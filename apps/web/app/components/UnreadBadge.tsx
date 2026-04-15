import { useUnreadCount } from '../lib/queries';

// CONTRACT:
// Renders a badge showing the number of unread posts.
// Fetches unreadCount via useUnreadCount() hook (refetches every 60s).
// Output: badge element or null if count === 0
// Logic:
//   1. const { data } = useUnreadCount()
//   2. If data?.unreadCount === 0 or undefined, render nothing
//   3. Render a red badge span with the unreadCount number

export function UnreadBadge() {
  throw new Error('not implemented');
}
