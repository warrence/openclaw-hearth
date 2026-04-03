"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionCookieService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
let SessionCookieService = class SessionCookieService {
    configService;
    config;
    constructor(configService) {
        this.configService = configService;
        this.config = this.configService.getOrThrow('auth', {
            infer: true,
        });
    }
    getCookieName() {
        return this.config.sessionCookieName;
    }
    createSessionCookie(userId) {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            uid: userId,
            iat: now,
            exp: now + this.config.sessionMaxAgeSeconds,
        };
        const encodedPayload = this.toBase64Url(JSON.stringify(payload));
        const signature = this.sign(encodedPayload);
        return this.serializeCookie(`${encodedPayload}.${signature}`);
    }
    clearSessionCookie() {
        return this.serializeCookie('', 0);
    }
    readUserIdFromCookieHeader(cookieHeader) {
        const cookieValue = this.parseCookieHeader(cookieHeader)[this.getCookieName()];
        if (!cookieValue) {
            return null;
        }
        const [encodedPayload, signature] = cookieValue.split('.', 2);
        if (!encodedPayload || !signature) {
            return null;
        }
        const expectedSignature = this.sign(encodedPayload);
        if (signature.length !== expectedSignature.length ||
            !(0, node_crypto_1.timingSafeEqual)(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return null;
        }
        const payload = this.parsePayload(encodedPayload);
        if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload.uid;
    }
    parsePayload(encodedPayload) {
        try {
            const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
            if (!Number.isInteger(payload.uid) ||
                !Number.isInteger(payload.iat) ||
                !Number.isInteger(payload.exp)) {
                return null;
            }
            return payload;
        }
        catch {
            return null;
        }
    }
    sign(encodedPayload) {
        return (0, node_crypto_1.createHmac)('sha256', this.config.sessionSecret)
            .update(encodedPayload)
            .digest('base64url');
    }
    serializeCookie(value, maxAge = this.config.sessionMaxAgeSeconds) {
        const parts = [
            `${this.getCookieName()}=${encodeURIComponent(value)}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            `Max-Age=${maxAge}`,
        ];
        if (maxAge === 0) {
            parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        }
        if (this.config.sessionCookieSecure) {
            parts.push('Secure');
        }
        return parts.join('; ');
    }
    parseCookieHeader(cookieHeader) {
        const rawCookie = Array.isArray(cookieHeader)
            ? cookieHeader.join('; ')
            : cookieHeader ?? '';
        return rawCookie
            .split(';')
            .map((part) => part.trim())
            .filter((part) => part.includes('='))
            .reduce((cookies, part) => {
            const separatorIndex = part.indexOf('=');
            const key = part.slice(0, separatorIndex).trim();
            const value = part.slice(separatorIndex + 1).trim();
            cookies[key] = decodeURIComponent(value);
            return cookies;
        }, {});
    }
    toBase64Url(value) {
        return Buffer.from(value, 'utf8').toString('base64url');
    }
};
exports.SessionCookieService = SessionCookieService;
exports.SessionCookieService = SessionCookieService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SessionCookieService);
