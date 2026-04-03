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
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_service_1 = require("../database/database.service");
let HealthService = class HealthService {
    databaseService;
    configService;
    constructor(databaseService, configService) {
        this.databaseService = databaseService;
        this.configService = configService;
    }
    async getStatus() {
        const appConfiguration = this.configService.get('app', {
            infer: true,
        });
        const dbConfiguration = this.configService.get('database', {
            infer: true,
        });
        const databaseStatus = await this.databaseService
            .check()
            .catch(() => 'down');
        const openclawConfig = this.configService.get('openclaw', { infer: true });
        const openclawStatus = await this.checkOpenClaw(openclawConfig);
        const allUp = databaseStatus === 'up' && openclawStatus.status === 'connected';
        return {
            status: allUp ? 'ok' : 'degraded',
            service: appConfiguration?.name ?? 'hearth-api-nest',
            environment: appConfiguration?.environment ?? 'development',
            database: {
                status: databaseStatus,
                database: dbConfiguration?.name ?? 'hearth',
                host: dbConfiguration?.host ?? '127.0.0.1',
                port: dbConfiguration?.port ?? 5432,
                schema: dbConfiguration?.schema ?? 'public',
            },
            openclaw: openclawStatus,
        };
    }
    async checkOpenClaw(config) {
        const url = config?.baseUrl;
        if (!url || !config?.token) {
            return { status: 'not_configured' };
        }
        try {
            const res = await fetch(`${url}/health`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) {
                return { status: 'disconnected', url };
            }
            try {
                const testRes = await fetch(`${url}/v1/responses`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${config.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'openclaw',
                        input: 'test',
                        max_output_tokens: 1,
                    }),
                    signal: AbortSignal.timeout(3000),
                });
                if (testRes.status === 404 || testRes.status === 422) {
                    const body = await testRes.json().catch(() => ({}));
                    const msg = String(body.error ?? body.message ?? '');
                    if (msg.includes('model') || msg.includes('provider') || msg.includes('No auth')) {
                        return { status: 'no_model', url };
                    }
                }
            }
            catch {
            }
            return { status: 'connected', url };
        }
        catch {
            return { status: 'disconnected', url };
        }
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        config_1.ConfigService])
], HealthService);
