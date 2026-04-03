import { configAdapter } from "./config.js";
import { gatewayAdapter } from "./gateway.js";
import { outboundAdapter } from "./outbound-adapter.js";
export const hearthAppChannel = {
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
