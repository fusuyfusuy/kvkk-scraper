import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import type { SseEvent } from '@kvkk/shared';

@Injectable()
export class SseService {
  private readonly subject = new Subject<SseEvent>();

  emit(event: SseEvent): void {
    this.subject.next(event);
  }

  asObservable(): Observable<SseEvent> {
    return this.subject.asObservable();
  }
}
