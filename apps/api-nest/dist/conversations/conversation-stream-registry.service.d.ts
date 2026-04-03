import type { StreamExecutionParams } from './conversation-assistant-execution.service';
import { ConversationRecord } from './conversations.repository';
import { ConversationMessageStreamEvent } from './dto/send-conversation-message.dto';
export type StreamEntry = {
    params: StreamExecutionParams;
    startedAt: number;
    emit: (event: ConversationMessageStreamEvent) => void;
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    partialText: string;
    persistedConversation?: ConversationRecord;
    persistedMessageId?: number;
};
export declare class ConversationStreamRegistryService {
    private readonly streams;
    register(token: string, params: StreamExecutionParams, emit: (event: ConversationMessageStreamEvent) => void, timeoutMs: number): Promise<void>;
    getEntry(token: string): StreamEntry | undefined;
    cancel(token: string): void;
    complete(token: string): void;
    fail(token: string, message: string): void;
    cancelByConversationId(conversationId: number): {
        agentId: string;
        profileSlug: string;
        conversationUuid: string;
    } | null;
    get size(): number;
}
