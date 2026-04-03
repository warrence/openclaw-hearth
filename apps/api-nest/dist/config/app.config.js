"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
const config_1 = require("@nestjs/config");
exports.appConfig = (0, config_1.registerAs)('app', () => ({
    name: process.env.APP_NAME ?? 'hearth-api-nest',
    environment: process.env.NODE_ENV ?? 'development',
    host: process.env.APP_HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3001),
    prefix: process.env.APP_PREFIX ?? '',
    logLevel: process.env.LOG_LEVEL ?? 'debug',
}));
