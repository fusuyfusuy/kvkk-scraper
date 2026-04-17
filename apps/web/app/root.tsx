import { Outlet, createRootRoute } from '@tanstack/react-router';
import { UnreadBadge } from './components/UnreadBadge';
import { useSseEvents } from './lib/sse';
import { useUnreadCount, useTriggerRefresh } from './lib/queries';

function RootComponent() {
  useSseEvents();
  const { data: unreadData } = useUnreadCount();
  const { mutate: refresh, isPending } = useTriggerRefresh();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">KVKK Takip</h1>
          <div className="flex items-center gap-4">
            <UnreadBadge count={unreadData?.unreadCount ?? 0} />
            <button
              onClick={() => refresh()}
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm transition-colors"
            >
              {isPending ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
