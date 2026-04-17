import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Sidebar } from './components/Sidebar';
import { ToastProvider } from './components/Toast';
import { useSseEvents } from './lib/sse';

function RootComponent() {
  useSseEvents();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="ml-60 min-h-screen">
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
