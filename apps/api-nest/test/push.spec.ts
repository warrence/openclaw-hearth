import {
  ForbiddenException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';

import { DeletePushSubscriptionDto } from '../src/push/dto/delete-push-subscription.dto';
import { SavePushSubscriptionDto } from '../src/push/dto/save-push-subscription.dto';
import { UpdatePushPresenceDto } from '../src/push/dto/update-push-presence.dto';
import { PushController } from '../src/push/push.controller';
import { PushRepository, PushSubscriptionRecord } from '../src/push/push.repository';
import { PushService } from '../src/push/push.service';

describe('Nest push migration slice', () => {
  let repository: {
    saveSubscription: jest.Mock;
    updatePresenceExact: jest.Mock;
    findLatestSubscriptionForUser: jest.Mock;
    updatePresenceById: jest.Mock;
    deleteSubscription: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let service: PushService;
  let controller: PushController;
  let validationPipe: ValidationPipe;

  const subscription: PushSubscriptionRecord = {
    id: 11,
    user_id: 7,
    endpoint: 'https://push.test/subscriptions/1',
    current_conversation_id: null,
    public_key: 'p256dh-key',
    auth_token: 'auth-key',
    content_encoding: 'aes128gcm',
    is_visible: false,
    user_agent: 'Safari',
    last_used_at: '2026-03-25T01:02:03.000Z',
    presence_seen_at: '2026-03-25T01:02:03.000Z',
    created_at: '2026-03-25T01:02:03.000Z',
    updated_at: '2026-03-25T01:02:03.000Z',
  };

  beforeEach(() => {
    repository = {
      saveSubscription: jest.fn(async () => subscription),
      updatePresenceExact: jest.fn(async () => ({
        ...subscription,
        current_conversation_id: 42,
        is_visible: true,
      })),
      findLatestSubscriptionForUser: jest.fn(async () => subscription),
      updatePresenceById: jest.fn(async () => ({
        ...subscription,
        current_conversation_id: 42,
        is_visible: true,
      })),
      deleteSubscription: jest.fn(async () => undefined),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key.startsWith('WEBPUSH_VAPID_')) {
          return 'configured';
        }

        return undefined;
      }),
    };
    service = new PushService(
      repository as unknown as PushRepository,
      configService as never,
    );
    controller = new PushController(service);
    validationPipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
  });

  it('returns the configured public key and rejects unconfigured installs', () => {
    expect(controller.getPublicKey()).toEqual({ public_key: 'configured' });

    configService.get.mockReturnValueOnce('').mockReturnValueOnce('').mockReturnValueOnce('');

    expect(() => service.getPublicKey()).toThrow(
      new ServiceUnavailableException('Push notifications are not configured.'),
    );
  });

  it('stores push subscriptions for the authenticated owner only', async () => {
    const payload = (await validationPipe.transform(
      {
        endpoint: 'https://push.test/subscriptions/1',
        keys: {
          p256dh: 'p256dh-key',
          auth: 'auth-key',
        },
      },
      {
        type: 'body',
        metatype: SavePushSubscriptionDto,
      },
    )) as SavePushSubscriptionDto;

    const result = await controller.saveSubscription(7, 7, payload, 'Safari');

    expect(result).toEqual(subscription);
    expect(repository.saveSubscription).toHaveBeenCalledWith({
      userId: 7,
      endpoint: 'https://push.test/subscriptions/1',
      publicKey: 'p256dh-key',
      authToken: 'auth-key',
      contentEncoding: 'aes128gcm',
      userAgent: 'Safari',
    });

    await expect(
      controller.saveSubscription(8, 7, payload, 'Safari'),
    ).rejects.toThrow(new ForbiddenException());
  });

  it('updates presence with exact and fallback behavior and supports deletion', async () => {
    const payload = (await validationPipe.transform(
      {
        endpoint: 'https://push.test/subscriptions/1',
        conversation_id: 42,
        is_visible: true,
      },
      {
        type: 'body',
        metatype: UpdatePushPresenceDto,
      },
    )) as UpdatePushPresenceDto;

    await expect(controller.updatePresence(7, 7, payload)).resolves.toEqual({
      ok: true,
      debug: {
        mode: 'exact',
        matched_id: 11,
        updated: 1,
        stored: {
          id: 11,
          current_conversation_id: 42,
          is_visible: true,
          presence_seen_at: '2026-03-25T01:02:03.000Z',
        },
      },
    });

    repository.updatePresenceExact.mockResolvedValueOnce(null);

    await expect(controller.updatePresence(7, 7, payload)).resolves.toEqual({
      ok: true,
      debug: {
        mode: 'fallback',
        matched_id: 11,
        updated: 1,
        stored: {
          id: 11,
          current_conversation_id: 42,
          is_visible: true,
          presence_seen_at: '2026-03-25T01:02:03.000Z',
        },
      },
    });

    repository.updatePresenceExact.mockResolvedValueOnce(null);
    repository.findLatestSubscriptionForUser.mockResolvedValueOnce(null);

    await expect(controller.updatePresence(7, 7, payload)).resolves.toEqual({
      ok: true,
      debug: {
        mode: 'none',
        matched_id: null,
        updated: 0,
        stored: null,
      },
    });

    const deletePayload = (await validationPipe.transform(
      {
        endpoint: 'https://push.test/subscriptions/1',
      },
      {
        type: 'body',
        metatype: DeletePushSubscriptionDto,
      },
    )) as DeletePushSubscriptionDto;

    await expect(
      controller.deleteSubscription(7, 7, deletePayload),
    ).resolves.toBeUndefined();
    expect(repository.deleteSubscription).toHaveBeenCalledWith(
      7,
      'https://push.test/subscriptions/1',
    );
  });
});
