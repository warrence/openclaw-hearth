import { ConfigService } from '@nestjs/config';
import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { UpdatePushPresenceDto } from './dto/update-push-presence.dto';
import { PushRepository, PushSubscriptionRecord } from './push.repository';
export declare class PushService {
    private readonly repository;
    private readonly configService;
    private readonly logger;
    constructor(repository: PushRepository, configService: ConfigService);
    getPublicKey(): {
        public_key: string;
    };
    saveSubscription(actorUserId: number, userId: number, payload: SavePushSubscriptionDto, userAgent?: string): Promise<PushSubscriptionRecord>;
    updatePresence(actorUserId: number, userId: number, payload: UpdatePushPresenceDto): Promise<{
        ok: true;
        debug: Record<string, unknown>;
    }>;
    deleteSubscription(actorUserId: number, userId: number, payload: DeletePushSubscriptionDto): Promise<void>;
    sendNotification(userId: number, payload: {
        title: string;
        body: string;
        conversationId: number;
        url: string;
    }): Promise<void>;
    private isConfigured;
    private assertOwner;
    private toPresenceDebug;
    private logPresenceUpdate;
}
