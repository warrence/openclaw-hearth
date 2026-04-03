export interface OpenClawConfig {
    baseUrl: string;
    token: string;
    agents: string[];
}
export declare function setupOpenClaw(): Promise<OpenClawConfig>;
