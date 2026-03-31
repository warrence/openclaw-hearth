import type { ChannelPlugin } from "openclaw/plugin-sdk/core";
import { createInboundHandler } from "./inbound.js";
import type { HearthAppResolvedAccount } from "./types.js";

// ChannelGatewayAdapter is an internal type — derive from ChannelPlugin
type ChannelGatewayAdapter<T> = NonNullable<ChannelPlugin<T>["gateway"]>;
type GatewayCtx = Parameters<NonNullable<ChannelGatewayAdapter<HearthAppResolvedAccount>["startAccount"]>>[0];

export const gatewayAdapter: ChannelGatewayAdapter<HearthAppResolvedAccount> = {
  async startAccount(ctx: GatewayCtx) {
    const { cfg, account } = ctx;

    // The HTTP route is registered via registerFull in index.ts using api.registerHttpRoute().
    // startAccount is called per-account and gives us channelRuntime access.
    // We store the channelRuntime reference so the handler can use it for dispatch.
    if (ctx.channelRuntime) {
      // Update the handler with channelRuntime now that it's available.
      // The route is already registered; we just set up the runtime reference.
      ctx.log?.info?.(`[hearth-app] [${account.accountId}] startAccount: channelRuntime available`);
      setChannelRuntime(ctx.channelRuntime);
    } else {
      ctx.log?.warn?.("[hearth-app] channelRuntime not available — dispatch will fail");
    }

    ctx.log?.info?.(`[hearth-app] [${account.accountId}] started`);

    // Keep running until aborted
    await new Promise<void>((resolve) => {
      ctx.abortSignal?.addEventListener?.("abort", () => resolve());
    });
  },

  async stopAccount(ctx: GatewayCtx) {
    ctx.log?.info?.("[hearth-app] stopAccount called");
    clearChannelRuntime();
  },
};

// Module-level runtime reference shared with the inbound handler
type ChannelRuntimeRef = Parameters<typeof createInboundHandler>[2];
let _channelRuntime: ChannelRuntimeRef | undefined;

export function getChannelRuntime(): ChannelRuntimeRef | undefined {
  return _channelRuntime;
}

function setChannelRuntime(rt: NonNullable<Parameters<typeof createInboundHandler>[2]>) {
  _channelRuntime = rt;
}

function clearChannelRuntime() {
  _channelRuntime = undefined;
}
