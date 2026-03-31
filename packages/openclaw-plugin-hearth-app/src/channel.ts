import type { ChannelPlugin } from "openclaw/plugin-sdk/core";
import { configAdapter } from "./config.js";
import { gatewayAdapter } from "./gateway.js";
import { outboundAdapter } from "./outbound-adapter.js";
import type { HearthAppResolvedAccount } from "./types.js";

export const hearthAppChannel: ChannelPlugin<HearthAppResolvedAccount> = {
  id: "hearth-app",

  meta: {
    id: "hearth-app",
    label: "Hearth App",
    selectionLabel: "Hearth App",
    docsPath: "hearth-app",
    blurb: "Native channel for Hearth household AI app",
  },

  capabilities: {
    chatTypes: ["direct"],
  },

  config: configAdapter,

  outbound: outboundAdapter,

  gateway: gatewayAdapter,
};
