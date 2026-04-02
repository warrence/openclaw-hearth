import { createWriteStream, mkdirSync } from "node:fs";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { dispatchInboundDirectDmWithRuntime } from "openclaw/plugin-sdk/channel-inbound";
import { resolveInboundRouteEnvelopeBuilderWithRuntime } from "openclaw/plugin-sdk/googlechat";
import { dispatchInboundReplyWithBase } from "openclaw/plugin-sdk/irc";
import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk/core";
import { buildHearthSessionKey } from "./session-key.js";
import { deliverToCallbackUrl, deliverErrorToCallbackUrl, postDeltaToCallbackUrl } from "./outbound.js";
import { registerSession, unregisterSession } from "./session-registry.js";
import type { HearthAppInboundEvent, HearthAttachment, HearthAppResolvedAccount } from "./types.js";

function validateToken(received: string, expected: string): boolean {
  if (!expected) return false;
  if (received.length !== expected.length) return false;
  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Dispatch a /stop command to an active OpenClaw session via the channel pipeline.
 * This sets the abortCutoff on the session entry, halting the active agent run.
 */
export async function dispatchStopCommand(params: {
  cfg: OpenClawConfig;
  channelRuntime: PluginRuntime["channel"];
  agentId: string;
  profileSlug: string;
  conversationUuid: string;
  messageId?: string;
}): Promise<void> {
  const { cfg, channelRuntime, agentId, profileSlug, conversationUuid, messageId } = params;
  const sessionKey = buildHearthSessionKey({ agentId, profileSlug, conversationUuid });

  await dispatchInboundDirectDmWithRuntime({
    cfg,
    runtime: { channel: channelRuntime } as Parameters<typeof dispatchInboundDirectDmWithRuntime>[0]["runtime"],
    channel: "hearth-app",
    channelLabel: "Hearth App",
    accountId: "default",
    peer: {
      kind: "direct",
      id: `app:${profileSlug}:conv:${conversationUuid}`,
    },
    senderId: profileSlug,
    senderAddress: profileSlug,
    recipientAddress: agentId,
    conversationLabel: `Hearth / ${profileSlug}`,
    rawBody: "/stop",
    commandBody: "/stop",
    commandAuthorized: true,
    messageId: messageId ?? `stop-${Date.now()}`,
    timestamp: Date.now(),
    originatingChannel: "hearth-app",
    originatingTo: profileSlug,
    deliver: async () => { /* stop command reply is silent */ },
    onRecordError: (err) => {
      console.error("[hearth-app] stop command record error:", err);
    },
    onDispatchError: (err, info) => {
      console.error(`[hearth-app] stop command dispatch error (${info.kind}):`, err);
    },
  });
}

/**
 * Download a URL to a local tmp file and return the local path.
 * Returns null if the download fails (non-fatal — we just skip that attachment).
 */
async function downloadToWorkspace(url: string, ext: string): Promise<string | null> {
  const workspaceDir = join(homedir(), ".openclaw", "workspace");
  try {
    mkdirSync(workspaceDir, { recursive: true });
  } catch {
    // ignore
  }

  const safeExt = /^\.[a-z0-9]+$/i.test(ext) ? ext : ".bin";
  const destPath = join(workspaceDir, `hearth-img-${randomUUID()}${safeExt}`);

  return new Promise((resolve) => {
    try {
      const getter = url.startsWith("https") ? httpsGet : httpGet;
      const req = getter(url, (res) => {
        if (!res.statusCode || res.statusCode >= 400) {
          res.resume();
          resolve(null);
          return;
        }
        const stream = createWriteStream(destPath);
        res.pipe(stream);
        stream.on("finish", () => stream.close(() => resolve(destPath)));
        stream.on("error", () => resolve(null));
      });
      req.on("error", () => resolve(null));
      req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Resolve image attachments into local workspace paths for the agent.
 * Uses internal_url first (served by NestJS), then falls back to url.
 */
async function stageImageAttachments(
  attachments: HearthAttachment[],
): Promise<{ paths: string[]; types: string[] }> {
  const paths: string[] = [];
  const types: string[] = [];

  for (const attachment of attachments) {
    if (attachment.category !== "image") continue;

    const url = attachment.internal_url || attachment.url;
    if (!url) continue;

    const ext = extname(attachment.name) || `.${attachment.extension}` || ".jpg";
    const localPath = await downloadToWorkspace(url, ext);
    if (localPath) {
      paths.push(localPath);
      types.push(attachment.mime_type || "image/jpeg");
    } else {
      console.warn(`[hearth-app] Failed to stage image attachment: ${attachment.name}`);
    }
  }

  return { paths, types };
}

type ChannelRuntime = NonNullable<PluginRuntime["channel"]>;

export function createInboundHandler(
  account: HearthAppResolvedAccount,
  cfg: OpenClawConfig,
  channelRuntime: ChannelRuntime | undefined,
) {
  return async function handleInbound(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean | void> {
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" });
      res.end("Method Not Allowed");
      return true;
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
      return true;
    }

    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "Expected JSON object" });
      return true;
    }

    const event = body as HearthAppInboundEvent;

    if (!validateToken(event.token ?? "", account.token)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return true;
    }

    if (!event.text || !event.profileSlug || !event.conversationUuid || !event.callbackUrl) {
      sendJson(res, 400, { error: "Missing required fields" });
      return true;
    }

    const agentId = event.agentId || account.agentId;
    console.log(`[hearth-app] dispatch: agent=${agentId} event.agentId=${event.agentId} conversation=${event.conversationId}`);
    const sessionKey = buildHearthSessionKey({
      agentId,
      profileSlug: event.profileSlug,
      conversationUuid: event.conversationUuid,
    });

    // Acknowledge immediately — delivery is async
    sendJson(res, 202, { accepted: true, sessionKey });

    const startedAt = Date.now();

    // Register session so tool hooks can route status events back to this callback
    registerSession(sessionKey, event.callbackUrl, event.conversationId);

    try {
      if (!channelRuntime) {
        console.error("[hearth-app] channelRuntime not available — cannot dispatch");
        unregisterSession(sessionKey);
        void deliverErrorToCallbackUrl(event, new Error("channelRuntime not available"));
        return;
      }

      // Stage image attachments to local workspace for the agent
      const imageAttachments = event.attachments?.filter((a) => a.category === "image") ?? [];
      const { paths: mediaPaths, types: mediaTypes } = imageAttachments.length > 0
        ? await stageImageAttachments(imageAttachments)
        : { paths: [], types: [] };

      // Build extraContext with media fields if images are present
      const extraContext: Record<string, unknown> = {};
      if (mediaPaths.length === 1) {
        extraContext["MediaPath"] = mediaPaths[0];
        extraContext["MediaUrl"] = mediaPaths[0];
        extraContext["MediaType"] = mediaTypes[0];
        extraContext["MediaPaths"] = mediaPaths;
        extraContext["MediaUrls"] = mediaPaths;
        extraContext["MediaTypes"] = mediaTypes;
      } else if (mediaPaths.length > 1) {
        extraContext["MediaPath"] = mediaPaths[0];
        extraContext["MediaUrl"] = mediaPaths[0];
        extraContext["MediaType"] = mediaTypes[0];
        extraContext["MediaPaths"] = mediaPaths;
        extraContext["MediaUrls"] = mediaPaths;
        extraContext["MediaTypes"] = mediaTypes;
      }

      const now = new Date().toISOString();
      const rolePolicy = event.userRole === 'owner'
        ? `USER ROLE: Owner (${event.profileName}). Full access — can manage settings, view system info, and modify configurations.`
        : `USER ROLE: Member (${event.profileName}). RESTRICTED ACCESS — this user must NOT be allowed to:
- View, change, or ask about any OpenClaw configuration, API keys, models, or system settings
- Access dashboard or admin features
- Modify any settings, files, or system configuration
- See technical details about the system architecture, server, or infrastructure
- Run commands, exec, or access the filesystem
If they ask about any of these, politely decline and say only the owner can manage those settings. Treat them as a normal chat user only.`;

      const capabilityManifest = `[Hearth system — REQUIRED]
Current time: ${now} (Asia/Kuching, UTC+8)
${rolePolicy}

REMINDER SCHEDULING: When user asks for a reminder, append this block to your reply (it is completely invisible to the user — do NOT mention it, do NOT explain it, do NOT say "I scheduled" or "I added an action"):
\`\`\`hearth-action
{"type":"reminder","fire_at":"<ISO8601 with +08:00>","text":"<reminder text>","target":"<optional: household member slug>","critical":<optional: true for critical reminders>}
\`\`\`

- Calculate fire_at from the current time above
- text should be a warm friendly nudge, NOT just the raw subject. Example: "Hey Dad, time to check your email! 📧" not "check email"
- Use the target person's name in the text if targeting someone else
- "target" is OPTIONAL — only include it when the user wants to remind a DIFFERENT household member
- Household members: ${(event.householdMembers ?? []).map(m => `${m.name} (slug: ${m.slug})`).join(', ') || 'unknown'}
- Use the slug value for "target". You know these people — use your memory to match nicknames (e.g. "mom" → the right member). If unsure, ask the user to confirm.
- "critical" is OPTIONAL — set to true when user says "important", "critical", "must not miss", "keep reminding", "nag me", or implies urgency. Critical reminders repeat every minute until the user responds.
- Never mention the hearth-action block or any "Note:" about scheduling
- Just reply naturally + silently include the block

REMINDER LISTING: When user asks to see/list their reminders, append:
\`\`\`hearth-action
{"type":"list-reminders"}
\`\`\`
The system will inject the results. Present them in a friendly format (table or list).
${event.userRole === 'owner' ? 'As owner, you can see ALL household reminders. Use {"type":"list-reminders","all":true} to see everyone\'s reminders.' : 'You can only see your own reminders.'}

REMINDER CANCELLATION: When user asks to cancel/delete a reminder, append:
\`\`\`hearth-action
{"type":"cancel-reminder","id":<reminder_id>}
\`\`\`
${event.userRole === 'owner' ? 'As owner, you can cancel any reminder.' : 'You can only cancel your own reminders.'}

IMPORTANT: Do not send intermediate progress messages like "I'm checking..." or "Let me look that up..." — complete your research/tool calls first, then send ONE final reply with the complete answer. Partial messages get cut off.

`;

      // Build preset directives
      const directives: string[] = [];
      if (event.modelOverride) directives.push(`/model ${event.modelOverride}`);
      if (event.thinkLevel && event.thinkLevel !== 'off') directives.push(`/think ${event.thinkLevel}`);
      if (event.reasoningEnabled === true) directives.push(`/reasoning on`);
      const directiveBlock = directives.length > 0 ? directives.join("\n") + "\n" : "";

      if (directives.length > 0) {
        console.log(`[hearth-app] preset directives: ${directives.join(" ")} agent=${agentId} conversation=${event.conversationId}`);
      }

      const bodyForAgent = `${capabilityManifest}\n${directiveBlock}${event.text}`;
      console.log(`[hearth-app] manifest role=${event.userRole ?? 'unknown'} profile=${event.profileSlug}`);
      console.log(`[hearth-app] manifest household: ${(event.householdMembers ?? []).map(m => m.name + ':' + m.slug).join(', ')}`);

      const peer = {
        kind: "direct" as const,
        id: `app:${event.profileSlug}:conv:${event.conversationUuid}`,
      };

      const { route, buildEnvelope } = resolveInboundRouteEnvelopeBuilderWithRuntime({
        cfg,
        channel: "hearth-app",
        accountId: "default",
        peer,
        runtime: channelRuntime as Parameters<typeof resolveInboundRouteEnvelopeBuilderWithRuntime>[0]["runtime"],
      });

      const { storePath, body } = buildEnvelope({
        channel: "Hearth App",
        from: `Hearth / ${event.profileName}`,
        body: event.text,
        timestamp: Date.parse(event.sentAt),
      });

      const ctxPayload = channelRuntime.reply.finalizeInboundContext({
        Body: body,
        BodyForAgent: bodyForAgent,
        RawBody: event.text,
        CommandBody: event.text,
        From: event.profileSlug,
        To: agentId,
        SessionKey: route.sessionKey,
        AccountId: (route as Record<string, unknown>)["accountId"] as string ?? "default",
        ChatType: "direct",
        ConversationLabel: `Hearth / ${event.profileName}`,
        SenderId: event.profileSlug,
        Provider: "hearth-app",
        Surface: "hearth-app",
        MessageSid: event.messageId,
        MessageSidFull: event.messageId,
        Timestamp: Date.parse(event.sentAt),
        OriginatingChannel: "hearth-app",
        OriginatingTo: event.profileSlug,
        ...(Object.keys(extraContext).length > 0 ? extraContext : {}),
      });

      let previousText = "";

      await dispatchInboundReplyWithBase({
        cfg,
        channel: "hearth-app",
        accountId: "default",
        route: { agentId: route.agentId, sessionKey: route.sessionKey },
        storePath,
        ctxPayload,
        core: {
          channel: {
            session: { recordInboundSession: channelRuntime.session.recordInboundSession },
            reply: { dispatchReplyWithBufferedBlockDispatcher: channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher },
          },
        },
        deliver: async (payload) => {
          unregisterSession(sessionKey);
          await deliverToCallbackUrl(event, payload, startedAt);
        },
        onRecordError: (err) => {
          console.error("[hearth-app] session record error:", err);
        },
        onDispatchError: (err, info) => {
          console.error(`[hearth-app] dispatch error (${info.kind}):`, err);
          unregisterSession(sessionKey);
          void deliverErrorToCallbackUrl(event, err);
        },
        replyOptions: {
          onPartialReply: (payload) => {
            const fullText = typeof payload === "string" ? payload : (payload as { text?: string }).text ?? "";
            if (!fullText || fullText === previousText) return;
            let newDelta = fullText.slice(previousText.length);
            previousText = fullText;
            // Strip hearth-action blocks from streaming output so user never sees them
            newDelta = newDelta
              .replace(/```hearth-action[\s\S]*?```/g, "")
              .replace(/hearth-action\s*\{[^}]*\}/gi, "");
            if (newDelta.trim()) {
              void postDeltaToCallbackUrl(event, newDelta, startedAt);
            }
          },
        },
      });
    } catch (err) {
      console.error("[hearth-app] inbound dispatch failed:", err);
      unregisterSession(sessionKey);
      void deliverErrorToCallbackUrl(event, err);
    }
  };
}
