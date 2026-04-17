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
        if (
          data.event === 'post:created' ||
          data.event === 'post:updated' ||
          data.event === 'scrape:completed'
        ) {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
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
