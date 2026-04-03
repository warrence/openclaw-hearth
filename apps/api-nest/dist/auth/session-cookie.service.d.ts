import { ConfigService } from '@nestjs/config';
export declare class SessionCookieService {
    private readonly configService;
    private readonly config;
    constructor(configService: ConfigService);
    getCookieName(): string;
    createSessionCookie(userId: number): string;
    clearSessionCookie(): string;
    readUserIdFromCookieHeader(cookieHeader?: string | string[]): number | null;
    private parsePayload;
    private sign;
    private serializeCookie;
    private parseCookieHeader;
    private toBase64Url;
}
