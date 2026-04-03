import { ConfigService } from '@nestjs/config';
export declare class LaravelCryptoService {
    private readonly configService;
    constructor(configService: ConfigService);
    encryptString(value: string): string;
    decryptString(payload: string): string;
    tryDecryptString(value: string | null | undefined): string | null;
    private decodePayload;
    private resolveCipherName;
    private resolveKey;
    private resolveIvLength;
}
