import type { DatabaseConfig } from './database';
import type { OpenClawConfig } from './openclaw';
import type { AgentConfig } from './agent';
import type { PluginTokens } from './install';
interface EnvParams {
    db: DatabaseConfig;
    openclaw: OpenClawConfig;
    agent: AgentConfig;
    pluginTokens?: PluginTokens;
}
export declare function writeEnvFile(params: EnvParams): Promise<void>;
export {};
