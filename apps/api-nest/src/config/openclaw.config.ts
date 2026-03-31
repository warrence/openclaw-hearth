import { registerAs } from '@nestjs/config';

export type OpenClawConfig = {
  baseUrl?: string;
  token?: string;
  defaultAgentId: string;
  defaultModel: string;
  fastModel: string;
  deepModel: string;
  agentTimeoutMs: number;
  responsesHttpEnabled: boolean;
  responsesPath: string;
  agentMap: Record<string, string>;
  /** URL of the OpenClaw Hearth native channel inbound endpoint */
  hearthChannelInboundUrl: string;
  /**
   * Auth token the Hearth plugin expects in the inbound event body.
   * Must match HEARTH_APP_CHANNEL_TOKEN on the plugin side.
   */
  hearthChannelToken: string;
  /**
   * Base URL Nest advertises to the plugin for callback POSTs.
   * The full callback URL is {hearthCallbackBaseUrl}/api/channel/hearth-app/callback/{token}
   */
  hearthCallbackBaseUrl: string;
};

export const openClawConfig = registerAs(
  'openclaw',
  (): OpenClawConfig => ({
    baseUrl: process.env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789',
    token: process.env.OPENCLAW_GATEWAY_TOKEN || undefined,
    // Agent and model defaults — overridden by hearth.json (dashboard settings)
    defaultAgentId: 'daughter-aeris',
    defaultModel: 'openai-codex/gpt-5.4',
    fastModel: 'openai-codex/gpt-5.4',   // fallback only; hearth.json takes priority
    deepModel: 'anthropic/claude-sonnet-4-5', // fallback only; hearth.json takes priority
    agentTimeoutMs: Number(process.env.OPENCLAW_AGENT_TIMEOUT_MS ?? 900000),
    responsesHttpEnabled: process.env.OPENCLAW_RESPONSES_HTTP_ENABLED !== 'false',
    responsesPath: process.env.OPENCLAW_RESPONSES_HTTP_PATH ?? '/v1/responses',
    agentMap: {
      aeris: 'daughter-aeris', // fallback only; hearth.json agentSettings takes priority
    },
    hearthChannelInboundUrl:
      process.env.OPENCLAW_HEARTH_CHANNEL_INBOUND_URL ??
      'http://127.0.0.1:18789/channel/hearth-app/inbound',
    hearthChannelToken:
      process.env.OPENCLAW_HEARTH_CHANNEL_TOKEN ??
      process.env.HEARTH_APP_CHANNEL_TOKEN ??
      '',
    hearthCallbackBaseUrl:
      (
        process.env.OPENCLAW_HEARTH_CALLBACK_BASE_URL ??
        process.env.HEARTH_CALLBACK_BASE_URL ??
        'http://127.0.0.1:3001'
      ).replace(/\/$/, ''),
  }),
);
