import { UnprocessableEntityException } from '@nestjs/common';

import { LaravelCryptoService } from '../src/settings/laravel-crypto.service';
import { OpenClawGatewayHealthService } from '../src/settings/openclaw-gateway-health.service';
import { OpenClawModelCatalogService } from '../src/settings/openclaw-model-catalog.service';
import { SettingsService } from '../src/settings/settings.service';
import { SettingsRepository } from '../src/settings/settings.repository';

describe('SettingsService model presets via hearth.json', () => {
  let service: SettingsService;
  let openClawConfigWriter: { get: jest.Mock; patch: jest.Mock };

  beforeEach(() => {
    process.env.APP_KEY = 'base64:9GqV1BjQeRjT8H7I3cLk2d1sM0pN4vWxYzAbCdEfGhI=';

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'APP_KEY') return process.env.APP_KEY;
        if (key === 'APP_CIPHER') return 'AES-256-CBC';
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'openclaw') {
          return {
            baseUrl: 'ws://gateway.test',
            token: 'gateway-env-token',
            defaultAgentId: 'daughter-aeris',
            defaultModel: 'openai-codex/gpt-5.4',
            fastModel: 'openai-codex/gpt-5.4',
            deepModel: 'anthropic/claude-sonnet-4-5',
            agentTimeoutMs: 900000,
            responsesHttpEnabled: true,
            responsesPath: '/v1/responses',
            agentMap: { aeris: 'daughter-aeris' },
          };
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };

    openClawConfigWriter = {
      get: jest.fn((path: string) => {
        if (path === 'modelPresets.fast') {
          return {
            model: 'openai-codex/gpt-5.4',
            thinkLevel: 'medium',
            reasoningEnabled: true,
          };
        }
        if (path === 'modelPresets.deep') {
          return {
            model: 'anthropic/claude-sonnet-4-5',
            thinkLevel: 'high',
            reasoningEnabled: null,
          };
        }
        return undefined;
      }),
      patch: jest.fn(),
    };

    service = new SettingsService(
      {
        findDefaultGatewayConnection: jest.fn(),
        updateGatewayStatus: jest.fn(),
        clearDefaultGatewayConnections: jest.fn(),
        createGatewayConnection: jest.fn(),
      } as unknown as SettingsRepository,
      new LaravelCryptoService(configService as never),
      new OpenClawModelCatalogService(configService as never),
      { health: jest.fn(), testConnection: jest.fn() } as unknown as OpenClawGatewayHealthService,
      configService as never,
      openClawConfigWriter as never,
    );
  });

  it('reads preset settings from hearth.json-backed config', async () => {
    const settings = await service.getModelPresetSettings() as any;

    expect(settings.presets.fast.model_id).toBe('openai-codex/gpt-5.4');
    expect(settings.presets.fast.think_level).toBe('medium');
    expect(settings.presets.fast.reasoning_enabled).toBe(true);
    expect(settings.presets.deep.model_id).toBe('anthropic/claude-sonnet-4-5');
    expect(settings.presets.deep.think_level).toBe('high');
  });

  it('writes updated preset settings back to hearth.json-backed config', async () => {
    const updated = await service.updateModelPresetSettings({
      presets: {
        fast: {
          model_id: 'openai-codex/gpt-5.4',
          think_level: 'high',
          reasoning_enabled: true,
        },
        deep: {
          model_id: 'anthropic/claude-sonnet-4-5',
          think_level: 'medium',
          reasoning_enabled: true,
        },
      },
    });

    expect(openClawConfigWriter.patch).toHaveBeenCalledWith({
      modelPresets: {
        fast: {
          model: 'openai-codex/gpt-5.4',
          thinkLevel: 'high',
          reasoningEnabled: true,
        },
        deep: {
          model: 'anthropic/claude-sonnet-4-5',
          thinkLevel: null,
          reasoningEnabled: null,
        },
      },
    });
    expect((updated as any).presets.fast.model_id).toBe('openai-codex/gpt-5.4');
  });

  it('rejects unavailable model ids', async () => {
    await expect(
      service.updateModelPresetSettings({
        presets: {
          fast: {
            model_id: 'not-real/provider-model',
            think_level: null,
            reasoning_enabled: null,
          },
          deep: {
            model_id: 'anthropic/claude-sonnet-4-5',
            think_level: null,
            reasoning_enabled: null,
          },
        },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
