export interface NetworkConfig {
    publicUrl: string;
    useCaddy: boolean;
    domain?: string;
    httpsPort: number;
    httpPort: number;
}
export declare function setupNetwork(): Promise<NetworkConfig>;
