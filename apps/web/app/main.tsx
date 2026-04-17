import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';

import { Route as RootRoute } from './root';
import { Route as IndexRoute } from './routes/index';
import { Route as PostDetailRoute } from './routes/posts.$id';

// @ts-expect-error TanStack Router file-based routes require codegen for full type safety
const routeTree = RootRoute.addChildren([IndexRoute, PostDetailRoute]);
const router = createRouter({ routeTree });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
