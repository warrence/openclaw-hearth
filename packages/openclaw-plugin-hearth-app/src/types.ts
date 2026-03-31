export interface HearthAttachment {
  id: string;
  name: string;
  url: string;
  internal_url?: string;
  mime_type: string;
  extension: string;
  category: "image" | "document" | "other";
  size_bytes: number;
  text_excerpt?: string;
}

export interface HearthAppInboundEvent {
  // Authentication
  token: string;
  callbackUrl: string;

  // Identity
  profileId: number;
  profileSlug: string;
  profileName: string;
  personIdentity: string; // e.g. "person:alex"
  agentId: string;        // "aeris"

  // Conversation
  conversationId: number;
  conversationUuid: string;
  messageId: string;

  // Content
  text: string;
  attachments?: HearthAttachment[];
  sentAt: string;

  // Routing
  modelPreset?: "auto" | "fast" | "deep";
  /** Resolved model name to use — injected as /model directive */
  modelOverride?: string;
  /** User role: owner or member */
  userRole?: string;
  /** Household members for cross-member reminders */
  householdMembers?: Array<{ name: string; slug: string }>;
  /** Think level — injected as /think <level> directive */
  thinkLevel?: string;
  /** Whether to enable extended reasoning — injected as /reasoning on */
  reasoningEnabled?: boolean;
}

export interface HearthAppOutboundEvent {
  event:
    | "assistant.placeholder"
    | "assistant.delta"
    | "assistant.message"
    | "status"
    | "done"
    | "error";
  conversationId: number;
  messageId?: string;

  /** Local file paths or public URLs for media produced by the agent (e.g. generated images). */
  mediaUrls?: string[];

  message?: {
    id: string;
    role: "assistant";
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
    tool?: string;
  };

  error?: string;
}

export interface HearthAppResolvedAccount {
  accountId: string;
  token: string;
  agentId: string;
  httpPath: string;
}
