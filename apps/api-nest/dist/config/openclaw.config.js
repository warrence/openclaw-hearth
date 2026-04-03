"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openClawConfig = void 0;
const config_1 = require("@nestjs/config");
exports.openClawConfig = (0, config_1.registerAs)('openclaw', () => ({
    baseUrl: process.env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789',
    token: process.env.OPENCLAW_GATEWAY_TOKEN || undefined,
    defaultAgentId: 'main',
    defaultModel: process.env.OPENCLAW_DEFAULT_MODEL || 'openclaw',
    fastModel: process.env.OPENCLAW_FAST_MODEL || process.env.OPENCLAW_DEFAULT_MODEL || 'openclaw',
    deepModel: process.env.OPENCLAW_DEEP_MODEL || process.env.OPENCLAW_DEFAULT_MODEL || 'openclaw',
    agentTimeoutMs: Number(process.env.OPENCLAW_AGENT_TIMEOUT_MS ?? 900000),
    responsesHttpEnabled: process.env.OPENCLAW_RESPONSES_HTTP_ENABLED !== 'false',
    responsesPath: process.env.OPENCLAW_RESPONSES_HTTP_PATH ?? '/v1/responses',
    agentMap: {
        main: 'main',
    },
    hearthChannelInboundUrl: process.env.OPENCLAW_HEARTH_CHANNEL_INBOUND_URL ??
        'http://127.0.0.1:18789/channel/hearth-app/inbound',
    hearthChannelToken: process.env.OPENCLAW_HEARTH_CHANNEL_TOKEN ??
        process.env.HEARTH_APP_CHANNEL_TOKEN ??
        '',
    hearthCallbackBaseUrl: (process.env.OPENCLAW_HEARTH_CALLBACK_BASE_URL ??
        process.env.HEARTH_CALLBACK_BASE_URL ??
        'http://127.0.0.1:3001').replace(/\/$/, ''),
}));
