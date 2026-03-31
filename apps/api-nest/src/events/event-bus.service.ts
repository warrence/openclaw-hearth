import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export type HearthEvent = {
  type: 'message.created' | 'conversation.created' | 'conversation.updated';
  userId: number;
  conversationId: number;
  data: Record<string, unknown>;
};

@Injectable()
export class EventBusService {
  private readonly events$ = new Subject<HearthEvent>();

  emit(event: HearthEvent): void {
    this.events$.next(event);
  }

  /** Subscribe to events for a specific user */
  forUser(userId: number): Observable<HearthEvent> {
    return this.events$.pipe(
      filter((e) => e.userId === userId),
    );
  }
}
