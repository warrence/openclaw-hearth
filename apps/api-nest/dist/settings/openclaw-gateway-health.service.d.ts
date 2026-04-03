import { ConfigService } from '@nestjs/config';
import { GatewayConnectionRecord } from './settings.repository';
import { LaravelCryptoService } from './laravel-crypto.service';
export declare class OpenClawGatewayHealthError extends Error {
}
export declare class OpenClawGatewayHealthService {
    private readonly configService;
    private readonly cryptoService;
    constructor(configService: ConfigService, cryptoService: LaravelCryptoService);
    health(gateway: GatewayConnectionRecord | null): Promise<Record<string, unknown>>;
    testConnection(baseUrl: string, token?: string | null): Promise<Record<string, unknown>>;
    private decryptGatewayToken;
    private normalizeTokenValue;
    private shouldUseLocalGatewayDefaults;
    private normalizeGatewayUrl;
    private buildHealthCommand;
    private runHealthCommand;
    private extractJsonPayload;
    private resolveCliBin;
    private getConfig;
}
