import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenClawConfig } from '../config/openclaw.config';
import { ModelPresetSettingsRecord } from './settings.repository';

type ModelOption = {
  id: string;
  label: string;
  provider: string;
  source: string;
  capabilities: {
    supports_think_level: boolean;
    supports_reasoning_toggle: boolean;
    think_levels: string[];
  };
};

@Injectable()
export class OpenClawModelCatalogService {
  constructor(private readonly configService: ConfigService) {}

  options(settings?: ModelPresetSettingsRecord): ModelOption[] {
    const config = this.getConfig();
    const seedIds = Array.from(
      new Set(
        [
          config.defaultModel,
          config.fastModel,
          config.deepModel,
          settings?.fast_model_id,
          settings?.deep_model_id,
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    const options = new Map<string, ModelOption>();

    for (const id of seedIds) {
      options.set(id, this.buildOption(id, 'openclaw-config'));
    }

    for (const [id, option] of Object.entries(this.curatedOptions())) {
      const existing = options.get(id);
      options.set(id, this.mergeOption(existing, option));
    }

    return [...options.values()].sort(
      (left, right) =>
        left.provider.localeCompare(right.provider) ||
        left.label.localeCompare(right.label),
    );
  }

  optionsPayload(settings?: ModelPresetSettingsRecord): {
    catalog_source: 'openclaw-bridge';
    models: ModelOption[];
  } {
    return {
      catalog_source: 'openclaw-bridge',
      models: this.options(settings),
    };
  }

  settingsPayload(settings: ModelPresetSettingsRecord): {
    catalog_source: 'openclaw-bridge';
    presets: Record<string, unknown>;
    updated_at: string | null;
  } {
    return {
      catalog_source: 'openclaw-bridge',
      presets: {
        fast: this.presetPayload('fast', settings),
        deep: this.presetPayload('deep', settings),
      },
      updated_at: settings.updated_at,
    };
  }

  findOption(
    modelId: string,
    settings?: ModelPresetSettingsRecord,
  ): ModelOption | undefined {
    return this.options(settings).find((option) => option.id === modelId);
  }

  supportsThinkLevel(
    modelId: string,
    settings?: ModelPresetSettingsRecord,
  ): boolean {
    return Boolean(
      this.findOption(modelId, settings)?.capabilities.supports_think_level,
    );
  }

  supportsReasoningToggle(
    modelId: string,
    settings?: ModelPresetSettingsRecord,
  ): boolean {
    return Boolean(
      this.findOption(modelId, settings)?.capabilities.supports_reasoning_toggle,
    );
  }

  allowedThinkLevels(
    modelId: string,
    settings?: ModelPresetSettingsRecord,
  ): string[] {
    return this.findOption(modelId, settings)?.capabilities.think_levels ?? [];
  }

  presetConfig(
    preset: 'fast' | 'deep',
    settings: ModelPresetSettingsRecord,
  ): {
    model_id: string;
    think_level: string | null;
    reasoning_enabled: boolean | null;
  } {
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

  private presetPayload(
    preset: 'fast' | 'deep',
    settings: ModelPresetSettingsRecord,
  ): {
    model_id: string;
    think_level: string | null;
    reasoning_enabled: boolean | null;
    capabilities: ModelOption['capabilities'];
  } {
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

  private curatedOptions(): Record<string, ModelOption> {
    // Read models from openclaw.json — all configured models, primary, fallbacks
    const result: Record<string, ModelOption> = {};
    try {
      const openClawJsonPath = require('node:path').join(require('node:os').homedir(), '.openclaw', 'openclaw.json');
      const raw = require('node:fs').readFileSync(openClawJsonPath, 'utf8');
      const cfg = JSON.parse(raw) as Record<string, unknown>;
      const agents = cfg['agents'] as Record<string, unknown> | undefined;
      const defaults = agents?.['defaults'] as Record<string, unknown> | undefined;

      // Collect all model IDs from openclaw.json
      const modelIds = new Set<string>();

      // Primary model
      const model = defaults?.['model'] as Record<string, unknown> | undefined;
      if (model?.['primary']) modelIds.add(String(model['primary']));

      // Fallbacks
      const fallbacks = model?.['fallbacks'];
      if (Array.isArray(fallbacks)) {
        for (const f of fallbacks) { if (typeof f === 'string') modelIds.add(f); }
      }

      // Configured model entries (agents.defaults.models)
      const models = defaults?.['models'];
      if (models && typeof models === 'object') {
        for (const key of Object.keys(models as Record<string, unknown>)) {
          modelIds.add(key);
        }
      }

      // Build options from all discovered models
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
    } catch { /* fallback to empty — seedIds from config will still appear */ }

    return result;
  }

  private buildOption(
    id: string,
    source: string,
    overrides: Partial<ModelOption> = {},
  ): ModelOption {
    const [provider, model] = this.splitId(id);
    const base: ModelOption = {
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

  private mergeOption(
    existing: ModelOption | undefined,
    incoming: ModelOption,
  ): ModelOption {
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

  private splitId(id: string): [string | null, string] {
    if (!id.includes('/')) {
      return [null, id];
    }

    const [provider, model] = id.split('/', 2);
    return [provider ?? null, model ?? id];
  }

  private humanizeModelLabel(value: string): string {
    return value
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private getConfig(): OpenClawConfig {
    return this.configService.getOrThrow<OpenClawConfig>('openclaw', {
      infer: true,
    });
  }
}
