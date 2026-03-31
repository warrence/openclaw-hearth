import {
  BadGatewayException,
  ForbiddenException,
  UnauthorizedException,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';

import { OwnerAuthGuard } from '../src/auth/owner-auth.guard';
import { SessionAuthGuard } from '../src/auth/session-auth.guard';
import { AuthenticatedRequest } from '../src/auth/auth.types';
import { UpdateImageProviderSettingsDto } from '../src/settings/dto/update-image-provider-settings.dto';
import { UpdateModelPresetSettingsDto } from '../src/settings/dto/update-model-preset-settings.dto';
import { UpdateTtsSettingsDto } from '../src/settings/dto/update-tts-settings.dto';
import { LaravelCryptoService } from '../src/settings/laravel-crypto.service';
import { OpenClawGatewayHealthService } from '../src/settings/openclaw-gateway-health.service';
import { OpenClawModelCatalogService } from '../src/settings/openclaw-model-catalog.service';
import { SettingsController } from '../src/settings/settings.controller';
import {
  GatewayConnectionRecord,
  ImageProviderSettingsRecord,
  ModelPresetSettingsRecord,
  SettingsRepository,
  TtsSettingsRecord,
} from '../src/settings/settings.repository';
import { SettingsService } from '../src/settings/settings.service';

const ownerRequest: AuthenticatedRequest = {
  authUser: {
    id: 1,
    name: 'Owner',
    slug: 'owner',
    avatar: null,
    memory_namespace: 'person:owner',
    default_agent_id: 'aeris',
    is_active: true,
    role: 'owner',
    pin_set_at: '2026-03-24T00:00:00.000Z',
    last_login_at: null,
    requires_pin: true,
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
    has_pin: true,
  },
};

const memberRequest: AuthenticatedRequest = {
  authUser: {
    ...ownerRequest.authUser!,
    id: 2,
    role: 'member',
  },
};

const encryptedSecret =
  'eyJpdiI6Im9IS0lwb2tVMG1VbzM4dHRyQk5GMWc9PSIsInZhbHVlIjoiWVB4Q1dJc2lDdVc1eW1XQ3lwMlQ2dz09IiwibWFjIjoiY2Q5MmQ3YzFkMTE0ZjY2YTg5YmQ0NGRlOGY0OTY4YTg2ZWY4ZDE3ZTJjNjYxZWUxNTVmYWU2OWViZjUwYWVkZiIsInRhZyI6IiJ9';

describe('Nest settings/admin migration slice', () => {
  let repository: {
    getOrCreateTtsSettings: jest.Mock;
    updateTtsSettings: jest.Mock;
    getOrCreateImageProviderSettings: jest.Mock;
    updateImageProviderSettings: jest.Mock;
    getOrCreateModelPresetSettings: jest.Mock;
    updateModelPresetSettings: jest.Mock;
    findDefaultGatewayConnection: jest.Mock;
    updateGatewayStatus: jest.Mock;
  };
  let service: SettingsService;
  let controller: SettingsController;
  let gatewayHealthService: { health: jest.Mock };
  let validationPipe: ValidationPipe;
  let sessionAuthGuard: SessionAuthGuard;
  let ownerAuthGuard: OwnerAuthGuard;

  const ttsRecord: TtsSettingsRecord = {
    id: 1,
    active_provider: 'openai',
    openai_api_key_encrypted: encryptedSecret,
    openai_default_voice: 'alloy',
    elevenlabs_api_key_encrypted: encryptedSecret,
    elevenlabs_default_voice: 'Rachel',
    updated_at: '2026-03-25T01:02:03.000Z',
  };

  const imageRecord: ImageProviderSettingsRecord = {
    id: 2,
    active_provider: 'openai',
    openai_api_key_encrypted: encryptedSecret,
    openai_default_model: 'gpt-image-1',
    openai_default_size: '1536x1024',
    openai_default_quality: 'high',
    updated_at: '2026-03-25T01:02:03.000Z',
  };

  const modelRecord: ModelPresetSettingsRecord = {
    id: 3,
    fast_model_id: 'openai/gpt-5.4',
    fast_think_level: 'medium',
    fast_reasoning_enabled: true,
    deep_model_id: 'anthropic/claude-sonnet-4-5',
    deep_think_level: 'high',
    deep_reasoning_enabled: null,
    updated_at: '2026-03-25T01:02:03.000Z',
  };

  const gatewayRecord: GatewayConnectionRecord = {
    id: 5,
    name: 'Default',
    base_url: 'ws://gateway.test',
    auth_token_encrypted: encryptedSecret,
    status: null,
    last_checked_at: null,
    last_error: null,
    is_default: true,
    created_at: '2026-03-25T01:02:03.000Z',
    updated_at: '2026-03-25T01:02:03.000Z',
  };

  beforeEach(() => {
    process.env.APP_KEY = 'base64:9GqV1BjQeRjT8H7I3cLk2d1sM0pN4vWxYzAbCdEfGhI=';

    repository = {
      getOrCreateTtsSettings: jest.fn(async () => ttsRecord),
      updateTtsSettings: jest.fn(async (_id, updates) => ({
        ...ttsRecord,
        ...updates,
      })),
      getOrCreateImageProviderSettings: jest.fn(async () => imageRecord),
      updateImageProviderSettings: jest.fn(async (_id, updates) => ({
        ...imageRecord,
        ...updates,
      })),
      getOrCreateModelPresetSettings: jest.fn(async () => modelRecord),
      updateModelPresetSettings: jest.fn(async (_id, updates) => ({
        ...modelRecord,
        ...updates,
      })),
      findDefaultGatewayConnection: jest.fn(async () => gatewayRecord),
      updateGatewayStatus: jest.fn(async () => undefined),
    };
    gatewayHealthService = {
      health: jest.fn(async () => ({
        defaultAgentId: 'daughter-aeris',
        agents: [
          {
            agentId: 'daughter-aeris',
            name: 'Aeris',
            sessions: {
              recent: [{ model: 'openai-codex/gpt-5.4' }],
            },
          },
        ],
      })),
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'APP_KEY') {
          return process.env.APP_KEY;
        }

        if (key === 'APP_CIPHER') {
          return 'AES-256-CBC';
        }

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

        if (key === 'APP_KEY') {
          return process.env.APP_KEY;
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    };

    service = new SettingsService(
      repository as unknown as SettingsRepository,
      new LaravelCryptoService(configService as never),
      new OpenClawModelCatalogService(configService as never),
      gatewayHealthService as unknown as OpenClawGatewayHealthService,
      configService as never,
    );
    controller = new SettingsController(service);
    validationPipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
    sessionAuthGuard = new SessionAuthGuard();
    ownerAuthGuard = new OwnerAuthGuard();
  });

  it('keeps owner settings routes owner-only and runtime routes session-only', () => {
    expect(allowOwner(ownerRequest)).toBe(true);
    expect(allowSession(memberRequest)).toBe(true);

    expect(() => ownerAuthGuard.canActivate(createHttpContext(memberRequest))).toThrow(
      new ForbiddenException('Owner access required.'),
    );
    expect(() => sessionAuthGuard.canActivate(createHttpContext({}))).toThrow(
      new UnauthorizedException('Unauthenticated.'),
    );
  });

  it('returns TTS owner payloads with masked secrets and runtime payloads without secret metadata', async () => {
    const ownerPayload = await controller.getTtsSettings() as any;
    const runtimePayload = await controller.getTtsRuntimeSettings() as any;
    const updated = await controller.updateTtsSettings({
      active_provider: 'browser',
      openai_api_key: '',
    }) as any;

    expect(ownerPayload.providers).toMatchObject({
      openai: {
        configured: true,
        has_api_key: true,
        api_key_masked: '********',
      },
      elevenlabs: {
        has_api_key: true,
      },
    });
    expect(runtimePayload.providers).toMatchObject({
      openai: {
        configured: true,
        default_voice: 'alloy',
      },
      elevenlabs: {
        configured: true,
      },
    });
    expect(runtimePayload.providers.openai).not.toHaveProperty('has_api_key');
    expect(runtimePayload.providers.openai).not.toHaveProperty('api_key_masked');
    expect(updated.active_provider).toBe('browser');
    expect(updated.providers.openai.has_api_key).toBe(false);
    expect(repository.updateTtsSettings).toHaveBeenCalled();
  });

  it('returns image owner payloads with masked secrets and runtime payloads without secret metadata', async () => {
    const ownerPayload = await controller.getImageProviderSettings() as any;
    const runtimePayload = await controller.getImageProviderRuntimeSettings() as any;
    const updated = await controller.updateImageProviderSettings({
      openai_api_key: '',
      openai_default_size: '',
    }) as any;

    expect(ownerPayload.enabled).toBe(true);
    expect(ownerPayload.providers.openai.api_key_masked).toBe('********');
    expect(runtimePayload.providers.openai).not.toHaveProperty('has_api_key');
    expect(runtimePayload.providers.openai).not.toHaveProperty('api_key_masked');
    expect(updated.providers.openai.has_api_key).toBe(false);
    expect(updated.providers.openai.default_size).toBe('1024x1024');
  });

  it('returns model options/settings and normalizes capability-aware updates', async () => {
    const options = await controller.getOpenClawModelOptions() as any;
    const settings = await controller.getModelPresetSettings() as any;
    const updated = await controller.updateModelPresetSettings({
      presets: {
        fast: {
          model_id: 'openai/gpt-5.4',
          think_level: 'high',
          reasoning_enabled: true,
        },
        deep: {
          model_id: 'anthropic/claude-sonnet-4-5',
          think_level: 'medium',
          reasoning_enabled: true,
        },
      },
    }) as any;

    expect(options.catalog_source).toBe('openclaw-bridge');
    expect(Array.isArray(options.models)).toBe(true);
    expect(settings.presets.fast.model_id).toBe('openai/gpt-5.4');
    expect(updated.presets.fast.reasoning_enabled).toBe(true);
    expect(updated.presets.deep.reasoning_enabled).toBeNull();
    await expect(
      controller.updateModelPresetSettings({
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

  it('returns gateway status and persists heartbeat state', async () => {
    const payload = await controller.getGatewayStatus() as any;

    expect(payload).toMatchObject({
      status: 'online',
      base_url: 'ws://gateway.test',
      default_agent_id: 'daughter-aeris',
      default_model: 'openai-codex/gpt-5.4',
    });
    expect(payload.agents).toEqual([
      {
        id: 'daughter-aeris',
        name: 'Aeris',
        status: 'default',
      },
    ]);
    expect(repository.updateGatewayStatus).toHaveBeenCalledWith(
      5,
      'online',
      expect.any(String),
      null,
    );
  });

  it('surfaces gateway failures as 502 payloads and persists the offline state', async () => {
    gatewayHealthService.health.mockRejectedValueOnce(new Error('Gateway down'));

    await expect(controller.getGatewayStatus()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(repository.updateGatewayStatus).toHaveBeenCalledWith(
      5,
      'offline',
      expect.any(String),
      'Gateway down',
    );
  });

  it('validates settings DTOs with Laravel-like constraints', async () => {
    await expect(
      validationPipe.transform(
        { active_provider: 'invalid' },
        {
          type: 'body',
          metatype: UpdateTtsSettingsDto,
        },
      ),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      validationPipe.transform(
        { active_provider: 'bad' },
        {
          type: 'body',
          metatype: UpdateImageProviderSettingsDto,
        },
      ),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      validationPipe.transform(
        {
          presets: {
            fast: { model_id: 'openai/gpt-5.4' },
          },
        },
        {
          type: 'body',
          metatype: UpdateModelPresetSettingsDto,
        },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

function allowOwner(request: AuthenticatedRequest): boolean {
  const sessionAuthGuard = new SessionAuthGuard();
  const ownerAuthGuard = new OwnerAuthGuard();

  expect(sessionAuthGuard.canActivate(createHttpContext(request))).toBe(true);
  return ownerAuthGuard.canActivate(createHttpContext(request));
}

function allowSession(request: AuthenticatedRequest): boolean {
  return new SessionAuthGuard().canActivate(createHttpContext(request));
}

function createHttpContext(request: AuthenticatedRequest) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}
