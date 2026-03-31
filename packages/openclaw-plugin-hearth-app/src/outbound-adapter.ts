import type { ChannelOutboundAdapter } from "openclaw/plugin-sdk/channel-send-result";

type OutboundCtx = Parameters<NonNullable<ChannelOutboundAdapter["sendText"]>>[0];

function buildOutboundUrl(): string {
  const inboundUrl =
    process.env["OPENCLAW_HEARTH_CHANNEL_INBOUND_URL"] ??
    "http://127.0.0.1:3001/api/channel/hearth-app/inbound";
  return inboundUrl.replace(/\/inbound$/, "/outbound");
}

function getToken(): string {
  return process.env["HEARTH_APP_CHANNEL_TOKEN"] ?? "";
}

async function postOutbound(
  to: string,
  text: string,
  mediaUrl?: string,
): Promise<void> {
  const url = buildOutboundUrl();
  const token = getToken();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, to, text, mediaUrl }),
  });

  if (!res.ok) {
    throw new Error(
      `Hearth outbound POST to ${url} failed: ${res.status} ${res.statusText}`,
    );
  }
}

export const outboundAdapter: ChannelOutboundAdapter = {
  deliveryMode: "direct",

  async sendText(ctx: OutboundCtx) {
    await postOutbound(ctx.to, ctx.text);
    return { channel: "hearth-app", messageId: ctx.to };
  },

  async sendMedia(ctx: OutboundCtx) {
    await postOutbound(ctx.to, ctx.text, ctx.mediaUrl);
    return { channel: "hearth-app", messageId: ctx.to };
  },
};
