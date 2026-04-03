import { ConversationRecord, MessageRecord } from '../conversations.repository';
export declare class SendConversationMessageDto {
    content?: string | null;
    attachments?: string[] | null;
    stream?: boolean | null;
}
export type SendConversationMessageResponse = {
    user_message: MessageRecord;
    assistant_message: null;
    conversation: ConversationRecord;
    runtime: {
        transport_mode: 'nest-local-persist';
        contract_shaped: false;
    };
};
export type ConversationMessageStreamEvent = {
    event: 'message.created' | 'assistant.placeholder' | 'assistant.delta' | 'assistant.message' | 'status' | 'progress' | 'done' | 'error' | 'conversation.updated';
    data: Record<string, unknown>;
};
