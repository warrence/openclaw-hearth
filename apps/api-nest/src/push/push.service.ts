import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';

import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { UpdatePushPresenceDto } from './dto/update-push-presence.dto';
import { PushRepository, PushSubscriptionRecord } from './push.repository';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly repository: PushRepository,
    private readonly configService: ConfigService,
  ) {}

  getPublicKey(): { public_key: string } {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Push notifications are not configured.',
      );
    }

    return {
      public_key: this.configService.get<string>('WEBPUSH_VAPID_PUBLIC_KEY')!,
    };
  }

  async saveSubscription(
    actorUserId: number,
    userId: number,
    payload: SavePushSubscriptionDto,
    userAgent?: string,
  ): Promise<PushSubscriptionRecord> {
    this.assertOwner(actorUserId, userId);

    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Push notifications are not configured.',
      );
    }

    return this.repository.saveSubscription({
      userId,
      endpoint: payload.endpoint,
      publicKey: payload.keys.p256dh,
      authToken: payload.keys.auth,
      contentEncoding: payload.contentEncoding?.trim() || 'aes128gcm',
      userAgent: userAgent?.trim() || null,
    });
  }

  async updatePresence(
    actorUserId: number,
    userId: number,
    payload: UpdatePushPresenceDto,
  ): Promise<{
    ok: true;
    debug: Record<string, unknown>;
  }> {
    this.assertOwner(actorUserId, userId);

    const exact = await this.repository.updatePresenceExact({
      userId,
      endpoint: payload.endpoint,
      conversationId: payload.conversation_id ?? null,
      isVisible: payload.is_visible,
    });

    if (exact) {
      const debug = this.toPresenceDebug('exact', exact.id, exact);
      this.logPresenceUpdate(userId, payload, debug);
      return { ok: true, debug };
    }

    const fallback = await this.repository.findLatestSubscriptionForUser(userId);

    if (!fallback) {
      const debug = {
        mode: 'none',
        matched_id: null,
        updated: 0,
        stored: null,
      };
      this.logPresenceUpdate(userId, payload, debug);
      return { ok: true, debug };
    }

    const stored = await this.repository.updatePresenceById({
      id: fallback.id,
      conversationId: payload.conversation_id ?? null,
      isVisible: payload.is_visible,
    });
    const debug = this.toPresenceDebug('fallback', stored.id, stored);
    this.logPresenceUpdate(userId, payload, debug);

    return { ok: true, debug };
  }

  async deleteSubscription(
    actorUserId: number,
    userId: number,
    payload: DeletePushSubscriptionDto,
  ): Promise<void> {
    this.assertOwner(actorUserId, userId);
    await this.repository.deleteSubscription(userId, payload.endpoint);
  }

  async sendNotification(
    userId: number,
    payload: {
      title: string;
      body: string;
      conversationId: number;
      url: string;
    },
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.debug('[push] VAPID not configured, skipping notification');
      return;
    }

    const subscriptions =
      await this.repository.findAllSubscriptionsForUser(userId);
    if (!subscriptions.length) return;

    const publicKey =
      this.configService.get<string>('WEBPUSH_VAPID_PUBLIC_KEY')!;
    const privateKey =
      this.configService.get<string>('WEBPUSH_VAPID_PRIVATE_KEY')!;
    const subject =
      this.configService.get<string>('WEBPUSH_VAPID_SUBJECT')!;

    webPush.setVapidDetails(subject, publicKey, privateKey);

    const notificationPayload = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.public_key, auth: sub.auth_token },
            },
            notificationPayload,
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            this.logger.log(
              `[push] Removing stale subscription id=${sub.id}`,
            );
            await this.repository.deleteSubscription(userId, sub.endpoint);
          } else {
            const errObj = err as { statusCode?: number; body?: string; headers?: Record<string, string> };
            this.logger.warn(
              `[push] Failed to notify subscription id=${sub.id}: ${String(err)} | status=${errObj.statusCode} body=${errObj.body} headers=${JSON.stringify(errObj.headers)}`,
            );
          }
        }
      }),
    );
  }

  private isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('WEBPUSH_VAPID_PUBLIC_KEY')?.trim() &&
        this.configService.get<string>('WEBPUSH_VAPID_PRIVATE_KEY')?.trim() &&
        this.configService.get<string>('WEBPUSH_VAPID_SUBJECT')?.trim(),
    );
  }

  private assertOwner(actorUserId: number, userId: number): void {
    if (actorUserId !== userId) {
      throw new ForbiddenException();
    }
  }

  private toPresenceDebug(
    mode: 'exact' | 'fallback',
    matchedId: number,
    stored: PushSubscriptionRecord,
  ): Record<string, unknown> {
    return {
      mode,
      matched_id: matchedId,
      updated: 1,
      stored: {
        id: stored.id,
        current_conversation_id: stored.current_conversation_id,
        is_visible: stored.is_visible,
        presence_seen_at: stored.presence_seen_at,
      },
    };
  }

  private logPresenceUpdate(
    userId: number,
    payload: UpdatePushPresenceDto,
    result: Record<string, unknown>,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'push presence update',
        user_id: userId,
        endpoint_prefix: payload.endpoint.slice(0, 80),
        conversation_id: payload.conversation_id ?? null,
        is_visible: payload.is_visible,
        result,
      }),
    );
  }
}
