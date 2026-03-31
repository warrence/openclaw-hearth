import { BadGatewayException, ValidationPipe } from '@nestjs/common';

import { LaravelCryptoService } from '../src/settings/laravel-crypto.service';
import { OpenClawGatewayHealthError } from '../src/settings/openclaw-gateway-health.service';
import { TestGatewayConnectionDto } from '../src/settings/dto/test-gateway-connection.dto';
import { UpdateGatewayConfigDto } from '../src/settings/dto/update-gateway-config.dto';
import { SettingsController } from '../src/settings/settings.controller';
import { SettingsRepository } from '../src/settings/settings.repository';
import { SettingsService } from '../src/settings/settings.service';

describe('Nest gateway config migration slice', () => {
  let repository: {
    clearDefaultGatewayConnections: jest.Mock;
    createGatewayConnection: jest.Mock;
  };
  let gatewayHealthService: {
    testConnection: jest.Mock;
  };
  let cryptoService: {
    encryptString: jest.Mock;
  };
  let service: SettingsService;
  let controller: SettingsController;
  let validationPipe: ValidationPipe;

  beforeEach(() => {
    repository = {
      clearDefaultGatewayConnections: jest.fn(async () => undefined),
      createGatewayConnection: jest.fn(async () => ({
        id: 4,
        name: 'Gateway',
        base_url: 'ws://gateway.test',
        auth_token_encrypted: 'encrypted-token',
        status: 'unknown',
        last_checked_at: null,
        last_error: null,
        is_default: true,
        created_at: '2026-03-25T01:02:03.000Z',
        updated_at: '2026-03-25T01:02:03.000Z',
      })),
    };
    gatewayHealthService = {
      testConnection: jest.fn(async () => ({
        defaultAgentId: 'daughter-aeris',
        agents: [{ agentId: 'daughter-aeris', name: 'Aeris' }],
      })),
    };
    cryptoService = {
      encryptString: jest.fn((value: string) => `encrypted:${value}`),
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'APP_KEY') {
          return 'base64:9GqV1BjQeRjT8H7I3cLk2d1sM0pN4vWxYzAbCdEfGhI=';
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

        throw new Error(`Unexpected config key: ${key}`);
      }),
    };

    service = new SettingsService(
      repository as unknown as SettingsRepository,
      cryptoService as unknown as LaravelCryptoService,
      {
        optionsPayload: jest.fn(),
        settingsPayload: jest.fn(),
      } as never,
      gatewayHealthService as never,
      configService as never,
    );
    controller = new SettingsController(service);
    validationPipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
  });

  it('tests gateway connections and maps failures to the Laravel-compatible payload', async () => {
    const payload = (await validationPipe.transform(
      {
        base_url: 'ws://gateway.test',
        token: 'gateway-token',
      },
      {
        type: 'body',
        metatype: TestGatewayConnectionDto,
      },
    )) as TestGatewayConnectionDto;

    await expect(controller.testGatewayConnection(payload)).resolves.toEqual({
      status: 'online',
      base_url: 'ws://gateway.test',
      default_agent_id: 'daughter-aeris',
      agents: [{ agentId: 'daughter-aeris', name: 'Aeris' }],
      raw: {
        defaultAgentId: 'daughter-aeris',
        agents: [{ agentId: 'daughter-aeris', name: 'Aeris' }],
      },
    });

    gatewayHealthService.testConnection.mockRejectedValueOnce(
      new OpenClawGatewayHealthError('Connection refused'),
    );

    await expect(controller.testGatewayConnection(payload)).rejects.toThrow(
      new BadGatewayException({
        status: 'offline',
        base_url: 'ws://gateway.test',
        message: 'Connection refused',
      }),
    );
  });

  it('updates the default gateway config and stores the encrypted token', async () => {
    const payload = (await validationPipe.transform(
      {
        name: 'Gateway',
        base_url: 'ws://gateway.test',
        token: 'gateway-token',
      },
      {
        type: 'body',
        metatype: UpdateGatewayConfigDto,
      },
    )) as UpdateGatewayConfigDto;

    await expect(controller.updateGatewayConfig(payload)).resolves.toEqual({
      id: 4,
      name: 'Gateway',
      base_url: 'ws://gateway.test',
      auth_token_encrypted: 'encrypted-token',
      status: 'unknown',
      last_checked_at: null,
      last_error: null,
      is_default: true,
      created_at: '2026-03-25T01:02:03.000Z',
      updated_at: '2026-03-25T01:02:03.000Z',
    });

    expect(repository.clearDefaultGatewayConnections).toHaveBeenCalled();
    expect(cryptoService.encryptString).toHaveBeenCalledWith('gateway-token');
    expect(repository.createGatewayConnection).toHaveBeenCalledWith({
      name: 'Gateway',
      baseUrl: 'ws://gateway.test',
      authTokenEncrypted: 'encrypted:gateway-token',
    });
  });
});
