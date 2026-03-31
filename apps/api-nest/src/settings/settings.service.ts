import { BadGatewayException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenClawConfig } from '../config/openclaw.config';
import { TestGatewayConnectionDto } from './dto/test-gateway-connection.dto';
import { UpdateGatewayConfigDto } from './dto/update-gateway-config.dto';
import { UpdateModelPresetSettingsDto } from './dto/update-model-preset-settings.dto';
import { LaravelCryptoService } from './laravel-crypto.service';
import { OpenClawConfigWriterService } from './openclaw-config-writer.service';
import { OpenClawGatewayHealthError, OpenClawGatewayHealthService } from './openclaw-gateway-health.service';
import { OpenClawModelCatalogService } from './openclaw-model-catalog.service';
import {
  ModelPresetSettingsRecord,
  SettingsRepository,
} from './settings.repository';

type PresetPayload = {
  model_id: string;
  think_level: string | null;
  reasoning_enabled: boolean | null;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly cryptoService: LaravelCryptoService,
    private readonly modelCatalog: OpenClawModelCatalogService,
    private readonly gatewayHealthService: OpenClawGatewayHealthService,
    private readonly configService: ConfigService,
    private readonly openClawConfigWriter: OpenClawConfigWriterService,
  ) {}

  async getOpenClawModelOptions(): Promise<Record<string, unknown>> {
    const settings = await this.getModelPresetSettingsRecord();
    return this.modelCatalog.optionsPayload(settings);
  }

  async getModelPresetSettings(): Promise<Record<string, unknown>> {
    return this.modelCatalog.settingsPayload(
      await this.getModelPresetSettingsRecord(),
    );
  }

  async updateModelPresetSettings(
    payload: UpdateModelPresetSettingsDto,
  ): Promise<Record<string, unknown>> {
    const settings = await this.getModelPresetSettingsRecord();
    const fast = this.normalizePresetPayload(payload.presets.fast, settings);
    const deep = this.normalizePresetPayload(payload.presets.deep, settings);
    const defaults = this.getModelDefaults();

    const updated = await this.repository.updateModelPresetSettings(
      settings.id,
      {
        fast_model_id: fast.model_id,
        fast_think_level: fast.think_level,
        fast_reasoning_enabled: fast.reasoning_enabled,
        deep_model_id: deep.model_id,
        deep_think_level: deep.think_level,
        deep_reasoning_enabled: deep.reasoning_enabled,
      },
      defaults,
    );

    // Persist to openclaw.json so the execution service reads from a single source of truth
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
    } catch {
      // Non-fatal — DB is the primary store, openclaw.json is the runtime cache
    }

    return this.modelCatalog.settingsPayload(updated);
  }

  async getAgentSettings(): Promise<Record<string, unknown>> {
    const config = this.getOpenClawConfig();

    // Read current mapping from hearth.json, fall back to env
    const fromJson = this.openClawConfigWriter.get<string>('agentSettings.aeris');
    const currentAerisId = fromJson ?? config.agentMap['aeris'] ?? config.defaultAgentId;

    // Read available agents from openclaw.json
    const openClawJsonPath = require('node:path').join(require('node:os').homedir(), '.openclaw', 'openclaw.json');
    let availableAgents: Array<{ id: string; name: string }> = [];
    try {
      const raw = require('node:fs').readFileSync(openClawJsonPath, 'utf8');
      const cfg = JSON.parse(raw) as Record<string, unknown>;
      const agentList = (cfg['agents'] as Record<string, unknown>)?.['list'];
      if (Array.isArray(agentList)) {
        availableAgents = agentList
          .filter((a) => typeof a === 'object' && a !== null && (a as Record<string, unknown>)['id'])
          .map((a) => ({
            id: String((a as Record<string, unknown>)['id']),
            name: String((a as Record<string, unknown>)['name'] || (a as Record<string, unknown>)['id']),
          }));
      }
    } catch { /* ignore */ }

    // Custom display name from hearth.json takes priority
    const customDisplayName = this.openClawConfigWriter.get<string>('agentDisplayName');
    const currentAgent = availableAgents.find((a) => a.id === currentAerisId);
    const agentDisplayName = customDisplayName || currentAgent?.name || 'Aeris';

    return {
      aerisAgentId: currentAerisId,
      agentDisplayName,
      availableAgents,
    };
  }

  async updateAgentDisplayName(name: string): Promise<Record<string, unknown>> {
    this.openClawConfigWriter.patch({ agentDisplayName: name.trim() || null });
    return this.getAgentSettings();
  }

  getReminderSettings(): Record<string, unknown> {
    const critical = this.openClawConfigWriter.get<Record<string, unknown>>('reminders.critical') ?? {};
    return {
      critical: {
        enabled: critical['enabled'] ?? true,
        intervalMinutes: critical['intervalMinutes'] ?? 1,
        maxRepeats: critical['maxRepeats'] ?? 30,
      },
    };
  }

  updateReminderSettings(critical: { enabled: boolean; intervalMinutes: number; maxRepeats: number }): Record<string, unknown> {
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

  async updateAgentSettings(aerisAgentId: string): Promise<Record<string, unknown>> {
    if (!aerisAgentId?.trim()) {
      throw new Error('aerisAgentId is required');
    }
    this.openClawConfigWriter.patch({
      agentSettings: { aeris: aerisAgentId.trim() },
    });
    return this.getAgentSettings();
  }

  async getGatewayStatus(): Promise<Record<string, unknown>> {
    const gateway = await this.repository.findDefaultGatewayConnection();
    const config = this.getOpenClawConfig();
    const lastCheckedAt = new Date().toISOString();

    try {
      const health = await this.gatewayHealthService.health(gateway);
      const defaultAgentId =
        typeof health.defaultAgentId === 'string' ? health.defaultAgentId : null;

      if (gateway) {
        await this.repository.updateGatewayStatus(
          gateway.id,
          'online',
          lastCheckedAt,
          null,
        );
      }

      const agents = Array.isArray(health.agents) ? health.agents : [];

      return {
        status: 'online',
        base_url: gateway?.base_url ?? config.baseUrl,
        last_checked_at: lastCheckedAt,
        last_error: null,
        agents: agents.map((agent) => {
          const record =
            agent && typeof agent === 'object'
              ? (agent as Record<string, unknown>)
              : {};

          return {
            id:
              typeof record.agentId === 'string' ? record.agentId : null,
            name: typeof record.name === 'string' ? record.name : null,
            status:
              typeof record.agentId === 'string' &&
              record.agentId === defaultAgentId
                ? 'default'
                : 'available',
          };
        }),
        default_agent_id: defaultAgentId,
        default_model:
          this.extractGatewayDefaultModel(health) ?? config.defaultModel,
        raw: health,
      };
    } catch (error) {
      const message =
        error instanceof OpenClawGatewayHealthError || error instanceof Error
          ? error.message
          : 'OpenClaw gateway status failed.';

      if (gateway) {
        await this.repository.updateGatewayStatus(
          gateway.id,
          'offline',
          lastCheckedAt,
          message,
        );
      }

      throw new BadGatewayException({
        status: 'offline',
        base_url: gateway?.base_url ?? config.baseUrl,
        last_checked_at: lastCheckedAt,
        last_error: message,
        agents: [],
        default_model: config.defaultModel,
      });
    }
  }

  async testGatewayConnection(
    payload: TestGatewayConnectionDto,
  ): Promise<Record<string, unknown>> {
    try {
      const health = await this.gatewayHealthService.testConnection(
        payload.base_url,
        payload.token ?? null,
      );

      return {
        status: 'online',
        base_url: payload.base_url,
        default_agent_id:
          typeof health.defaultAgentId === 'string' ? health.defaultAgentId : null,
        agents: Array.isArray(health.agents) ? health.agents : [],
        raw: health,
      };
    } catch (error) {
      const message =
        error instanceof OpenClawGatewayHealthError || error instanceof Error
          ? error.message
          : 'OpenClaw gateway test failed.';

      throw new BadGatewayException({
        status: 'offline',
        base_url: payload.base_url,
        message,
      });
    }
  }

  async updateGatewayConfig(
    payload: UpdateGatewayConfigDto,
  ): Promise<Record<string, unknown>> {
    await this.repository.clearDefaultGatewayConnections();

    return this.repository.createGatewayConnection({
      name: payload.name,
      baseUrl: payload.base_url,
      authTokenEncrypted: this.cryptoService.encryptString(payload.token),
    });
  }

  private async getModelPresetSettingsRecord(): Promise<ModelPresetSettingsRecord> {
    return this.repository.getOrCreateModelPresetSettings(this.getModelDefaults());
  }

  private normalizePresetPayload(
    preset: {
      model_id: string;
      think_level?: string | null;
      reasoning_enabled?: boolean | null;
    },
    settings: ModelPresetSettingsRecord,
  ): PresetPayload {
    const modelId = preset.model_id.trim();
    const option = this.modelCatalog.findOption(modelId, settings);

    if (!option) {
      throw new UnprocessableEntityException({
        message:
          'Selected model is not available from the current OpenClaw bridge catalog.',
        errors: {
          model_id: [
            'Selected model is not available from the current OpenClaw bridge catalog.',
          ],
        },
      });
    }

    let thinkLevel = this.normalizeNullableString(preset.think_level);
    let reasoningEnabled =
      preset.reasoning_enabled === undefined ? null : preset.reasoning_enabled;

    if (!this.modelCatalog.supportsThinkLevel(modelId, settings)) {
      thinkLevel = null;
    } else if (
      thinkLevel !== null &&
      !this.modelCatalog.allowedThinkLevels(modelId, settings).includes(
        thinkLevel,
      )
    ) {
      throw new UnprocessableEntityException({
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

  private normalizeNullableString(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private extractGatewayDefaultModel(
    health: Record<string, unknown>,
  ): string | null {
    const agents = Array.isArray(health.agents) ? health.agents : [];
    const firstAgent =
      agents[0] && typeof agents[0] === 'object'
        ? (agents[0] as Record<string, unknown>)
        : null;
    const sessions =
      firstAgent && Array.isArray(firstAgent.sessions)
        ? firstAgent.sessions
        : firstAgent && typeof firstAgent.sessions === 'object'
          ? (firstAgent.sessions as Record<string, unknown>).recent
          : null;
    const recent = Array.isArray(sessions) ? sessions : [];
    const firstRecent =
      recent[0] && typeof recent[0] === 'object'
        ? (recent[0] as Record<string, unknown>)
        : null;

    return firstRecent && typeof firstRecent.model === 'string'
      ? firstRecent.model
      : null;
  }

  private getModelDefaults(): { fastModel: string; deepModel: string } {
    const config = this.getOpenClawConfig();
    return {
      fastModel: config.fastModel,
      deepModel: config.deepModel,
    };
  }

  private getOpenClawConfig(): OpenClawConfig {
    return this.configService.getOrThrow<OpenClawConfig>('openclaw', {
      infer: true,
    });
  }
}
