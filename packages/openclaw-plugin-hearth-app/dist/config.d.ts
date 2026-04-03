import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk/core";
type ChannelConfigAdapter<T> = NonNullable<ChannelPlugin<T>["config"]>;
import type { HearthAppResolvedAccount } from "./types.js";
/** Standalone helper — resolves config without needing a full account object */
export declare function resolveHearthConfig(cfg: OpenClawConfig): HearthAppResolvedAccount;
export declare const configAdapter: ChannelConfigAdapter<HearthAppResolvedAccount>;
export {};
