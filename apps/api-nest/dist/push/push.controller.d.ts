import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { UpdatePushPresenceDto } from './dto/update-push-presence.dto';
import { PushService } from './push.service';
export declare class PushController {
    private readonly pushService;
    constructor(pushService: PushService);
    getPublicKey(): {
        public_key: string;
    };
    saveSubscription(actorUserId: number, userId: number, body: SavePushSubscriptionDto, userAgent?: string): Promise<import("./push.repository").PushSubscriptionRecord>;
    updatePresence(actorUserId: number, userId: number, body: UpdatePushPresenceDto): Promise<{
        ok: true;
        debug: Record<string, unknown>;
    }>;
    deleteSubscription(actorUserId: number, userId: number, body: DeletePushSubscriptionDto): Promise<void>;
}
