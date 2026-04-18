import { buildAgentSessionKey } from "openclaw/plugin-sdk/core";

export function buildHearthPeerId(params: {
  profileSlug: string;
  conversationUuid: string;
}): string {
  return `app:${params.profileSlug}:conv:${params.conversationUuid}`;
}

export function buildHearthSessionKey(params: {
  agentId: string;
  profileSlug: string;
  conversationUuid: string;
}): string {
  return buildAgentSessionKey({
    agentId: params.agentId,
    channel: "hearth-app",
    accountId: "default",
    dmScope: "per-channel-peer",
    peer: {
      kind: "direct",
      id: buildHearthPeerId(params),
    },
  });
}
