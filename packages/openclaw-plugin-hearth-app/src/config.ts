import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk/core";

// ChannelConfigAdapter is an internal type - use the field type from ChannelPlugin
type ChannelConfigAdapter<T> = NonNullable<ChannelPlugin<T>["config"]>;
import type { HearthAppResolvedAccount } from "./types.js";

const CHANNEL_SECTION = "hearth-app";
const DEFAULT_HTTP_PATH = "/channel/hearth-app/inbound";
const DEFAULT_AGENT_ID = "main";

function getChannelConfig(cfg: OpenClawConfig): Record<string, unknown> {
  const channels = (cfg as Record<string, unknown>)["channels"];
  if (channels && typeof channels === "object") {
    const ch = (channels as Record<string, unknown>)[CHANNEL_SECTION];
    if (ch && typeof ch === "object") {
      return ch as Record<string, unknown>;
    }
  }
  // Also check plugin config path
  const plugins = (cfg as Record<string, unknown>)["plugins"];
  if (plugins && typeof plugins === "object") {
    const entries = (plugins as Record<string, unknown>)["entries"];
    if (entries && typeof entries === "object") {
      const entry = (entries as Record<string, unknown>)["hearth-app"];
      if (entry && typeof entry === "object") {
        const config = (entry as Record<string, unknown>)["config"];
        if (config && typeof config === "object") {
          return config as Record<string, unknown>;
        }
      }
    }
  }
  return {};
}

/** Standalone helper — resolves config without needing a full account object */
export function resolveHearthConfig(cfg: OpenClawConfig): HearthAppResolvedAccount {
  return configAdapter.resolveAccount(cfg, "default");
}

export const configAdapter: ChannelConfigAdapter<HearthAppResolvedAccount> = {
  listAccountIds(_cfg: OpenClawConfig): string[] {
    return ["default"];
  },

  resolveAccount(cfg: OpenClawConfig, accountId?: string | null): HearthAppResolvedAccount {
    const section = getChannelConfig(cfg);
    const token = (section["token"] as string | undefined) ?? process.env["HEARTH_APP_CHANNEL_TOKEN"] ?? "";
    const agentId = (section["agentId"] as string | undefined) ?? DEFAULT_AGENT_ID;
    const httpPath = (section["httpPath"] as string | undefined) ?? DEFAULT_HTTP_PATH;
    return {
      accountId: accountId ?? "default",
      token,
      agentId,
      httpPath,
    };
  },

  isConfigured(account: HearthAppResolvedAccount): boolean {
    return account.token.length > 0;
  },

  unconfiguredReason(_account: HearthAppResolvedAccount): string {
    return "No token configured. Set token in plugin config or HEARTH_APP_CHANNEL_TOKEN env var.";
  },

  describeAccount(account: HearthAppResolvedAccount) {
    return {
      accountId: account.accountId,
      label: `Hearth App (${account.httpPath})`,
    };
  },
};
