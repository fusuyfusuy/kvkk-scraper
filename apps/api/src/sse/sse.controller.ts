import { Controller, Get, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SseService } from './sse.service';
import type { SseEvent } from '@kvkk/shared';

@Controller('events')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  // CONTRACT:
  // GET /events — open SSE stream for real-time events
  // Input: none (client connects with EventSource)
  // Output: Observable<MessageEvent> (NestJS SSE format)
  // Logic:
  //   1. Return sseService.getEvents() mapped to NestJS MessageEvent format { data, type }
  //   2. NestJS handles Content-Type: text/event-stream and keep-alive
  //   3. Client auto-reconnects via EventSource browser API
  @Sse()
  stream(): Observable<MessageEvent> {
    throw new Error('not implemented');
  }
}
