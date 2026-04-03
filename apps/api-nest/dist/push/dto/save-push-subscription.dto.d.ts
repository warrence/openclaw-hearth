declare class PushSubscriptionKeysDto {
    p256dh: string;
    auth: string;
}
export declare class SavePushSubscriptionDto {
    endpoint: string;
    keys: PushSubscriptionKeysDto;
    contentEncoding?: string | null;
}
export {};
