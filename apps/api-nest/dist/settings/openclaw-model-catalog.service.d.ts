import { ConfigService } from '@nestjs/config';
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
export declare class OpenClawModelCatalogService {
    private readonly configService;
    constructor(configService: ConfigService);
    options(settings?: ModelPresetSettingsRecord): ModelOption[];
    optionsPayload(settings?: ModelPresetSettingsRecord): {
        catalog_source: 'openclaw-bridge';
        models: ModelOption[];
    };
    settingsPayload(settings: ModelPresetSettingsRecord): {
        catalog_source: 'openclaw-bridge';
        presets: Record<string, unknown>;
        updated_at: string | null;
    };
    findOption(modelId: string, settings?: ModelPresetSettingsRecord): ModelOption | undefined;
    supportsThinkLevel(modelId: string, settings?: ModelPresetSettingsRecord): boolean;
    supportsReasoningToggle(modelId: string, settings?: ModelPresetSettingsRecord): boolean;
    allowedThinkLevels(modelId: string, settings?: ModelPresetSettingsRecord): string[];
    presetConfig(preset: 'fast' | 'deep', settings: ModelPresetSettingsRecord): {
        model_id: string;
        think_level: string | null;
        reasoning_enabled: boolean | null;
    };
    private presetPayload;
    private curatedOptions;
    private buildOption;
    private mergeOption;
    private splitId;
    private humanizeModelLabel;
    private getConfig;
}
export {};
