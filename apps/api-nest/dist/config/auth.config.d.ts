export declare const authConfig: (() => {
    sessionSecret: string;
    sessionCookieName: string;
    sessionCookieSecure: boolean;
    sessionMaxAgeSeconds: number;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    sessionSecret: string;
    sessionCookieName: string;
    sessionCookieSecure: boolean;
    sessionMaxAgeSeconds: number;
}>;
