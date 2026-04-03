/**
 * In-memory registry mapping OpenClaw session keys to active Hearth inbound events.
 * Used by plugin hooks (before_tool_call etc.) to route status events back to Nest.
 *
 * Entries are written when an inbound dispatch starts and cleaned up after the
 * deliver callback fires (or after a TTL).
 */
type SessionEntry = {
    callbackUrl: string;
    conversationId: number;
    expiresAt: number;
};
export declare function registerSession(sessionKey: string, callbackUrl: string, conversationId: number): void;
export declare function unregisterSession(sessionKey: string): void;
export declare function getSessionEntry(sessionKey: string): SessionEntry | undefined;
/** Prune expired entries — call periodically to avoid memory leaks. */
export declare function pruneExpired(): void;
export {};
