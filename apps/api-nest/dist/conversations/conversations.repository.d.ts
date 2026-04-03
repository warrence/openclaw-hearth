import { AttachmentPayload } from '../attachments/attachments.types';
import { DatabaseService } from '../database/database.service';
export type ConversationScope = 'active' | 'archived';
export type UserRecord = {
    id: number;
    name: string;
    slug: string;
    avatar: string | null;
    memory_namespace: string;
    default_agent_id: string | null;
    is_active: boolean;
    role: string;
    pin_set_at: string | null;
    last_login_at: string | null;
    requires_pin: boolean;
    created_at: string;
    updated_at: string;
    has_pin: boolean;
};
export type SearchMatchRecord = {
    matched_fields: string[];
    preview: string;
    message_id: number | null;
    message_created_at: string | null;
};
export type ConversationRecord = {
    id: number;
    user_id: number;
    title: string;
    agent_id: string;
    mode: string;
    model_preset: string;
    openclaw_session_key: string;
    status: string;
    archived_at: string | null;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
    messages_count?: number;
    search_match?: SearchMatchRecord;
    user?: UserRecord;
};
export type MessageRecord = {
    id: number;
    conversation_id: number;
    role: string;
    content: string;
    model: string | null;
    metadata_json: Record<string, unknown> | null;
    source: string | null;
    channel: string | null;
    contract_event: string | null;
    channel_message_id: string | null;
    person_identity: string | null;
    agent_id: string | null;
    reply_to_message_id: string | null;
    sent_at: string | null;
    contract_json: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
};
type CreateConversationParams = {
    userId: number;
    title: string;
    agentId?: string;
    modelPreset?: 'fast' | 'deep';
};
type UpdateConversationParams = {
    title?: string;
    agentId?: string;
    modelPreset?: 'fast' | 'deep';
    status?: 'active' | 'archived';
};
type CreateUserMessageParams = {
    conversationId: number;
    content: string;
    attachments?: AttachmentPayload[];
};
type CreateAssistantMessageParams = {
    conversationId: number;
    content: string;
    model?: string | null;
    metadata?: Record<string, unknown> | null;
    messageId: string;
    replyToMessageId?: string | null;
    personIdentity?: string | null;
    agentId?: string | null;
    sentAt?: string | null;
    contractJson?: Record<string, unknown> | null;
};
export declare class ConversationsRepository {
    private readonly databaseService;
    constructor(databaseService: DatabaseService);
    findUserBySlug(slug: string): Promise<{
        id: number;
        name: string;
        slug: string;
    } | null>;
    listAllUsers(): Promise<Array<{
        id: number;
        name: string;
        slug: string;
    }>>;
    listUserConversations(params: {
        userId: number;
        scope?: ConversationScope;
        search?: string;
        limit?: number;
    }): Promise<ConversationRecord[]>;
    createConversation(params: CreateConversationParams): Promise<ConversationRecord>;
    findConversationById(conversationId: number): Promise<ConversationRecord | null>;
    updateConversation(conversationId: number, params: UpdateConversationParams): Promise<ConversationRecord>;
    findConversationBySessionKey(sessionKey: string): Promise<ConversationRecord | null>;
    findLatestActiveConversationByUserSlug(slug: string): Promise<ConversationRecord | null>;
    deleteConversation(conversationId: number): Promise<void>;
    listConversationMessages(conversationId: number): Promise<MessageRecord[]>;
    findLastImageAttachment(conversationId: number): Promise<AttachmentPayload | null>;
    createUserMessage(params: CreateUserMessageParams): Promise<{
        userMessage: MessageRecord;
        conversation: ConversationRecord;
    }>;
    createAssistantMessage(params: CreateAssistantMessageParams): Promise<{
        assistantMessage: MessageRecord;
        conversation: ConversationRecord;
    }>;
    private mapConversationRow;
    private mapConversationDetailRow;
    private mapMessageRow;
    private buildAppSessionKey;
    private toNumber;
    private toIsoString;
    private toRequiredIsoString;
    private formatLaravelTimestamp;
}
export {};
