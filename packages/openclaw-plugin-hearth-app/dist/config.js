const CHANNEL_SECTION = "hearth-app";
const DEFAULT_HTTP_PATH = "/channel/hearth-app/inbound";
const DEFAULT_AGENT_ID = "main";
function getChannelConfig(cfg) {
    const channels = cfg["channels"];
    if (channels && typeof channels === "object") {
        const ch = channels[CHANNEL_SECTION];
        if (ch && typeof ch === "object") {
            return ch;
        }
    }
    // Also check plugin config path
    const plugins = cfg["plugins"];
    if (plugins && typeof plugins === "object") {
        const entries = plugins["entries"];
        if (entries && typeof entries === "object") {
            const entry = entries["hearth-app"];
            if (entry && typeof entry === "object") {
                const config = entry["config"];
                if (config && typeof config === "object") {
                    return config;
                }
            }
        }
    }
    return {};
}
/** Standalone helper — resolves config without needing a full account object */
export function resolveHearthConfig(cfg) {
    return configAdapter.resolveAccount(cfg, "default");
}
export const configAdapter = {
    listAccountIds(_cfg) {
        return ["default"];
    },
    resolveAccount(cfg, accountId) {
        const section = getChannelConfig(cfg);
        const token = section["token"] ?? process.env["HEARTH_APP_CHANNEL_TOKEN"] ?? "";
        const agentId = section["agentId"] ?? DEFAULT_AGENT_ID;
        const httpPath = section["httpPath"] ?? DEFAULT_HTTP_PATH;
        return {
            accountId: accountId ?? "default",
            token,
            agentId,
            httpPath,
        };
    },
    isConfigured(account) {
        return account.token.length > 0;
    },
    unconfiguredReason(_account) {
        return "No token configured. Set token in plugin config or HEARTH_APP_CHANNEL_TOKEN env var.";
    },
    describeAccount(account) {
        return {
            accountId: account.accountId,
            label: `Hearth App (${account.httpPath})`,
        };
    },
};
