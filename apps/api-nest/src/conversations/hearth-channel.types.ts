/**
 * Types matching the openclaw-plugin-hearth-app contract.
 * Keep in sync with packages/openclaw-plugin-hearth-app/src/types.ts.
 */

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
  /** Plugin auth token — must match HEARTH_APP_CHANNEL_TOKEN on the plugin side */
  token: string;
  /** URL the plugin will POST reply events back to */
  callbackUrl: string;

  profileId: number;
  profileSlug: string;
  profileName: string;
  /** e.g. "person:alex" */
  personIdentity: string;
  /** e.g. "main" */
  agentId: string;

  conversationId: number;
  /** UUID segment extracted from the conversation's openclaw_session_key */
  conversationUuid: string;
  messageId: string;

  text: string;
  attachments?: HearthAttachment[];
  sentAt: string;

  modelPreset?: 'fast' | 'deep';
  /** Resolved model identifier to use — overrides the session default */
  modelOverride?: string;
  /** User role: owner or member */
  userRole?: string;
  /** Household members for cross-member reminders */
  householdMembers?: Array<{ name: string; slug: string }>;
  /** Think level directive (off | minimal | low | medium | high | xhigh | adaptive) */
  thinkLevel?: string;
  /** Whether to enable extended reasoning */
  reasoningEnabled?: boolean;
}

export interface HearthAppOutboundEvent {
  event:
    | 'assistant.placeholder'
    | 'assistant.delta'
    | 'assistant.message'
    | 'status'
    | 'done'
    | 'error';
  conversationId: number;
  messageId?: string;

  /** Local file paths or public URLs for media produced by the agent (e.g. generated images). */
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
