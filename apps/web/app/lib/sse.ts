import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000/api';

export function useSseEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/events`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const name = data.event as string | undefined;
        if (
          name === 'post:created' ||
          name === 'post:updated' ||
          name === 'scrape:completed'
        ) {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
        }
        if (
          name === 'scrape:completed' ||
          name === 'scrape:failed' ||
          name === 'email:sent' ||
          name === 'email:failed'
        ) {
          queryClient.invalidateQueries({ queryKey: ['stats'] });
          queryClient.invalidateQueries({ queryKey: ['scrape-runs'] });
          queryClient.invalidateQueries({ queryKey: ['email-deliveries'] });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => es.close();
  }, [queryClient]);
}
