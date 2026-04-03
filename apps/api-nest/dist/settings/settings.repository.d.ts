import { DatabaseService } from '../database/database.service';
export type ModelPresetSettingsRecord = {
    id: number;
    fast_model_id: string;
    fast_think_level: string | null;
    fast_reasoning_enabled: boolean | null;
    deep_model_id: string;
    deep_think_level: string | null;
    deep_reasoning_enabled: boolean | null;
    updated_at: string | null;
};
export type GatewayConnectionRecord = {
    id: number;
    name: string;
    base_url: string;
    auth_token_encrypted: string | null;
    status: string | null;
    last_checked_at: string | null;
    last_error: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
};
export declare class SettingsRepository {
    private readonly databaseService;
    constructor(databaseService: DatabaseService);
    getOrCreateModelPresetSettings(defaults: {
        fastModel: string;
        deepModel: string;
    }): Promise<ModelPresetSettingsRecord>;
    updateModelPresetSettings(recordId: number, updates: Pick<ModelPresetSettingsRecord, 'fast_model_id' | 'fast_think_level' | 'fast_reasoning_enabled' | 'deep_model_id' | 'deep_think_level' | 'deep_reasoning_enabled'>, defaults: {
        fastModel: string;
        deepModel: string;
    }): Promise<ModelPresetSettingsRecord>;
    findDefaultGatewayConnection(): Promise<GatewayConnectionRecord | null>;
    updateGatewayStatus(recordId: number, status: string, lastCheckedAt: string, lastError: string | null): Promise<void>;
    clearDefaultGatewayConnections(): Promise<void>;
    createGatewayConnection(params: {
        name: string;
        baseUrl: string;
        authTokenEncrypted: string;
    }): Promise<GatewayConnectionRecord>;
    private mapModelPresetSettingsRow;
    private mapGatewayConnectionRow;
    private toIsoString;
}
