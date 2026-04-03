import { TestGatewayConnectionDto } from './dto/test-gateway-connection.dto';
import { UpdateGatewayConfigDto } from './dto/update-gateway-config.dto';
import { UpdateModelPresetSettingsDto } from './dto/update-model-preset-settings.dto';
import { SettingsService } from './settings.service';
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    getOpenClawModelOptions(): Promise<Record<string, unknown>>;
    getModelPresetSettings(): Promise<Record<string, unknown>>;
    updateModelPresetSettings(body: UpdateModelPresetSettingsDto): Promise<Record<string, unknown>>;
    getGatewayStatus(): Promise<Record<string, unknown>>;
    testGatewayConnection(body: TestGatewayConnectionDto): Promise<Record<string, unknown>>;
    updateGatewayConfig(body: UpdateGatewayConfigDto): Promise<Record<string, unknown>>;
    getAgentDisplayInfo(): {
        agentDisplayName: string;
    };
    getAgentSettings(): Promise<Record<string, unknown>>;
    updateAgentSettings(body: {
        hearthAgentId: string;
    }): Promise<Record<string, unknown>>;
    updateAgentDisplayName(body: {
        name: string;
    }): Promise<Record<string, unknown>>;
    getReminderSettings(): Record<string, unknown>;
    updateReminderSettings(body: {
        critical: {
            enabled: boolean;
            intervalMinutes: number;
            maxRepeats: number;
        };
    }): Record<string, unknown>;
}
