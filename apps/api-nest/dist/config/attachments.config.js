"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachmentsConfig = void 0;
const config_1 = require("@nestjs/config");
const node_path_1 = require("node:path");
const normalizeBaseUrl = (value) => value.replace(/\/+$/, '');
exports.attachmentsConfig = (0, config_1.registerAs)('attachments', () => ({
    storageRoot: (0, node_path_1.resolve)(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT ?? 'storage'),
    publicBaseUrl: normalizeBaseUrl(process.env.ATTACHMENTS_PUBLIC_BASE_URL ?? 'http://localhost:3001/storage'),
    internalBaseUrl: normalizeBaseUrl(process.env.ATTACHMENTS_INTERNAL_BASE_URL ??
        'http://127.0.0.1:3001/storage'),
    tokenSecret: process.env.ATTACHMENTS_TOKEN_SECRET ??
        `${process.env.APP_NAME ?? 'hearth-api-nest'}:attachments:dev`,
    tokenTtlSeconds: Number(process.env.ATTACHMENTS_TOKEN_TTL_SECONDS ?? 86400),
}));
