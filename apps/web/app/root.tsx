import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { UnreadBadge } from './components/UnreadBadge';
import { useSseEvents } from './lib/sse';
import { useUnreadCount } from './lib/queries';

// CONTRACT:
// Root route — wraps the app with QueryClientProvider and renders the header with UnreadBadge.
// Logic:
//   1. Instantiate QueryClient with staleTime=30s, gcTime=5min
//   2. Render header with app title and <UnreadBadge />
//   3. Render <Outlet /> for child routes
//   4. Call useSseEvents() hook to subscribe to SSE stream globally

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
    },
  },
});

function RootComponent() {
  // CONTRACT:
  // Renders QueryClientProvider, header with UnreadBadge, and Outlet.
  // Logic:
  //   1. Wrap with <QueryClientProvider client={queryClient}>
  //   2. Header: nav with h1 "KVKK Takip" and <UnreadBadge />
  //   3. <Outlet /> for page content
  //   4. useSseEvents() subscribes globally
  useSseEvents();
  const { data: unreadData } = useUnreadCount();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">KVKK Takip</h1>
            <UnreadBadge count={unreadData?.unreadCount ?? 0} />
          </nav>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
