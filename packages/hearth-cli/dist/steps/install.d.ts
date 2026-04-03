export declare function installDependencies(): Promise<void>;
export interface PluginTokens {
    channelToken: string;
    gatewayToken: string;
}
export declare function installPlugin(): Promise<PluginTokens>;
export declare function buildWebApp(): Promise<void>;
