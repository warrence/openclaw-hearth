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
    hearthChannelInboundUrl: string;
    hearthChannelToken: string;
    hearthCallbackBaseUrl: string;
};
export declare const openClawConfig: (() => OpenClawConfig) & import("@nestjs/config").ConfigFactoryKeyHost<OpenClawConfig>;
