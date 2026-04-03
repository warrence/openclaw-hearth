import type { OpenClawConfig } from './openclaw';
export interface AgentConfig {
    agentId: string;
    displayName: string;
}
export declare function setupAgent(openclaw: OpenClawConfig): Promise<AgentConfig>;
