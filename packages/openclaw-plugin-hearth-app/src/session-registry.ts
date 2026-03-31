/**
 * In-memory registry mapping OpenClaw session keys to active Hearth inbound events.
 * Used by plugin hooks (before_tool_call etc.) to route status events back to Nest.
 *
 * Entries are written when an inbound dispatch starts and cleaned up after the
 * deliver callback fires (or after a TTL).
 */

const TTL_MS = 15 * 60 * 1000; // 15 min — matches agent timeout

type SessionEntry = {
  callbackUrl: string;
  conversationId: number;
  expiresAt: number;
};

const registry = new Map<string, SessionEntry>();

export function registerSession(sessionKey: string, callbackUrl: string, conversationId: number): void {
  registry.set(sessionKey.toLowerCase(), {
    callbackUrl,
    conversationId,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function unregisterSession(sessionKey: string): void {
  registry.delete(sessionKey.toLowerCase());
}

export function getSessionEntry(sessionKey: string): SessionEntry | undefined {
  const entry = registry.get(sessionKey.toLowerCase());
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    registry.delete(sessionKey.toLowerCase());
    return undefined;
  }
  return entry;
}

/** Prune expired entries — call periodically to avoid memory leaks. */
export function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of registry.entries()) {
    if (now > entry.expiresAt) registry.delete(key);
  }
}
