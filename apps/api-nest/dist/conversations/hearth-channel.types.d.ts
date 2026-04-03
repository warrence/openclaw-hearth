export interface HearthAttachment {
    id: string;
    name: string;
    url: string;
    internal_url?: string;
    mime_type: string;
    extension: string;
    category: 'image' | 'document' | 'other';
    size_bytes: number;
    text_excerpt?: string;
}
export interface HearthAppInboundEvent {
    token: string;
    callbackUrl: string;
    profileId: number;
    profileSlug: string;
    profileName: string;
    personIdentity: string;
    agentId: string;
    conversationId: number;
    conversationUuid: string;
    messageId: string;
    text: string;
    attachments?: HearthAttachment[];
    sentAt: string;
    modelPreset?: 'fast' | 'deep';
    modelOverride?: string;
    userRole?: string;
    householdMembers?: Array<{
        name: string;
        slug: string;
    }>;
    pendingReminders?: Array<{
        id: number;
        text: string;
        fire_at: string;
        critical: boolean;
        user_id: number;
    }>;
    thinkLevel?: string;
    reasoningEnabled?: boolean;
}
export interface HearthAppOutboundEvent {
    event: 'assistant.placeholder' | 'assistant.delta' | 'assistant.message' | 'status' | 'done' | 'error';
    conversationId: number;
    messageId?: string;
    mediaUrls?: string[];
    message?: {
        id: string;
        role: 'assistant';
        content: string;
        model?: string;
        created_at: string;
    };
    delta?: {
        text: string;
        elapsed_ms?: number;
    };
    status?: {
        state: string;
        label: string;
        elapsed_ms?: number;
    };
    error?: string;
}
