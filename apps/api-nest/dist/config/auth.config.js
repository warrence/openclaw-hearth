"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authConfig = void 0;
const config_1 = require("@nestjs/config");
exports.authConfig = (0, config_1.registerAs)('auth', () => ({
    sessionSecret: process.env.AUTH_SESSION_SECRET ?? 'hearth-api-nest:session:dev-secret',
    sessionCookieName: process.env.AUTH_SESSION_COOKIE_NAME ?? 'hearth_nest_session',
    sessionCookieSecure: String(process.env.AUTH_SESSION_COOKIE_SECURE ?? 'false').toLowerCase() === 'true',
    sessionMaxAgeSeconds: Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS ?? 60 * 60 * 24 * 30),
}));
