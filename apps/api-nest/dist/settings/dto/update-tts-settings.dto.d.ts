export declare class UpdateTtsSettingsDto {
    active_provider?: 'browser' | 'openai' | 'elevenlabs';
    openai_api_key?: string | null;
    openai_default_voice?: string | null;
    elevenlabs_api_key?: string | null;
    elevenlabs_default_voice?: string | null;
}
