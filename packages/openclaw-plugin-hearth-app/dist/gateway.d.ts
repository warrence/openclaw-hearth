import type { ChannelPlugin } from "openclaw/plugin-sdk/core";
import { createInboundHandler } from "./inbound.js";
import type { HearthAppResolvedAccount } from "./types.js";
type ChannelGatewayAdapter<T> = NonNullable<ChannelPlugin<T>["gateway"]>;
export declare const gatewayAdapter: ChannelGatewayAdapter<HearthAppResolvedAccount>;
type ChannelRuntimeRef = Parameters<typeof createInboundHandler>[2];
export declare function getChannelRuntime(): ChannelRuntimeRef | undefined;
export {};
