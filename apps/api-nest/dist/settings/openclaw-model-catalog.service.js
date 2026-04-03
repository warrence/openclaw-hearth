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
exports.OpenClawModelCatalogService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let OpenClawModelCatalogService = class OpenClawModelCatalogService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    options(settings) {
        const config = this.getConfig();
        const seedIds = Array.from(new Set([
            config.defaultModel,
            config.fastModel,
            config.deepModel,
            settings?.fast_model_id,
            settings?.deep_model_id,
        ].filter((value) => Boolean(value))));
        const options = new Map();
        for (const id of seedIds) {
            options.set(id, this.buildOption(id, 'openclaw-config'));
        }
        for (const [id, option] of Object.entries(this.curatedOptions())) {
            const existing = options.get(id);
            options.set(id, this.mergeOption(existing, option));
        }
        return [...options.values()].sort((left, right) => left.provider.localeCompare(right.provider) ||
            left.label.localeCompare(right.label));
    }
    optionsPayload(settings) {
        return {
            catalog_source: 'openclaw-bridge',
            models: this.options(settings),
        };
    }
    settingsPayload(settings) {
        return {
            catalog_source: 'openclaw-bridge',
            presets: {
                fast: this.presetPayload('fast', settings),
                deep: this.presetPayload('deep', settings),
            },
            updated_at: settings.updated_at,
        };
    }
    findOption(modelId, settings) {
        return this.options(settings).find((option) => option.id === modelId);
    }
    supportsThinkLevel(modelId, settings) {
        return Boolean(this.findOption(modelId, settings)?.capabilities.supports_think_level);
    }
    supportsReasoningToggle(modelId, settings) {
        return Boolean(this.findOption(modelId, settings)?.capabilities.supports_reasoning_toggle);
    }
    allowedThinkLevels(modelId, settings) {
        return this.findOption(modelId, settings)?.capabilities.think_levels ?? [];
    }
    presetConfig(preset, settings) {
        const config = this.getConfig();
        const defaults = {
            fast: {
                model_id: config.fastModel,
                think_level: null,
                reasoning_enabled: null,
            },
            deep: {
                model_id: config.deepModel,
                think_level: null,
                reasoning_enabled: null,
            },
        };
        if (preset === 'fast') {
            return {
                model_id: settings.fast_model_id || defaults.fast.model_id,
                think_level: settings.fast_think_level,
                reasoning_enabled: settings.fast_reasoning_enabled,
            };
        }
        return {
            model_id: settings.deep_model_id || defaults.deep.model_id,
            think_level: settings.deep_think_level,
            reasoning_enabled: settings.deep_reasoning_enabled,
        };
    }
    presetPayload(preset, settings) {
        const config = this.presetConfig(preset, settings);
        const model = config.model_id
            ? this.findOption(config.model_id, settings)
            : undefined;
        return {
            model_id: config.model_id,
            think_level: config.think_level,
            reasoning_enabled: config.reasoning_enabled,
            capabilities: model?.capabilities ?? {
                supports_think_level: false,
                supports_reasoning_toggle: false,
                think_levels: [],
            },
        };
    }
    curatedOptions() {
        const result = {};
        try {
            const openClawJsonPath = require('node:path').join(require('node:os').homedir(), '.openclaw', 'openclaw.json');
            const raw = require('node:fs').readFileSync(openClawJsonPath, 'utf8');
            const cfg = JSON.parse(raw);
            const agents = cfg['agents'];
            const defaults = agents?.['defaults'];
            const modelIds = new Set();
            const model = defaults?.['model'];
            if (model?.['primary'])
                modelIds.add(String(model['primary']));
            const fallbacks = model?.['fallbacks'];
            if (Array.isArray(fallbacks)) {
                for (const f of fallbacks) {
                    if (typeof f === 'string')
                        modelIds.add(f);
                }
            }
            const models = defaults?.['models'];
            if (models && typeof models === 'object') {
                for (const key of Object.keys(models)) {
                    modelIds.add(key);
                }
            }
            for (const id of modelIds) {
                const isAnthropic = id.includes('anthropic') || id.includes('claude');
                const isOpenAI = id.includes('openai') || id.includes('gpt');
                result[id] = this.buildOption(id, 'openclaw-config', {
                    capabilities: {
                        supports_think_level: isOpenAI || isAnthropic,
                        supports_reasoning_toggle: isOpenAI,
                        think_levels: (isOpenAI || isAnthropic) ? ['low', 'medium', 'high'] : [],
                    },
                });
            }
        }
        catch { }
        return result;
    }
    buildOption(id, source, overrides = {}) {
        const [provider, model] = this.splitId(id);
        const base = {
            id,
            label: this.humanizeModelLabel(model || id),
            provider: provider || 'unknown',
            source,
            capabilities: {
                supports_think_level: false,
                supports_reasoning_toggle: false,
                think_levels: [],
            },
        };
        return {
            ...base,
            ...overrides,
            capabilities: {
                ...base.capabilities,
                ...(overrides.capabilities ?? {}),
            },
        };
    }
    mergeOption(existing, incoming) {
        if (!existing) {
            return incoming;
        }
        return {
            ...existing,
            ...incoming,
            capabilities: {
                ...existing.capabilities,
                ...incoming.capabilities,
            },
        };
    }
    splitId(id) {
        if (!id.includes('/')) {
            return [null, id];
        }
        const [provider, model] = id.split('/', 2);
        return [provider ?? null, model ?? id];
    }
    humanizeModelLabel(value) {
        return value
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (match) => match.toUpperCase());
    }
    getConfig() {
        return this.configService.getOrThrow('openclaw', {
            infer: true,
        });
    }
};
exports.OpenClawModelCatalogService = OpenClawModelCatalogService;
exports.OpenClawModelCatalogService = OpenClawModelCatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenClawModelCatalogService);
