export const gatewayAdapter = {
    async startAccount(ctx) {
        const { cfg, account } = ctx;
        // The HTTP route is registered via registerFull in index.ts using api.registerHttpRoute().
        // startAccount is called per-account and gives us channelRuntime access.
        // We store the channelRuntime reference so the handler can use it for dispatch.
        if (ctx.channelRuntime) {
            // Update the handler with channelRuntime now that it's available.
            // The route is already registered; we just set up the runtime reference.
            ctx.log?.info?.(`[hearth-app] [${account.accountId}] startAccount: channelRuntime available`);
            setChannelRuntime(ctx.channelRuntime);
        }
        else {
            ctx.log?.warn?.("[hearth-app] channelRuntime not available — dispatch will fail");
        }
        ctx.log?.info?.(`[hearth-app] [${account.accountId}] started`);
        // Keep running until aborted
        await new Promise((resolve) => {
            ctx.abortSignal?.addEventListener?.("abort", () => resolve());
        });
    },
    async stopAccount(ctx) {
        ctx.log?.info?.("[hearth-app] stopAccount called");
        clearChannelRuntime();
    },
};
let _channelRuntime;
export function getChannelRuntime() {
    return _channelRuntime;
}
function setChannelRuntime(rt) {
    _channelRuntime = rt;
}
function clearChannelRuntime() {
    _channelRuntime = undefined;
}
