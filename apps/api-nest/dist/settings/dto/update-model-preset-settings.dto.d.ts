declare class ModelPresetDto {
    model_id: string;
    think_level?: string | null;
    reasoning_enabled?: boolean | null;
}
declare class ModelPresetsDto {
    fast: ModelPresetDto;
    deep: ModelPresetDto;
}
export declare class UpdateModelPresetSettingsDto {
    presets: ModelPresetsDto;
}
export {};
