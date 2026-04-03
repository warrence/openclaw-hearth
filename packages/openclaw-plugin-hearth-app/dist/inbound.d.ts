import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk/core";
import type { HearthAppResolvedAccount } from "./types.js";
/**
 * Dispatch a /stop command to an active OpenClaw session via the channel pipeline.
 * This sets the abortCutoff on the session entry, halting the active agent run.
 */
export declare function dispatchStopCommand(params: {
    cfg: OpenClawConfig;
    channelRuntime: PluginRuntime["channel"];
    agentId: string;
    profileSlug: string;
    conversationUuid: string;
    messageId?: string;
}): Promise<void>;
type ChannelRuntime = NonNullable<PluginRuntime["channel"]>;
export declare function createInboundHandler(account: HearthAppResolvedAccount, cfg: OpenClawConfig, channelRuntime: ChannelRuntime | undefined): (req: IncomingMessage, res: ServerResponse) => Promise<boolean | void>;
export {};
