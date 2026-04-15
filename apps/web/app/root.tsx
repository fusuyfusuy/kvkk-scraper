import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { UnreadBadge } from './components/UnreadBadge';
import { useSseEvents } from './lib/sse';

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
  throw new Error('not implemented');
}

export const Route = createRootRoute({
  component: RootComponent,
});
