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

function normalizeKeys(sessionKeys: string | string[]): string[] {
  const values = Array.isArray(sessionKeys) ? sessionKeys : [sessionKeys];
  return [...new Set(values.map((key) => key.trim().toLowerCase()).filter(Boolean))];
}

export function registerSession(
  sessionKeys: string | string[],
  callbackUrl: string,
  conversationId: number,
): void {
  const entry: SessionEntry = {
    callbackUrl,
    conversationId,
    expiresAt: Date.now() + TTL_MS,
  };

  for (const key of normalizeKeys(sessionKeys)) {
    registry.set(key, entry);
  }
}

export function unregisterSession(sessionKeys: string | string[]): void {
  for (const key of normalizeKeys(sessionKeys)) {
    registry.delete(key);
  }
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

export function getOnlyActiveSessionEntry(): SessionEntry | undefined {
  const now = Date.now();
  const unique = new Map<string, SessionEntry>();

  for (const [key, entry] of registry.entries()) {
    if (now > entry.expiresAt) {
      registry.delete(key);
      continue;
    }

    unique.set(`${entry.conversationId}|${entry.callbackUrl}`, entry);
    if (unique.size > 1) return undefined;
  }

  return unique.values().next().value;
}

/** Prune expired entries — call periodically to avoid memory leaks. */
export function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of registry.entries()) {
    if (now > entry.expiresAt) registry.delete(key);
  }
}
