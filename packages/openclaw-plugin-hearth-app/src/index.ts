import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { hearthAppChannel } from "./channel.js";
import { createInboundHandler, dispatchStopCommand } from "./inbound.js";
import { resolveHearthConfig } from "./config.js";
import { getChannelRuntime } from "./gateway.js";
import { getOnlyActiveSessionEntry, getSessionEntry, pruneExpired } from "./session-registry.js";
import { postToolStatusToCallback } from "./outbound.js";


// Prune expired session entries every 5 minutes
setInterval(pruneExpired, 5 * 60 * 1000).unref();

export default defineChannelPluginEntry({
  id: "hearth-app",
  name: "Hearth App",
  description: "Native OpenClaw channel plugin for Hearth household AI app",
  plugin: hearthAppChannel,
  registerFull(api) {
    const account = resolveHearthConfig(api.config);
    if (!account.token) {
      api.logger.warn?.("[hearth-app] No token configured — skipping HTTP route registration");
      return;
    }

    // Create a handler that defers channelRuntime lookup to request time
    // (channelRuntime is set when startAccount runs, after registerFull)
    const handler = createInboundHandler(account, api.config, undefined);

    // Wrap to pick up channelRuntime at request time
    api.registerHttpRoute({
      path: account.httpPath,
      auth: "plugin",
      handler: async (req, res) => {
        const rt = getChannelRuntime();
        const liveHandler = rt
          ? createInboundHandler(account, api.config, rt)
          : handler;
        return liveHandler(req, res);
      },
    });

    // Abort route — POST /channel/hearth-app/abort
    const abortPath = account.httpPath.replace(/\/inbound$/, "/abort");
    api.registerHttpRoute({
      path: abortPath,
      auth: "plugin",
      handler: async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            req.on("data", (c: Buffer) => chunks.push(c));
            req.on("end", resolve);
            req.on("error", reject);
          });
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            agentId?: string;
            profileSlug: string;
            conversationUuid: string;
            token?: string; // optional — route is already protected by plugin auth
          };
          const rt = getChannelRuntime();
          if (!rt) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "channelRuntime not available" }));
            return;
          }
          await dispatchStopCommand({
            cfg: api.config,
            channelRuntime: rt,
            agentId: body.agentId || account.agentId,
            profileSlug: body.profileSlug,
            conversationUuid: body.conversationUuid,
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          api.logger.error?.(`[hearth-app] abort route error: ${String(err)}`);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "abort failed" }));
        }
      },
    });

    // TTS route — uses OpenClaw's built-in TTS (reads messages.tts from openclaw.json)
    const ttsPath = account.httpPath.replace(/\/inbound$/, "/tts");
    api.registerHttpRoute({
      path: ttsPath,
      auth: "plugin",
      handler: async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            req.on("data", (c: Buffer) => chunks.push(c));
            req.on("end", resolve);
            req.on("error", reject);
          });
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { text: string };
          const text = body?.text?.trim();
          if (!text) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "text is required" }));
            return;
          }

          const { textToSpeech } = await import("openclaw/plugin-sdk/speech-runtime");
          const result = await textToSpeech({ text, cfg: api.config, channel: "hearth-app" });

          if (!result.success || !result.audioPath) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: result.error || "TTS synthesis failed" }));
            return;
          }

          const { readFileSync } = await import("node:fs");
          const audioBuffer = readFileSync(result.audioPath);
          const ext = result.outputFormat || "mp3";
          const mime = ext === "opus" ? "audio/ogg" : ext === "wav" ? "audio/wav" : "audio/mpeg";

          res.writeHead(200, {
            "Content-Type": mime,
            "Content-Length": String(audioBuffer.length),
          });
          res.end(audioBuffer);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err) }));
        }
      },
    });

    // Register before_tool_call hook to stream tool status to Hearth frontend
    api.on("before_tool_call", async (event, ctx) => {
      const sessionKey = ctx.sessionKey;
      const entry = sessionKey
        ? getSessionEntry(sessionKey)
        : getOnlyActiveSessionEntry();
      api.logger.info?.(
        `[hearth-app] before_tool_call tool=${event.toolName} sessionKey=${sessionKey ?? ""} matchedConversation=${entry?.conversationId ?? ""}`,
      );
      if (!entry) return;
      await postToolStatusToCallback(
        entry.callbackUrl,
        entry.conversationId,
        event.toolName,
        0,
      );
    });

    api.logger.info?.(`[hearth-app] Registered HTTP route: ${account.httpPath}`);
  },
});
