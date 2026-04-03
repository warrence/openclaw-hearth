import { DatabaseService } from '../database/database.service';
export type PushSubscriptionRecord = {
    id: number;
    user_id: number;
    endpoint: string;
    current_conversation_id: number | null;
    public_key: string;
    auth_token: string;
    content_encoding: string | null;
    is_visible: boolean;
    user_agent: string | null;
    last_used_at: string | null;
    presence_seen_at: string | null;
    created_at: string;
    updated_at: string;
};
export declare class PushRepository {
    private readonly databaseService;
    constructor(databaseService: DatabaseService);
    saveSubscription(params: {
        userId: number;
        endpoint: string;
        publicKey: string;
        authToken: string;
        contentEncoding: string;
        userAgent: string | null;
    }): Promise<PushSubscriptionRecord>;
    updatePresenceExact(params: {
        userId: number;
        endpoint: string;
        conversationId: number | null;
        isVisible: boolean;
    }): Promise<PushSubscriptionRecord | null>;
    findLatestSubscriptionForUser(userId: number): Promise<PushSubscriptionRecord | null>;
    updatePresenceById(params: {
        id: number;
        conversationId: number | null;
        isVisible: boolean;
    }): Promise<PushSubscriptionRecord>;
    findAllSubscriptionsForUser(userId: number): Promise<PushSubscriptionRecord[]>;
    deleteSubscription(userId: number, endpoint: string): Promise<void>;
    private mapRow;
    private toIsoString;
}
