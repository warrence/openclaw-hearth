import { EventBusService } from '../events/event-bus.service';
import { PushService } from '../push/push.service';
import { ConversationsRepository } from './conversations.repository';
export type HearthOutboundPayload = {
    token: string;
    to: string;
    text: string;
    mediaUrl?: string;
};
export declare class OutboundMessageService {
    private readonly conversationsRepository;
    private readonly pushService;
    private readonly eventBus;
    private readonly logger;
    constructor(conversationsRepository: ConversationsRepository, pushService: PushService, eventBus: EventBusService);
    deliverOutboundMessage(payload: HearthOutboundPayload): Promise<void>;
    deliverInternal(conversationId: number, userId: number, text: string): Promise<void>;
    private deliverToConversation;
    private resolveConversation;
}
