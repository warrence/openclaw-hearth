import type { OutboundReplyPayload } from "openclaw/plugin-sdk/reply-payload";
import type { HearthAppInboundEvent, HearthAppOutboundEvent } from "./types.js";

// Buffer for accumulating media across multiple deliver() calls
const pendingMedia = new Map<number, string[]>();

export async function deliverToCallbackUrl(
  event: HearthAppInboundEvent,
  payload: OutboundReplyPayload,
  startedAt: number,
): Promise<void> {
  const text = payload.text ?? "";
  const rawMediaUrl = payload.mediaUrl ?? "none";
  const rawMediaUrls = payload.mediaUrls ?? [];

  // Collect media from this delivery — dedupe mediaUrl + mediaUrls
  const rawUrlSet = new Set<string>();
  if (payload.mediaUrl) rawUrlSet.add(payload.mediaUrl);
  if (payload.mediaUrls?.length) payload.mediaUrls.forEach((u) => rawUrlSet.add(u));
  const rawUrls = [...rawUrlSet];

  // If media-only (no text), buffer it — OpenClaw sends media and text in separate deliver() calls
  if (!text.trim() && rawUrls.length > 0) {
    const existing = pendingMedia.get(event.conversationId) ?? [];
    existing.push(...rawUrls);
    pendingMedia.set(event.conversationId, existing);
    return;
  }

  // Combine any buffered media with this delivery
  const buffered = pendingMedia.get(event.conversationId) ?? [];
  pendingMedia.delete(event.conversationId);
  const allMediaUrls = [...buffered, ...rawUrls];
  const mediaUrls = allMediaUrls.length > 0 ? allMediaUrls : undefined;

  const outbound: HearthAppOutboundEvent = {
    event: "assistant.message",
    conversationId: event.conversationId,
    messageId: event.messageId,
    message: {
      id: event.messageId,
      role: "assistant",
      content: text,
      created_at: new Date().toISOString(),
    },
    mediaUrls,
  };

  await postToCallback(event.callbackUrl, outbound);

  const done: HearthAppOutboundEvent = {
    event: "done",
    conversationId: event.conversationId,
  };

  await postToCallback(event.callbackUrl, done);
}

export async function deliverErrorToCallbackUrl(
  event: HearthAppInboundEvent,
  error: unknown,
): Promise<void> {
  const msg =
    error instanceof Error ? error.message : String(error);

  const outbound: HearthAppOutboundEvent = {
    event: "error",
    conversationId: event.conversationId,
    error: msg,
  };

  try {
    await postToCallback(event.callbackUrl, outbound);
  } catch {
    // Best-effort — don't throw from error delivery
  }
}

/**
 * Post a streaming delta event to Nest callback — for real-time typing effect.
 */
export async function postDeltaToCallbackUrl(
  event: HearthAppInboundEvent,
  text: string,
  startedAt: number,
): Promise<void> {
  const outbound: HearthAppOutboundEvent = {
    event: "assistant.delta",
    conversationId: event.conversationId,
    delta: {
      text,
      elapsed_ms: Date.now() - startedAt,
    },
  };
  try {
    await postToCallback(event.callbackUrl, outbound);
  } catch {
    // best-effort — don't interrupt generation
  }
}

/** Map tool names to friendly labels shown in the Hearth UI */
const TOOL_LABELS: Record<string, string> = {
  web_search: "🔍 Searching the web",
  web_fetch: "🌐 Reading a webpage",
  Read: "📖 Reading files",
  Write: "💾 Writing files",
  Edit: "✏️ Editing files",
  exec: "💻 Running a command",
  memory_search: "🧠 Searching memory",
  memory_store: "🧠 Saving to memory",
  memory_forget: "🧠 Updating memory",
  image_generate: "🎨 Generating image",
  image: "🖼️ Analysing image",
  browser: "🌐 Browsing web",
  sessions_spawn: "🤖 Spawning agent",
};

export async function postToolStatusToCallback(
  callbackUrl: string,
  conversationId: number,
  toolName: string,
  elapsedMs = 0,
): Promise<void> {
  const label = TOOL_LABELS[toolName] ?? `⚙️ Using ${toolName}`;
  const outbound: HearthAppOutboundEvent = {
    event: "status",
    conversationId,
    status: {
      state: "running",
      label,
      elapsed_ms: elapsedMs,
    },
  };
  try {
    await postToCallback(callbackUrl, outbound);
  } catch {
    // best-effort — don't interrupt tool execution
  }
}

async function postToCallback(
  callbackUrl: string,
  body: HearthAppOutboundEvent,
): Promise<void> {
  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Callback POST to ${callbackUrl} failed: ${res.status} ${res.statusText}`);
  }
}
