import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import type { SseEvent } from '@kvkk/shared';

@Injectable()
export class SseService {
  private readonly subject = new Subject<SseEvent>();

  // CONTRACT:
  // Return an Observable that clients subscribe to for SSE events.
  // Output: Observable<SseEvent> (packages/shared/src/types/api.ts)
  // Logic:
  //   1. Return this.subject.asObservable()
  getEvents(): Observable<SseEvent> {
    throw new Error('not implemented');
  }

  // CONTRACT:
  // Emit a new event to all connected SSE clients.
  // Input: event (SseEvent from packages/shared/src/types/api.ts)
  // Output: void
  // Logic:
  //   1. this.subject.next({ ...event, timestamp: new Date() })
  emit(event: Omit<SseEvent, 'timestamp'>): void {
    throw new Error('not implemented');
  }
}
