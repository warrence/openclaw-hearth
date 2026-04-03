function buildOutboundUrl() {
    const inboundUrl = process.env["OPENCLAW_HEARTH_CHANNEL_INBOUND_URL"] ??
        "http://127.0.0.1:3001/api/channel/hearth-app/inbound";
    return inboundUrl.replace(/\/inbound$/, "/outbound");
}
function getToken() {
    return process.env["HEARTH_APP_CHANNEL_TOKEN"] ?? "";
}
async function postOutbound(to, text, mediaUrl) {
    const url = buildOutboundUrl();
    const token = getToken();
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, to, text, mediaUrl }),
    });
    if (!res.ok) {
        throw new Error(`Hearth outbound POST to ${url} failed: ${res.status} ${res.statusText}`);
    }
}
export const outboundAdapter = {
    deliveryMode: "direct",
    async sendText(ctx) {
        await postOutbound(ctx.to, ctx.text);
        return { channel: "hearth-app", messageId: ctx.to };
    },
    async sendMedia(ctx) {
        await postOutbound(ctx.to, ctx.text, ctx.mediaUrl);
        return { channel: "hearth-app", messageId: ctx.to };
    },
};
