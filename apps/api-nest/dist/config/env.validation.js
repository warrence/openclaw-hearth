"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.envValidationSchema = void 0;
const Joi = __importStar(require("joi"));
exports.envValidationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'test', 'production')
        .default('development'),
    PORT: Joi.number().port().default(3001),
    APP_NAME: Joi.string().default('hearth-api-nest'),
    APP_HOST: Joi.alternatives().try(Joi.string().ip(), Joi.string().hostname()).default('0.0.0.0'),
    APP_PREFIX: Joi.string().allow('').default(''),
    LOG_LEVEL: Joi.string()
        .valid('fatal', 'error', 'warn', 'log', 'debug', 'verbose')
        .default('debug'),
    APP_KEY: Joi.string()
        .default('base64:9GqV1BjQeRjT8H7I3cLk2d1sM0pN4vWxYzAbCdEfGhI='),
    APP_CIPHER: Joi.string().valid('AES-256-CBC', 'AES-128-CBC').default('AES-256-CBC'),
    AUTH_SESSION_SECRET: Joi.string().min(16).default('hearth-api-nest:session:dev-secret'),
    AUTH_SESSION_COOKIE_NAME: Joi.string().default('hearth_nest_session'),
    AUTH_SESSION_COOKIE_SECURE: Joi.boolean().default(false),
    AUTH_SESSION_MAX_AGE_SECONDS: Joi.number().integer().positive().default(2592000),
    WEBPUSH_VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
    WEBPUSH_VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),
    WEBPUSH_VAPID_SUBJECT: Joi.string().allow('').optional(),
    OPENCLAW_BASE_URL: Joi.string().uri({ scheme: ['http', 'https', 'ws', 'wss'] }).allow('').optional(),
    OPENCLAW_GATEWAY_TOKEN: Joi.string().allow('').optional(),
    OPENCLAW_DEFAULT_AGENT_ID: Joi.string().default('main'),
    OPENCLAW_AGENT_ID: Joi.string().default('main'),
    OPENCLAW_DEFAULT_MODEL: Joi.string().default('openai-codex/gpt-5.4'),
    OPENCLAW_FAST_MODEL: Joi.string().default('openai-codex/gpt-5.4'),
    OPENCLAW_DEEP_MODEL: Joi.string().default('anthropic/claude-sonnet-4-5'),
    OPENCLAW_AGENT_TIMEOUT_MS: Joi.number().integer().positive().default(900000),
    OPENCLAW_RESPONSES_HTTP_ENABLED: Joi.boolean().default(true),
    OPENCLAW_RESPONSES_HTTP_PATH: Joi.string().default('/v1/responses'),
    ATTACHMENTS_STORAGE_ROOT: Joi.string().default('storage'),
    ATTACHMENTS_PUBLIC_BASE_URL: Joi.string().default('http://localhost:3001/storage'),
    ATTACHMENTS_INTERNAL_BASE_URL: Joi.string().uri({ scheme: ['http', 'https'] }).default('http://127.0.0.1:3001/storage'),
    ATTACHMENTS_TOKEN_SECRET: Joi.string().min(16).default('hearth-api-nest:attachments:dev'),
    ATTACHMENTS_TOKEN_TTL_SECONDS: Joi.number().integer().positive().default(86400),
    DATABASE_HOST: Joi.alternatives().try(Joi.string().ip(), Joi.string().hostname()).default('127.0.0.1'),
    DATABASE_PORT: Joi.number().port().default(5432),
    DATABASE_NAME: Joi.string().default('hearth'),
    DATABASE_USER: Joi.string().default('postgres'),
    DATABASE_PASSWORD: Joi.string().allow('').default('postgres'),
    DATABASE_SCHEMA: Joi.string().default('public'),
    DATABASE_SSL: Joi.boolean().default(false),
    DATABASE_AUTO_RUN_MIGRATIONS: Joi.boolean().default(false),
    DATABASE_SYNCHRONIZE: Joi.boolean().default(false),
    DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).allow('').optional(),
}).unknown(true);
