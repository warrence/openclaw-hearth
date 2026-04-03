import { Observable } from 'rxjs';
export type HearthEvent = {
    type: 'message.created' | 'conversation.created' | 'conversation.updated';
    userId: number;
    conversationId: number;
    data: Record<string, unknown>;
};
export declare class EventBusService {
    private readonly events$;
    emit(event: HearthEvent): void;
    forUser(userId: number): Observable<HearthEvent>;
}
