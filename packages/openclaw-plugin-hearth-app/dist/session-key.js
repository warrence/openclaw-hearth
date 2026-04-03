import { buildAgentSessionKey } from "openclaw/plugin-sdk/core";
export function buildHearthSessionKey(params) {
    return buildAgentSessionKey({
        agentId: params.agentId,
        channel: "hearth-app",
        accountId: "default",
        peer: {
            kind: "direct",
            id: `app:${params.profileSlug}:conv:${params.conversationUuid}`,
        },
    });
}
