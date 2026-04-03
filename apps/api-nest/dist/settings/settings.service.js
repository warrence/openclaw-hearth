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
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const laravel_crypto_service_1 = require("./laravel-crypto.service");
const openclaw_config_writer_service_1 = require("./openclaw-config-writer.service");
const openclaw_gateway_health_service_1 = require("./openclaw-gateway-health.service");
const openclaw_model_catalog_service_1 = require("./openclaw-model-catalog.service");
const settings_repository_1 = require("./settings.repository");
let SettingsService = class SettingsService {
    repository;
    cryptoService;
    modelCatalog;
    gatewayHealthService;
    configService;
    openClawConfigWriter;
    constructor(repository, cryptoService, modelCatalog, gatewayHealthService, configService, openClawConfigWriter) {
        this.repository = repository;
        this.cryptoService = cryptoService;
        this.modelCatalog = modelCatalog;
        this.gatewayHealthService = gatewayHealthService;
        this.configService = configService;
        this.openClawConfigWriter = openClawConfigWriter;
    }
    async getOpenClawModelOptions() {
        const settings = await this.getModelPresetSettingsRecord();
        return this.modelCatalog.optionsPayload(settings);
    }
    async getModelPresetSettings() {
        return this.modelCatalog.settingsPayload(await this.getModelPresetSettingsRecord());
    }
    async updateModelPresetSettings(payload) {
        const settings = await this.getModelPresetSettingsRecord();
        const fast = this.normalizePresetPayload(payload.presets.fast, settings);
        const deep = this.normalizePresetPayload(payload.presets.deep, settings);
        const defaults = this.getModelDefaults();
        const updated = await this.repository.updateModelPresetSettings(settings.id, {
            fast_model_id: fast.model_id,
            fast_think_level: fast.think_level,
            fast_reasoning_enabled: fast.reasoning_enabled,
            deep_model_id: deep.model_id,
            deep_think_level: deep.think_level,
            deep_reasoning_enabled: deep.reasoning_enabled,
        }, defaults);
        try {
            this.openClawConfigWriter.patch({
                modelPresets: {
                    fast: {
                        model: fast.model_id,
                        thinkLevel: fast.think_level ?? null,
                        reasoningEnabled: fast.reasoning_enabled ?? null,
                    },
                    deep: {
                        model: deep.model_id,
                        thinkLevel: deep.think_level ?? null,
                        reasoningEnabled: deep.reasoning_enabled ?? null,
                    },
                },
            });
        }
        catch {
        }
        return this.modelCatalog.settingsPayload(updated);
    }
    getAgentDisplayName() {
        return this.openClawConfigWriter.get('agentDisplayName') || 'Assistant';
    }
    async getAgentSettings() {
        const config = this.getOpenClawConfig();
        const fromJson = this.openClawConfigWriter.get('agentSettings.agent');
        const currentAgentId = fromJson ?? config.agentMap['main'] ?? config.defaultAgentId;
        const openClawJsonPath = require('node:path').join(require('node:os').homedir(), '.openclaw', 'openclaw.json');
        let availableAgents = [];
        try {
            const raw = require('node:fs').readFileSync(openClawJsonPath, 'utf8');
            const cfg = JSON.parse(raw);
            const agentList = cfg['agents']?.['list'];
            if (Array.isArray(agentList)) {
                availableAgents = agentList
                    .filter((a) => typeof a === 'object' && a !== null && a['id'])
                    .map((a) => ({
                    id: String(a['id']),
                    name: String(a['name'] || a['id']),
                }));
            }
        }
        catch { }
        const customDisplayName = this.openClawConfigWriter.get('agentDisplayName');
        const currentAgent = availableAgents.find((a) => a.id === currentAgentId);
        const agentDisplayName = customDisplayName || currentAgent?.name || 'Assistant';
        return {
            hearthAgentId: currentAgentId,
            agentDisplayName,
            availableAgents,
        };
    }
    async updateAgentDisplayName(name) {
        this.openClawConfigWriter.patch({ agentDisplayName: name.trim() || null });
        return this.getAgentSettings();
    }
    getReminderSettings() {
        const critical = this.openClawConfigWriter.get('reminders.critical') ?? {};
        return {
            critical: {
                enabled: critical['enabled'] ?? true,
                intervalMinutes: critical['intervalMinutes'] ?? 1,
                maxRepeats: critical['maxRepeats'] ?? 30,
            },
        };
    }
    updateReminderSettings(critical) {
        this.openClawConfigWriter.patch({
            reminders: {
                critical: {
                    enabled: critical.enabled,
                    intervalMinutes: Math.max(1, Math.min(30, critical.intervalMinutes)),
                    maxRepeats: Math.max(1, Math.min(100, critical.maxRepeats)),
                },
            },
        });
        return this.getReminderSettings();
    }
    async updateAgentSettings(hearthAgentId) {
        if (!hearthAgentId?.trim()) {
            throw new Error('hearthAgentId is required');
        }
        this.openClawConfigWriter.patch({
            agentSettings: { agent: hearthAgentId.trim() },
        });
        return this.getAgentSettings();
    }
    async getGatewayStatus() {
        const gateway = await this.repository.findDefaultGatewayConnection();
        const config = this.getOpenClawConfig();
        const lastCheckedAt = new Date().toISOString();
        try {
            const health = await this.gatewayHealthService.health(gateway);
            const defaultAgentId = typeof health.defaultAgentId === 'string' ? health.defaultAgentId : null;
            if (gateway) {
                await this.repository.updateGatewayStatus(gateway.id, 'online', lastCheckedAt, null);
            }
            const agents = Array.isArray(health.agents) ? health.agents : [];
            return {
                status: 'online',
                base_url: gateway?.base_url ?? config.baseUrl,
                last_checked_at: lastCheckedAt,
                last_error: null,
                agents: agents.map((agent) => {
                    const record = agent && typeof agent === 'object'
                        ? agent
                        : {};
                    return {
                        id: typeof record.agentId === 'string' ? record.agentId : null,
                        name: typeof record.name === 'string' ? record.name : null,
                        status: typeof record.agentId === 'string' &&
                            record.agentId === defaultAgentId
                            ? 'default'
                            : 'available',
                    };
                }),
                default_agent_id: defaultAgentId,
                default_model: this.extractGatewayDefaultModel(health) ?? config.defaultModel,
                raw: health,
            };
        }
        catch (error) {
            const message = error instanceof openclaw_gateway_health_service_1.OpenClawGatewayHealthError || error instanceof Error
                ? error.message
                : 'OpenClaw gateway status failed.';
            if (gateway) {
                await this.repository.updateGatewayStatus(gateway.id, 'offline', lastCheckedAt, message);
            }
            throw new common_1.BadGatewayException({
                status: 'offline',
                base_url: gateway?.base_url ?? config.baseUrl,
                last_checked_at: lastCheckedAt,
                last_error: message,
                agents: [],
                default_model: config.defaultModel,
            });
        }
    }
    async testGatewayConnection(payload) {
        try {
            const health = await this.gatewayHealthService.testConnection(payload.base_url, payload.token ?? null);
            return {
                status: 'online',
                base_url: payload.base_url,
                default_agent_id: typeof health.defaultAgentId === 'string' ? health.defaultAgentId : null,
                agents: Array.isArray(health.agents) ? health.agents : [],
                raw: health,
            };
        }
        catch (error) {
            const message = error instanceof openclaw_gateway_health_service_1.OpenClawGatewayHealthError || error instanceof Error
                ? error.message
                : 'OpenClaw gateway test failed.';
            throw new common_1.BadGatewayException({
                status: 'offline',
                base_url: payload.base_url,
                message,
            });
        }
    }
    async updateGatewayConfig(payload) {
        await this.repository.clearDefaultGatewayConnections();
        return this.repository.createGatewayConnection({
            name: payload.name,
            baseUrl: payload.base_url,
            authTokenEncrypted: this.cryptoService.encryptString(payload.token),
        });
    }
    async getModelPresetSettingsRecord() {
        return this.repository.getOrCreateModelPresetSettings(this.getModelDefaults());
    }
    normalizePresetPayload(preset, settings) {
        const modelId = preset.model_id.trim();
        const option = this.modelCatalog.findOption(modelId, settings);
        if (!option) {
            throw new common_1.UnprocessableEntityException({
                message: 'Selected model is not available from the current OpenClaw bridge catalog.',
                errors: {
                    model_id: [
                        'Selected model is not available from the current OpenClaw bridge catalog.',
                    ],
                },
            });
        }
        let thinkLevel = this.normalizeNullableString(preset.think_level);
        let reasoningEnabled = preset.reasoning_enabled === undefined ? null : preset.reasoning_enabled;
        if (!this.modelCatalog.supportsThinkLevel(modelId, settings)) {
            thinkLevel = null;
        }
        else if (thinkLevel !== null &&
            !this.modelCatalog.allowedThinkLevels(modelId, settings).includes(thinkLevel)) {
            throw new common_1.UnprocessableEntityException({
                message: 'Selected think level is not supported for this model.',
                errors: {
                    think_level: ['Selected think level is not supported for this model.'],
                },
            });
        }
        if (!this.modelCatalog.supportsReasoningToggle(modelId, settings)) {
            reasoningEnabled = null;
        }
        return {
            model_id: modelId,
            think_level: thinkLevel,
            reasoning_enabled: reasoningEnabled,
        };
    }
    normalizeNullableString(value) {
        if (value === null || value === undefined) {
            return null;
        }
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    }
    extractGatewayDefaultModel(health) {
        const agents = Array.isArray(health.agents) ? health.agents : [];
        const firstAgent = agents[0] && typeof agents[0] === 'object'
            ? agents[0]
            : null;
        const sessions = firstAgent && Array.isArray(firstAgent.sessions)
            ? firstAgent.sessions
            : firstAgent && typeof firstAgent.sessions === 'object'
                ? firstAgent.sessions.recent
                : null;
        const recent = Array.isArray(sessions) ? sessions : [];
        const firstRecent = recent[0] && typeof recent[0] === 'object'
            ? recent[0]
            : null;
        return firstRecent && typeof firstRecent.model === 'string'
            ? firstRecent.model
            : null;
    }
    getModelDefaults() {
        const config = this.getOpenClawConfig();
        return {
            fastModel: config.fastModel,
            deepModel: config.deepModel,
        };
    }
    getOpenClawConfig() {
        return this.configService.getOrThrow('openclaw', {
            infer: true,
        });
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_repository_1.SettingsRepository,
        laravel_crypto_service_1.LaravelCryptoService,
        openclaw_model_catalog_service_1.OpenClawModelCatalogService,
        openclaw_gateway_health_service_1.OpenClawGatewayHealthService,
        config_1.ConfigService,
        openclaw_config_writer_service_1.OpenClawConfigWriterService])
], SettingsService);
