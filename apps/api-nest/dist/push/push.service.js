"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const webPush = __importStar(require("web-push"));
const push_repository_1 = require("./push.repository");
let PushService = PushService_1 = class PushService {
    repository;
    configService;
    logger = new common_1.Logger(PushService_1.name);
    constructor(repository, configService) {
        this.repository = repository;
        this.configService = configService;
    }
    getPublicKey() {
        if (!this.isConfigured()) {
            throw new common_1.ServiceUnavailableException('Push notifications are not configured.');
        }
        return {
            public_key: this.configService.get('WEBPUSH_VAPID_PUBLIC_KEY'),
        };
    }
    async saveSubscription(actorUserId, userId, payload, userAgent) {
        this.assertOwner(actorUserId, userId);
        if (!this.isConfigured()) {
            throw new common_1.ServiceUnavailableException('Push notifications are not configured.');
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
    async updatePresence(actorUserId, userId, payload) {
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
    async deleteSubscription(actorUserId, userId, payload) {
        this.assertOwner(actorUserId, userId);
        await this.repository.deleteSubscription(userId, payload.endpoint);
    }
    async sendNotification(userId, payload) {
        if (!this.isConfigured()) {
            this.logger.debug('[push] VAPID not configured, skipping notification');
            return;
        }
        const subscriptions = await this.repository.findAllSubscriptionsForUser(userId);
        if (!subscriptions.length)
            return;
        const publicKey = this.configService.get('WEBPUSH_VAPID_PUBLIC_KEY');
        const privateKey = this.configService.get('WEBPUSH_VAPID_PRIVATE_KEY');
        const subject = this.configService.get('WEBPUSH_VAPID_SUBJECT');
        webPush.setVapidDetails(subject, publicKey, privateKey);
        const notificationPayload = JSON.stringify(payload);
        await Promise.all(subscriptions.map(async (sub) => {
            try {
                await webPush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.public_key, auth: sub.auth_token },
                }, notificationPayload);
            }
            catch (err) {
                const status = err.statusCode;
                if (status === 410 || status === 404) {
                    this.logger.log(`[push] Removing stale subscription id=${sub.id}`);
                    await this.repository.deleteSubscription(userId, sub.endpoint);
                }
                else {
                    const errObj = err;
                    this.logger.warn(`[push] Failed to notify subscription id=${sub.id}: ${String(err)} | status=${errObj.statusCode} body=${errObj.body} headers=${JSON.stringify(errObj.headers)}`);
                }
            }
        }));
    }
    isConfigured() {
        return Boolean(this.configService.get('WEBPUSH_VAPID_PUBLIC_KEY')?.trim() &&
            this.configService.get('WEBPUSH_VAPID_PRIVATE_KEY')?.trim() &&
            this.configService.get('WEBPUSH_VAPID_SUBJECT')?.trim());
    }
    assertOwner(actorUserId, userId) {
        if (actorUserId !== userId) {
            throw new common_1.ForbiddenException();
        }
    }
    toPresenceDebug(mode, matchedId, stored) {
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
    logPresenceUpdate(userId, payload, result) {
        this.logger.log(JSON.stringify({
            event: 'push presence update',
            user_id: userId,
            endpoint_prefix: payload.endpoint.slice(0, 80),
            conversation_id: payload.conversation_id ?? null,
            is_visible: payload.is_visible,
            result,
        }));
    }
};
exports.PushService = PushService;
exports.PushService = PushService = PushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [push_repository_1.PushRepository,
        config_1.ConfigService])
], PushService);
