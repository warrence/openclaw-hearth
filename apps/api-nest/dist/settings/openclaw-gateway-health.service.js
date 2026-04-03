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
exports.OpenClawGatewayHealthService = exports.OpenClawGatewayHealthError = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const laravel_crypto_service_1 = require("./laravel-crypto.service");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
class OpenClawGatewayHealthError extends Error {
}
exports.OpenClawGatewayHealthError = OpenClawGatewayHealthError;
let OpenClawGatewayHealthService = class OpenClawGatewayHealthService {
    configService;
    cryptoService;
    constructor(configService, cryptoService) {
        this.configService = configService;
        this.cryptoService = cryptoService;
    }
    async health(gateway) {
        const config = this.getConfig();
        const command = this.buildHealthCommand(this.shouldUseLocalGatewayDefaults(gateway, config.baseUrl)
            ? {}
            : {
                baseUrl: gateway?.base_url,
                token: this.decryptGatewayToken(gateway, config.token),
            });
        return this.runHealthCommand(command);
    }
    async testConnection(baseUrl, token) {
        return this.runHealthCommand(this.buildHealthCommand({
            baseUrl,
            token: this.normalizeTokenValue(token),
        }));
    }
    decryptGatewayToken(gateway, fallbackToken) {
        const encrypted = gateway?.auth_token_encrypted;
        if (!encrypted) {
            return this.normalizeTokenValue(fallbackToken);
        }
        const decrypted = this.cryptoService.tryDecryptString(encrypted);
        return this.normalizeTokenValue(decrypted ?? fallbackToken ?? null);
    }
    normalizeTokenValue(token) {
        if (!token) {
            return null;
        }
        const trimmed = token.trim();
        if (trimmed === '') {
            return null;
        }
        const serializedMatch = /^s:\d+:"(.*)";$/.exec(trimmed);
        return serializedMatch?.[1] ?? trimmed;
    }
    shouldUseLocalGatewayDefaults(gateway, configuredBaseUrl) {
        const baseUrl = gateway?.base_url || configuredBaseUrl;
        if (!baseUrl) {
            return true;
        }
        return ['ws://127.0.0.1:18789', 'ws://localhost:18789'].includes(this.normalizeGatewayUrl(baseUrl));
    }
    normalizeGatewayUrl(baseUrl) {
        const trimmed = baseUrl.trim().replace(/\/+$/, '');
        if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
            return trimmed;
        }
        return trimmed.replace(/^http/i, 'ws');
    }
    buildHealthCommand(params) {
        const command = [
            'gateway',
            'call',
            'health',
            '--json',
            '--timeout',
            '10000',
        ];
        if (params.baseUrl) {
            command.push('--url', this.normalizeGatewayUrl(params.baseUrl));
        }
        if (params.token) {
            command.push('--token', params.token);
        }
        return command;
    }
    async runHealthCommand(command) {
        const cliBin = this.resolveCliBin();
        try {
            const { stdout } = await execFileAsync(cliBin, command, {
                env: {
                    ...process.env,
                    PATH: process.env.PATH ??
                        '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',
                },
            });
            return JSON.parse(this.extractJsonPayload(stdout));
        }
        catch (error) {
            const message = error instanceof Error && error.message.trim() !== ''
                ? error.message
                : 'OpenClaw gateway call failed.';
            throw new OpenClawGatewayHealthError(message);
        }
    }
    extractJsonPayload(output) {
        const trimmed = output.trim();
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start === -1 || end === -1 || end < start) {
            throw new OpenClawGatewayHealthError('OpenClaw returned no JSON payload.');
        }
        return trimmed.slice(start, end + 1);
    }
    resolveCliBin() {
        return process.env.OPENCLAW_CLI_BIN?.trim() || 'openclaw';
    }
    getConfig() {
        return this.configService.getOrThrow('openclaw', {
            infer: true,
        });
    }
};
exports.OpenClawGatewayHealthService = OpenClawGatewayHealthService;
exports.OpenClawGatewayHealthService = OpenClawGatewayHealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        laravel_crypto_service_1.LaravelCryptoService])
], OpenClawGatewayHealthService);
